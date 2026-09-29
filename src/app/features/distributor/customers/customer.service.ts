import { Injectable, signal } from '@angular/core';
import { DistributorCustomer } from './customer.models';

@Injectable({ providedIn: 'root' })
export class DistributorCustomerService {
  private readonly customerRecords = signal<DistributorCustomer[]>([
    { id: 'CL-MET-991', storeName: 'Metro Retail Chicago', destinationName: 'West-Side Retail Hub Gate #4', destinationAddress: '2400 Madison St, Chicago, IL' },
    { id: 'CL-PAC-204', storeName: 'Pacific Logistics SFO', destinationName: 'Bayview Distribution Dock 2', destinationAddress: '1800 Evans Ave, San Francisco, CA' },
    { id: 'CL-VLT-310', storeName: 'VoltLine Solutions Corp', destinationName: 'VoltLine Receiving Yard', destinationAddress: '455 Industrial Pkwy, Gary, IN' },
    { id: 'CL-IST-118', storeName: 'InterState Supply Ltd', destinationName: 'InterState Warehouse B', destinationAddress: '900 Commerce Dr, Milwaukee, WI' },
    { id: 'CL-NTM-452', storeName: 'North Tech Machinery', destinationName: 'North Tech Plant Gate 1', destinationAddress: '72 Foundry Rd, Detroit, MI' }
  ]);

  readonly customers = this.customerRecords.asReadonly();

  findById(id: string): DistributorCustomer | undefined {
    return this.customerRecords().find(customer => customer.id === id);
  }
}
