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

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
}
