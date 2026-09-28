import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { DashboardDriver } from '../../dashboard.models';

@Component({
  selector: 'app-live-fleet-map',
  standalone: true,
  templateUrl: './live-fleet-map.component.html'
})
export class LiveFleetMapComponent implements AfterViewInit, OnDestroy {
  readonly drivers = input.required<DashboardDriver[]>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private map?: L.Map;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapElement().nativeElement, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true
    });
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    const markers = this.drivers().map(driver => {
      const color = driver.status === 'ACTIVE' ? '#2563eb' : '#10b981';
      return L.circleMarker([driver.latitude, driver.longitude], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1
      })
        .bindPopup(`<strong>${driver.name}</strong><br>${driver.route}`)
        .addTo(this.map!);
    });

    if (markers.length === 1) {
      this.map.setView(markers[0].getLatLng(), 7);
    } else if (markers.length > 1) {
      this.map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [32, 32], maxZoom: 6 });
    } else {
      this.map.setView([39.5, -98.35], 4);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
