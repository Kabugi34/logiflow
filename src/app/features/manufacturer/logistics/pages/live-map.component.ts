import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogisticsMapComponent } from '../components/logistics-map/logistics-map.component';
import { TripStatusComponent } from '../components/trip-status/trip-status.component';
import { ManufacturerLogisticsService } from '../logistics.service';
import { finalize } from 'rxjs';

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
  protected readonly actionBusy = signal(false);

  protected selectTrip(id: string): void {
    this.selectedTripId.set(id);
    this.feedback.set('');
  }

  protected pingDriver(): void {
    const trip = this.selectedTrip();
    if (!trip || this.actionBusy()) return;
    this.runAction(this.logisticsService.pingDriver(trip.id), 'Driver ping request sent.');
  }

  protected proposeReroute(): void {
    const trip = this.selectedTrip();
    if (!trip || this.actionBusy()) return;
    this.runAction(this.logisticsService.proposeReroute(trip.id), 'Reroute proposal sent for dispatcher review.');
  }

  private runAction(request: import('rxjs').Observable<unknown>, success: string): void {
    this.feedback.set(''); this.actionBusy.set(true);
    request.pipe(finalize(() => this.actionBusy.set(false))).subscribe({
      next: () => this.feedback.set(success),
      error: error => this.feedback.set(error?.error?.message ?? 'The request could not be completed.')
    });
  }
}
