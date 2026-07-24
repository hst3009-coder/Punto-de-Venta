/**
 * Pasos de despliegue:
 * 1. cd functions && npm install
 * 2. Requiere plan Blaze activo en Firebase Console
 * 3. Desde la raíz del proyecto: firebase deploy --only functions
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

function getAdminDb() {
  const dbId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-puntodeventa-9270ce54-a192-43a7-827f-3c9856c14e1b';
  try {
    return getFirestore(dbId);
  } catch (err) {
    logger.warn(`No se pudo conectar a la base de datos ${dbId}, usando base de datos por defecto:`, err);
    return getFirestore();
  }
}

export const recalculateStockLevels = onSchedule(
  {
    schedule: '0 0 1 1,4,7,10 *',
    timeZone: 'America/Santo_Domingo',
  },
  async () => {
    logger.info('Iniciando recalculación automática trimestral de minStock y maxStock...');

    const db = getAdminDb();
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 1. Leer productos elegibles (excluyendo visible: false y category: 'Genérico')
    const productsSnapshot = await db.collection('products').get();
    const eligibleProducts = productsSnapshot.docs.filter((docSnap) => {
      const data = docSnap.data();
      if (data.visible === false) return false;
      if (data.category === 'Genérico') return false;
      return true;
    });

    logger.info(`Se encontraron ${eligibleProducts.length} productos elegibles para recalcular stock.`);

    // 2. Leer ventas de los últimos 90 días
    const salesSnapshot = await db.collection('sales').get();
    const productQuantityMap = new Map<string, number>();

    salesSnapshot.docs.forEach((saleDoc) => {
      const sale = saleDoc.data();
      if (sale.isCancelled) return;

      const saleDateStr = sale.createdAt || sale.date;
      if (!saleDateStr) return;

      const saleTime = new Date(saleDateStr).getTime();
      if (isNaN(saleTime) || saleTime < ninetyDaysAgo.getTime()) return;

      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const prodId = item?.product?.id || item?.productId;
          if (!prodId) return;

          const qty = Number(item.quantity) || 0;
          const currentQty = productQuantityMap.get(prodId) || 0;
          productQuantityMap.set(prodId, currentQty + qty);
        });
      }
    });

    // 3. Calcular minStock / maxStock y preparar escrituras en lotes (máximo 400 por batch)
    let updatedCount = 0;
    let currentBatch = db.batch();
    let operationCount = 0;

    for (const prodDoc of eligibleProducts) {
      const prodId = prodDoc.id;
      const totalQtySold = productQuantityMap.get(prodId) || 0;
      const avgDailySales = totalQtySold / 90;

      // Si avgDailySales es 0 (sin ventas en los últimos 90 días), no se modifica minStock/maxStock
      // y se deja el producto con sus valores conservadores actuales sin realizar escritura.
      if (avgDailySales <= 0) {
        continue;
      }

      const minStock = Math.ceil(avgDailySales * 10);
      const maxStock = Math.ceil(avgDailySales * 30);

      currentBatch.update(prodDoc.ref, {
        minStock,
        maxStock,
      });

      operationCount++;
      updatedCount++;

      if (operationCount >= 400) {
        await currentBatch.commit();
        currentBatch = db.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await currentBatch.commit();
    }

    logger.info(
      `Recalculación de niveles de stock completada exitosamente. Se actualizaron ${updatedCount} productos de un total de ${eligibleProducts.length} elegibles.`
    );
  }
);
