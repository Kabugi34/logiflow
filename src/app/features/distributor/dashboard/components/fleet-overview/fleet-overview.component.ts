import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardFleetDriver } from '../../dashboard.models';

@Component({
  selector: 'app-distributor-fleet-overview',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './fleet-overview.component.html'
})
export class FleetOverviewComponent {
  readonly drivers = input.required<DashboardFleetDriver[]>();
}
