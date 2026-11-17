export type ProductAuthorizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export interface ProductAuthorization {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  manufacturerOrganizationId: string;
  manufacturerName: string;
  distributorOrganizationId: string;
  distributorName: string;
  status: ProductAuthorizationStatus;
  requestNote?: string | null;
  targetMarket?: string | null;
  salesChannels?: string | null;
  geographicalCoverage?: string | null;
  distributionStrategy?: string | null;
  agreedWholesalePrice?: number | null;
  minimumOrderQuantity?: number | null;
  requestedAt: string;
  decidedAt: string | null;
}
