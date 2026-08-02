import { useState, useEffect } from 'react';
import {
  Product,
  Sale,
  PendingSale,
  Customer,
  CustomerPayment,
  CustomerRefund,
  CreditNote,
  Movement,
  Employee,
  Closure,
  AccountPayable,
  PayablePayment,
  SupplierReturn,
  SupplierCreditNote,
  CardDeposit,
  StoreIdentity,
  DashboardConfig,
} from '../types';
import { firestoreService } from '../lib/firebase';
import { getSaleTimestamp } from '../lib/dates';

const DEFAULT_STORE_IDENTITY: StoreIdentity = {
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

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  id: 'dashboardConfig',
  cardFeePercent: 3.8,
  holidays: [],
};

const saveCreditNotesToStorage = (notes: CreditNote[]) => {
  const sanitized = notes.map((cn) => ({ ...cn, code: undefined }));
  localStorage.setItem('pos_credit_notes', JSON.stringify(sanitized));
};

export function useFirestoreData(enabled: boolean) {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('pos_products');
    return saved ? JSON.parse(saved) : [];
  });

  const [salesHistory, setSalesHistory] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('pos_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [pendingSales, setPendingSales] = useState<PendingSale[]>(() => {
    const saved = localStorage.getItem('pos_pending_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('pos_customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>(() => {
    const saved = localStorage.getItem('pos_customer_payments');
    return saved ? JSON.parse(saved) : [];
  });

  const [customerRefunds, setCustomerRefunds] = useState<CustomerRefund[]>(() => {
    const saved = localStorage.getItem('pos_customer_refunds');
    return saved ? JSON.parse(saved) : [];
  });

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    const saved = localStorage.getItem('pos_credit_notes');
    return saved ? JSON.parse(saved) : [];
  });

  const [movements, setMovements] = useState<Movement[]>(() => {
    const saved = localStorage.getItem('pos_movements');
    return saved ? JSON.parse(saved) : [];
  });

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [closures, setClosures] = useState<Closure[]>(() => {
    const saved = localStorage.getItem('pos_closures');
    return saved ? JSON.parse(saved) : [];
  });

  const [payables, setPayables] = useState<AccountPayable[]>(() => {
    const saved = localStorage.getItem('pos_payables');
    return saved ? JSON.parse(saved) : [];
  });

  const [payablePayments, setPayablePayments] = useState<PayablePayment[]>(() => {
    const saved = localStorage.getItem('pos_payable_payments');
    return saved ? JSON.parse(saved) : [];
  });

  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>(() => {
    const saved = localStorage.getItem('pos_supplier_returns');
    return saved ? JSON.parse(saved) : [];
  });

  const [supplierCreditNotes, setSupplierCreditNotes] = useState<SupplierCreditNote[]>(() => {
    const saved = localStorage.getItem('pos_supplier_credit_notes');
    return saved ? JSON.parse(saved) : [];
  });

  const [cardDeposits, setCardDeposits] = useState<CardDeposit[]>(() => {
    const saved = localStorage.getItem('pos_card_deposits');
    return saved ? JSON.parse(saved) : [];
  });

  const [storeIdentity, setStoreIdentity] = useState<StoreIdentity>(() => {
    const saved = localStorage.getItem('pos_store_identity');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_STORE_IDENTITY;
  });

  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(() => {
    const saved = localStorage.getItem('pos_dashboard_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_DASHBOARD_CONFIG;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [dbQuotaExceeded, setDbQuotaExceeded] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    setIsSyncing(true);

    const handleQuotaError = (err: any) => {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
        setDbQuotaExceeded(true);
      }
    };

    // 1. Products
    const unsubProducts = firestoreService.subscribeToCollection<Product>(
      'products',
      (dbProducts) => {
        setProducts(dbProducts);
        setIsSyncing(false);
      },
      (err) => {
        console.error('Firestore products subscription error:', err);
        handleQuotaError(err);
        setIsSyncing(false);
      }
    );

    // 2. Sales
    const unsubSales = firestoreService.subscribeToCollection<Sale>(
      'sales',
      (dbSales) => {
        const sorted = [...dbSales].sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a));
        setSalesHistory(sorted);
      },
      (err) => {
        console.error('Firestore sales subscription error:', err);
        handleQuotaError(err);
      }
    );

    // 3. Pending Sales
    const unsubPendingSales = firestoreService.subscribeToCollection<PendingSale>(
      'pending_sales',
      (dbPending) => {
        const sorted = [...dbPending].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setPendingSales(sorted);
        localStorage.setItem('pos_pending_sales', JSON.stringify(sorted));
      },
      (err) => {
        console.error('Firestore pending sales subscription error:', err);
        handleQuotaError(err);
      }
    );

    // 4. Customers
    const unsubCustomers = firestoreService.subscribeToCollection<Customer>(
      'customers',
      (dbCustomers) => {
        setCustomers(dbCustomers);
        localStorage.setItem('pos_customers', JSON.stringify(dbCustomers));
      },
      (err) => {
        console.error('Firestore customers subscription error:', err);
      }
    );

    // 5. Customer Payments
    const unsubCustomerPayments = firestoreService.subscribeToCollection<CustomerPayment>(
      'customerPayments',
      (dbPayments) => {
        setCustomerPayments(dbPayments);
        localStorage.setItem('pos_customer_payments', JSON.stringify(dbPayments));
      },
      (err) => {
        console.error('Firestore customer payments subscription error:', err);
      }
    );

    // 6. Customer Refunds
    const unsubCustomerRefunds = firestoreService.subscribeToCollection<CustomerRefund>(
      'customerRefunds',
      (dbRefunds) => {
        setCustomerRefunds(dbRefunds);
        localStorage.setItem('pos_customer_refunds', JSON.stringify(dbRefunds));
      },
      (err) => {
        console.error('Firestore customer refunds subscription error:', err);
      }
    );

    // 7. Credit Notes
    const unsubCreditNotes = firestoreService.subscribeToCollection<CreditNote>(
      'creditNotes',
      (dbNotes) => {
        setCreditNotes(dbNotes);
        saveCreditNotesToStorage(dbNotes);
      },
      (err) => {
        console.error('Firestore credit notes subscription error:', err);
      }
    );

    // 8. Movements
    const unsubMovements = firestoreService.subscribeToCollection<Movement>(
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

    // 9. Employees
    const unsubEmployees = firestoreService.subscribeToCollection<Employee>(
      'employees',
      (dbEmployees) => {
        setEmployees(dbEmployees);
      },
      (err) => {
        console.error('Firestore employees subscription error:', err);
      }
    );

    // 10. Closures
    const unsubClosures = firestoreService.subscribeToCollection<Closure>(
      'closures',
      (dbClosures) => {
        const sorted = [...dbClosures].sort(
          (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        );
        setClosures(sorted);
        localStorage.setItem('pos_closures', JSON.stringify(sorted));
      },
      (err) => {
        console.error('Firestore closures subscription error:', err);
      }
    );

    // 11. Accounts Payable
    const unsubPayables = firestoreService.subscribeToCollection<AccountPayable>(
      'accountsPayable',
      (dbPayables) => {
        setPayables(dbPayables);
        localStorage.setItem('pos_payables', JSON.stringify(dbPayables));
      },
      (err) => {
        console.error('Firestore accountsPayable subscription error:', err);
      }
    );

    // 12. Payable Payments
    const unsubPayablePayments = firestoreService.subscribeToCollection<PayablePayment>(
      'payablePayments',
      (dbPayments) => {
        setPayablePayments(dbPayments);
        localStorage.setItem('pos_payable_payments', JSON.stringify(dbPayments));
      },
      (err) => {
        console.error('Firestore payablePayments subscription error:', err);
      }
    );

    // 13. Supplier Returns
    const unsubSupplierReturns = firestoreService.subscribeToCollection<SupplierReturn>(
      'supplierReturns',
      (dbReturns) => {
        setSupplierReturns(dbReturns);
        localStorage.setItem('pos_supplier_returns', JSON.stringify(dbReturns));
      },
      (err) => {
        console.error('Firestore supplierReturns subscription error:', err);
      }
    );

    // 14. Supplier Credit Notes
    const unsubSupplierCreditNotes = firestoreService.subscribeToCollection<SupplierCreditNote>(
      'supplierCreditNotes',
      (dbNotes) => {
        setSupplierCreditNotes(dbNotes);
        localStorage.setItem('pos_supplier_credit_notes', JSON.stringify(dbNotes));
      },
      (err) => {
        console.error('Firestore supplierCreditNotes subscription error:', err);
      }
    );

    // 15. Card Deposits
    const unsubCardDeposits = firestoreService.subscribeToCollection<CardDeposit>(
      'cardDeposits',
      (dbDeposits) => {
        setCardDeposits(dbDeposits);
        localStorage.setItem('pos_card_deposits', JSON.stringify(dbDeposits));
      },
      (err) => {
        console.error('Firestore cardDeposits subscription error:', err);
      }
    );

    // 16. Configs (store_identity and dashboardConfig)
    const unsubConfigs = firestoreService.subscribeToCollection<any>(
      'configs',
      (dbConfigs) => {
        const identityDoc = dbConfigs.find((c) => c.id === 'store_identity');
        if (identityDoc) {
          setStoreIdentity(identityDoc);
          localStorage.setItem('pos_store_identity', JSON.stringify(identityDoc));
        } else {
          firestoreService.setDocWithId('configs', 'store_identity', DEFAULT_STORE_IDENTITY);
        }

        const configDoc = dbConfigs.find((c) => c.id === 'dashboardConfig');
        if (configDoc) {
          setDashboardConfig(configDoc);
          localStorage.setItem('pos_dashboard_config', JSON.stringify(configDoc));
        } else {
          firestoreService.setDocWithId('configs', 'dashboardConfig', DEFAULT_DASHBOARD_CONFIG);
        }
      },
      (err) => {
        console.error('Firestore configs subscription error:', err);
        handleQuotaError(err);
      }
    );

    return () => {
      unsubProducts();
      unsubSales();
      unsubPendingSales();
      unsubCustomers();
      unsubCustomerPayments();
      unsubCustomerRefunds();
      unsubCreditNotes();
      unsubMovements();
      unsubEmployees();
      unsubClosures();
      unsubPayables();
      unsubPayablePayments();
      unsubSupplierReturns();
      unsubSupplierCreditNotes();
      unsubCardDeposits();
      unsubConfigs();
    };
  }, [enabled]);

  return {
    products,
    setProducts,
    salesHistory,
    setSalesHistory,
    sales: salesHistory,
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
    setEmployees,
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
    cardDeposits,
    setCardDeposits,
    storeIdentity,
    setStoreIdentity,
    dashboardConfig,
    setDashboardConfig,
    isSyncing,
    dbQuotaExceeded,
  };
}
