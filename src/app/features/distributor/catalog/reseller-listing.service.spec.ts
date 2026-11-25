import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorResellerListingService } from './reseller-listing.service';

describe('DistributorResellerListingService', () => {
  let service: DistributorResellerListingService;
  let httpTesting: HttpTestingController;

  const listing = {
    id: 'listing-1',
    distributorOrganizationId: 'seller-1',
    manufacturerProductId: 'product-1',
    retailPrice: 850,
    currency: 'KES',
    status: 'ACTIVE',
    quantityOnHand: 12,
    reservedQuantity: 2,
    availableQuantity: 10,
    availability: 'IN_STOCK',
    productName: 'Cement 50kg',
    description: 'Portland cement',
    imageUrl: '/api/v1/customer/catalog/reseller-listings/listing-1/image',
    brand: 'Acme',
    category: 'Building',
    unit: 'bag',
    manufacturerName: 'Acme Manufacturing',
    distributorName: 'Local Supply',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DistributorResellerListingService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('loads backend eligible purchase and listing contracts without client-supplied tenant IDs', () => {
    let eligible: unknown;
    let listings: unknown;
    service.eligibleProducts().subscribe((value) => (eligible = value));
    service.list().subscribe((value) => (listings = value));

    httpTesting.expectOne(API_ENDPOINTS.distributor.eligibleResellerProducts).flush([
      {
        manufacturerProductId: 'product-1', name: 'Cement 50kg', description: 'Portland cement',
        imageUrl: null, brand: 'Acme', category: 'Building', unit: 'bag',
        manufacturerName: 'Acme Manufacturing', alreadyListed: false, acceptedQuantity: 12,
        availableQuantity: 12,
      },
    ]);
    httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListings).flush([listing]);

    expect(eligible).toMatchObject([{ manufacturerProductId: 'product-1', acceptedQuantity: 12 }]);
    expect(listings).toMatchObject([{ id: 'listing-1', manufacturerProductId: 'product-1', distributorOrganizationId: 'seller-1', availableQuantity: 10 }]);
  });

  it('creates a listing using only the canonical Manufacturer product ID and retail price', () => {
    let createdId = '';
    service.create({ manufacturerProductId: 'product-1', retailPrice: 875 }).subscribe((value) => (createdId = value.id));
    const request = httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListings);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ manufacturerProductId: 'product-1', retailPrice: 875 });
    request.flush(listing);
    expect(createdId).toBe('listing-1');
  });

  it('uses the documented detail, price, visibility and archive operations', () => {
    service.get('listing-1').subscribe();
    httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListing('listing-1')).flush(listing);

    service.updateRetailPrice('listing-1', { retailPrice: 900 }).subscribe();
    const price = httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListingPrice('listing-1'));
    expect(price.request.method).toBe('PATCH');
    expect(price.request.body).toEqual({ retailPrice: 900 });
    price.flush({ ...listing, retailPrice: 900 });

    service.pause('listing-1').subscribe();
    const pause = httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListingPause('listing-1'));
    expect(pause.request.method).toBe('POST');
    pause.flush({ ...listing, status: 'PAUSED' });

    service.resume('listing-1').subscribe();
    const resume = httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListingResume('listing-1'));
    expect(resume.request.method).toBe('POST');
    resume.flush(listing);

    service.archive('listing-1').subscribe();
    const archive = httpTesting.expectOne(API_ENDPOINTS.distributor.resellerListing('listing-1'));
    expect(archive.request.method).toBe('DELETE');
    archive.flush(null);
  });

  it('uses the published canonical product image route when eligibility returns a null image URL', () => {
    expect(service.productImageUrl({ manufacturerProductId: 'product-1', imageUrl: null })).toBe(
      API_ENDPOINTS.distributor.productImage('product-1'),
    );
  });
});

