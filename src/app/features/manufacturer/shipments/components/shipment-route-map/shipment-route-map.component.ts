import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';
import * as Leaflet from 'leaflet';
import { ManufacturerShipment } from '../../shipment.models';

@Component({
  selector: 'app-shipment-route-map',
  standalone: true,
  templateUrl: './shipment-route-map.component.html'
})
export class ShipmentRouteMapComponent implements AfterViewInit, OnDestroy {
  readonly shipment = input.required<ManufacturerShipment>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private map?: Leaflet.Map;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const route = this.shipment().route.map(point => [point.latitude, point.longitude] as Leaflet.LatLngTuple);
    this.map = Leaflet.map(this.mapElement().nativeElement, { zoomControl: false, scrollWheelZoom: false });
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapElement().nativeElement);
    Leaflet.control.zoom({ position: 'topright' }).addTo(this.map);
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    if (route.length > 1) {
      Leaflet.polyline(route, { color: '#2563eb', weight: 4, opacity: 0.9 }).addTo(this.map);
      const start = this.shipment().route[0];
      const end = this.shipment().route.at(-1)!;
      Leaflet.circleMarker(route[0], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#10b981', fillOpacity: 1 }).bindPopup(start.label).addTo(this.map);
      Leaflet.circleMarker(route[route.length - 1], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#f97316', fillOpacity: 1 }).bindPopup(end.label).addTo(this.map);
      this.map.fitBounds(Leaflet.latLngBounds(route), { padding: [24, 24] });
    } else {
      this.map.setView([39.5, -98.35], 4);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
