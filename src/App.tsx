import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Product, Category, CartItem, Sale, StoreIdentity, PendingSale, Employee, Customer, CustomerPayment, Closure, EmployeePermissions, Movement, AccountPayable, PayablePayment, DashboardConfig, CardDeposit, SupplierReturn, CustomerRefund, CreditNote, SupplierCreditNote, ProductPackaging } from './types';
import { PRODUCTS, CATEGORIES } from './data/products';
import { ProductCard } from './components/ProductCard';
import { CartItemRow } from './components/CartItemRow';
import { PackagingSelectModal } from './components/PackagingSelectModal';
import { PaymentModal } from './components/PaymentModal';
import { CorteTurnoModal } from './components/CorteTurnoModal';
import { TicketsModal } from './components/TicketsModal';
import { CustomersView } from './components/CustomersView';
import { ExpensesModal } from './components/ExpensesModal';
import { MenudoModal } from './components/MenudoModal';
import { AdminDrawer } from './components/AdminDrawer';
import { DatabaseControlCenter } from './components/DatabaseControlCenter';
import { ProductsView } from './components/products/ProductsView';
import { DashboardView } from './components/DashboardView';
import { firestoreService, authService } from './lib/firebase';
import { roundCents, roundUpToNearestFive } from './lib/money';
import { getSaleTimestamp } from './lib/dates';
import { getListPrice } from './lib/priceLists';
import { matchesProductSearch, rankSearchResults } from './lib/search';
import { LoginScreen } from './components/LoginScreen';
import { PinLockScreen } from './components/PinLockScreen';
import { getEmployeePermissions, ROLE_DEFAULT_PERMISSIONS } from './lib/permissions';
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
  TrendingDown
} from 'lucide-react';

