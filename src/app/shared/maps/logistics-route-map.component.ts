import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnChanges, OnDestroy, input, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { LogisticsRoutePoint } from '../../core/logistics/logistics.models';
import { addCurrentLocationControl, addMapBaseLayer, KENYA_MAP_CENTER } from '../../core/maps/map.utils';

@Component({
  selector: 'app-logistics-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logistics-route-map.component.html'
})
export class LogisticsRouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly route = input.required<LogisticsRoutePoint[]>();
  readonly currentIndex = input(0);
  readonly routeLabel = input('Shipment route');
  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private map?: L.Map;
  private routeLayers?: L.LayerGroup;

  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.drawRoute();
  }

  ngOnChanges(): void {
    if (this.viewReady) this.drawRoute();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private drawRoute(): void {
    queueMicrotask(() => {
      const host = this.mapElement().nativeElement;
      if (!this.map) {
        this.map = L.map(host, { zoomControl: false, scrollWheelZoom: false });
        L.control.zoom({ position: 'topright' }).addTo(this.map);
        addMapBaseLayer(this.map);
        addCurrentLocationControl(this.map, false);
        this.routeLayers = L.layerGroup().addTo(this.map);
      }
      this.renderRoute();
    });
  }

  private renderRoute(): void {
    if (!this.map || !this.routeLayers) return;
    this.routeLayers.clearLayers();
    const points = this.route().map(point => [point.latitude, point.longitude] as L.LatLngTuple);
    if (!points.length) {
      this.map.setView(KENYA_MAP_CENTER, 7);
      return;
    }

    const selectedIndex = Math.min(Math.max(this.currentIndex(), 0), points.length - 1);
    if (points.length > 1) L.polyline(points, { color: '#2563eb', weight: 4, opacity: 0.86 }).addTo(this.routeLayers);
    points.forEach((point, index) => {
      const isCurrent = index === selectedIndex;
      const color = index === points.length - 1 ? '#10b981' : isCurrent ? '#2563eb' : '#94a3b8';
      L.circleMarker(point, { radius: isCurrent ? 7 : 5, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindPopup(`${index === selectedIndex ? `${this.routeLabel()}: ` : ''}${this.route()[index].label}`)
        .bindTooltip(this.route()[index].label)
        .addTo(this.routeLayers!);
    });

    if (points.length > 1) this.map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 12 });
    else this.map.setView(points[0], 12);
    this.map.invalidateSize();
  }
}