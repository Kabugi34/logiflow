import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  template: `
    <span class="inline-flex items-center justify-center gap-2" role="status">
      <svg
        class="h-4 w-4 animate-spin text-current"
        [class.h-3]="small"
        [class.w-3]="small"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
      @if (label) {
        <span>{{ label }}</span>
      }
    </span>
  `,
})
export class LoadingIndicatorComponent {
  @Input() label = '';
  @Input() small = false;
}
