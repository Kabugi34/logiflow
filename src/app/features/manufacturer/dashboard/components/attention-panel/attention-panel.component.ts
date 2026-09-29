import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardAttentionItem } from '../../dashboard.models';

@Component({
  selector: 'app-attention-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './attention-panel.component.html'
})
export class AttentionPanelComponent {
  readonly items = input.required<DashboardAttentionItem[]>();
}
