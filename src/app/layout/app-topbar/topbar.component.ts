import { Component, inject } from '@angular/core';
import { AppearanceService } from '../../core/services/appearance.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html'
})
export class TopbarComponent {
  protected readonly appearance = inject(AppearanceService);
}
