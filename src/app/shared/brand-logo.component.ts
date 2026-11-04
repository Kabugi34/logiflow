import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  template: `
    <span class="inline-flex min-w-0 items-center gap-2">
      <img
        src="3.svg"
        width="40"
        height="40"
        alt=""
        class="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
      />
      @if (!iconOnly()) {
        <span class="flex min-w-0 flex-col">
          <span
            class="text-sm font-semibold leading-4"
            [class.text-slate-900]="!inverse()"
            [class.text-white]="inverse()"
            >LogiFlow</span
          >
          @if (subtitle()) {
            <span
              class="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide"
              [class.text-slate-500]="!inverse()"
              [class.text-slate-300]="inverse()"
            >
              {{ subtitle() }}
            </span>
          }
        </span>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {
  readonly iconOnly = input(false);
  readonly subtitle = input('');
  readonly inverse = input(false);
}
