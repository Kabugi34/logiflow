# LogiFlow Frontend Payment Lifecycle Implementation Report

## Backend sources reviewed

Reviewed `C:\DISTRO-BACKEND\LOGIFLOW_BACKEND_PAYMENT_LIFECYCLE_INTEGRATION_GUIDE.md`, `C:\DISTRO-BACKEND\LOGIFLOW_BACKEND_PAYMENT_LIFECYCLE_IMPLEMENTATION_REPORT.md`, and the corresponding backend checkout controller/service, checkout response DTO, payment request DTO, and `CheckoutPaymentStatus` enum. The backend is the source of truth for payment outcomes.

The centralized checkout API is:

- `POST /api/v1/checkouts/{checkoutId}/payment` with an `Idempotency-Key` header and `{ method, phoneNumber? }` body.
- `GET /api/v1/checkouts/{checkoutId}` or `GET /api/v1/checkouts/{checkoutId}/payment` for the latest payment state.

The payment DTO supplies `id`, `method`, `status`, `terminal`, `retryAllowed`, `userMessage`, provider reference, and timestamps. Supported attempt states are `PENDING`, `UNKNOWN`, `SUCCESS`, `FAILED`, `CANCELLED`, and `TIMED_OUT`. `PENDING` and `UNKNOWN` are unresolved; only backend terminal state ends polling. Retries are allowed only when the backend says `retryAllowed`.

## Original frontend causes

Centralized checkout polled immediately and every second using `switchMap`, which allowed slow GET requests to overlap. It had no polling deadline or component-destruction cleanup, and polling held the shared busy state. It also inferred retryability from status names, restored or discarded cart recovery around initiation rather than a verified outcome, and accepted stale/extra statuses that are not part of the checkout backend enum.

## Changes

- Updated `src/app/features/distributor/procurement/pages/centralized-checkout.component.ts` to start polling only after an accepted initiation response or a backend read shows a nonterminal attempt.
- Polling starts after three seconds, repeats every three seconds, uses `exhaustMap` to prevent concurrent requests, observes the backend `terminal` flag, and stops at two minutes. A frontend deadline leaves the payment unresolved and presents a manual refresh action; it never changes payment status.
- Poll requests and checkout reads are tied to `DestroyRef`, and polling is stopped before manual refresh. Polling has its own state and no longer leaves the initiation spinner active.
- Duplicate submission is blocked while checkout is busy or genuinely unresolved. Retries keep the same checkout ID. Initial/ambiguous initiation reuses its idempotency key; a confirmed retryable attempt gets a fresh key.
- Cart recovery is retained through initiation and removed only after backend-confirmed success. Confirmed failure, cancellation, or timeout restores the purchased items, regardless of whether the backend permits another attempt.
- Updated `src/app/features/distributor/procurement/checkout.service.ts` for the backend DTO, including terminal/retry fields, server message, and the backend `MPESA` method name. The view continues to present the supported M-Pesa Sandbox and Demo choices.
- Updated `src/app/features/distributor/procurement/pages/centralized-checkout.component.html` to show server messages and a distinct unresolved-after-polling-deadline message.
- Fixed the existing cart persistence test fixture to clear the current `v2` key as well as the legacy key, preventing cross-test localStorage leakage.

## Outcomes and retries

`SUCCESS` stops polling and confirms payment; `FAILED`, `CANCELLED`, and `TIMED_OUT` stop polling and show the backend message. Cancelled M-Pesa does not retain a loading state on Demo. The retry control appears only for the three backend-retryable outcomes with `retryAllowed: true`. `UNKNOWN` remains unresolved and blocks a new attempt. The checkout and existing supplier orders are reused for retries.

## Verification

- Production Angular build: passed. The existing non-ESM `leaflet` optimization warning remains.
- Angular suite: passed, 16 files and 53 tests. The cart persistence fixture was corrected to clear its current storage key.
- The existing suite has no centralized checkout component tests, so it does not automate the twelve backend payment lifecycle scenarios listed in the request. No backend E2E environment was available for provider callbacks or configured DEMO simulator outcomes.
- Backend verification is not claimed. The backend team's implementation report says Maven tests and migration validation did not complete in their environment.

## Backend dependency / operational limitation

The backend guide documents no scheduled reconciliation for M-Pesa attempts whose callbacks never arrive. Such attempts can remain `PENDING` and block retries. The UI reports this as unresolved after its own two-minute polling limit and allows a manual status read; operational/provider follow-up remains a backend dependency. The backend report also requires Flyway migration V58 to be applied for payment attempt history/retries.
