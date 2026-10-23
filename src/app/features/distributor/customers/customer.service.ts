import { Injectable, signal } from '@angular/core';
import { DistributorCustomer } from './customer.models';

@Injectable({ providedIn: 'root' })
export class DistributorCustomerService {
  // The backend currently has no distributor customer-directory endpoint.
  private readonly customerRecords = signal<DistributorCustomer[]>([]);
  readonly customers = this.customerRecords.asReadonly();
  findById(id: string): DistributorCustomer | undefined {
    return this.customerRecords().find((customer) => customer.id === id);
  }
}
