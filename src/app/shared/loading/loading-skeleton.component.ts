import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  template: `
    <div class="space-y-3 p-4" role="status" aria-label="Loading content">
      <span class="sr-only">Loading content</span>
      @if (variant === 'cards') {
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          @for (row of indexes; track row) {
            <div class="animate-pulse rounded-lg border border-slate-200 bg-white p-4">
              <div class="h-3 w-24 rounded bg-slate-200"></div>
              <div class="mt-4 h-7 w-16 rounded bg-slate-200"></div>
              <div class="mt-3 h-2 w-32 rounded bg-slate-100"></div>
            </div>
          }
        </div>
      } @else {
        <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div class="flex gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
            @for (column of columnsArray; track column) {
              <div class="h-3 flex-1 animate-pulse rounded bg-slate-200"></div>
            }
          </div>
          @for (row of indexes; track row) {
            <div class="flex gap-4 border-b border-slate-100 px-4 py-4 last:border-0">
              @for (column of columnsArray; track column) {
                <div class="h-3 flex-1 animate-pulse rounded bg-slate-100"></div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class LoadingSkeletonComponent {
  @Input() rows = 5;
  @Input() columns = 5;
  @Input() variant: 'table' | 'cards' = 'table';

  get indexes(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }

  get columnsArray(): number[] {
    return Array.from({ length: this.columns }, (_, index) => index);
  }
}
