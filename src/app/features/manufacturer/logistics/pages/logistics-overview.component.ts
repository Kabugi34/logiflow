import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerLogisticsService } from '../logistics.service';
import { TripStatusComponent } from '../components/trip-status/trip-status.component';

@Component({
  selector: 'app-logistics-overview',
  standalone: true,
  imports: [RouterLink, TripStatusComponent],
  templateUrl: './logistics-overview.component.html'
})
export class LogisticsOverviewComponent {
  protected readonly logisticsService = inject(ManufacturerLogisticsService);
  protected readonly trips = this.logisticsService.trips;
  protected readonly metrics = this.logisticsService.metrics;
}
