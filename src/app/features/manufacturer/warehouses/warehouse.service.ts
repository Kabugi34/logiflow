import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerWarehouse } from './warehouse.models';

interface WarehouseDto {
  id: string; code?: string; name: string; address: string; city?: string | null; postalCode?: string | null;
  siteManager?: string | null; status?: 'ACTIVE' | 'INACTIVE'; active?: boolean;
  stockUnits?: number; staffCount?: number;
}
interface Page<T> { content?: T[]; }

export interface WarehouseCreateRequest {
  code: string; name: string; address: string; city: string; postalCode: string; siteManager: string;
}

@Injectable({ providedIn: 'root' })
export class ManufacturerWarehouseService {
  private readonly http = inject(HttpClient);
  private readonly warehouseRecords = signal<ManufacturerWarehouse[]>([]);
  readonly warehouses = this.warehouseRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true); this.error.set('');
    this.http.get<Page<WarehouseDto> | WarehouseDto[]>(`${API_ENDPOINTS.manufacturer.warehouses}?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.warehouseRecords.set(rows.map(row => this.mapWarehouse(row)));
        this.loading.set(false);
      },
      error: error => {
        this.error.set(error?.error?.message ?? 'Manufacturer warehouses could not be loaded.');
        this.loading.set(false);
      }
    });
  }

  findById(id: string): ManufacturerWarehouse | undefined {
    return this.warehouseRecords().find(warehouse => warehouse.id === id);
  }

  createWarehouse(details: WarehouseCreateRequest) {
    return this.http.post<WarehouseDto>(API_ENDPOINTS.manufacturer.warehouses, details);
  }

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.http.patch<WarehouseDto>(API_ENDPOINTS.manufacturer.warehouse(id), { status });
  }

  private mapWarehouse(row: WarehouseDto): ManufacturerWarehouse {
    return {
      id: row.id, name: row.name, address: row.address, city: row.city ?? '', postalCode: row.postalCode ?? '',
      status: row.status ?? (row.active === false ? 'INACTIVE' : 'ACTIVE'), stockUnits: row.stockUnits ?? 0,
      staffCount: row.staffCount ?? 0, siteManager: row.siteManager ?? 'Not assigned', managerRole: 'Site Manager',
      activities: [], staff: []
    };
  }
}
