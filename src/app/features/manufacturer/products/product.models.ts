export type ProductStatus = 'ACTIVE' | 'LOW STOCK' | 'CRITICAL STOCK';
export type ProductPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'DISCONTINUED';

export interface ManufacturerProduct {
  id: number | string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  unit: string;
  stock: number;
  status: ProductStatus;
  publicationStatus: ProductPublicationStatus;
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
