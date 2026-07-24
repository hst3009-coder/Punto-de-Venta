export interface ProductPackaging {
  id: string;
  name: string; // ej. "Caja de 12", "Pallet de 100"
  unitsPerPackage: number;
  price: number; // precio de venta de ESE empaque completo
  taxExempt?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  color: string; // Tailwind bg color class for visual style
  emoji: string; // Emoji representing the product
  imageUrl?: string; // Image URL representing the product
  barcode?: string;
  createdAt?: string;
  code?: string;
  sku?: string;
  cost?: number;
  profitPercent?: number;
  visible?: boolean;
  provider?: string;
  expirationDate?: string;
  isKit?: boolean;
  kitComponents?: Array<{ productId: string; code: string; name: string; quantity: number; cost: number; price: number }>;
  packagings?: ProductPackaging[];
  minStock?: number;
  taxExempt?: boolean;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  packagingId?: string;
  selectedPackaging?: ProductPackaging;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'qr' | 'credit' | 'mixed';

export interface PaymentBreakdownItem {
  id: string;
  method: 'cash' | 'card' | 'transfer' | 'credit' | 'credit_note';
  amount: number;
  bankAccountId?: string;
  creditNoteCode?: string;
  creditNoteId?: string;
}

export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdownItem[];
  amountPaid: number;
  change: number;
  date: string;
  ticketNumber: string;
  createdAt?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  cancelledAt?: string;
  returnedItems?: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    reason: string;
    date: string;
  }[];
  soldBy?: {
    id: string;
    name: string;
  };
  customerId?: string;
  customerName?: string;
  isCredit?: boolean;
  creditStatus?: 'pending' | 'paid';
  creditPaidAt?: string;
  bankAccountId?: string;
}

// --- New Firestore Collections Types ---

export interface AccountPayable {
  id: string;
  supplierName: string;
  concept: string;
  totalAmount: number;
  dueDate: string; // fecha de vencimiento
  status: 'pending' | 'paid';
  employeeId?: string;
  employeeName?: string;
  createdAt?: string;
}

export interface SupplierCreditNote {
  id: string;
  supplierName: string;
  originalAmount: number;
  remainingBalance: number;
  reason: string;
  linkedReturnId?: string; // si vino de una devolución a proveedor
  status: 'active' | 'depleted';
  employeeId?: string;
  employeeName?: string;
  createdAt?: string;
}

export interface PayablePayment {
  id: string;
  payableId: string;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit_note';
  employeeId?: string;
  employeeName?: string;
  createdAt?: string;
  bankAccountId?: string;
  supplierCreditNoteId?: string;
}

export interface Bank {
  id: string;
  name: string;
  accountNumber: string;
  balance: number;
  currency: string;
  createdAt?: string;
}

export interface CardDeposit {
  id: string;
  batchDate: string; // día en que se hicieron las ventas con tarjeta
  expectedDepositDate: string; // día laboral siguiente calculado
  grossAmount: number;
  feePercent: number; // snapshot de la comisión al momento de crearse
  netAmount: number; // grossAmount * (1 - feePercent/100)
  status: 'pending' | 'confirmed';
  confirmedAmount?: number;
  confirmedAt?: string;
  confirmedByEmployeeId?: string;
  confirmedByEmployeeName?: string;
  createdAt?: string;
}

export interface PaymentTypeConfig {
  id: string;
  label: string;
  active: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountLabel: string;
  active: boolean;
}

export interface TicketConfig {
  width: '58mm' | '80mm';
  fontFamily: 'mono' | 'sans' | 'serif';
  showLogo: boolean;
  showSlogan: boolean;
  showTaxBreakdown: boolean;
  showEmployeeName: boolean;
  showFooterMessage: boolean;
  footerMessageText: string;
}

export interface ClientPriceList {
  id: string;
  name: string; // ej. "Mayorista", "Distribuidor"
  profitPercent: number; // % de ganancia sobre el costo, aplicado a todos los productos
}

export interface DashboardConfig {
  id: string;
  cardFeePercent: number; // default 3.8
  defaultInitialCash?: number; // default 500
  holidays: string[]; // fechas YYYY-MM-DD de días feriados/no laborables
  paymentTypes?: PaymentTypeConfig[];
  bankAccounts?: BankAccount[];
  ticketConfig?: TicketConfig;
  categoryProfitTargets?: Record<string, number>;
  clientPriceLists?: ClientPriceList[];
}

