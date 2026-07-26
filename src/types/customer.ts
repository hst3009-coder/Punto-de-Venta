import { PaymentMethod } from './sale';

export interface ClientPriceList {
  id: string;
  name: string; // ej. "Mayorista", "Distribuidor"
  profitPercent: number; // % de ganancia sobre el costo, aplicado a todos los productos
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
