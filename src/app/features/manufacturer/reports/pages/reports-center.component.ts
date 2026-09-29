import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerReportService } from '../report.service';

@Component({
  selector: 'app-reports-center',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './reports-center.component.html'
})
export class ReportsCenterComponent {
  protected readonly reportService = inject(ManufacturerReportService);
  protected readonly startDate = signal('2024-09-01');
  protected readonly endDate = signal('2024-09-30');
  protected readonly selectedWarehouseId = signal('ALL');
  protected readonly snapshot = computed(() => this.reportService.getSnapshot(this.selectedWarehouseId()));
  protected readonly maximumLoads = computed(() => this.reportService.getMaximumWeeklyLoads(this.selectedWarehouseId()));
  protected readonly exportMessage = signal('');

  protected updateStartDate(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
    this.exportMessage.set('');
  }

  protected updateEndDate(event: Event): void {
    this.endDate.set((event.target as HTMLInputElement).value);
    this.exportMessage.set('');
  }

  protected updateWarehouse(event: Event): void {
    this.selectedWarehouseId.set((event.target as HTMLSelectElement).value);
    this.exportMessage.set('');
  }

  protected barHeight(loads: number): number {
    return Math.max(8, (loads / this.maximumLoads()) * 100);
  }

  protected exportCsv(): void {
    const snapshot = this.snapshot();
    const rows: string[][] = [
      ['LogiFlow Operational Reports'],
      ['Start Date', this.startDate()],
      ['End Date', this.endDate()],
      ['Warehouse', this.selectedWarehouseId() === 'ALL' ? 'All warehouses' : this.reportService.warehouses.find(warehouse => warehouse.id === this.selectedWarehouseId())?.name ?? 'Selected warehouse'],
      [],
      ['Metric', 'Value'],
      ['Inventory Accuracy Rate', `${snapshot.inventoryAccuracyPercent}%`],
      ['Purchase Order Lead Time', `${snapshot.purchaseOrderLeadTimeDays} days`],
      ['SLA On-Time Fulfillment', `${snapshot.slaOnTimePercent}%`],
      ['Driver Work Utilization', `${snapshot.driverWorkUtilizationPercent}%`],
      [],
      ['Shipment Dispatch Performance', 'Loads'],
      ...snapshot.weeklyShipmentVolume.map(week => [week.label, String(week.loads)]),
      [],
      ['Warehouse Storage Space Distribution', 'Occupied Percent'],
      ...snapshot.warehouseDistribution.map(warehouse => [warehouse.name, `${warehouse.occupancyPercent}%`])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = 'logiflow-operational-reports.csv';
    download.click();
    URL.revokeObjectURL(url);
    this.exportMessage.set('CSV export generated.');
  }
}
