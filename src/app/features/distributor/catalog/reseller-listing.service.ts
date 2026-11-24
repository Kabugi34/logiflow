import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import {
  CreateResellerListingRequest,
  EligibleResellerProduct,
  ResellerListing,
  resellerAvailability,
  resellerListingStatus,
  UpdateResellerRetailPriceRequest,
} from './reseller-listing.models';

interface ApiResellerListing extends Omit<ResellerListing, 'status' | 'availability'> {
  status: string;
  availability: string;
}

@Injectable({ providedIn: 'root' })
export class DistributorResellerListingService {
  private readonly http = inject(HttpClient);

  eligibleProducts(): Observable<EligibleResellerProduct[]> {
    return this.http.get<EligibleResellerProduct[]>(API_ENDPOINTS.distributor.eligibleResellerProducts);
  }

  list(): Observable<ResellerListing[]> {
    return this.http.get<ApiResellerListing[]>(API_ENDPOINTS.distributor.resellerListings)
      .pipe(map((rows) => rows.map((row) => this.toListing(row))));
  }

  get(id: string): Observable<ResellerListing> {
    return this.http.get<ApiResellerListing>(API_ENDPOINTS.distributor.resellerListing(id))
      .pipe(map((row) => this.toListing(row)));
  }

  create(request: CreateResellerListingRequest): Observable<ResellerListing> {
    return this.http.post<ApiResellerListing>(API_ENDPOINTS.distributor.resellerListings, request)
      .pipe(map((row) => this.toListing(row)));
  }

  updateRetailPrice(id: string, request: UpdateResellerRetailPriceRequest): Observable<ResellerListing> {
    return this.http.patch<ApiResellerListing>(API_ENDPOINTS.distributor.resellerListingPrice(id), request)
      .pipe(map((row) => this.toListing(row)));
  }

  pause(id: string): Observable<ResellerListing> {
    return this.http.post<ApiResellerListing>(API_ENDPOINTS.distributor.resellerListingPause(id), {})
      .pipe(map((row) => this.toListing(row)));
  }

  resume(id: string): Observable<ResellerListing> {
    return this.http.post<ApiResellerListing>(API_ENDPOINTS.distributor.resellerListingResume(id), {})
      .pipe(map((row) => this.toListing(row)));
  }

  archive(id: string): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.distributor.resellerListing(id));
  }

  productImageUrl(product: Pick<EligibleResellerProduct, 'manufacturerProductId' | 'imageUrl'>): string {
    // The backend's eligible-product DTO currently sets imageUrl to null. Its
    // published-product image route is tenant-visible to authenticated Distributors.
    return product.imageUrl || API_ENDPOINTS.distributor.productImage(product.manufacturerProductId);
  }

  private toListing(row: ApiResellerListing): ResellerListing {
    return {
      ...row,
      status: resellerListingStatus(row.status),
      availability: resellerAvailability(row.availability),
    };
  }
}

