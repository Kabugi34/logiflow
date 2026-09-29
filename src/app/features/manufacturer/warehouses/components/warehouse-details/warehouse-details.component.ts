import { Component, input, output } from '@angular/core';
import { ManufacturerWarehouse } from '../../warehouse.models';

@Component({
  selector: 'app-warehouse-details',
  standalone: true,
  templateUrl: './warehouse-details.component.html'
})
export class WarehouseDetailsComponent {
  readonly warehouse = input.required<ManufacturerWarehouse>();
  readonly closeDetails = output<void>();
}
