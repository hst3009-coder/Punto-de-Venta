import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to initialize Gemini SDK on demand
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Route: AI Category Suggestion
  app.post('/api/suggest-category', async (req, res) => {
    try {
      const { productName, categories } = req.body;
      if (!productName || typeof productName !== 'string' || !productName.trim()) {
        return res.status(400).json({ error: 'Product name is required' });
      }

      const ai = getGeminiClient();

      const categoriesListText = Array.isArray(categories) && categories.length > 0
        ? categories.map((c: any) => `- ${c.name} (id: ${c.id})`).join('\n')
        : 'Sin categorías preexistentes';

      const prompt = `Tienes las siguientes categorías existentes en el catálogo de productos de una tienda:
${categoriesListText}

Nombre del nuevo producto a clasificar: "${productName.trim()}"

Por favor sugiere la categoría más adecuada para este producto. Si coincide bien con una categoría existente de la lista, responde exactamente con el nombre de esa categoría. Si ninguna de las categorías existentes encaja bien, sugiere una categoría nueva apropiada en español.

REGLAS OBLIGATORIAS:
- Responde ÚNICAMENTE en una sola línea con el nombre de la categoría (ejemplo: "Cuidado Capilar" o "Electrónica").
- NO agregues introducciones, ni saludos, ni explicaciones, ni puntos finales extra, ni comillas, ni marcas de formato markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      const rawText = response.text || '';
      const suggestion = rawText.trim().replace(/^["'`]+|["'`]+$/g, '');

      return res.json({ suggestion });
    } catch (err: any) {
      console.error('Error in /api/suggest-category:', err);
      return res.status(500).json({ error: err.message || 'Failed to generate category suggestion' });
    }
  });

  // API Route: AI Restock Summary
  app.post('/api/suggest-restock-summary', async (req, res) => {
    try {
      const { suggestions } = req.body;
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return res.status(400).json({ error: 'Suggestions array is required and cannot be empty.' });
      }

      const ai = getGeminiClient();

      const itemsText = suggestions.map((item: any, i: number) => {
        return `${i + 1}. Producto: "${item.productName}", Stock actual: ${item.currentStock}, Cobertura restante: ${item.daysOfCoverage?.toFixed(1) || '0'} días, Cantidad sugerida a pedir: ${item.suggestedQty}${item.supplierName ? `, Proveedor: ${item.supplierName}` : ''}`;
      }).join('\n');

      const prompt = `A continuación tienes la lista de productos que requieren reabastecimiento en un punto de venta (calculados matemáticamente con base en el ritmo real de ventas):

${itemsText}

Por favor redacta un párrafo corto y ejecutivo en español que resuma la situación general de reabastecimiento.
Destaca los productos con menor cobertura de días y ofrece una breve recomendación práctica para el encargado de compras.

REGLAS OBLIGATORIAS:
- No realices nuevos cálculos matemáticos; usa estrictamente los datos proporcionados.
- Sé breve, directo y profesional (entre 2 y 4 oraciones).
- No uses títulos ni listas en viñetas, sólo un párrafo fluido de texto.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      const summary = (response.text || '').trim();
      return res.json({ summary });
    } catch (err: any) {
      console.error('Error in /api/suggest-restock-summary:', err);
      return res.status(500).json({ error: err.message || 'Failed to generate restock summary' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
