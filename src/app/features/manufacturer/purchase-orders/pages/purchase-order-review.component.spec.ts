import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ManufacturerPurchaseOrder } from '../purchase-order.models';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';
import { PurchaseOrderReviewComponent } from './purchase-order-review.component';

function order(overrides: Partial<ManufacturerPurchaseOrder> = {}): ManufacturerPurchaseOrder {
  return {
    id: 'po-1',
    distributorId: 'dist-1',
    distributorName: 'Acme Distribution',
    paymentTerms: 'PAY_NOW',
    totalAmount: 1000,
    amountPaid: 0,
    amountOutstanding: 1000,
    dueAt: null,
    overdue: false,
    manufacturerName: 'Maker',
    destinationHub: 'Nairobi',
    issueDate: '2026-11-24',
    status: 'ACCEPTED',
    fulfilmentStatus: 'UNKNOWN',
    paymentStatus: 'PENDING',
    lines: [],
    timeline: [],
    settlements: [
      {
        id: 's1',
        status: 'PENDING',
        amount: 1000,
        currency: 'KES',
        note: null,
        settledAt: null,
        method: 'BANK_TRANSFER',
        totalDue: 1000,
        amountPaid: 0,
        amountOutstanding: 1000,
        payments: [
          {
            id: 'pay-1',
            method: 'BANK_TRANSFER',
            payerReference: 'REF-1',
            amount: null,
            status: 'SUBMITTED',
            proofDocumentId: 'doc-1',
            submittedAt: '2026-11-24T10:00:00Z',
            confirmedAt: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('PurchaseOrderReviewComponent payment confirmation', () => {
  const confirmBankPayment = vi.fn(() => of(undefined));

  function render(role: string, value: ManufacturerPurchaseOrder): ComponentFixture<PurchaseOrderReviewComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'po-1' }) }, paramMap: of(convertToParamMap({ id: 'po-1' })) } },
        { provide: AuthService, useValue: { hasRole: (candidate: string) => candidate === role, user: signal(null) } },
        {
          provide: ManufacturerPurchaseOrderService,
          useValue: {
            findById: () => value,
            confirmBankPayment,
            downloadProof: () => of(new Blob()),
            loading: signal(false),
            refresh: () => undefined,
            error: signal(''),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PurchaseOrderReviewComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    confirmBankPayment.mockClear();
    TestBed.resetTestingModule();
  });

  it('lets the supplier administrator confirm the amount received', () => {
    const fixture = render('MANUFACTURER_ADMIN', order());
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('REF-1');
    const button = Array.from(root.querySelectorAll('button')).find((b) =>
      /confirm payment received/i.test(b.textContent ?? ''),
    );
    expect(button).toBeTruthy();
    button!.click();
    // A pay-now order is pre-filled with the exact total.
    expect(confirmBankPayment).toHaveBeenCalledWith('po-1', 'REF-1', 1000);
  });

  it.each(['MANUFACTURER_STAFF', 'DISTRIBUTOR_ADMIN', 'DISTRIBUTOR_STAFF'])(
    'never shows a confirm button to %s',
    (role) => {
      const fixture = render(role, order());
      const root = fixture.nativeElement as HTMLElement;

      expect(root.textContent).toContain('REF-1');
      const confirmButtons = Array.from(root.querySelectorAll('button')).filter((b) =>
        /confirm payment received/i.test(b.textContent ?? ''),
      );
      expect(confirmButtons).toHaveLength(0);
      expect(confirmBankPayment).not.toHaveBeenCalled();
    },
  );

  it('refuses a malformed amount before calling the API', () => {
    const fixture = render('MANUFACTURER_ADMIN', order());
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = '12.345';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const button = Array.from(root.querySelectorAll('button')).find((b) =>
      /confirm payment received/i.test(b.textContent ?? ''),
    );
    button!.click();
    fixture.detectChanges();

    expect(confirmBankPayment).not.toHaveBeenCalled();
    expect(root.textContent).toMatch(/amount received/i);
  });
});