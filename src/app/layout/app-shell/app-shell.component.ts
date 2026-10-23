import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { manufacturerWorkspace, WorkspaceConfig } from '../navigation/navigation.config';
import { SidebarComponent } from '../app-sidebar/sidebar.component';
import { TopbarComponent } from '../app-topbar/topbar.component';
import { HttpActivityService } from '../../core/services/http-activity.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent
  ],
  templateUrl: './app-shell.component.html'
})
export class AppShellComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly layout = inject(LayoutService);
  protected readonly httpActivity = inject(HttpActivityService);
  protected readonly workspace: WorkspaceConfig = this.route.snapshot.data['workspace'] ?? manufacturerWorkspace;
}
