import { Component, input } from '@angular/core';

@Component({
  selector: 'app-nav-icon',
  standalone: true,
  template: `
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-5 w-5 shrink-0"
    >
      @switch (name()) {
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        }
        @case ('package') {
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" />
        }
        @case ('layers') {
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        }
        @case ('file-text') {
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 13h8M8 17h8" />
        }
        @case ('truck') {
          <path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" />
          <circle cx="7.5" cy="19" r="1.5" />
          <circle cx="18" cy="19" r="1.5" />
        }
        @case ('map') {
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15" />
        }
        @case ('route') {
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3h1" />
        }
        @case ('map-pin') {
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        }
        @case ('users') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('steering-wheel') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2" />
          <path d="M5.6 5.6 10.5 10.5M18.4 5.6 13.5 10.5M12 14v7" />
        }
        @case ('id-card') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M6 16c.7-1.4 1.7-2 3-2s2.3.6 3 2m3-6h3m-3 4h3" />
        }
        @case ('contact') {
          <circle cx="10" cy="8" r="4" />
          <path d="M3 21v-2a7 7 0 0 1 14 0v2M17 4h4m-2-2v4m-2 11h4m-2-2v4" />
        }
        @case ('warehouse') {
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <path d="M3 10h18M8 21v-7h8v7M7 10V8m5 2V8m5 2V8" />
        }
        @case ('bar-chart') {
          <path d="M4 20V10m5 10V4m6 16v-7m5 7V7M2 20h20" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path
            d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z"
            transform="translate(-1 -1) scale(1.08)"
          />
        }
        @case ('shopping-bag') {
          <path d="M5 8h14l1 13H4L5 8Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        }
        @default {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8m-4-4h8" />
        }
      }
    </svg>
  `,
})
export class NavIconComponent {
  readonly name = input.required<string>();
}
