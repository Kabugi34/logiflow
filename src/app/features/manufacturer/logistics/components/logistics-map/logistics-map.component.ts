import { AfterViewInit, Component, ElementRef, OnDestroy, input, output, viewChild } from '@angular/core';
import * as Leaflet from 'leaflet';
import { LogisticsTrip } from '../../logistics.models';

@Component({
  selector: 'app-logistics-map',
  standalone: true,
  templateUrl: './logistics-map.component.html'
})
export class LogisticsMapComponent implements AfterViewInit, OnDestroy {
  readonly trips = input.required<LogisticsTrip[]>();
  readonly selectedTripId = input<string | null>(null);
  readonly selectTrip = output<string>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private map?: Leaflet.Map;

  ngAfterViewInit(): void {
    this.map = Leaflet.map(this.mapElement().nativeElement, { zoomControl: false, scrollWheelZoom: true });
    Leaflet.control.zoom({ position: 'topright' }).addTo(this.map);
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    const allPoints: Leaflet.LatLngTuple[] = [];
    for (const trip of this.trips()) {
      const route = trip.route.map(point => [point.latitude, point.longitude] as Leaflet.LatLngTuple);
      if (!route.length) continue;
      allPoints.push(...route);
      const routeColor = trip.status === 'DELIVERED' ? '#10b981' : trip.status === 'DELAYED' ? '#f97316' : '#2563eb';
      if (route.length > 1) {
        Leaflet.polyline(route, { color: routeColor, weight: trip.id === this.selectedTripId() ? 4 : 2.5, opacity: 0.82 }).addTo(this.map);
      }
      const currentIndex = trip.status === 'DELIVERED' ? route.length - 1 : Math.max(0, Math.floor((route.length - 1) * 0.58));
      const marker = Leaflet.circleMarker(route[currentIndex], {
        radius: trip.id === this.selectedTripId() ? 7 : 5,
        color: '#ffffff',
        weight: 2,
        fillColor: routeColor,
        fillOpacity: 1
      }).bindPopup(`<strong>${trip.driver}</strong><br>${trip.id}<br>${trip.currentLocation}`);
      marker.on('click', () => this.selectTrip.emit(trip.id));
      marker.addTo(this.map);
    }

    const hubs = [
      { point: [41.8781, -87.6298] as Leaflet.LatLngTuple, label: 'Chicago Hub' },
      { point: [34.0522, -118.2437] as Leaflet.LatLngTuple, label: 'Los Angeles Hub' },
      { point: [51.9244, 4.4777] as Leaflet.LatLngTuple, label: 'Rotterdam Hub' },
      { point: [1.3521, 103.8198] as Leaflet.LatLngTuple, label: 'Singapore Hub' }
    ];
    for (const hub of hubs) {
      Leaflet.circleMarker(hub.point, { radius: 4, color: '#ffffff', weight: 1.5, fillColor: '#64748b', fillOpacity: 1 })
        .bindTooltip(hub.label)
        .addTo(this.map);
    }

    this.map.setView([28, -22], 2);
    if (allPoints.length > 0 && this.trips().length < 2) {
      this.map.fitBounds(Leaflet.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 5 });
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
