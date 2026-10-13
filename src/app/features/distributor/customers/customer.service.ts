import { Injectable, signal } from '@angular/core';
import { DistributorCustomer } from './customer.models';

@Injectable({ providedIn: 'root' })
export class DistributorCustomerService {
  private readonly customerRecords = signal<DistributorCustomer[]>([
    { id: 'CL-MET-991', storeName: 'Metro Retail Nairobi', destinationName: 'Westlands Distribution Hub', destinationAddress: 'Waiyaki Way, Westlands, Nairobi' },
    { id: 'CL-PAC-204', storeName: 'Coastline Retail Mombasa', destinationName: 'Shimanzi Receiving Dock 2', destinationAddress: 'Shimanzi Road, Mombasa' },
    { id: 'CL-VLT-310', storeName: 'VoltLine Solutions Kenya', destinationName: 'VoltLine Receiving Yard', destinationAddress: 'Mombasa Road, Athi River' },
    { id: 'CL-IST-118', storeName: 'Lake Region Supply Ltd', destinationName: 'Kisumu Distribution Warehouse', destinationAddress: 'Kisumu-Kakamega Road, Kisumu' },
    { id: 'CL-NTM-452', storeName: 'Rift Valley Machinery', destinationName: 'Rift Valley Plant Gate 1', destinationAddress: 'Uganda Road, Eldoret' }
  ]);

  readonly customers = this.customerRecords.asReadonly();

  findById(id: string): DistributorCustomer | undefined {
    return this.customerRecords().find(customer => customer.id === id);
  }
}
