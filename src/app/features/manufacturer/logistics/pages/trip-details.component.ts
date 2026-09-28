import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LogisticsMapComponent } from '../components/logistics-map/logistics-map.component';
import { TripStatusComponent } from '../components/trip-status/trip-status.component';
import { ManufacturerLogisticsService } from '../logistics.service';

@Component({
  selector: 'app-trip-details',
  standalone: true,
  imports: [RouterLink, LogisticsMapComponent, TripStatusComponent],
  templateUrl: './trip-details.component.html'
})
export class TripDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly logisticsService = inject(ManufacturerLogisticsService);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly trip = computed(() => this.logisticsService.findTripById(this.routeParams().get('id') ?? ''));
}