export default function App() {
  const { showAlert, showConfirm } = useAlert();

  // --- Authentication State ---
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (user) => {
      if (user) {
        if (user.email && user.email.toLowerCase() === 'hst.30.09@gmail.com') {
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

  // --- Core State ---
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('pos_products');
    return saved ? JSON.parse(saved) : [];
  });

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
  
  const [salesHistory, setSalesHistory] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('pos_sales');
    return saved ? JSON.parse(saved) : [];
  });

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
  const permissions = useMemo(() => getEmployeePermissions(currentEmployee), [currentEmployee]);
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

  const [storeIdentity, setStoreIdentity] = useState<StoreIdentity>(() => {
    const saved = localStorage.getItem('pos_store_identity');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      id: 'store_identity',
      name: 'MI NEGOCIO',
      showNameOnInvoice: true,
      slogan: 'Terminal de Punto de Venta Inteligente',
      showSloganOnInvoice: true,
      address: 'Av. Principal #123, Ciudad de México',
      showAddressOnInvoice: true,
      phone: '555-019-2834',
      showPhoneOnInvoice: true,
      logoUrl: '🛒',
      showLogoOnInvoice: true,
    };
  });

  const handleUpdateIdentity = useCallback(async (updated: StoreIdentity) => {
    setStoreIdentity(updated);
    localStorage.setItem('pos_store_identity', JSON.stringify(updated));
    try {
      await firestoreService.setDocWithId('configs', 'store_identity', updated);
    } catch (err) {
      console.error('Error updating identity in Firestore:', err);
    }
  }, []);

  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(() => {
    const saved = localStorage.getItem('pos_dashboard_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      id: 'dashboardConfig',
      cardFeePercent: 3.8,
      holidays: [],
    };
  });

  const handleUpdateDashboardConfig = useCallback(async (updated: DashboardConfig) => {
    setDashboardConfig(updated);
    localStorage.setItem('pos_dashboard_config', JSON.stringify(updated));
    try {
      await firestoreService.setDocWithId('configs', 'dashboardConfig', updated);
    } catch (err) {
      console.error('Error updating dashboard config in Firestore:', err);
    }
  }, []);

  const [pendingSales, setPendingSales] = useState<PendingSale[]>(() => {
    const saved = localStorage.getItem('pos_pending_sales');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [pendingRefName, setPendingRefName] = useState('');
  const [selectedProductForPackaging, setSelectedProductForPackaging] = useState<Product | null>(null);

  const getCartItemKey = (productId: string, packagingId?: string): string => {
    return packagingId ? `${productId}_pkg_${packagingId}` : productId;
  };

  // --- Customers State ---
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('pos_customers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const activePriceList = useMemo(() => {
    if (!activeCustomer?.priceListId) return null;
    return (dashboardConfig?.clientPriceLists || []).find(pl => pl.id === activeCustomer.priceListId) || null;
  }, [activeCustomer, dashboardConfig?.clientPriceLists]);

  const effectiveCart = useMemo(() => {
    if (!activePriceList) return cart;
    return cart.map((item) => {
      if (item.selectedPackaging) return item;
      return {
        ...item,
        product: {
          ...item.product,
          price: getListPrice(item.product, activePriceList),
        },
      };
    });
  }, [cart, activePriceList]);
  
  // --- Totals Computations ---
  const totals = useMemo(() => {
    let totalSubtotal = 0;
    let totalTax = 0;
    let rawTotal = 0;

    effectiveCart.forEach((item) => {
      const itemTotal = item.product.price * item.quantity;
      rawTotal += itemTotal;

      if (item.product.taxExempt) {
        totalSubtotal += itemTotal;
      } else {
        const itemSubtotal = roundCents(itemTotal / 1.18);
        const itemTax = roundCents(itemTotal - itemSubtotal);
        totalSubtotal += itemSubtotal;
        totalTax += itemTax;
      }
    });

    const finalTotal = roundUpToNearestFive(rawTotal);
    
    return { 
      subtotal: roundCents(totalSubtotal), 
      tax: roundCents(totalTax), 
      total: finalTotal, 
      finalTotal,
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
      items: [...cart],
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
  const [employees, setEmployees] = useState<Employee[]>([]);

  // --- Generic Product Modal States ---
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [genericName, setGenericName] = useState('');
  const [genericPrice, setGenericPrice] = useState('');
  const [genericTaxExempt, setGenericTaxExempt] = useState(false);

  // --- Expenses Modal Cash-Only State ---
  const [expensesForceCash, setExpensesForceCash] = useState(false);

  const [movements, setMovements] = useState<Movement[]>(() => {
    const saved = localStorage.getItem('pos_movements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>(() => {
    const saved = localStorage.getItem('pos_customer_payments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [customerRefunds, setCustomerRefunds] = useState<CustomerRefund[]>(() => {
    const saved = localStorage.getItem('pos_customer_refunds');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    const saved = localStorage.getItem('pos_credit_notes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [closures, setClosures] = useState<Closure[]>(() => {
    const saved = localStorage.getItem('pos_closures');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [payables, setPayables] = useState<AccountPayable[]>(() => {
    const saved = localStorage.getItem('pos_payables');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [cardDeposits, setCardDeposits] = useState<CardDeposit[]>(() => {
    const saved = localStorage.getItem('pos_card_deposits');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [payablePayments, setPayablePayments] = useState<PayablePayment[]>(() => {
    const saved = localStorage.getItem('pos_payable_payments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>(() => {
    const saved = localStorage.getItem('pos_supplier_returns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [supplierCreditNotes, setSupplierCreditNotes] = useState<SupplierCreditNote[]>(() => {
    const saved = localStorage.getItem('pos_supplier_credit_notes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [showClerkInput, setShowClerkInput] = useState(false);
  const [tempClerkName, setTempClerkName] = useState(clerkName);
  const [recentTicket, setRecentTicket] = useState<Sale | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbQuotaExceeded, setDbQuotaExceeded] = useState(false);

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

  // --- Real-time Firestore Sync Hooks ---
  useEffect(() => {
    if (!authUser) return;
    setIsSyncing(true);
    // Listen to live products from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<Product>(
      'products',
      (dbProducts) => {
        setProducts(dbProducts);
        setIsSyncing(false);
      },
      (err) => {
        console.error('Firestore products subscription error:', err);
        const errMsg = err.message || String(err);
        if (errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
          setDbQuotaExceeded(true);
        }
        setIsSyncing(false);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live sales from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<Sale>(
      'sales',
      (dbSales) => {
        const sorted = [...dbSales].sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a));
        setSalesHistory(sorted);
      },
      (err) => {
        console.error('Firestore sales subscription error:', err);
        const errMsg = err.message || String(err);
        if (errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
          setDbQuotaExceeded(true);
        }
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to pending sales from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<PendingSale>(
      'pending_sales',
      (dbPending) => {
        const sorted = [...dbPending].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setPendingSales(sorted);
        localStorage.setItem('pos_pending_sales', JSON.stringify(sorted));
      },
      (err) => {
        console.error('Firestore pending sales subscription error:', err);
        const errMsg = err.message || String(err);
        if (errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
          setDbQuotaExceeded(true);
        }
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live customers from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<Customer>(
      'customers',
      async (dbCustomers) => {
        setCustomers(dbCustomers);
        localStorage.setItem('pos_customers', JSON.stringify(dbCustomers));
      },
      (err) => {
        console.error('Firestore customers subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live customer payments from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<CustomerPayment>(
      'customerPayments',
      (dbPayments) => {
        setCustomerPayments(dbPayments);
        localStorage.setItem('pos_customer_payments', JSON.stringify(dbPayments));
      },
      (err) => {
        console.error('Firestore customer payments subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live customer refunds from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<CustomerRefund>(
      'customerRefunds',
      (dbRefunds) => {
        setCustomerRefunds(dbRefunds);
        localStorage.setItem('pos_customer_refunds', JSON.stringify(dbRefunds));
      },
      (err) => {
        console.error('Firestore customer refunds subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  const saveCreditNotesToStorage = (notes: CreditNote[]) => {
    const sanitized = notes.map(cn => ({ ...cn, code: undefined }));
    localStorage.setItem('pos_credit_notes', JSON.stringify(sanitized));
  };

  useEffect(() => {
    if (!authUser) return;
    // Listen to live credit notes from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<CreditNote>(
      'creditNotes',
      (dbNotes) => {
        setCreditNotes(dbNotes);
        saveCreditNotesToStorage(dbNotes);
      },
      (err) => {
        console.error('Firestore credit notes subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    localStorage.setItem('pos_customer_payments', JSON.stringify(customerPayments));
  }, [customerPayments]);

  useEffect(() => {
    localStorage.setItem('pos_customer_refunds', JSON.stringify(customerRefunds));
  }, [customerRefunds]);

  useEffect(() => {
    saveCreditNotesToStorage(creditNotes);
  }, [creditNotes]);

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

  useEffect(() => {
    localStorage.setItem('pos_payables', JSON.stringify(payables));
  }, [payables]);

  useEffect(() => {
    localStorage.setItem('pos_payable_payments', JSON.stringify(payablePayments));
  }, [payablePayments]);

  useEffect(() => {
    localStorage.setItem('pos_supplier_returns', JSON.stringify(supplierReturns));
  }, [supplierReturns]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live movements from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<Movement>(
      'movements',
      (dbMovements) => {
        const sorted = [...dbMovements].sort((a, b) => {
          const timeA = new Date(a.createdAt || a.date).getTime();
          const timeB = new Date(b.createdAt || b.date).getTime();
          return timeB - timeA;
        });
        setMovements(sorted);
        localStorage.setItem('pos_movements', JSON.stringify(sorted));
      },
      (err) => {
        console.error('Firestore movements subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    localStorage.setItem('pos_movements', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live employees from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<Employee>(
      'employees',
      (dbEmployees) => {
        setEmployees(dbEmployees);
      },
      (err) => {
        console.error('Firestore employees subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live closures from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<Closure>(
      'closures',
      (dbClosures) => {
        const sorted = [...dbClosures].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setClosures(sorted);
        localStorage.setItem('pos_closures', JSON.stringify(sorted));
      },
      (err) => {
        console.error('Firestore closures subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live accounts payable from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<AccountPayable>(
      'accountsPayable',
      (dbPayables) => {
        setPayables(dbPayables);
        localStorage.setItem('pos_payables', JSON.stringify(dbPayables));
      },
      (err) => {
        console.error('Firestore accountsPayable subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live payable payments from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<PayablePayment>(
      'payablePayments',
      (dbPayments) => {
        setPayablePayments(dbPayments);
        localStorage.setItem('pos_payable_payments', JSON.stringify(dbPayments));
      },
      (err) => {
        console.error('Firestore payablePayments subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live supplier returns from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<SupplierReturn>(
      'supplierReturns',
      (dbReturns) => {
        setSupplierReturns(dbReturns);
        localStorage.setItem('pos_supplier_returns', JSON.stringify(dbReturns));
      },
      (err) => {
        console.error('Firestore supplierReturns subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live supplier credit notes from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<SupplierCreditNote>(
      'supplierCreditNotes',
      (dbNotes) => {
        setSupplierCreditNotes(dbNotes);
        localStorage.setItem('pos_supplier_credit_notes', JSON.stringify(dbNotes));
      },
      (err) => {
        console.error('Firestore supplierCreditNotes subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to live card deposits from Firestore
    const unsubscribe = firestoreService.subscribeToCollection<CardDeposit>(
      'cardDeposits',
      (dbDeposits) => {
        setCardDeposits(dbDeposits);
        localStorage.setItem('pos_card_deposits', JSON.stringify(dbDeposits));
      },
      (err) => {
        console.error('Firestore cardDeposits subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    // Listen to store identity from Firestore configs collection
    const unsubscribe = firestoreService.subscribeToCollection<any>(
      'configs',
      (dbConfigs) => {
        const identityDoc = dbConfigs.find((c) => c.id === 'store_identity');
        if (identityDoc) {
          setStoreIdentity(identityDoc);
          localStorage.setItem('pos_store_identity', JSON.stringify(identityDoc));
        } else {
          // If Firestore configuration doesn't exist yet, seed it with current state
          firestoreService.setDocWithId('configs', 'store_identity', storeIdentity);
        }

        const configDoc = dbConfigs.find((c) => c.id === 'dashboardConfig');
        if (configDoc) {
          setDashboardConfig(configDoc);
          localStorage.setItem('pos_dashboard_config', JSON.stringify(configDoc));
        } else {
          // If Firestore dashboardConfig doesn't exist yet, seed it with default state
          firestoreService.setDocWithId('configs', 'dashboardConfig', dashboardConfig);
        }
      },
      (err) => {
        console.error('Firestore configs subscription error:', err);
        const errMsg = err.message || String(err);
        if (errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
          setDbQuotaExceeded(true);
        }
      }
    );

    return () => unsubscribe();
  }, [authUser]);

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

    setCart((prevCart) => {
      const targetKey = getCartItemKey(product.id, packaging?.id);
      const existingIndex = prevCart.findIndex(
        (item) => getCartItemKey(item.product.id, item.packagingId) === targetKey
      );

      if (existingIndex > -1) {
        return prevCart.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
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
        },
      ];
    });
    setSelectedCartItemId(getCartItemKey(product.id, packaging?.id));
    setSearchQuery(''); // Clear search query upon selection
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

  // --- Keyboard Shortcuts & Barcode Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If payment modal is open, ignore global app shortcuts
      if (isPaymentOpen) {
        // We still allow Escape to close the modal if it's not handled by the modal itself,
        // but the user said "all app level shortcuts (F1... F12) should be IGNORED completely".
        if (e.key === 'F1' || e.key === 'F3' || e.key === 'F4' || e.key === 'F6' || e.key === 'F10' || e.key === 'F12') {
          e.preventDefault();
          return;
        }
        // If Escape is pressed and isPaymentOpen is true, let it fall through to the Esc handler below
        // which closes all modals, or we could handle it specifically here.
        // The instructions say: "Escape can continue to work to close the payment modal if that logic already exists".
      }

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      );

      // Focus search: F10 or Ctrl + K with priority over browser
      if (e.key === 'F10' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        setSearchQuery(''); // Clear what was written on F10
        searchInputRef.current?.focus();
        return;
      }
      // Toggle Products view with F3 (priority over browser search/find)
      if (e.key === 'F3') {
        e.preventDefault();
        setIsProductsManagerOpen((prev) => !prev);
        return;
      }
      // Toggle Customers view with F4
      if (e.key === 'F4') {
        e.preventDefault();
        setIsCustomersOpen((prev) => !prev);
        return;
      }
      // Toggle Corte de Turno with F6
      if (e.key === 'F6') {
        e.preventDefault();
        setIsCorteOpen((prev) => !prev);
        return;
      }
      // Go back to POS with F1
      if (e.key === 'F1') {
        e.preventDefault();
        setIsProductsManagerOpen(false);
        setIsCustomersOpen(false);
        return;
      }
      // Open Payment modal: F12 with priority over browser
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
        return;
      }
      // Esc to close drawers and modals with priority
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPaymentOpen(false);
        setIsAdminOpen(false);
        setIsDbOpen(false);
        setIsCorteOpen(false);
        setShowClerkInput(false);
        setIsProductsManagerOpen(false);
        setIsCustomersOpen(false);
        setIsExpensesOpen(false);
        return;
      }

      // If typing in any input element, ignore navigational/increment hotkeys
      if (isInput) {
        // Special exception: if active element is the search input and searchQuery is empty,
        // we want '+' and '-' to be handled by cart navigation, not typed!
        const isSearchInput = activeEl === searchInputRef.current;
        if (isSearchInput && searchQuery.trim() === '') {
          if (e.key === '+' || e.key === '=' || e.key === '-') {
            // let it pass through to the cart handlers below
          } else {
            return;
          }
        } else {
          return;
        }
      } else {
        // If not in an input, and typing a printable key, focus the search input!
        const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== '+' && e.key !== '-' && e.key !== '=' && e.key !== ' ';
        if (isPrintableKey && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }

      // Cart Navigation using Arrow keys
      if (cart.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const currentIndex = cart.findIndex((item) => item.product.id === selectedCartItemId);
          if (currentIndex === -1) {
            setSelectedCartItemId(cart[0].product.id);
          } else {
            const nextIndex = (currentIndex + 1) % cart.length;
            setSelectedCartItemId(cart[nextIndex].product.id);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const currentIndex = cart.findIndex((item) => item.product.id === selectedCartItemId);
          if (currentIndex === -1) {
            setSelectedCartItemId(cart[cart.length - 1].product.id);
          } else {
            const prevIndex = (currentIndex - 1 + cart.length) % cart.length;
            setSelectedCartItemId(cart[prevIndex].product.id);
          }
        } else if (e.key === '+' || e.key === '=') {
          if (selectedCartItemId) {
            e.preventDefault();
            handleIncrementQuantity(selectedCartItemId);
          }
        } else if (e.key === '-') {
          if (selectedCartItemId) {
            e.preventDefault();
            handleDecrementQuantity(selectedCartItemId);
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedCartItemId) {
            e.preventDefault();
            handleRemoveFromCart(selectedCartItemId);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    selectedCartItemId,
    handleIncrementQuantity,
    handleDecrementQuantity,
    handleRemoveFromCart,
    searchQuery,
    setSearchQuery
  ]);

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
    const matchedProduct = products.find((p) => {
      const cleanBarcode = p.barcode ? p.barcode.trim().replace(/^0+/, '') : '';
      const cleanId = p.id ? p.id.trim().replace(/^0+/, '') : '';
      return (cleanBarcode && cleanBarcode === cleanQueryCode) || (cleanId && cleanId === cleanQueryCode);
    });

    if (matchedProduct) {
      handleAddToCart(matchedProduct);
      setSearchQuery(''); // Reset search bar
    } else {
      const matched = products.filter((p) => {
        if (p.visible === false) return false;
        const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
        return matchCategory && matchesProductSearch(p, cleanQuery);
      });
      const ranked = rankSearchResults(matched, cleanQuery, recentSalesCount);
      if (ranked.length > 0) {
        handleAddToCart(ranked[0]);
        setSearchQuery(''); // Reset search bar
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
      await firestoreService.updateDoc('products', productId, { stock: nextStock });
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

    // Always perform local stock deduction and add sale record to local state immediately
    const updatedProducts = products.map((p) => {
      const itemsForProduct = cart.filter(
        (item) => item.product.id === p.id && item.product.category !== 'Genérico'
      );
      if (itemsForProduct.length > 0) {
        const totalUnitsDeducted = itemsForProduct.reduce((sum, item) => {
          const qty = item.selectedPackaging
            ? item.selectedPackaging.unitsPerPackage * item.quantity
            : item.quantity;
          return sum + qty;
        }, 0);
        return { ...p, stock: p.stock - totalUnitsDeducted };
      }
      return p;
    });

    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

    setSalesHistory((prevSales) => {
      const updatedSales = [saleWithEmployee, ...prevSales.filter(s => s.id !== saleWithEmployee.id)];
      localStorage.setItem('pos_sales', JSON.stringify(updatedSales));
      return updatedSales;
    });

    // Calculate credit note deductions from local state and prepare Firestore batch update operations
    let updatedCreditNotes = [...creditNotes];
    const creditNoteBatchOps: Array<{ id: string; remainingBalance: number; status: 'active' | 'depleted' | 'voided' }> = [];

    if (saleWithEmployee.paymentBreakdown && saleWithEmployee.paymentBreakdown.length > 0) {
      const cnRows = saleWithEmployee.paymentBreakdown.filter(b => b.method === 'credit_note' && (b.amount || 0) > 0);
      for (const row of cnRows) {
        const applied = roundCents(Number(row.amount) || 0);
        const currentNote = updatedCreditNotes.find(cn => 
          (row.creditNoteId && cn.id === row.creditNoteId) ||
          (row.creditNoteCode && cn.code.toUpperCase() === row.creditNoteCode.toUpperCase())
        );

        if (currentNote) {
          const newRemaining = roundCents(Math.max(0, currentNote.remainingBalance - applied));
          const newStatus: 'active' | 'depleted' | 'voided' = newRemaining === 0 ? 'depleted' : 'active';

          const updatedNote = {
            ...currentNote,
            remainingBalance: newRemaining,
            status: newStatus,
          };

          updatedCreditNotes = updatedCreditNotes.map(cn => cn.id === currentNote.id ? updatedNote : cn);
          creditNoteBatchOps.push({
            id: currentNote.id,
            remainingBalance: newRemaining,
            status: newStatus,
          });
        }
      }
    }

    if (creditNoteBatchOps.length > 0) {
      setCreditNotes(updatedCreditNotes);
      saveCreditNotesToStorage(updatedCreditNotes);
    }

    try {
      const operations: Array<{
        type: 'set' | 'update' | 'delete';
        collectionName: string;
        id: string;
        data?: any;
        merge?: boolean;
      }> = [];

      // 1. Add operation to save sale record to Firestore
      operations.push({
        type: 'set',
        collectionName: 'sales',
        id: saleWithEmployee.id,
        data: saleWithEmployee,
        merge: true,
      });

      // 2. Add operations to deduct stock from products in Firestore
      for (const prod of updatedProducts) {
        const original = products.find((p) => p.id === prod.id);
        if (original && original.stock !== prod.stock) {
          operations.push({
            type: 'update',
            collectionName: 'products',
            id: prod.id,
            data: { stock: prod.stock },
          });
        }
      }

      // 3. Add operations to deduct credit note balances in Firestore (atomically in the same batch)
      for (const cnOp of creditNoteBatchOps) {
        operations.push({
          type: 'update',
          collectionName: 'creditNotes',
          id: cnOp.id,
          data: {
            remainingBalance: cnOp.remainingBalance,
            status: cnOp.status,
          }
        });
      }

      // Execute all operations atomically in a single batch (sales + product stock + credit notes)
      await firestoreService.runBatch(operations);
    } catch (err) {
      console.error('Error completing sale in Firestore:', err);
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
    const filtered = products.filter((prod) => {
      if (prod.visible === false) return false;
      const matchCategory = selectedCategory === 'all' || prod.category === selectedCategory;
      const matchQuery = matchesProductSearch(prod, debouncedSearchQuery);
      return matchCategory && matchQuery;
    });

    return rankSearchResults(filtered, debouncedSearchQuery, recentSalesCount);
  }, [products, selectedCategory, debouncedSearchQuery, recentSalesCount]);

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
    <div className="h-screen w-screen bg-slate-50 text-slate-800 flex font-sans antialiased overflow-hidden">
      
      {/* Left Column: Header, Products & Shortcuts */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50">
        
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
                <div className="flex items-center gap-2">
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
                    <input
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
        <footer className="bg-white border-t border-slate-200 py-3 px-6 text-xs text-slate-500 flex flex-wrap justify-center items-center gap-3 shrink-0">
          
          {permissions.manageProducts && (
            <button
              onClick={() => setIsProductsManagerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-medium text-indigo-700 transition-colors cursor-pointer shadow-xs"
              title="Catálogo de Productos y Suministro (F3)"
            >
              <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-indigo-300 font-mono text-[10px] font-black shadow-xs">F3</kbd>
              <span>Productos</span>
            </button>
          )}

          {permissions.manageCustomers && (
            <button
              onClick={() => setIsCustomersOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-medium text-indigo-700 transition-colors cursor-pointer shadow-xs"
              title="Cartera de Clientes y Créditos (F4)"
            >
              <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-indigo-300 font-mono text-[10px] font-black shadow-xs">F4</kbd>
              <span>Clientes</span>
            </button>
          )}

          {permissions.viewDashboard && (
            <button
              onClick={() => setShowDashboard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-medium text-indigo-750 transition-colors cursor-pointer shadow-xs"
              title="Ver Dashboard y Analíticas"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dashboard</span>
            </button>
          )}

          <button
            onClick={() => searchInputRef.current?.focus()}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 transition-colors cursor-pointer"
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
            className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-xl font-medium transition-colors cursor-pointer ${
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
              onClick={() => setIsExpensesOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-medium text-rose-700 transition-colors cursor-pointer shadow-xs"
              title="Registrar Egresos de Caja"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Egresos</span>
            </button>
          )}

          <button
            onClick={() => setIsCorteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50/50 hover:bg-rose-50 border border-rose-200 rounded-xl font-medium text-rose-700 transition-colors cursor-pointer shadow-xs"
            title="Realizar Corte de Turno de hoy (F6)"
          >
            <kbd className="bg-white px-1.5 py-0.5 rounded-lg border border-rose-300 font-mono text-[10px] font-black shadow-xs">F6</kbd>
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <span>Corte de Turno</span>
          </button>
        </footer>

      </div>

      {/* Right Column: Order Summary (reaches from top to bottom, pegged to the right) */}
      <aside className="w-[380px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-2xl relative z-10">
        
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
          
          {cart.length > 0 && (
            <div className="flex items-center gap-1.5">
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
            </div>
          )}
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
            <input
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
          className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-white"
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
              return (
                <CartItemRow
                  key={itemKey}
                  item={item}
                  originalPrice={originalProduct.price}
                  priceListName={totals.activePriceList?.name}
                  onIncrement={handleIncrementQuantity}
                  onDecrement={handleDecrementQuantity}
                  onRemove={handleRemoveFromCart}
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
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200">
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
                      items: [...cart],
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

            {permissions.registerExpenses && (
              <button
                type="button"
                onClick={() => {
                  setExpensesForceCash(true);
                  setIsExpensesOpen(true);
                }}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer mb-1"
                title="Registrar una salida rápida de efectivo del cajón de dinero"
              >
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>Salida de Efectivo</span>
              </button>
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
                <input
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
                <input
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
    </div>
  );
}
