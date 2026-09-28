import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryRow } from '../../inventory.models';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './inventory-table.component.html'
})
export class InventoryTableComponent {
  readonly rows = input.required<InventoryRow[]>();
}
