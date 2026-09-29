import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogisticsMapComponent } from '../components/logistics-map/logistics-map.component';
import { TripStatusComponent } from '../components/trip-status/trip-status.component';
import { ManufacturerLogisticsService } from '../logistics.service';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [RouterLink, LogisticsMapComponent, TripStatusComponent],
  templateUrl: './live-map.component.html'
})
export class LiveMapComponent {
  private readonly logisticsService = inject(ManufacturerLogisticsService);
  protected readonly trips = this.logisticsService.trips;
  protected readonly metrics = this.logisticsService.metrics;
  protected readonly selectedTripId = signal(this.trips()[0]?.id ?? null);
  protected readonly selectedTrip = computed(() => this.logisticsService.findTripById(this.selectedTripId() ?? ''));
  protected readonly feedback = signal('');

  protected selectTrip(id: string): void {
    this.selectedTripId.set(id);
    this.feedback.set('');
  }

  protected pingDriver(): void {
    const trip = this.selectedTrip();
    if (trip) this.feedback.set(`Driver ping sent to ${trip.driver}.`);
  }

  protected proposeReroute(): void {
    const trip = this.selectedTrip();
    if (trip) this.feedback.set(`Reroute proposal for ${trip.id} sent for dispatcher review.`);
  }
}
