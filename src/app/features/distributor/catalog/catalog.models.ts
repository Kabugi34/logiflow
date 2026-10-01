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
  minimumOrderQty: number;
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED';
  addedAt: string;
  notes: string;
}

export interface DistributorCatalogProduct {
  sku: string;
  name: string;
  manufacturerName: string;
  category: string;
  brand: string;
  unit: string;
  stock: number;
  description: string;
}
