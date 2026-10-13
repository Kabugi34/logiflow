import { TestBed } from '@angular/core/testing';
import { DistributorOrderService } from './order.service';

describe('DistributorOrderService', () => {
  let service: DistributorOrderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DistributorOrderService);
  });

  it('groups active outbound orders into a single shipment per route', () => {
    const shipments = service.groupOrdersByRoute();

    expect(shipments.length).toBeGreaterThan(0);
    const activeShipment = shipments.find(group => group.routeLabel.includes('Westlands') || group.routeLabel.includes('Mombasa'));
    expect(activeShipment).toBeTruthy();
    expect(activeShipment?.orderIds.length).toBeGreaterThan(0);
    expect(activeShipment?.status).toMatch(/PREPARING|IN_TRANSIT|REROUTED/);
  });
});
