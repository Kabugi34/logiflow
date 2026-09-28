import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ManufacturerWarehouse } from '../../warehouse.models';

@Component({
  selector: 'app-warehouse-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './warehouse-card.component.html'
})
export class WarehouseCardComponent {
  readonly warehouse = input.required<ManufacturerWarehouse>();
  readonly selected = input(false);
  readonly selectWarehouse = output<string>();
}
