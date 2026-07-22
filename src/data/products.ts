import { Product, Category } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'Todos', emoji: '🛍️' },
  { id: 'cafeteria', name: 'Cafetería', emoji: '☕' },
  { id: 'bebidas', name: 'Bebidas Frías', emoji: '🥤' },
  { id: 'panaderia', name: 'Panadería', emoji: '🥐' },
  { id: 'comida', name: 'Alimentos', emoji: '🍔' },
  { id: 'postres', name: 'Postres', emoji: '🍰' },
];

export const PRODUCTS: Product[] = [
  // Cafetería
  { id: 'c1', name: 'Café Espresso', price: 2.50, category: 'cafeteria', stock: 99, color: 'bg-amber-50 text-amber-800 border-amber-200', emoji: '☕', barcode: '1001' },
  { id: 'c2', name: 'Café Americano', price: 3.00, category: 'cafeteria', stock: 99, color: 'bg-amber-50 text-amber-800 border-amber-200', emoji: '☕', barcode: '1002' },
  { id: 'c3', name: 'Capuccino', price: 3.75, category: 'cafeteria', stock: 50, color: 'bg-yellow-50 text-yellow-800 border-yellow-200', emoji: '🥛', barcode: '1003' },
  { id: 'c4', name: 'Café Latte', price: 3.75, category: 'cafeteria', stock: 60, color: 'bg-yellow-50 text-yellow-800 border-yellow-200', emoji: '🥤', barcode: '1004' },
  { id: 'c5', name: 'Té Matcha Latte', price: 4.25, category: 'cafeteria', stock: 30, color: 'bg-emerald-50 text-emerald-800 border-emerald-200', emoji: '🍵', barcode: '1005' },
  { id: 'c6', name: 'Té de Manzanilla', price: 2.75, category: 'cafeteria', stock: 40, color: 'bg-green-50 text-green-800 border-green-200', emoji: '🫖', barcode: '1006' },

  // Bebidas Frías
  { id: 'b1', name: 'Agua Mineral', price: 1.50, category: 'bebidas', stock: 120, color: 'bg-blue-50 text-blue-800 border-blue-200', emoji: '💧', barcode: '2001' },
  { id: 'b2', name: 'Coca-Cola Original', price: 2.00, category: 'bebidas', stock: 80, color: 'bg-red-50 text-red-800 border-red-200', emoji: '🥤', barcode: '2002' },
  { id: 'b3', name: 'Jugo de Naranja', price: 3.50, category: 'bebidas', stock: 25, color: 'bg-orange-50 text-orange-800 border-orange-200', emoji: '🍊', barcode: '2003' },
  { id: 'b4', name: 'Limonada Imperial', price: 3.00, category: 'bebidas', stock: 45, color: 'bg-lime-50 text-lime-800 border-lime-200', emoji: '🍋', barcode: '2004' },
  { id: 'b5', name: 'Smoothie de Fresa', price: 4.50, category: 'bebidas', stock: 20, color: 'bg-pink-50 text-pink-800 border-pink-200', emoji: '🍓', barcode: '2005' },

  // Panadería
  { id: 'p1', name: 'Croissant Mantequilla', price: 2.25, category: 'panaderia', stock: 35, color: 'bg-amber-50 text-amber-900 border-amber-200', emoji: '🥐', barcode: '3001' },
  { id: 'p2', name: 'Pan de Chocolate', price: 2.50, category: 'panaderia', stock: 25, color: 'bg-amber-50 text-amber-900 border-amber-200', emoji: '🍫', barcode: '3002' },
  { id: 'p3', name: 'Bagel con Queso Crema', price: 3.50, category: 'panaderia', stock: 15, color: 'bg-amber-50 text-amber-900 border-amber-200', emoji: '🥯', barcode: '3003' },
  { id: 'p4', name: 'Donut de Glaseado', price: 1.80, category: 'panaderia', stock: 40, color: 'bg-rose-50 text-rose-800 border-rose-200', emoji: '🍩', barcode: '3004' },

  // Alimentos
  { id: 'a1', name: 'Sandwich de Jamón y Queso', price: 5.50, category: 'comida', stock: 18, color: 'bg-stone-50 text-stone-800 border-stone-200', emoji: '🥪', barcode: '4001' },
  { id: 'a2', name: 'Hamburguesa Especial', price: 7.90, category: 'comida', stock: 12, color: 'bg-amber-50 text-amber-900 border-amber-200', emoji: '🍔', barcode: '4002' },
  { id: 'a3', name: 'Papas Fritas Crujientes', price: 3.00, category: 'comida', stock: 50, color: 'bg-yellow-50 text-yellow-800 border-yellow-200', emoji: '🍟', barcode: '4003' },
  { id: 'a4', name: 'Ensalada César', price: 6.50, category: 'comida', stock: 10, color: 'bg-emerald-50 text-emerald-800 border-emerald-200', emoji: '🥗', barcode: '4004' },
  { id: 'a5', name: 'Pizza Rebanada Pepperoni', price: 3.50, category: 'comida', stock: 16, color: 'bg-orange-50 text-orange-800 border-orange-200', emoji: '🍕', barcode: '4005' },

  // Postres
  { id: 'po1', name: 'Tarta de Queso', price: 4.50, category: 'postres', stock: 15, color: 'bg-pink-50 text-pink-800 border-pink-200', emoji: '🍰', barcode: '5001' },
  { id: 'po2', name: 'Muffin de Arándanos', price: 2.80, category: 'postres', stock: 22, color: 'bg-violet-50 text-violet-800 border-violet-200', emoji: '🧁', barcode: '5002' },
  { id: 'po3', name: 'Brownie de Chocolate', price: 3.20, category: 'postres', stock: 18, color: 'bg-stone-50 text-stone-800 border-stone-200', emoji: '🍫', barcode: '5003' },
  { id: 'po4', name: 'Galleta con Chips de Chocolate', price: 1.50, category: 'postres', stock: 35, color: 'bg-yellow-50 text-yellow-800 border-yellow-200', emoji: '🍪', barcode: '5004' },
];
