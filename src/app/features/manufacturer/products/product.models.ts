export type ProductStatus = 'ACTIVE' | 'LOW STOCK' | 'CRITICAL STOCK';

export interface ManufacturerProduct {
  id: number;
  name: string;
  sku: string;
  brand: string;
  category: string;
  unit: string;
  stock: number;
  status: ProductStatus;
  image: string;
  description: string;
  inventory: ProductInventory[];
  movements: ProductMovement[];
}

export interface ProductInventory {
  terminal: string;
  reserved: number;
  available: number;
}

export interface ProductMovement {
  title: string;
  detail: string;
  date: string;
}
