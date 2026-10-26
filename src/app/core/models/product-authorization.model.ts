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
  requestedAt: string;
  decidedAt: string | null;
}