export interface Closure {
  id: string;
  date: string;
  clerkName: string;
  employeeId?: string;
  initialCash: number;
  expectedCash: number;
  actualCash: number;
  salesTotal: number;
  difference: number;
  status: 'open' | 'closed';
  createdAt?: string;
  pendingCashCount?: boolean;
  closedByAdminId?: string;
  closedByAdminName?: string;
}

export interface Config {
  id: string;
  storeName: string;
  storeAddress?: string;
  taxRate: number;
  currencySymbol: string;
  ticketFooter?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  creditLimit?: number;
  noCreditLimit?: boolean;
  openingDebt?: number;
  priceListId?: string;
  createdAt?: string;
}

export interface CreditNote {
  id: string;
  code: string; // código corto único, ej. 8 caracteres alfanuméricos en mayúscula
  originalAmount: number;
  remainingBalance: number;
  status: 'active' | 'depleted' | 'voided';
  createdFromRefundId?: string;
  employeeId?: string;
  employeeName?: string;
  createdAt?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedByEmployeeId?: string;
  voidedByEmployeeName?: string;
}

export interface CustomerRefund {
  id: string;
  saleId: string;
  ticketNumber: string;
  amount: number;
  method: 'cash' | 'credit_note' | 'credit_reduction';
  creditNoteId?: string;
  customerId?: string; // solo si method es credit_reduction
  reason: string;
  date: string;
  employeeId?: string;
  employeeName?: string;
  createdAt?: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  paymentMethod?: PaymentMethod;
  employeeId?: string;
  employeeName?: string;
  bankAccountId?: string;
}

export interface EmployeePermissions {
  viewDashboard: boolean;
  manageEmployees: boolean;
  manageProducts: boolean;
  bulkEditProducts: boolean;
  importProducts: boolean;
  manageCustomers: boolean;
  registerPayments: boolean;
  registerExpenses?: boolean;
  closeShift: boolean;
  voidSales: boolean;
  accessDatabaseTools: boolean;
  editStoreSettings: boolean;
  managePayables?: boolean;
  manageReturns?: boolean;
  confirmBankDeposits?: boolean;
  exportFullBackup?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'cashier' | 'manager';
  email?: string;
  pinHash?: string;
  pinSalt?: string;
  active: boolean;
  createdAt?: string;
  permissions?: EmployeePermissions;
}

export interface Movement {
  id: string;
  type: 'out';
  amount: number;
  concept: string;
  category: string; // e.g. "Servicios", "Renta", "Suministros", "Nómina", "Otro"
  paymentMethod: 'cash' | 'card' | 'transfer';
  bankAccountId?: string;
  clerkName: string;
  employeeId?: string;
  employeeName?: string;
  date: string;
  createdAt?: string;
  expenseType?: 'gasto' | 'pago_factura';
  invoiceNumber?: string;
  isOperational?: boolean;
  source?: 'shift' | 'dashboard';
}

export interface PriceList {
  id: string;
  name: string;
  description?: string;
  discountPercentage?: number;
  active: boolean;
  createdAt?: string;
}

export interface ProductPrice {
  id: string; // product ID
  productId: string;
  productName: string;
  priceListId: string;
  priceListName: string;
  specialPrice: number;
  createdAt?: string;
}

export interface SupplierReturn {
  id: string;
  supplierId?: string;
  supplierName: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  cost: number;
  status: 'pending' | 'credited';
  date: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
}

export interface StoreIdentity {
  id: string;
  name: string;
  showNameOnInvoice: boolean;
  slogan: string;
  showSloganOnInvoice: boolean;
  address: string;
  showAddressOnInvoice: boolean;
  phone: string;
  showPhoneOnInvoice: boolean;
  logoUrl: string; // Base64 or icon
  showLogoOnInvoice: boolean;
}

export interface PendingSale {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: 'close_shift_admin' | 'void_credit_note' | 'change_permissions';
  description: string; // texto legible, ej. "Cerró el turno de Juan Pérez (pendiente de contar)"
  employeeId?: string;
  employeeName?: string;
  targetEmployeeId?: string; // si aplica (a quién afectó la acción)
  createdAt?: string;
}


