export interface DistributorCatalogOffer {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  unit: string;
  listPrice: number;
  reorderThreshold: number;
  status: 'ACTIVE' | 'PAUSED';
  addedAt: string;
  notes: string;
}

export interface DistributorCatalogProduct {
  id: string;
  manufacturerId: string;
  sku: string;
  name: string;
  manufacturerName: string;
  category: string;
  brand: string;
  unit: string;
  stock: boolean;
  description: string;
  authorizationStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}
