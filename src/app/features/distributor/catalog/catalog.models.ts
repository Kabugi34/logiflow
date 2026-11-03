export interface DistributorCatalogOffer {
  id: string;
  sourceStockItemId: string;
  manufacturerId: string;
  manufacturerName: string;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  unit: string;
  description: string;
  imageUrl: string;
  wholesalePrice: number | null;
  availableQuantity: number | null;
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
  wholesalePrice: number | null;
  availableQuantity: number | null;
  inStock: boolean | null;
  description: string;
  imageUrl: string;
  authorizationStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}
