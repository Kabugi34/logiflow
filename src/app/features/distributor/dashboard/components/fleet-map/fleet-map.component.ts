import { AfterViewInit, Component, ElementRef, OnDestroy, computed, input, viewChild } from '@angular/core';
import * as Leaflet from 'leaflet';
import { addCurrentLocationControl, addMapBaseLayer, KENYA_MAP_CENTER } from '../../../../../core/maps/map.utils';
import { DashboardVehicle } from '../../dashboard.models';

@Component({
  selector: 'app-distributor-fleet-map',
  standalone: true,
  templateUrl: './fleet-map.component.html'
})
export class FleetMapComponent implements AfterViewInit, OnDestroy {
  readonly vehicles = input.required<DashboardVehicle[]>();
  protected readonly activeVehicles = computed(() => this.vehicles().filter(vehicle => vehicle.status === 'ON_TRIP'));
  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private map?: Leaflet.Map;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.map = Leaflet.map(this.mapElement().nativeElement, { zoomControl: false, scrollWheelZoom: false });
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapElement().nativeElement);
    Leaflet.control.zoom({ position: 'topright' }).addTo(this.map);
    addMapBaseLayer(this.map);
    addCurrentLocationControl(this.map);

    const markers = this.vehicles().map(vehicle => Leaflet.circleMarker([vehicle.latitude, vehicle.longitude], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: vehicle.status === 'ON_TRIP' ? '#2563eb' : '#10b981',
      fillOpacity: 1
    })
      .bindPopup(`<strong>${vehicle.id}</strong> · ${vehicle.model}<br>${vehicle.locationLabel}`)
      .addTo(this.map!));

    if (markers.length === 1) {
      this.map.setView(markers[0].getLatLng(), 11);
    } else if (markers.length > 1) {
      this.map.fitBounds(Leaflet.featureGroup(markers).getBounds(), { padding: [32, 32], maxZoom: 11 });
    } else {
      this.map.setView(KENYA_MAP_CENTER, 10);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
