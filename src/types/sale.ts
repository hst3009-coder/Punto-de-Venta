import { CartItem } from './product';

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

export interface PendingSale {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
  createdAt: string;
}

export interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  collectionName: string;
  id: string;
  data?: object;
  merge?: boolean;
}

export interface PendingSyncSale {
  id: string;
  timestamp: number;
  saleData: Sale;
  operations: BatchOperation[];
}
