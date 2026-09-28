import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { manufacturerNavigation } from '../navigation/navigation.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  protected readonly navigation = manufacturerNavigation;
}
