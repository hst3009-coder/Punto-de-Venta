import { ClientPriceList } from './customer';

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

export interface Config {
  id: string;
  storeName: string;
  storeAddress?: string;
  taxRate: number;
  currencySymbol: string;
  ticketFooter?: string;
  updatedAt?: string;
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

export interface AuditLogEntry {
  id: string;
  action: 
    | 'close_shift_admin' 
    | 'void_credit_note' 
    | 'change_permissions'
    | 'confirm_bank_deposit'
    | 'register_supplier_return'
    | 'credit_supplier_return'
    | 'register_expense'
    | 'register_payment';
  description: string; // texto legible, ej. "Cerró el turno de Juan Pérez (pendiente de contar)"
  employeeId?: string;
  employeeName?: string;
  targetEmployeeId?: string; // si aplica (a quién afectó la acción)
  createdAt?: string;
}
