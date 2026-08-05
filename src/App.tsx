import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Product, Category, CartItem, Sale, StoreIdentity, PendingSale, Employee, Customer, CustomerPayment, Closure, EmployeePermissions, Movement, AccountPayable, PayablePayment, DashboardConfig, CardDeposit, SupplierReturn, CustomerRefund, CreditNote, SupplierCreditNote, ProductPackaging, PendingSyncSale, BatchOperation, isMixedSale } from './types';
import { PRODUCTS, CATEGORIES } from './data/products';
import { ProductCard } from './components/ProductCard';
import { CartItemRow } from './components/CartItemRow';
import { PackagingSelectModal } from './components/PackagingSelectModal';
import { PriceOverrideModal } from './components/PriceOverrideModal';
import { CartTotalOverrideModal } from './components/CartTotalOverrideModal';

function lazyWithRetry(componentImport: () => Promise<any>, exportName?: string) {
  return React.lazy(async () => {
    try {
      const m = await componentImport();
      return { default: exportName ? m[exportName] : (m.default || m) };
    } catch (error) {
      console.warn('Dynamic import failed, retrying...', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const m = await componentImport();
        return { default: exportName ? m[exportName] : (m.default || m) };
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}

const PaymentModal = lazyWithRetry(() => import('./components/PaymentModal'), 'PaymentModal');
const CorteTurnoModal = lazyWithRetry(() => import('./components/CorteTurnoModal'), 'CorteTurnoModal');
const TicketsModal = lazyWithRetry(() => import('./components/TicketsModal'), 'TicketsModal');
const CustomersView = lazyWithRetry(() => import('./components/CustomersView'), 'CustomersView');
const ExpensesModal = lazyWithRetry(() => import('./components/ExpensesModal'), 'ExpensesModal');
const MenudoModal = lazyWithRetry(() => import('./components/MenudoModal'), 'MenudoModal');
const AdminDrawer = lazyWithRetry(() => import('./components/AdminDrawer'), 'AdminDrawer');
const DatabaseControlCenter = lazyWithRetry(() => import('./components/DatabaseControlCenter'), 'DatabaseControlCenter');
const ProductsView = lazyWithRetry(() => import('./components/products/ProductsView'), 'ProductsView');
const DashboardView = lazyWithRetry(() => import('./components/DashboardView'), 'DashboardView');
import { firestoreService, authService } from './lib/firebase';
import { increment } from 'firebase/firestore';
import { roundCents, roundUpToNearestFive } from './lib/money';
import { buildSaleBatchOperations, calculateSaleTotals } from './lib/saleProcessor';
import { getSaleTimestamp } from './lib/dates';
import { getListPrice } from './lib/priceLists';
import { getEffectiveItemInfo, getCartItemKey } from './lib/bulkPricing';
import { matchesProductSearch, rankSearchResults, getPackagingBarcode } from './lib/search';
import { calculateABCClassification } from './lib/abcAnalysis';
import { LoginScreen } from './components/LoginScreen';
import { PinLockScreen } from './components/PinLockScreen';
import { ROLE_DEFAULT_PERMISSIONS } from './lib/permissions';
import { usePermissions } from './hooks/usePermissions';
import { useFirestoreData } from './hooks/useFirestoreData';
import { useAlert } from './context/AlertContext';
import {
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Barcode,
  TrendingUp,
  RefreshCw,
  Coins,
  Receipt,
  User,
  Users,
  Sparkles,
  Layers,
  ChevronRight,
  Plus,
  Database,
  Lock,
  Calendar,
  Clock,
  X,
  LogOut,
  Package,
  LayoutDashboard,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function App() {
  const { showAlert, showConfirm } = useAlert();

  // --- Authentication State ---
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // --- Live Clock State ---
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (user) => {
      if (user) {
        const authorizedEmail = (import.meta.env.VITE_AUTHORIZED_EMAIL || 'hst.30.09@gmail.com').toLowerCase();
        if (user.email && user.email.toLowerCase() === authorizedEmail) {
          setAuthUser(user);
          setAuthError(null);
        } else {
          setAuthError('Esta cuenta no tiene acceso a este sistema.');
          await authService.signOut();
          setAuthUser(null);
        }
      } else {
        setAuthUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Core State & Real-time Firestore Hook ---
  const {
    products,
    setProducts,
    salesHistory,
    setSalesHistory,
    pendingSales,
    setPendingSales,
    customers,
    setCustomers,
    customerPayments,
    setCustomerPayments,
    customerRefunds,
    setCustomerRefunds,
    creditNotes,
    setCreditNotes,
    movements,
    setMovements,
    employees,
    closures,
    setClosures,
    payables,
    setPayables,
    payablePayments,
    setPayablePayments,
    supplierReturns,
    setSupplierReturns,
    supplierCreditNotes,
    setSupplierCreditNotes,
    suppliers,
    cardDeposits,
    setCardDeposits,
    purchaseOrders,
    purchaseReceipts,
    storeIdentity,
    setStoreIdentity,
    dashboardConfig,
    setDashboardConfig,
    isSyncing,
    dbQuotaExceeded,
  } = useFirestoreData(!!authUser);

  const categories = useMemo(() => {
    const uniqueCats = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        uniqueCats.add(p.category.trim());
      }
    });
    
    const dynamicCategories: Category[] = Array.from(uniqueCats).sort().map(cat => ({
      id: cat,
      name: cat,
      emoji: '📦'
    }));

    return [{ id: 'all', name: 'Todos', emoji: '🌟' }, ...dynamicCategories];
  }, [products]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('pos_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [priceOverrideModalItem, setPriceOverrideModalItem] = useState<CartItem | null>(null);
  const [isCartTotalOverrideOpen, setIsCartTotalOverrideOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [cartTotalAdjustmentActive, setCartTotalAdjustmentActive] = useState<boolean>(false);
  const lastTotalNetoTapRef = useRef<number>(0);

  // --- Toast state for non-blocking notifications ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);
  
  const todaysSalesCount = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"
    return salesHistory.filter(sale => {
      const saleDateStr = new Date(getSaleTimestamp(sale)).toLocaleDateString('en-CA');
      return saleDateStr === todayStr;
    }).length;
  }, [salesHistory]);

  const recentSalesCount = useMemo(() => {
    const map = new Map<string, number>();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    salesHistory.forEach((sale) => {
      if (sale.isCancelled) return;
      const t = getSaleTimestamp(sale);
      if (t >= thirtyDaysAgo) {
        sale.items.forEach((item) => {
          if (item.product && item.product.id) {
            const current = map.get(item.product.id) || 0;
            map.set(item.product.id, current + (item.quantity || 1));
          }
        });
      }
    });
    return map;
  }, [salesHistory]);

  const monthlySalesCount = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    salesHistory.forEach((sale) => {
      if (sale.isCancelled) return;
      const sDate = new Date(getSaleTimestamp(sale));
      if (sDate.getFullYear() === currentYear && sDate.getMonth() === currentMonth) {
        sale.items?.forEach((item) => {
          if (item.product?.id) {
            const current = map.get(item.product.id) || 0;
            map.set(item.product.id, current + (item.quantity || 1));
          }
        });
      }
    });
    return map;
  }, [salesHistory]);

  const abcAnalysis = useMemo(() => {
    return calculateABCClassification(products, salesHistory);
  }, [products, salesHistory]);

  // --- PIN Session States ---
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(() => {
    const saved = sessionStorage.getItem('pos_current_employee');
    return saved ? JSON.parse(saved) : null;
  });
  const [sessionUnlocked, setSessionUnlocked] = useState<boolean>(() => {
    const unlocked = sessionStorage.getItem('pos_session_unlocked') === 'true';
    const savedEmp = sessionStorage.getItem('pos_current_employee');
    return unlocked && !!savedEmp;
  });

  const clerkName = currentEmployee?.name || 'Cajero Principal';
  const permissions = usePermissions(currentEmployee);
  const cartListRef = useRef<HTMLDivElement>(null);

  const handleUnlock = (employee: Employee) => {
    // If it's the initial-admin with PIN 0000, ensure it has admin permissions
    const unlockedEmployee = employee.id === 'initial-admin' 
      ? { ...employee, permissions: ROLE_DEFAULT_PERMISSIONS.admin } 
      : employee;

    const safeEmployee = {
      id: unlockedEmployee.id,
      name: unlockedEmployee.name,
      role: unlockedEmployee.role,
      active: unlockedEmployee.active,
      permissions: unlockedEmployee.permissions
    };
    sessionStorage.setItem('pos_session_unlocked', 'true');
    sessionStorage.setItem('pos_current_employee', JSON.stringify(safeEmployee));
    setCurrentEmployee(unlockedEmployee);
    setSessionUnlocked(true);
  };

  const handleCorteSuccess = () => {
    // Clean session
    sessionStorage.removeItem('pos_session_unlocked');
    sessionStorage.removeItem('pos_current_employee');
    setSessionUnlocked(false);
    setCurrentEmployee(null);
    setIsCorteOpen(false);

    // Try closing the window
    window.close();

    // Fallback: wait ~300ms, ensure locked state is active if page is still open
    setTimeout(() => {
      setSessionUnlocked(false);
      setCurrentEmployee(null);
    }, 300);
  };

  const handleUpdateIdentity = useCallback(async (updated: StoreIdentity) => {
    setStoreIdentity(updated);
    localStorage.setItem('pos_store_identity', JSON.stringify(updated));
    try {
      await firestoreService.setDocWithId('configs', 'store_identity', updated);
    } catch (err) {
      console.error('Error updating identity in Firestore:', err);
    }
  }, [setStoreIdentity]);

  const handleUpdateDashboardConfig = useCallback(async (updated: DashboardConfig) => {
    setDashboardConfig(updated);
    localStorage.setItem('pos_dashboard_config', JSON.stringify(updated));
    try {
      await firestoreService.setDocWithId('configs', 'dashboardConfig', updated);
    } catch (err) {
      console.error('Error updating dashboard config in Firestore:', err);
    }
  }, [setDashboardConfig]);

  // --- Local Retry Queue for Failed Sales Syncs ---
  const [pendingSyncQueue, setPendingSyncQueue] = useState<PendingSyncSale[]>(() => {
    const saved = localStorage.getItem('pos_pending_sync_queue');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const pendingSyncQueueRef = useRef(pendingSyncQueue);
  pendingSyncQueueRef.current = pendingSyncQueue;

  const processPendingSyncQueue = useCallback(async () => {
    const queue = pendingSyncQueueRef.current;
    if (queue.length === 0) return;

    setIsSyncingQueue(true);
    const remainingQueue: PendingSyncSale[] = [];

    for (const item of queue) {
      try {
        await firestoreService.runBatch(item.operations);
      } catch (err) {
        console.error(`Error al reintentar sincronizar venta ${item.id}:`, err);
        remainingQueue.push(item);
      }
    }

    setPendingSyncQueue(remainingQueue);
    localStorage.setItem('pos_pending_sync_queue', JSON.stringify(remainingQueue));
    setIsSyncingQueue(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      processPendingSyncQueue();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine && pendingSyncQueue.length > 0) {
      processPendingSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [processPendingSyncQueue]);

  const hasOverduePendingSync = useMemo(() => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return pendingSyncQueue.some((item) => now - (item.timestamp || now) > TWENTY_FOUR_HOURS);
  }, [pendingSyncQueue]);

  const [isSavingPending, setIsSavingPending] = useState(false);
  const [pendingRefName, setPendingRefName] = useState('');
  const [selectedProductForPackaging, setSelectedProductForPackaging] = useState<Product | null>(null);

  const getCartItemKey = (productId: string, packagingId?: string): string => {
    return packagingId ? `${productId}_pkg_${packagingId}` : productId;
  };

  // --- Customers State ---
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const activePriceList = useMemo(() => {
    if (!activeCustomer?.priceListId) return null;
    return (dashboardConfig?.clientPriceLists || []).find(pl => pl.id === activeCustomer.priceListId) || null;
  }, [activeCustomer, dashboardConfig?.clientPriceLists]);

  const effectiveCart = useMemo(() => {
    return cart.map((item) => {
      const info = getEffectiveItemInfo(
        item.product,
        item.quantity,
        activePriceList,
        item.selectedPackaging,
        item.priceOverride
      );
      return {
        ...item,
        product: {
          ...item.product,
          price: info.unitPrice,
        },
        _effectiveInfo: info,
      };
    });
  }, [cart, activePriceList]);
  
  // --- Totals Computations ---
  const totals = useMemo(() => {
    const saleTotals = calculateSaleTotals(effectiveCart);
    return { 
      ...saleTotals, 
      finalTotal: saleTotals.total, 
      activePriceList
    };
  }, [effectiveCart, activePriceList]);

  const handlePutOnHold = useCallback(async (customName?: string) => {
    if (cart.length === 0) return;
    
    const defaultName = `Venta #${todaysSalesCount + 1}`;
    const name = customName?.trim() || defaultName;
    
    const newPending: PendingSale = {
      id: crypto.randomUUID(),
      name,
      items: [...effectiveCart],
      total: totals.finalTotal,
      createdAt: new Date().toISOString(),
    };
    
    // Immediately update local state so the UI reflects the change instantly
    setPendingSales(prev => {
      const updated = [...prev.filter(p => p.id !== newPending.id), newPending];
      localStorage.setItem('pos_pending_sales', JSON.stringify(updated));
      return updated;
    });
    
    // Clear active cart
    setCart([]);
    
    try {
      await firestoreService.setDocWithId('pending_sales', newPending.id, newPending);
    } catch (err) {
      console.error('Error saving pending sale to Firestore:', err);
    }
  }, [cart, totals.finalTotal, todaysSalesCount]);

  const handleLoadPendingSale = useCallback(async (pending: PendingSale) => {
    const currentCart = [...cart];
    const currentTotal = totals.finalTotal;
    
    // Immediately remove from local state and swap if current cart has items
    setPendingSales(prev => {
      let updated = prev.filter(p => p.id !== pending.id);
      
      if (currentCart.length > 0) {
        const swapPending: PendingSale = {
          id: crypto.randomUUID(),
          name: `Venta #${todaysSalesCount + 1}`,
          items: currentCart,
          total: currentTotal,
          createdAt: new Date().toISOString(),
        };
        updated = [...updated, swapPending];
        
        // Save swapped item to Firestore in background
        firestoreService.setDocWithId('pending_sales', swapPending.id, swapPending)
          .catch(err => console.error('Error saving swapped pending sale:', err));
      }
      
      localStorage.setItem('pos_pending_sales', JSON.stringify(updated));
      return updated;
    });

    // Load items into cart
    setCart(pending.items);
    
    // Delete loaded pending sale from Firestore in background
    try {
      await firestoreService.deleteDoc('pending_sales', pending.id);
    } catch (err) {
      console.error('Error deleting pending sale from Firestore:', err);
    }
  }, [cart, totals.finalTotal, todaysSalesCount]);

  const handleDeletePendingSale = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Immediately remove from local state
    setPendingSales(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('pos_pending_sales', JSON.stringify(updated));
      return updated;
    });
    
    try {
      await firestoreService.deleteDoc('pending_sales', id);
    } catch (err) {
      console.error('Error deleting pending sale:', err);
    }
  }, []);

  // --- Modals and Drawers States ---
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isDbOpen, setIsDbOpen] = useState(false);
  const [isCorteOpen, setIsCorteOpen] = useState(false);
  const [isMenudoOpen, setIsMenudoOpen] = useState(false);
  const [menudoTotalForCorte, setMenudoTotalForCorte] = useState<number | null>(null);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [isTicketsModalOpen, setIsTicketsModalOpen] = useState(false);
  const [isProductsManagerOpen, setIsProductsManagerOpen] = useState(false);
  const [preSelectedProductTab, setPreSelectedProductTab] = useState<'catalog' | 'edit' | 'add' | 'inventory' | 'kits' | 'categories_suppliers' | 'sales'>('catalog');
  const [preSelectedProductId, setPreSelectedProductId] = useState<string | null>(null);
  const [isCustomersOpen, setIsCustomersOpen] = useState(false);
  const [preSelectedCustomerId, setPreSelectedCustomerId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // --- Generic Product Modal States ---
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [genericName, setGenericName] = useState('');
  const [genericPrice, setGenericPrice] = useState('');
  const [genericTaxExempt, setGenericTaxExempt] = useState(false);

  // --- Expenses Modal Cash-Only State ---
  const [expensesForceCash, setExpensesForceCash] = useState(false);

  const [showClerkInput, setShowClerkInput] = useState(false);
  const [tempClerkName, setTempClerkName] = useState(clerkName);
  const [recentTicket, setRecentTicket] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter sales for the current active shift
  const currentShiftSales = useMemo(() => {
    if (currentEmployee) {
      const empClosures = closures.filter(c => c.employeeId === currentEmployee.id);
      let lastClosure: Closure | null = null;
      empClosures.forEach(current => {
        if (!lastClosure) {
          lastClosure = current;
          return;
        }
        const latestTime = new Date(lastClosure.createdAt || lastClosure.date).getTime();
        const currentTime = new Date(current.createdAt || current.date).getTime();
        if (currentTime > latestTime) {
          lastClosure = current;
        }
      });

      const lastClosureTime = lastClosure 
        ? new Date(lastClosure.createdAt || lastClosure.date).getTime() 
        : 0;

      return salesHistory.filter(sale => {
        if (!sale.date) return false;
        if (sale.soldBy?.id !== currentEmployee.id) return false;
        
        return getSaleTimestamp(sale) > lastClosureTime;
      });
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTime = startOfToday.getTime();

      return salesHistory.filter(sale => {
        if (!sale.date) return false;
        return getSaleTimestamp(sale) >= startOfTodayTime;
      });
    }
  }, [salesHistory, currentEmployee, closures]);

  useEffect(() => {
    document.title = storeIdentity.name || 'Punto de Venta';
  }, [storeIdentity.name]);

  const saveCreditNotesToStorage = (notes: CreditNote[]) => {
    const sanitized = notes.map(cn => ({ ...cn, code: undefined }));
    localStorage.setItem('pos_credit_notes', JSON.stringify(sanitized));
  };

  const handleAddCustomerRefund = (refund: CustomerRefund) => {
    const updated = [refund, ...customerRefunds];
    setCustomerRefunds(updated);
    localStorage.setItem('pos_customer_refunds', JSON.stringify(updated));
  };

  const handleAddCreditNote = (note: CreditNote) => {
    const updated = [note, ...creditNotes];
    setCreditNotes(updated);
    saveCreditNotesToStorage(updated);
  };

  const handleUpdateCreditNote = async (note: CreditNote) => {
    const updated = creditNotes.map(cn => cn.id === note.id ? note : cn);
    setCreditNotes(updated);
    saveCreditNotesToStorage(updated);
    try {
      await firestoreService.setDocWithId('creditNotes', note.id, note);
    } catch (err) {
      console.error('Error updating credit note in Firestore:', err);
    }
  };

  // --- Sync to LocalStorage (as offline fallback cache) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('pos_products', JSON.stringify(products));
    }, 800);
    return () => clearTimeout(timer);
  }, [products]);

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pos_sales', JSON.stringify(salesHistory));
  }, [salesHistory]);

  useEffect(() => {
    localStorage.setItem('pos_clerk', clerkName);
  }, [clerkName]);

  useEffect(() => {
    localStorage.setItem('pos_pending_sales', JSON.stringify(pendingSales));
  }, [pendingSales]);

  useEffect(() => {
    if (cart.length === 0) {
      setCartTotalAdjustmentActive(false);
    }
    if (cartListRef.current) {
      cartListRef.current.scrollTo({
        top: cartListRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [cart.length]);

  // --- Cart Actions ---
  const handleAddToCart = useCallback((product: Product, packaging?: ProductPackaging, explicitBaseUnit?: boolean) => {
    // If product has packagings and no packaging was explicitly chosen, show selection modal
    if (product.packagings && product.packagings.length > 0 && !packaging && !explicitBaseUnit) {
      setSelectedProductForPackaging(product);
      return;
    }

    const existingOverride = cart.find(
      (item) => item.product.id === product.id && typeof item.priceOverride === 'number'
    )?.priceOverride;

    if (cartTotalAdjustmentActive && existingOverride === undefined) {
      showToast('El Total Neto ajustado aplicó solo a los productos de ese momento — este producto se agregó a su precio normal.');
    }

    setCart((prevCart) => {
      const targetKey = getCartItemKey(product.id, packaging?.id);
      const existingIndex = prevCart.findIndex(
        (item) => getCartItemKey(item.product.id, item.packagingId) === targetKey
      );

      const existingOverrideInCart = prevCart.find(
        (item) => item.product.id === product.id && typeof item.priceOverride === 'number'
      )?.priceOverride;

      if (existingIndex > -1) {
        return prevCart.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                quantity: item.quantity + 1,
                ...(existingOverrideInCart !== undefined ? { priceOverride: existingOverrideInCart } : {}),
              }
            : item
        );
      }

      const cartProduct: Product = packaging
        ? {
            ...product,
            price: packaging.price,
            taxExempt: packaging.taxExempt !== undefined ? packaging.taxExempt : product.taxExempt,
          }
        : product;

      return [
        ...prevCart,
        {
          product: cartProduct,
          quantity: 1,
          packagingId: packaging?.id,
          selectedPackaging: packaging,
          ...(existingOverrideInCart !== undefined ? { priceOverride: existingOverrideInCart } : {}),
        },
      ];
    });
    setSelectedCartItemId(getCartItemKey(product.id, packaging?.id));
    setSearchQuery(''); // Clear search query upon selection
  }, [cart, cartTotalAdjustmentActive, showToast]);

  const handleApplyPriceOverride = useCallback((productId: string, newUnitPrice: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId
          ? { ...item, priceOverride: newUnitPrice }
          : item
      )
    );
  }, []);

  const handleResetPriceOverride = useCallback((productId: string) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const { priceOverride, ...rest } = item;
          return rest;
        }
        return item;
      })
    );
  }, []);

  const handleApplyCartTotalOverride = useCallback((overrides: { itemKey: string; newUnitPrice: number }[]) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        const targetKey = getCartItemKey(item.product.id, item.packagingId);
        const match = overrides.find((o) => o.itemKey === targetKey);
        if (match) {
          return { ...item, priceOverride: match.newUnitPrice };
        }
        return item;
      })
    );
    setCartTotalAdjustmentActive(true);
  }, []);

  const handleResetAllPriceOverrides = useCallback(() => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        const { priceOverride, ...rest } = item;
        return rest;
      })
    );
    setCartTotalAdjustmentActive(false);
  }, []);

  const handleIncrementQuantity = useCallback((productId: string, packagingId?: string) => {
    const targetKey = getCartItemKey(productId, packagingId);
    setCart((prevCart) => {
      return prevCart.map((item) =>
        getCartItemKey(item.product.id, item.packagingId) === targetKey
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  }, []);

  const handleDecrementQuantity = useCallback(async (productId: string, packagingId?: string) => {
    const targetKey = getCartItemKey(productId, packagingId);
    const item = cart.find((i) => getCartItemKey(i.product.id, i.packagingId) === targetKey);
    if (!item) return;

    const itemName = item.selectedPackaging
      ? `${item.product.name} (${item.selectedPackaging.name})`
      : item.product.name;

    if (item.quantity <= 1) {
      const confirmRemove = await showConfirm(
        'Confirmar eliminación',
        `¿Está seguro de que desea eliminar "${itemName}" del carrito?`
      );
      if (!confirmRemove) return;
    }

    setCart((prevCart) => {
      const itemInCart = prevCart.find((i) => getCartItemKey(i.product.id, i.packagingId) === targetKey);
      if (!itemInCart) return prevCart;
      if (itemInCart.quantity <= 1) {
        return prevCart.filter((i) => getCartItemKey(i.product.id, i.packagingId) !== targetKey);
      }
      return prevCart.map((i) =>
        getCartItemKey(i.product.id, i.packagingId) === targetKey
          ? { ...i, quantity: i.quantity - 1 }
          : i
      );
    });
  }, [cart, showConfirm]);

  const handleRemoveFromCart = useCallback((productId: string, packagingId?: string) => {
    const targetKey = getCartItemKey(productId, packagingId);
    setCart((prevCart) => prevCart.filter((item) => getCartItemKey(item.product.id, item.packagingId) !== targetKey));
  }, []);

  const handleClearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomerId('');
  }, []);

  // --- Sync Selected Cart Item Id ---
  useEffect(() => {
    if (cart.length === 0) {
      setSelectedCartItemId(null);
    } else {
      const exists = cart.some((item) => item.product.id === selectedCartItemId);
      if (!exists) {
        setSelectedCartItemId(cart[0].product.id);
      }
    }
  }, [cart, selectedCartItemId]);

  // --- Keyboard Shortcuts ---
  useKeyboardShortcuts(
    {
      F10: (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        setSearchQuery('');
        searchInputRef.current?.focus();
      },
      'ctrl+k': (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        setSearchQuery('');
        searchInputRef.current?.focus();
      },
      F3: (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        setIsProductsManagerOpen((prev) => !prev);
      },
      F4: (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        setIsCustomersOpen((prev) => !prev);
      },
      F6: (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        setIsCorteOpen((prev) => !prev);
      },
      F1: (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        setIsProductsManagerOpen(false);
        setIsCustomersOpen(false);
      },
      F12: (e) => {
        if (isPaymentOpen) return;
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      },
      Escape: (e) => {
        e.preventDefault();
        setIsPaymentOpen(false);
        setIsAdminOpen(false);
        setIsDbOpen(false);
        setIsCorteOpen(false);
        setShowClerkInput(false);
        setIsProductsManagerOpen(false);
        setIsCustomersOpen(false);
        setIsExpensesOpen(false);
      },
      ArrowDown: (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) return;
        if (cart.length > 0) {
          e.preventDefault();
          const currentIndex = cart.findIndex((item) => getCartItemKey(item.product.id, item.packagingId) === selectedCartItemId);
          if (currentIndex === -1) {
            setSelectedCartItemId(getCartItemKey(cart[0].product.id, cart[0].packagingId));
          } else {
            const nextIndex = (currentIndex + 1) % cart.length;
            setSelectedCartItemId(getCartItemKey(cart[nextIndex].product.id, cart[nextIndex].packagingId));
          }
        }
      },
      ArrowUp: (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) return;
        if (cart.length > 0) {
          e.preventDefault();
          const currentIndex = cart.findIndex((item) => getCartItemKey(item.product.id, item.packagingId) === selectedCartItemId);
          if (currentIndex === -1) {
            setSelectedCartItemId(getCartItemKey(cart[cart.length - 1].product.id, cart[cart.length - 1].packagingId));
          } else {
            const prevIndex = (currentIndex - 1 + cart.length) % cart.length;
            setSelectedCartItemId(getCartItemKey(cart[prevIndex].product.id, cart[prevIndex].packagingId));
          }
        }
      },
      '+': (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) {
          const isSearchInput = activeEl === searchInputRef.current;
          if (!(isSearchInput && searchQuery.trim() === '')) return;
        }
        if (cart.length > 0 && selectedCartItemId) {
          e.preventDefault();
          handleIncrementQuantity(selectedCartItemId);
        }
      },
      '=': (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) {
          const isSearchInput = activeEl === searchInputRef.current;
          if (!(isSearchInput && searchQuery.trim() === '')) return;
        }
        if (cart.length > 0 && selectedCartItemId) {
          e.preventDefault();
          handleIncrementQuantity(selectedCartItemId);
        }
      },
      '-': (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) {
          const isSearchInput = activeEl === searchInputRef.current;
          if (!(isSearchInput && searchQuery.trim() === '')) return;
        }
        if (cart.length > 0 && selectedCartItemId) {
          e.preventDefault();
          handleDecrementQuantity(selectedCartItemId);
        }
      },
      Delete: (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) return;
        if (cart.length > 0 && selectedCartItemId) {
          e.preventDefault();
          handleRemoveFromCart(selectedCartItemId);
        }
      },
      Backspace: (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) return;
        if (cart.length > 0 && selectedCartItemId) {
          e.preventDefault();
          handleRemoveFromCart(selectedCartItemId);
        }
      },
    },
    {
      enabled: true,
      onUnhandledKey: (e) => {
        if (isPaymentOpen) return;
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (!isInput) {
          const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== '+' && e.key !== '-' && e.key !== '=' && e.key !== ' ';
          if (isPrintableKey && searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }
      },
    }
  );

  // --- Keep Search Input Focused in Sales View ---
  useEffect(() => {
    if (!authUser || !sessionUnlocked) return;

    const isAnyModalOpen =
      isPaymentOpen ||
      isAdminOpen ||
      isDbOpen ||
      isCorteOpen ||
      isExpensesOpen ||
      isTicketsModalOpen ||
      isProductsManagerOpen ||
      showClerkInput;

    if (isAnyModalOpen) return;

    // Focus immediately on mount/modal closure
    searchInputRef.current?.focus();

    // 1. Refocus on an interval to catch any lost focus
    const interval = setInterval(() => {
      const activeEl = document.activeElement;
      const isInteractive = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'BUTTON' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.tagName === 'A' ||
        activeEl.getAttribute('contenteditable') === 'true'
      );
      if (activeEl !== searchInputRef.current && !isInteractive) {
        searchInputRef.current?.focus();
      }
    }, 300);

    // 2. Refocus immediately on clicks to non-interactive elements
    const handleGlobalClick = () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        const isInteractive = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'BUTTON' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'A' ||
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (!isInteractive && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    };

    window.addEventListener('click', handleGlobalClick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [
    authUser,
    sessionUnlocked,
    isPaymentOpen,
    isAdminOpen,
    isDbOpen,
    isCorteOpen,
    isTicketsModalOpen,
    isProductsManagerOpen,
    showClerkInput
  ]);

  // --- Barcode / Quick Search Enter Handler ---
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;

    const cleanQueryCode = cleanQuery.replace(/^0+/, '');
    let matchedPackaging: ProductPackaging | undefined = undefined;

    const matchedProduct = products.find((p) => {
      if (p.packagings && p.packagings.length > 0) {
        const foundPkg = p.packagings.find((pkg) => {
          const pkgBarcode = getPackagingBarcode(p, pkg).trim().replace(/^0+/, '');
          return pkgBarcode && pkgBarcode === cleanQueryCode;
        });
        if (foundPkg) {
          matchedPackaging = foundPkg;
          return true;
        }
      }

      const cleanBarcode = p.barcode ? p.barcode.trim().replace(/^0+/, '') : '';
      const cleanId = p.id ? p.id.trim().replace(/^0+/, '') : '';
      const cleanCode = p.code ? p.code.trim().replace(/^0+/, '') : '';
      const cleanSku = p.sku ? p.sku.trim().replace(/^0+/, '') : '';
      return (
        (cleanBarcode && cleanBarcode === cleanQueryCode) ||
        (cleanCode && cleanCode === cleanQueryCode) ||
        (cleanId && cleanId === cleanQueryCode) ||
        (cleanSku && cleanSku === cleanQueryCode)
      );
    });

    if (matchedProduct) {
      handleAddToCart(matchedProduct, matchedPackaging);
      setSearchQuery(''); // Reset search bar
    } else {
      const visibleCategoryProducts = products.filter((p) => {
        if (p.visible === false) return false;
        return selectedCategory === 'all' || p.category === selectedCategory;
      });
      const ranked = rankSearchResults(
        visibleCategoryProducts,
        cleanQuery,
        recentSalesCount,
        monthlySalesCount,
        abcAnalysis.abcMap,
        abcAnalysis.hasHistory
      );
      if (ranked.length > 0) {
        const topProduct = ranked[0];
        let topPkg: ProductPackaging | undefined = undefined;
        if (topProduct.packagings && topProduct.packagings.length > 0) {
          topPkg = topProduct.packagings.find((pkg) => {
            const pkgBarcode = getPackagingBarcode(topProduct, pkg).trim().replace(/^0+/, '');
            return pkgBarcode && pkgBarcode === cleanQueryCode;
          });
        }
        handleAddToCart(topProduct, topPkg);
        setSearchQuery(''); // Reset search bar
      } else {
        setSearchQuery('');
        showToast(`Producto no encontrado: ${cleanQuery}`);
      }
    }
  };

  // --- Admin Catalog Actions ---
  const handleAddProduct = async (newProduct: Product) => {
    setProducts((prev) => {
      const updated = [newProduct, ...prev.filter(p => p.id !== newProduct.id)];
      localStorage.setItem('pos_products', JSON.stringify(updated));
      return updated;
    });
    try {
      await firestoreService.setDocWithId('products', newProduct.id, newProduct);
    } catch (err) {
      console.error('Error saving product to Firestore:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== productId);
      localStorage.setItem('pos_products', JSON.stringify(updated));
      return updated;
    });
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    try {
      await firestoreService.deleteDoc('products', productId);
    } catch (err) {
      console.error('Error deleting product from Firestore:', err);
    }
  };

  const handleRestock = async (productId: string, amount: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const nextStock = prod.stock + amount;
    setProducts((prev) => {
      const updated = prev.map((p) => p.id === productId ? { ...p, stock: nextStock } : p);
      localStorage.setItem('pos_products', JSON.stringify(updated));
      return updated;
    });
    try {
      await firestoreService.updateDoc('products', productId, { stock: increment(amount) });
    } catch (err) {
      console.error('Error updating stock in Firestore:', err);
    }
  };

  // --- Checkout Success ---
  const handleFinishSale = async (newSale: Sale) => {
    const saleWithEmployee: Sale = {
      ...newSale,
      createdAt: newSale.createdAt || new Date().toISOString(),
      soldBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : undefined
    };

    const { updatedProducts, updatedCreditNotes, operations } = buildSaleBatchOperations({
      sale: saleWithEmployee,
      products,
      creditNotes,
    });

    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

    setSalesHistory((prevSales) => {
      const updatedSales = [saleWithEmployee, ...prevSales.filter(s => s.id !== saleWithEmployee.id)];
      localStorage.setItem('pos_sales', JSON.stringify(updatedSales));
      return updatedSales;
    });

    if (updatedCreditNotes !== creditNotes) {
      setCreditNotes(updatedCreditNotes);
      saveCreditNotesToStorage(updatedCreditNotes);
    }

    try {
      // Execute all operations atomically in a single batch (sales + product stock + credit notes)
      await firestoreService.runBatch(operations);
    } catch (err) {
      console.error('Error completing sale in Firestore, adding to pending sync queue:', err);
      const failedSaleItem: PendingSyncSale = {
        id: saleWithEmployee.id,
        timestamp: Date.now(),
        saleData: saleWithEmployee,
        operations,
      };
      setPendingSyncQueue((prev) => {
        const updated = [...prev.filter((item) => item.id !== failedSaleItem.id), failedSaleItem];
        localStorage.setItem('pos_pending_sync_queue', JSON.stringify(updated));
        return updated;
      });
    }

    // 3. Clear cart and set recent ticket
    setCart([]);
    setSelectedCustomerId('');
    setRecentTicket(saleWithEmployee);
  };

  // --- Navigation Handlers ---
  const handleNavigateToCustomer = (customerId: string) => {
    setPreSelectedCustomerId(customerId);
    setShowDashboard(false);
    setIsCustomersOpen(true);
  };

  const handleCloseCustomers = () => {
    setIsCustomersOpen(false);
    setPreSelectedCustomerId(null);
  };

  const handleNavigateToProduct = (productId: string) => {
    setPreSelectedProductTab('add');
    setPreSelectedProductId(productId);
    setShowDashboard(false);
    setIsProductsManagerOpen(true);
  };

  const handleCloseProductsManager = () => {
    setIsProductsManagerOpen(false);
    setPreSelectedProductId(null);
  };

  // --- Filtering Products ---
  const filteredProducts = useMemo(() => {
    const visibleCategoryProducts = products.filter((prod) => {
      if (prod.visible === false) return false;
      return selectedCategory === 'all' || prod.category === selectedCategory;
    });

    return rankSearchResults(
      visibleCategoryProducts,
      debouncedSearchQuery,
      recentSalesCount,
      monthlySalesCount,
      abcAnalysis.abcMap,
      abcAnalysis.hasHistory
    );
  }, [products, selectedCategory, debouncedSearchQuery, recentSalesCount, monthlySalesCount, abcAnalysis]);

  // Clerk Name Submit
  const handleClerkNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempClerkName.trim()) {
      if (currentEmployee) {
        const updatedEmp = { ...currentEmployee, name: tempClerkName.trim() };
        setCurrentEmployee(updatedEmp);
        sessionStorage.setItem('pos_current_employee', JSON.stringify(updatedEmp));
      }
      setShowClerkInput(false);
    }
  };

  const currentCartQuantity = (productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginScreen
        storeIdentity={storeIdentity}
        onLoginSuccess={(user) => {
          setAuthUser(user);
          setAuthError(null);
        }}
        initialError={authError}
      />
    );
  }

  if (!sessionUnlocked) {
    return (
      <PinLockScreen
        onUnlock={handleUnlock}
      />
    );
  }

  const lastEmployeeSale = currentEmployee
    ? salesHistory.find(sale => sale.soldBy?.id === currentEmployee.id) || null
    : null;

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans antialiased overflow-hidden relative">
      
      {/* Left Column: Header, Products & Shortcuts */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50 relative pb-16 md:pb-0">
        
        {/* Top Banner / Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm shrink-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            
            {/* Logo & Status */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-indigo-100 overflow-hidden">
                {storeIdentity.logoUrl && (storeIdentity.logoUrl.startsWith('data:image') || storeIdentity.logoUrl.startsWith('http')) ? (
                  <img src={storeIdentity.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  storeIdentity.logoUrl || '🛒'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-bold text-xl tracking-tight text-slate-800 uppercase">
                    {storeIdentity.name || 'MI NEGOCIO'}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Caja Abierta
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{storeIdentity.slogan || 'Terminal de Punto de Venta Inteligente'}</p>
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Pending Sync Queue Badge & Retry Button */}
              {pendingSyncQueue.length > 0 && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                    hasOverduePendingSync
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                  title="Ventas guardadas localmente pendientes de sincronizar con Firestore"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasOverduePendingSync ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span>
                      {pendingSyncQueue.length} {pendingSyncQueue.length === 1 ? 'venta pendiente' : 'ventas pendientes'} de sincronizar
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={processPendingSyncQueue}
                    disabled={isSyncingQueue}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      hasOverduePendingSync
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    } disabled:opacity-50`}
                    title="Reintentar sincronizar ahora"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                    <span>{isSyncingQueue ? 'Sincronizando...' : 'Reintentar ahora'}</span>
                  </button>
                </div>
              )}

              {/* Sales Count Badge / Tickets history trigger */}
              <button
                type="button"
                onClick={() => setIsTicketsModalOpen(true)}
                className="bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 transition-all cursor-pointer group shadow-sm text-left"
                title="Ver historial de facturas (Tickets)"
              >
                <Receipt className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 block uppercase tracking-wide leading-none transition-colors">Tickets</span>
                  <span className="text-sm font-black text-slate-900 group-hover:text-indigo-750 transition-colors">{currentShiftSales.length}</span>
                </div>
              </button>

              {/* Active Clerk Button */}
              <div className="relative">
                {showClerkInput ? (
                  <form onSubmit={handleClerkNameSubmit} className="flex gap-1 animate-scale-up absolute right-0 top-1/2 -translate-y-1/2 bg-white p-2 border border-slate-200 rounded-xl shadow-lg z-50">
                    <input autoComplete="off"
                      type="text"
                      value={tempClerkName}
                      onChange={(e) => setTempClerkName(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                      placeholder="Nombre"
                      autoFocus
                    />
                    <button type="submit" className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-indigo-700">
                      Ok
                    </button>
                    <button type="button" onClick={() => setShowClerkInput(false)} className="text-gray-400 text-xs px-1 hover:text-gray-600">
                      X
                    </button>
                  </form>
                ) : (
                  <button
                    id="clerk-badge"
                    onClick={() => {
                      setTempClerkName(clerkName);
                      setShowClerkInput(true);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 border-2 border-white rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer shadow-sm"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="max-w-[100px] truncate">{clerkName}</span>
                  </button>
                )}
              </div>
              
              {/* Dashboard Toggle */}
              {permissions.viewDashboard && (
                <button
                  onClick={() => setShowDashboard(!showDashboard)}
                  className={`p-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-sm ${
                    showDashboard ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 hover:border-indigo-500 hover:text-indigo-600'
                  }`}
                  title="Ver Dashboard Gerencial"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </button>
              )}

              {/* Settings / Inventory Drawer Trigger */}
              {(permissions.manageEmployees || permissions.editStoreSettings || permissions.accessDatabaseTools) && (
                <button
                  id="admin-inventory-btn"
                  onClick={() => setIsAdminOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer bg-white shadow-sm"
                  title="Configuración e Identidad"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              {/* Close Shift (Cerrar Turno) Button */}
              {permissions.closeShift && (
                <button
                  onClick={() => setIsCorteOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-rose-500 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer bg-white shadow-sm"
                  title="Realizar Corte de Caja (F6)"
                >
                  <Clock className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={() => {
                  sessionStorage.removeItem('pos_session_unlocked');
                  sessionStorage.removeItem('pos_current_employee');
                  setSessionUnlocked(false);
                  setCurrentEmployee(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-rose-500 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer bg-white shadow-sm"
                title="Cerrar sesión de empleado"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

          </div>
        </header>

        {/* Overdue pending sync warning banner (>24h) */}
        {hasOverduePendingSync && (
          <div className="bg-rose-600 text-white border-b border-rose-700 px-6 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0 font-medium animate-fade-in shadow-inner">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
              <p>
                <strong>¡Alerta de Conexión!</strong> Hay {pendingSyncQueue.length} {pendingSyncQueue.length === 1 ? 'venta pendiente' : 'ventas pendientes'} por sincronizar con más de 24 horas en la cola local. Por favor verifique la conexión a internet de este dispositivo.
              </p>
            </div>
            <button
              onClick={processPendingSyncQueue}
              disabled={isSyncingQueue}
              className="bg-white hover:bg-rose-50 text-rose-800 px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 text-[11px] shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQueue ? 'animate-spin' : ''}`} />
              <span>{isSyncingQueue ? 'Sincronizando...' : 'Reintentar ahora'}</span>
            </button>
          </div>
        )}

        {/* Quota limit warning banner */}
        {dbQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-800 shrink-0 font-medium animate-fade-in shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p>
                <strong>Modo Local Activo:</strong> Se excedió el límite de consultas de la base de datos de Google Firestore. El sistema continuará guardando todas sus ventas y productos localmente de forma segura.
              </p>
            </div>
            <a 
              href="https://console.firebase.google.com/project/project-b1664caa-7e06-4276-a53/firestore/databases/ai-studio-puntodeventa-9270ce54-a192-43a7-827f-3c9856c14e1b/data?openUpgradeDialog=true"
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-bold transition-colors shrink-0 text-[10px]"
            >
              Ver Consola Firestore
            </a>
          </div>
        )}

        {/* Main Products Container (No gaps, no floating cards) */}
        <main className="flex-1 overflow-hidden flex flex-col bg-white">
          
          {/* Unified Search, Filter and Products layout: 1 single seamless layout unit */}
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            
            {/* Top Search & Filter Bar */}
            <div className="bg-white border-b border-slate-200 p-4 sm:p-5 space-y-4 shrink-0">
              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="pos-search-input"
                    ref={searchInputRef}
                    type="text"
                    autoComplete="off"
                    placeholder="Buscar producto por nombre, categoría o escanee código de barras... (Ctrl + K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-14 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all focus:outline-none placeholder:text-slate-400"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-400 font-mono select-none">
                    <Barcode className="w-3.5 h-3.5" />
                    <span>Enter</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGenericModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 hover:text-indigo-800 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Otro / Producto Genérico</span>
                </button>
              </form>

              {/* Pending Sales Bar (Only visible if there is at least one pending sale) */}
              {pendingSales.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto p-2 bg-amber-50/70 rounded-xl border border-amber-100 animate-fade-in scrollbar-thin scrollbar-thumb-amber-200">
                  <span className="text-xs font-bold text-amber-700 mr-1 flex-shrink-0 uppercase tracking-wider flex items-center gap-1.5 pl-1.5 select-none">
                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    Pendientes ({pendingSales.length}):
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {pendingSales.map((pending) => (
                      <div
                        key={pending.id}
                        onClick={() => handleLoadPendingSale(pending)}
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-amber-200 hover:border-amber-400 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all cursor-pointer shadow-xs hover:shadow-sm shrink-0"
                        title="Haga clic para recuperar o cambiar por el carrito actual"
                      >
                        <span className="max-w-[120px] truncate">{pending.name}</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-lg font-black font-mono">
                          ${pending.total.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePendingSale(pending.id, e)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar venta pendiente"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories filter layout */}
              <div className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-200">
                <span className="text-xs font-bold text-slate-400 mr-1 flex-shrink-0 uppercase tracking-wider">Filtro:</span>
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      id={`cat-filter-${cat.id}`}
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer flex-shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/80 border-transparent'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Catalog grid view */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 animate-fade-in">
              {products.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[380px] shadow-sm animate-fade-in mx-auto max-w-lg mt-8">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 border border-indigo-100">
                    <Database className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">Catálogo Vacío</h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Los mockdata han sido eliminados correctamente y el Punto de Venta está listo para usar su propia base de datos.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Utilice el menú de administración (icono de engranaje) para agregar sus propios productos, o configure su inventario directamente.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={() => setIsAdminOpen(true)}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Agregar Producto
                    </button>
                    <button
                      onClick={async () => {
                        const confirmRestore = await showConfirm(
                          'Cargar Catálogo Demo',
                          '¿Desea restaurar el catálogo de productos de muestra (Demo) en su base de datos local y Firestore?'
                        );
                        if (confirmRestore) {
                          try {
                            const demoProducts = (await import('./data/products')).PRODUCTS;
                            setProducts(demoProducts);
                            localStorage.setItem('pos_products', JSON.stringify(demoProducts));
                            for (const prod of demoProducts) {
                              await firestoreService.setDocWithId('products', prod.id, prod);
                            }
                          } catch (e) {
                            console.error('Error restoring demo:', e);
                          }
                        }
                      }}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" /> Cargar Demo
                    </button>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center h-80 shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-4 border border-slate-200">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">No se encontraron productos</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    Intente cambiando el término de búsqueda o la categoría activa. También puede añadir productos desde la barra de herramientas.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="mt-4 px-4 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    Restaurar Filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-8">
                  {filteredProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      onAddToCart={handleAddToCart}
                      onOpenPackagingSelector={(product) => setSelectedProductForPackaging(product)}
                      cartQuantity={currentCartQuantity(prod.id)}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>

        {/* Bottom Sticky Shortcut Legend bar as interactive buttons */}
        <footer className="bg-white border-t border-slate-200 py-3 px-4 text-xs text-slate-500 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto whitespace-nowrap shrink-0 z-10">
          
          {permissions.manageProducts && (
            <button
              onClick={() => setIsProductsManagerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-medium text-indigo-700 transition-colors cursor-pointer shadow-xs shrink-0"
              title="Catálogo de Productos y Suministro (F3)"
            >
              <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-indigo-300 font-mono text-[10px] font-black shadow-xs">F3</kbd>
              <span>Productos</span>
            </button>
          )}

          {permissions.manageCustomers && (
            <button
              onClick={() => setIsCustomersOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-medium text-indigo-700 transition-colors cursor-pointer shadow-xs shrink-0"
              title="Cartera de Clientes y Créditos (F4)"
            >
              <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-indigo-300 font-mono text-[10px] font-black shadow-xs">F4</kbd>
              <span>Clientes</span>
            </button>
          )}

          {permissions.viewDashboard && (
            <button
              onClick={() => setShowDashboard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-medium text-indigo-750 transition-colors cursor-pointer shadow-xs shrink-0"
              title="Ver Dashboard y Analíticas"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dashboard</span>
            </button>
          )}

          <button
            onClick={() => searchInputRef.current?.focus()}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Enfocar buscador"
          >
            <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-slate-300 font-mono text-[10px] font-black shadow-xs">F10</kbd>
            <span>Buscar</span>
          </button>
          
          <button
            onClick={() => {
              if (cart.length > 0) setIsPaymentOpen(true);
            }}
            disabled={cart.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-xl font-medium transition-colors cursor-pointer shrink-0 ${
              cart.length > 0 
                ? 'bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-slate-50 text-slate-400 border-slate-150 cursor-not-allowed'
            }`}
            title="Ir a cobrar la orden"
          >
            <kbd className={`px-1.5 py-0.5 rounded-lg border font-mono text-[10px] font-black shadow-xs ${
              cart.length > 0 ? 'bg-white border-indigo-300' : 'bg-slate-100 border-slate-200'
            }`}>F12</kbd>
            <span>Cobrar</span>
          </button>

          {permissions.registerExpenses && (
            <button
              onClick={() => {
                setExpensesForceCash(true);
                setIsExpensesOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-medium text-rose-700 transition-colors cursor-pointer shadow-xs shrink-0"
              title="Registrar Egresos de Caja"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Egresos</span>
            </button>
          )}

          <button
            onClick={() => setIsCorteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50/50 hover:bg-rose-50 border border-rose-200 rounded-xl font-medium text-rose-700 transition-colors cursor-pointer shadow-xs shrink-0"
            title="Realizar Corte de Turno de hoy (F6)"
          >
            <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-rose-300 font-mono text-[10px] font-black shadow-xs">F6</kbd>
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <span>Corte de Turno</span>
          </button>
        </footer>

        {/* Floating Mobile Cart Bar (visible only on mobile when cart drawer is closed) */}
        {!isMobileCartOpen && (
          <div
            onClick={() => setIsMobileCartOpen(true)}
            className="md:hidden fixed bottom-3 left-3 right-3 z-30 bg-indigo-600 text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between font-bold cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-700 rounded-xl relative">
                <ShoppingCart className="w-5 h-5 text-white" />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-indigo-100">
                  {cart.length === 0 ? 'Ver carrito (Vacío)' : `Ver Carrito (${cart.reduce((s, i) => s + i.quantity, 0)} art.)`}
                </div>
                <div className="text-[10px] text-indigo-200 font-medium">Toca para abrir resumen</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black font-mono bg-indigo-750/90 px-3 py-1.5 rounded-xl border border-indigo-500/40">
                RD$ {totals.total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <ChevronUp className="w-5 h-5 text-indigo-200 animate-bounce" />
            </div>
          </div>
        )}

      </div>

      {/* Mobile Cart Overlay Backdrop */}
      {isMobileCartOpen && (
        <div
          onClick={() => setIsMobileCartOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 animate-fade-in"
        />
      )}

      {/* Right Column / Mobile Drawer: Order Summary */}
      <aside
        className={`fixed inset-x-0 bottom-0 top-12 z-40 bg-white border-t border-slate-200 flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 md:relative md:top-0 md:inset-auto md:w-[380px] md:shrink-0 md:border-t-0 md:border-l md:translate-y-0 ${
          isMobileCartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'
        }`}
      >
        
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-gray-900 uppercase tracking-tight">Resumen de Pedido</h2>
              <p className="text-[10px] text-gray-400">Total artículos: {cart.reduce((s, i) => s + i.quantity, 0)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {cart.length > 0 && (
              <>
                <button
                  id="hold-cart-btn"
                  type="button"
                  onClick={() => {
                    setPendingRefName(`Venta #${todaysSalesCount + 1}`);
                    setIsSavingPending(true);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                  title="Poner esta orden en espera"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Guardar
                </button>
                <button
                  id="clear-cart-btn"
                  onClick={handleClearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100/50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vaciar
                </button>
              </>
            )}

            {/* Close button on mobile drawer */}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors ml-1 cursor-pointer"
              title="Cerrar resumen"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Save Reference form */}
        {isSavingPending && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePutOnHold(pendingRefName);
              setPendingRefName('');
              setIsSavingPending(false);
            }}
            className="p-3 bg-indigo-50/50 border-b border-indigo-100 flex items-center gap-2 shrink-0 animate-scale-up"
          >
            <input autoComplete="off"
              type="text"
              placeholder="Referencia (ej: Mesa 3, Juan...)"
              value={pendingRefName}
              onChange={(e) => setPendingRefName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              autoFocus
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSavingPending(false);
                setPendingRefName('');
              }}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
            >
              X
            </button>
          </form>
        )}

        {/* Customer & Price List Selector */}
        <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-700 truncate focus:outline-none cursor-pointer flex-1"
            >
              <option value="">Cliente: Público General</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.priceListId ? '🏷️' : ''}
                </option>
              ))}
            </select>
          </div>
          {totals.activePriceList && (
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0 animate-fade-in" title="Precio Mayorista/Lista aplicado">
              🏷️ {totals.activePriceList.name} (+{totals.activePriceList.profitPercent}%)
            </span>
          )}
        </div>

        {/* Cart List Container */}
        <div 
          ref={cartListRef}
          className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 bg-white"
        >
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="w-14 h-14 rounded-full bg-indigo-50/60 text-indigo-500 flex items-center justify-center mb-3">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-700 text-sm">El carrito está vacío</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                Haga clic sobre un producto de la izquierda para agregarlo a la orden de venta.
              </p>
            </div>
          ) : (
            effectiveCart.map((item) => {
              const originalProduct = products.find(p => p.id === item.product.id) || item.product;
              const itemKey = getCartItemKey(item.product.id, item.packagingId);
              const effInfo = (item as any)._effectiveInfo;
              return (
                <CartItemRow
                  key={itemKey}
                  item={item}
                  originalPrice={originalProduct.price}
                  priceListName={effInfo?.appliedPriceListName || totals.activePriceList?.name}
                  bulkTierApplied={effInfo?.bulkTierApplied}
                  appliedPriceType={effInfo?.appliedType}
                  priceListFallbackNoCost={effInfo?.priceListFallbackNoCost}
                  onIncrement={handleIncrementQuantity}
                  onDecrement={handleDecrementQuantity}
                  onRemove={handleRemoveFromCart}
                  onOverridePrice={(cartItem) => setPriceOverrideModalItem(cartItem)}
                  isSelected={selectedCartItemId === itemKey}
                  onSelect={() => setSelectedCartItemId(itemKey)}
                />
              );
            })
          )}
        </div>

        {/* Cart Calculations Area */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4 shrink-0">
          <div className="space-y-1.5 text-xs text-slate-500 font-medium">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="text-slate-800 font-bold">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>ITBIS (18%):</span>
              <span className="text-slate-800 font-bold">${totals.tax.toFixed(2)}</span>
            </div>
            <div
              onDoubleClick={() => {
                if (cart.length > 0) {
                  setIsCartTotalOverrideOpen(true);
                }
              }}
              onTouchEnd={() => {
                const now = Date.now();
                if (now - lastTotalNetoTapRef.current < 300) {
                  if (cart.length > 0) {
                    setIsCartTotalOverrideOpen(true);
                  }
                }
                lastTotalNetoTapRef.current = now;
              }}
              className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200 cursor-pointer select-none hover:bg-slate-100/80 p-1.5 rounded-lg transition-colors"
              title="Doble clic o doble toque para ajustar el total de la venta"
            >
              <span>Total Neto:</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action and fast checkout helpers */}
          <div className="space-y-2 pt-2">
            {/* Fast cash shortcuts */}
            {cart.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    setIsPaymentOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 font-bold flex items-center justify-center gap-1 cursor-pointer bg-white shadow-sm transition-all"
                >
                  <Coins className="w-3.5 h-3.5 text-slate-400" />
                  Efectivo Rápido
                </button>
                <button
                  onClick={() => {
                    const ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
                    const saleData: Sale = {
                      id: crypto.randomUUID(),
                      items: [...effectiveCart],
                      total: totals.finalTotal,
                      paymentMethod: 'card',
                      amountPaid: totals.finalTotal,
                      change: 0,
                      date: new Date().toLocaleString('es-ES', { hour12: false }),
                      ticketNumber,
                    };
                    handleFinishSale(saleData);
                    setIsPaymentOpen(true); // Open payment screen directly on Completed layout
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 font-bold flex items-center justify-center gap-1 cursor-pointer bg-white shadow-sm transition-all"
                >
                  <span>💳 Tarjeta Exacta</span>
                </button>
              </div>
            )}

            {/* Main Action Trigger */}
            <button
              id="checkout-btn"
              onClick={() => setIsPaymentOpen(true)}
              disabled={cart.length === 0}
              className={`w-full py-4 px-4 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                cart.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:shadow-indigo-600/35 active:scale-[0.98] cursor-pointer'
              }`}
            >
              <span>Proceder al Cobro</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Ultima Venta Detalle */}
            {lastEmployeeSale !== null && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-xs mt-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-100 pb-1.5 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                    Última Venta
                  </span>
                  <span className="font-mono text-slate-400 font-medium">#{lastEmployeeSale.ticketNumber.split('-')[1] || lastEmployeeSale.ticketNumber}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 divide-x divide-slate-100 text-center">
                  <div className="px-1">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Total</div>
                    <div className="text-sm font-black text-slate-800">${lastEmployeeSale.total.toFixed(2)}</div>
                  </div>
                  <div className="px-1">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Método</div>
                    <div className="text-xs font-extrabold text-slate-700 truncate mt-0.5" title={lastEmployeeSale.paymentMethod}>
                      {lastEmployeeSale.paymentMethod === 'cash' ? '💵 Efectivo' :
                       lastEmployeeSale.paymentMethod === 'card' ? '💳 Tarjeta' :
                       lastEmployeeSale.paymentMethod === 'transfer' ? '🏦 Transf.' :
                       lastEmployeeSale.paymentMethod === 'mixed' ? '🔀 Mixto' :
                       lastEmployeeSale.paymentMethod === 'credit' ? '👥 Crédito' : '📱 QR'}
                    </div>
                  </div>
                  <div className="px-1">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Cambio</div>
                    <div className={`text-sm font-black ${lastEmployeeSale.change > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      ${lastEmployeeSale.change.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </aside>

      {/* --- Fixed Live Clock (Bottom Right) --- */}
      <div className="fixed bottom-3 right-4 z-30 pointer-events-none select-none">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white/90 backdrop-blur-md text-slate-700 border border-slate-200/90 shadow-md shadow-slate-900/5">
          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
        </div>
      </div>

      {/* --- Floating Non-blocking Toast Notification --- */}
      {toastMessage && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center gap-2.5 text-xs font-bold animate-fade-in backdrop-blur-md pointer-events-none">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --- Modals and Drawers Layouts --- */}
      
      {/* 1. Payment Modal */}
      {isPaymentOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Módulo de Pago...</span>
            </div>
          </div>
        }>
          <PaymentModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            cartItems={effectiveCart}
            subtotal={totals.subtotal}
            tax={totals.tax}
            total={totals.total}
            onSubmitSale={handleFinishSale}
            clerkName={clerkName}
            storeIdentity={storeIdentity}
            customers={customers}
            sales={salesHistory}
            customerPayments={customerPayments}
            customerRefunds={customerRefunds}
            creditNotes={creditNotes}
            onUpdateCreditNote={handleUpdateCreditNote}
            dashboardConfig={dashboardConfig}
            initialCustomerId={selectedCustomerId}
            onSelectCustomer={(cid) => setSelectedCustomerId(cid)}
          />
        </React.Suspense>
      )}

      {/* Clientes View Manager Modal */}
      {isCustomersOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Módulo de Clientes...</span>
            </div>
          </div>
        }>
          <CustomersView
            isOpen={isCustomersOpen}
            onClose={handleCloseCustomers}
            customers={customers}
            sales={salesHistory}
            clerkName={clerkName}
            currentEmployee={currentEmployee}
            customerPayments={customerPayments}
            customerRefunds={customerRefunds}
            preSelectedCustomerId={preSelectedCustomerId}
            dashboardConfig={dashboardConfig}
          />
        </React.Suspense>
      )}

      {/* Dashboard View Manager Modal */}
      {showDashboard && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Dashboard...</span>
            </div>
          </div>
        }>
          <DashboardView
            isOpen={showDashboard}
            onClose={() => setShowDashboard(false)}
            products={products}
            sales={salesHistory}
            customers={customers}
            customerPayments={customerPayments}
            customerRefunds={customerRefunds}
            creditNotes={creditNotes}
            employees={employees}
            closures={closures}
            movements={movements}
            onNavigateToCustomer={handleNavigateToCustomer}
            onNavigateToProduct={handleNavigateToProduct}
            onOpenExpenses={() => setIsExpensesOpen(true)}
            currentEmployee={currentEmployee}
            payables={payables}
            payablePayments={payablePayments}
            dashboardConfig={dashboardConfig}
            cardDeposits={cardDeposits}
            onOpenMenudo={() => setIsMenudoOpen(true)}
            supplierReturns={supplierReturns}
            supplierCreditNotes={supplierCreditNotes}
            purchaseOrders={purchaseOrders}
            purchaseReceipts={purchaseReceipts}
          />
        </React.Suspense>
      )}

      {/* Expenses Modal */}
      {isExpensesOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Registro de Gastos...</span>
            </div>
          </div>
        }>
          <ExpensesModal
            isOpen={isExpensesOpen}
            onClose={() => {
              setIsExpensesOpen(false);
              setExpensesForceCash(false);
            }}
            movements={movements}
            currentEmployee={currentEmployee}
            clerkName={clerkName}
            forcePaymentMethod={expensesForceCash ? 'cash' : undefined}
            closures={closures}
          />
        </React.Suspense>
      )}

      {/* 2. Admin Slide Drawer */}
      {isAdminOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Panel de Administración...</span>
            </div>
          </div>
        }>
          <AdminDrawer
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
            onOpenDatabase={() => setIsDbOpen(true)}
            identity={storeIdentity}
            onUpdateIdentity={handleUpdateIdentity}
            permissions={permissions}
            dashboardConfig={dashboardConfig}
            onUpdateDashboardConfig={handleUpdateDashboardConfig}
            products={products}
            categories={categories}
            customers={customers}
            salesHistory={salesHistory}
            customerPayments={customerPayments}
            customerRefunds={customerRefunds}
            payables={payables}
            payablePayments={payablePayments}
            creditNotes={creditNotes}
            supplierCreditNotes={supplierCreditNotes}
            movements={movements}
            supplierReturns={supplierReturns}
            closures={closures}
            currentEmployee={currentEmployee}
            cardDeposits={cardDeposits}
            suppliers={suppliers}
          />
        </React.Suspense>
      )}

      {/* Special Products Manager View */}
      {isProductsManagerOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Catálogo de Productos...</span>
            </div>
          </div>
        }>
          <ProductsView
            isOpen={isProductsManagerOpen}
            onClose={handleCloseProductsManager}
            products={products}
            categories={categories}
            dashboardConfig={dashboardConfig}
            onAddProduct={handleAddProduct}
            onDeleteProduct={handleDeleteProduct}
            sales={salesHistory}
            initialTab={preSelectedProductTab}
            initialProductId={preSelectedProductId}
            permissions={permissions}
          />
        </React.Suspense>
      )}

      {/* 3. Firestore Database Control Center Modal */}
      {isDbOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Centro de Datos...</span>
            </div>
          </div>
        }>
          <DatabaseControlCenter
            isOpen={isDbOpen}
            onClose={() => setIsDbOpen(false)}
          />
        </React.Suspense>
      )}

      {/* 4. Corte de Turno Modal */}
      {isCorteOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Corte de Turno...</span>
            </div>
          </div>
        }>
          <CorteTurnoModal
            isOpen={isCorteOpen}
            onClose={() => {
              setIsCorteOpen(false);
              setMenudoTotalForCorte(null);
            }}
            salesHistory={salesHistory}
            clerkName={clerkName}
            currentEmployee={currentEmployee}
            closures={closures}
            movements={movements}
            customerRefunds={customerRefunds}
            dashboardConfig={dashboardConfig}
            onSuccess={() => {
              handleCorteSuccess();
              setMenudoTotalForCorte(null);
            }}
            externalCashTotal={menudoTotalForCorte}
            onOpenMenudo={() => setIsMenudoOpen(true)}
          />
        </React.Suspense>
      )}

      {/* 5. Tickets History Modal */}
      {isTicketsModalOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Historial de Tickets...</span>
            </div>
          </div>
        }>
          <TicketsModal
            isOpen={isTicketsModalOpen}
            onClose={() => setIsTicketsModalOpen(false)}
            salesHistory={salesHistory}
            onUpdateSalesHistory={(updatedSales) => setSalesHistory(updatedSales)}
            products={products}
            onUpdateProducts={(updatedProducts) => setProducts(updatedProducts)}
            storeIdentity={storeIdentity}
            clerkName={clerkName}
            currentEmployee={currentEmployee}
            closures={closures}
            customerRefunds={customerRefunds}
            onAddCustomerRefund={handleAddCustomerRefund}
            creditNotes={creditNotes}
            onAddCreditNote={handleAddCreditNote}
            dashboardConfig={dashboardConfig}
          />
        </React.Suspense>
      )}

      {/* 6. Generic Product Modal */}
      {isGenericModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Agregar Producto Genérico</h3>
              <button 
                onClick={() => {
                  setIsGenericModalOpen(false);
                  setGenericName('');
                  setGenericPrice('');
                  setGenericTaxExempt(false);
                }} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const priceVal = parseFloat(genericPrice);
              if (!genericName.trim() || isNaN(priceVal) || priceVal < 0) {
                showAlert('Error', 'Por favor ingresa una descripción válida y un precio mayor o igual a 0.');
                return;
              }
              const syntheticProd: Product = {
                id: crypto.randomUUID(),
                name: genericName.trim(),
                price: priceVal,
                category: 'Genérico',
                stock: 999999,
                color: 'bg-slate-500',
                emoji: '📦',
                taxExempt: genericTaxExempt,
                visible: true
              };
              handleAddToCart(syntheticProd);
              setIsGenericModalOpen(false);
              setGenericName('');
              setGenericPrice('');
              setGenericTaxExempt(false);
            }} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nombre / Descripción</label>
                <input autoComplete="off"
                  type="text"
                  required
                  placeholder="Ej. Reparación de pantalla, Artículo de limpieza..."
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Precio (ITBIS Incluido)</label>
                <input autoComplete="off"
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={genericPrice}
                  onChange={(e) => setGenericPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="generic-tax-exempt"
                  checked={genericTaxExempt}
                  onChange={(e) => setGenericTaxExempt(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label htmlFor="generic-tax-exempt" className="text-xs font-semibold text-slate-600 select-none">
                  Exento de ITBIS (18%)
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsGenericModalOpen(false);
                    setGenericName('');
                    setGenericPrice('');
                    setGenericTaxExempt(false);
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors"
                >
                  Agregar al Carrito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Menudo Modal */}
      {isMenudoOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Desglose de Efectivo...</span>
            </div>
          </div>
        }>
          <MenudoModal
            isOpen={isMenudoOpen}
            onClose={() => setIsMenudoOpen(false)}
            onApplyTotal={(total) => {
              setMenudoTotalForCorte(total);
              setIsCorteOpen(true);
            }}
            isCorteOpen={isCorteOpen}
          />
        </React.Suspense>
      )}

      {/* Packaging Selector Modal */}
      <PackagingSelectModal
        isOpen={!!selectedProductForPackaging}
        onClose={() => setSelectedProductForPackaging(null)}
        product={selectedProductForPackaging}
        onSelectPackaging={handleAddToCart}
      />

      {/* Manual Price Override Modal */}
      <PriceOverrideModal
        isOpen={!!priceOverrideModalItem}
        onClose={() => setPriceOverrideModalItem(null)}
        item={priceOverrideModalItem}
        onConfirm={handleApplyPriceOverride}
        onReset={handleResetPriceOverride}
      />

      {/* Cart Total Override Modal */}
      <CartTotalOverrideModal
        isOpen={isCartTotalOverrideOpen}
        onClose={() => setIsCartTotalOverrideOpen(false)}
        cartItems={effectiveCart}
        currentTotal={totals.total}
        onConfirm={handleApplyCartTotalOverride}
        onResetAll={handleResetAllPriceOverrides}
      />
    </div>
  );
}
