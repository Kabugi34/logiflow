import { Injectable, signal } from '@angular/core';
import { ManufacturerProduct } from './product.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerProductService {
  private readonly productRecords = signal<ManufacturerProduct[]>([
    {
      id: 1,
      name: 'Heavy Duty Hydraulic Motor',
      sku: 'HDM-092-X',
      brand: 'LogiCore',
      category: 'Motors',
      unit: 'Pcs',
      stock: 450,
      status: 'ACTIVE',
      image: 'assets/images/products/hydraulic-motor.jpg',
      description: 'High-displacement hydraulic motor designed for continuous duty in marine and heavy logistics applications.',
      inventory: [
        { terminal: 'Terminal Gate A-1 (Chicago)', reserved: 40, available: 240 },
        { terminal: 'Terminal Gate C-4 (Houston)', reserved: 12, available: 190 },
        { terminal: 'Terminal Gate W-2 (L.A.)', reserved: 0, available: 20 }
      ],
      movements: [
        { title: 'Standard Dispatch Complete', detail: '40 units sent to Terminal B-1', date: 'Today, 15:45' },
        { title: 'Manifest Synchronization', detail: 'Acme auto-approved 120 units', date: 'Yesterday' },
        { title: 'Quality Check Halt', detail: '5 units held due to gasket seals check', date: '3 days ago' }
      ]
    },
    {
      id: 2,
      name: 'High-Precision Gear Box',
      sku: 'HPG-881-A',
      brand: 'AeroDyn',
      category: 'Transmission',
      unit: 'Pcs',
      stock: 120,
      status: 'LOW STOCK',
      image: 'assets/images/products/gear-box.jpg',
      description: 'Precision-machined gear assembly for industrial drive systems.',
      inventory: [
        { terminal: 'Terminal Gate A-1 (Chicago)', reserved: 100, available: 20 },
        { terminal: 'Terminal Gate C-4 (Houston)', reserved: 0, available: 100 }
      ],
      movements: [
        { title: 'Stock threshold reached', detail: 'Inventory below the recommended level', date: 'Today, 09:20' }
      ]
    },
    {
      id: 3,
      name: 'Voltage Regulator Block',
      sku: 'VRB-332-Y',
      brand: 'VoltTech',
      category: 'Electronics',
      unit: 'Pcs',
      stock: 1240,
      status: 'ACTIVE',
      image: 'assets/images/products/voltage-regulator.jpg',
      description: 'Industrial voltage regulation module for heavy equipment and control systems.',
      inventory: [
        { terminal: 'Terminal Gate A-1 (Chicago)', reserved: 0, available: 1240 }
      ],
      movements: [
        { title: 'Inventory received', detail: '1,240 units added to available stock', date: 'Yesterday' }
      ]
    },
    {
      id: 4,
      name: 'Pneumatic Control Valve',
      sku: 'PCV-404-Z',
      brand: 'LogiCore',
      category: 'Valves',
      unit: 'Pcs',
      stock: 14,
      status: 'CRITICAL STOCK',
      image: 'assets/images/products/control-valve.jpg',
      description: 'Pneumatic flow-control valve for automated warehouse and transport equipment.',
      inventory: [
        { terminal: 'Terminal Gate A-1 (Chicago)', reserved: 12, available: 2 },
        { terminal: 'Terminal Gate C-4 (Houston)', reserved: 2, available: 12 }
      ],
      movements: [
        { title: 'Critical stock hold', detail: 'Only 2 units available at Chicago terminal', date: 'Today, 08:10' }
      ]
    }
  ]);

  readonly products = this.productRecords.asReadonly();

  findBySku(sku: string): ManufacturerProduct | undefined {
    return this.productRecords().find(product => product.sku === sku);
  }

  save(product: Omit<ManufacturerProduct, 'id' | 'status' | 'stock' | 'inventory' | 'movements'>): void {
    const duplicate = this.productRecords().some(item => item.sku.toLowerCase() === product.sku.toLowerCase());
    if (duplicate) {
      throw new Error('A product with this SKU already exists.');
    }

    this.productRecords.update(items => [
      ...items,
      {
        ...product,
        id: Math.max(0, ...items.map(item => item.id)) + 1,
        stock: 0,
        status: 'CRITICAL STOCK',
        inventory: [],
        movements: []
      }
    ]);
  }
}
