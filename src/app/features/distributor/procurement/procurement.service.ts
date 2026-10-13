import { computed, inject, Injectable, signal } from '@angular/core';
import { LogisticsService } from '../../../core/logistics/logistics.service';
import { ManufacturerProductService } from '../../manufacturer/products/product.service';
import { DistributorPurchaseOrder, DraftProcurementLine, ProcurementManufacturer, ProcurementOrderLine } from './procurement.models';

const manufacturers: ProcurementManufacturer[] = [
  { id: 'MFG-TITAN', name: 'Titan Industrial Foundries Ltd', productBrand: 'LogiCore', location: 'Industrial Area, Nairobi', verification: 'CERTIFIED', rating: 4.8 },
  { id: 'MFG-APEX', name: 'Apex Hydraulic Assemblies Kenya Ltd', productBrand: 'AeroDyn', location: 'Athi River, Machakos County', verification: 'VERIFIED', rating: 4.7 },
  { id: 'MFG-VOLTLINE', name: 'VoltLine Electrical Kenya Ltd', productBrand: 'VoltTech', location: 'Nakuru, Nakuru County', verification: 'VERIFIED', rating: 4.8 },
  { id: 'MFG-KIFARU', name: 'Kifaru Industrial Works Ltd', productBrand: 'Kifaru Industrial Works', location: 'Mombasa Road, Nairobi', verification: 'VERIFIED', rating: 4.6 },
  { id: 'MFG-RIFT', name: 'Rift Valley Motion Systems Ltd', productBrand: 'Rift Valley Motion Systems', location: 'Nakuru, Nakuru County', verification: 'CERTIFIED', rating: 4.9 }
];

const indicativeUnitCosts: Record<string, number> = {
  'HDM-092-X': 180000,
  'HPG-881-A': 28500,
  'VRB-332-Y': 24800,
  'PCV-404-Z': 108000,
  'GA-210-C': 23660,
  'CSM-118-B': 110500
};

@Injectable({ providedIn: 'root' })
export class DistributorProcurementService {
  private readonly productService = inject(ManufacturerProductService);
  private readonly logisticsService = inject(LogisticsService);

  readonly manufacturers = manufacturers;
  readonly orders = computed<DistributorPurchaseOrder[]>(() => this.logisticsService.inboundOrders().map(order => ({
    id: order.id,
    manufacturerId: order.manufacturerId,
    manufacturerName: order.manufacturerName,
    manufacturerLocation: order.manufacturerLocation,
    orderDate: order.orderDate,
    expectedDelivery: order.expectedDelivery,
    status: order.status,
    destination: order.destination,
    logisticsCost: order.logisticsCost,
    lines: order.lines,
    timeline: order.timeline,
    shipmentId: order.shipmentId,
    tripId: order.tripId,
    driverName: order.driverName,
    vehicleLabel: order.vehicleLabel,
    route: order.route,
    currentRouteIndex: order.currentRouteIndex
  })));
  readonly inTransitOrders = computed(() => this.orders().filter(order => order.status === 'IN_TRANSIT'));

  findManufacturer(id: string): ProcurementManufacturer | undefined {
    return manufacturers.find(manufacturer => manufacturer.id === id);
  }

  manufacturerForBrand(brand: string): ProcurementManufacturer | undefined {
    return manufacturers.find(manufacturer => manufacturer.productBrand === brand);
  }

  indicativeUnitCost(sku: string): number {
    return indicativeUnitCosts[sku] ?? 0;
  }

  productsForManufacturer(manufacturerId: string) {
    const manufacturer = this.findManufacturer(manufacturerId);
    return manufacturer
      ? this.productService.products().filter(product => product.brand === manufacturer.productBrand)
      : [];
  }

  findOrder(id: string): DistributorPurchaseOrder | undefined {
    return this.orders().find(order => order.id === id);
  }

  total(order: Pick<DistributorPurchaseOrder, 'lines' | 'logisticsCost'>): number {
    return order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0) + order.logisticsCost;
  }

  createDraft(manufacturerId: string, draftLines: DraftProcurementLine[]): string {
    const manufacturer = this.findManufacturer(manufacturerId);
    if (!manufacturer) throw new Error('Select a valid manufacturer.');
    if (!draftLines.length) throw new Error('Add at least one product to the purchase order.');

    const lines: ProcurementOrderLine[] = draftLines.map(draftLine => {
      const product = this.productsForManufacturer(manufacturerId).find(item => item.sku === draftLine.sku);
      if (!product) throw new Error('Each selected product must come from the chosen manufacturer.');
      if (!Number.isInteger(draftLine.quantity) || draftLine.quantity < 1) throw new Error('Enter a valid quantity for every product.');
      return {
        sku: product.sku,
        productName: product.name,
        quantity: draftLine.quantity,
        unit: product.unit,
        unitCost: this.indicativeUnitCost(product.sku)
      };
    });

    return this.logisticsService.createInboundOrder({
      manufacturerId,
      manufacturerName: manufacturer.name,
      manufacturerLocation: manufacturer.location,
      distributorName: 'Vance Distributors',
      destination: 'Nairobi Distribution Centre',
      lines
    });
  }
}