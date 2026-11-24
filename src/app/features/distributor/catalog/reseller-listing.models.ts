export type ResellerListingStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
export type ResellerAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

/** Matches EligibleResellerProductResponse in the backend. */
export interface EligibleResellerProduct {
  manufacturerProductId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  category: string | null;
  unit: string | null;
  manufacturerName: string;
  alreadyListed: boolean;
  acceptedQuantity: number;
  availableQuantity: number;
}

/** Matches ResellerListingResponse in the backend. */
export interface ResellerListing {
  id: string;
  distributorOrganizationId: string;
  manufacturerProductId: string;
  retailPrice: number;
  currency: string;
  status: ResellerListingStatus;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  availability: ResellerAvailability;
  productName: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  category: string | null;
  unit: string | null;
  manufacturerName: string;
  distributorName: string;
}

export interface CreateResellerListingRequest {
  manufacturerProductId: string;
  retailPrice: number;
}

export interface UpdateResellerRetailPriceRequest {
  retailPrice: number;
}

export function resellerListingStatus(value: string): ResellerListingStatus {
  return value === 'ACTIVE' || value === 'PAUSED' || value === 'ARCHIVED' ? value : 'UNKNOWN';
}

export function resellerAvailability(value: string): ResellerAvailability {
  return value === 'IN_STOCK' || value === 'OUT_OF_STOCK' ? value : 'UNKNOWN';
}

