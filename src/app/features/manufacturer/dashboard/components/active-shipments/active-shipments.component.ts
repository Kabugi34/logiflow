import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardShipment } from '../../dashboard.models';

@Component({
  selector: 'app-active-shipments',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './active-shipments.component.html'
})
export class ActiveShipmentsComponent {
  readonly shipments = input.required<DashboardShipment[]>();
}
