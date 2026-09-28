import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardDriver, ManufacturerDashboard } from '../../dashboard.models';

@Component({
  selector: 'app-fleet-overview',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './fleet-overview.component.html'
})
export class FleetOverviewComponent {
  readonly dashboard = input.required<ManufacturerDashboard>();
  readonly drivers = input.required<DashboardDriver[]>();
}
