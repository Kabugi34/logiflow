import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerFleetService } from './fleet.service';

describe('ManufacturerFleetService', () => {
  let service: ManufacturerFleetService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ManufacturerFleetService);
    http = TestBed.inject(HttpTestingController);

    http.expectOne(`${API_ENDPOINTS.manufacturer.drivers}?size=100`).flush([]);
    http.expectOne(`${API_ENDPOINTS.manufacturer.vehicles}?size=100`).flush([]);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('sends the required identity and licence expiry fields when inviting a driver', () => {
    service
      .createDriverApi({
        name: 'Jordan Driver',
        email: 'JORDAN@example.com',
        phone: '+254712345678',
        license: 'ab-1234',
        nationalId: '12345678',
        licenseExpiryDate: '2030-12-31',
      })
      .subscribe();

    const request = http.expectOne(API_ENDPOINTS.manufacturer.drivers);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      fullName: 'Jordan Driver',
      email: 'jordan@example.com',
      phoneNumber: '+254712345678',
      licenseNumber: 'AB-1234',
      nationalId: '12345678',
      licenseExpiryDate: '2030-12-31',
      baseWarehouseId: null,
    });
    request.flush({
      id: 'driver-1',
      fullName: 'Jordan Driver',
      email: 'jordan@example.com',
      nationalId: '12345678',
      licenseExpiryDate: '2030-12-31',
    });
  });
});
