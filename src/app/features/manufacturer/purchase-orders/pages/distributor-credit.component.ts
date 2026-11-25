import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CreditStatement } from '../../../../core/models/purchase-order-settlement.model';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';

/**
 * A manufacturer's view of the credit extended to one distributor: the limit and
 * term, what is outstanding, and every credit order with its payments.
 */
@Component({
  selector: 'app-distributor-credit',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <section class="space-y-5">
      <header class="border-b border-slate-200 pb-4">
        <nav aria-label="Breadcrumb" class="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <a routerLink="/manufacturer/purchase-orders" queryParamsHandling="preserve" class="hover:text-blue-600"
            >Purchase Orders</a
          ><span aria-hidden="true">›</span><span class="font-medium text-slate-600">Credit</span>
        </nav>
        <h1 class="text-xl font-semibold text-slate-900">
          Credit &amp; statement{{ statement()?.credit?.distributorName ? ': ' + statement()!.credit.distributorName : '' }}
        </h1>
      </header>

      @if (error()) {
        <p role="alert" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {{ error() }}
        </p>
      }
      @if (notice()) {
        <p role="status" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {{ notice() }}
        </p>
      }

      @if (statement(); as current) {
        <section class="rounded-lg border border-slate-200 bg-white p-4" data-testid="credit-summary">
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <dt class="text-[10px] uppercase text-slate-400">Applies</dt>
              <dd class="mt-1 text-xs font-semibold text-slate-800">{{ sourceLabel() }}</dd>
            </div>
            <div>
              <dt class="text-[10px] uppercase text-slate-400">Limit</dt>
              <dd class="mt-1 text-xs font-semibold text-slate-800">
                {{ current.credit.effectiveLimit === null ? 'No credit' : (current.credit.effectiveLimit | currency: current.credit.currency : 'symbol' : '1.2-2') }}
              </dd>
            </div>
            <div>
              <dt class="text-[10px] uppercase text-slate-400">Term</dt>
              <dd class="mt-1 text-xs font-semibold text-slate-800">
                {{ current.credit.effectiveTermDays === null ? '—' : current.credit.effectiveTermDays + ' days' }}
              </dd>
            </div>
            <div>
              <dt class="text-[10px] uppercase text-slate-400">Outstanding</dt>
              <dd class="mt-1 text-xs font-semibold text-slate-800">
                {{ current.credit.outstanding | currency: current.credit.currency : 'symbol' : '1.2-2' }}
              </dd>
            </div>
            <div>
              <dt class="text-[10px] uppercase text-slate-400">Available</dt>
              <dd class="mt-1 text-xs font-semibold text-slate-800">
                {{ current.credit.available | currency: current.credit.currency : 'symbol' : '1.2-2' }}
              </dd>
            </div>
          </dl>
          @if (current.credit.overdueOrders > 0) {
            <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {{ current.credit.overdueOrders }} overdue order(s). This distributor cannot place new credit
              orders until they are paid.
            </p>
          }
        </section>

        @if (canEdit) {
          <form
            class="rounded-lg border border-slate-200 bg-white p-4"
            (submit)="$event.preventDefault(); save()"
            data-testid="credit-form"
          >
            <h2 class="text-sm font-semibold text-slate-900">Credit terms for this distributor</h2>
            <p class="mt-1 text-xs text-slate-500">
              Without terms set here, credit is refused unless the platform default applies. Pay-now orders
              are never limited.
            </p>
            <div class="mt-3 flex flex-wrap items-end gap-3">
              <label class="flex flex-col text-[10px] text-slate-500">
                Credit limit (KES)
                <input
                  type="text"
                  inputmode="decimal"
                  class="mt-1 h-9 w-40 rounded-md border border-slate-300 px-2 text-xs text-slate-900"
                  [value]="limitInput()"
                  (input)="limitInput.set($any($event.target).value)"
                  name="creditLimit"
                />
              </label>
              <label class="flex flex-col text-[10px] text-slate-500">
                Term (days)
                <input
                  type="text"
                  inputmode="numeric"
                  class="mt-1 h-9 w-24 rounded-md border border-slate-300 px-2 text-xs text-slate-900"
                  [value]="termInput()"
                  (input)="termInput.set($any($event.target).value)"
                  name="termDays"
                />
              </label>
              <label class="flex flex-col text-[10px] text-slate-500">
                Status
                <select
                  class="mt-1 h-9 rounded-md border border-slate-300 px-2 text-xs text-slate-900"
                  [value]="statusInput()"
                  (change)="statusInput.set($any($event.target).value)"
                  name="status"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </label>
              <button
                type="submit"
                [disabled]="saving()"
                class="min-h-9 rounded-md bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-300"
              >
                {{ saving() ? 'Saving…' : 'Save terms' }}
              </button>
            </div>
          </form>
        } @else {
          <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Only a manufacturer administrator can change credit terms.
          </p>
        }

        <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Credit orders</h2>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] text-xs">
              <thead class="bg-slate-50 text-left text-[10px] font-medium text-slate-600">
                <tr>
                  <th scope="col" class="px-3 py-2.5">Order</th>
                  <th scope="col" class="px-3 py-2.5 text-right">Total</th>
                  <th scope="col" class="px-3 py-2.5 text-right">Paid</th>
                  <th scope="col" class="px-3 py-2.5 text-right">Outstanding</th>
                  <th scope="col" class="px-3 py-2.5">Due</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (line of current.orders; track line.purchaseOrderId) {
                  <tr>
                    <td class="px-3 py-3">
                      <a
                        class="font-medium text-blue-600 hover:text-blue-700"
                        [routerLink]="['/manufacturer/purchase-orders', line.purchaseOrderId]"
                        queryParamsHandling="preserve"
                        >{{ line.purchaseOrderNumber }}</a
                      >
                      <p class="mt-0.5 text-[10px] text-slate-500">{{ line.status }}</p>
                    </td>
                    <td class="px-3 py-3 text-right">{{ line.totalAmount | currency: 'KES' : 'symbol' : '1.2-2' }}</td>
                    <td class="px-3 py-3 text-right">{{ line.amountPaid | currency: 'KES' : 'symbol' : '1.2-2' }}</td>
                    <td class="px-3 py-3 text-right font-semibold">
                      {{ line.outstanding | currency: 'KES' : 'symbol' : '1.2-2' }}
                    </td>
                    <td class="px-3 py-3" [class.text-red-700]="line.overdue">
                      {{ line.dueAt ? (line.dueAt | date: 'dd MMM y') : '—' }}
                      @if (line.overdue) {
                        <span class="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[9px]">OVERDUE</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-3 py-6 text-center text-slate-500">No credit orders yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (loading()) {
        <p class="text-xs text-slate-500">Loading credit details…</p>
      }
    </section>
  `,
})
export class DistributorCreditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(ManufacturerPurchaseOrderService);
  private readonly auth = inject(AuthService);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly canEdit = this.auth.hasRole('MANUFACTURER_ADMIN');
  protected readonly statement = signal<CreditStatement | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly limitInput = signal('');
  protected readonly termInput = signal('30');
  protected readonly statusInput = signal<'ACTIVE' | 'SUSPENDED'>('ACTIVE');

  protected readonly sourceLabel = computed(() => {
    switch (this.statement()?.credit.effectiveSource) {
      case 'RELATIONSHIP':
        return 'Your terms';
      case 'PLATFORM_DEFAULT':
        return 'Platform default';
      default:
        return this.statement()?.credit.status === 'SUSPENDED' ? 'Suspended' : 'No credit';
    }
  });

  constructor() {
    effect(() => {
      const id = this.params().get('distributorId');
      if (id) this.load(id);
    });
  }

  private load(distributorId: string): void {
    this.loading.set(true);
    this.error.set('');
    this.orders
      .loadStatement(distributorId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (statement) => {
          this.statement.set(statement);
          const credit = statement.credit;
          this.limitInput.set(credit.creditLimit === null ? '' : credit.creditLimit.toFixed(2));
          this.termInput.set(String(credit.termDays ?? credit.effectiveTermDays ?? 30));
          this.statusInput.set(credit.status ?? 'ACTIVE');
        },
        error: (error) =>
          this.error.set(error?.error?.message ?? 'Credit details could not be loaded.'),
      });
  }

  protected save(): void {
    const distributorId = this.params().get('distributorId');
    if (!distributorId || !this.canEdit || this.saving()) return;
    this.error.set('');
    this.notice.set('');
    const limitText = this.limitInput().trim();
    const days = Number(this.termInput().trim());
    if (!/^\d+(\.\d{1,2})?$/.test(limitText)) {
      this.error.set('Enter the credit limit as an amount with at most two decimal places.');
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      this.error.set('The term must be a whole number of days between 1 and 365.');
      return;
    }
    this.saving.set(true);
    this.orders
      .saveCredit(distributorId, {
        creditLimit: Number(limitText),
        termDays: days,
        status: this.statusInput(),
        expectedVersion: this.statement()?.credit.version ?? null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notice.set('Credit terms saved.');
          this.load(distributorId);
        },
        error: (error) =>
          this.error.set(error?.error?.message ?? 'The credit terms could not be saved.'),
      });
  }
}
