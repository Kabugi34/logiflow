# LogiFlow Frontend Payment Method Alignment Report

## Summary

Aligned the distributor centralized checkout payment selector with the backend-reported methods. The UI now offers **M-Pesa STK Push (Sandbox)** and **Demo Payment** only. A single unified checkout still serves one or multiple suppliers, followed by one payment initiation.

## Original Render error

Before this change, the selector defaulted to `DEMO_MPESA` and `CentralizedCheckoutService` posted `{ "method": "DEMO_MPESA" }`. The backend-reported enum accepts only `MPESA_SANDBOX` and `DEMO`, so the request reached the correct existing payment route with an unsupported enum value. The DTO property name remains `method`; the reported validation error identifies that field and lists the accepted values.

## Request and status integration

The frontend reuses the existing centralized checkout routes:

- `POST /api/v1/checkouts` creates the one server checkout, with the existing `Idempotency-Key` and grouped supplier orders.
- `POST /api/v1/checkouts/{checkoutId}/payment` initiates the selected method with an `Idempotency-Key`.
- `GET /api/v1/checkouts/{checkoutId}` retrieves checkout and payment state and is polled every second while the backend reports `PENDING`, `INITIATED`, or `PROCESSING`. This same read restores state after route refresh when the checkout ID is in the URL.

Payment request bodies are now:

```json
{ "method": "MPESA_SANDBOX", "phoneNumber": "254712345678" }
```

```json
{ "method": "DEMO" }
```

The M-Pesa phone number is collected on the checkout screen, normalized to E.164-like format, and required before initiation. No phone number or amount is sent for Demo Payment. The backend derives the checkout amount; Angular applies no demo amount ceiling.

The response model accepts payment methods `MPESA_SANDBOX` and `DEMO`; payment states include pending/processing, success, failure, cancellation, timeout/expiration, reversal, refund, and unknown. Only a server response can display success. A payment attempt is not considered paid from initiation acknowledgement.

## Components and services changed

- `src/app/features/distributor/procurement/checkout.service.ts`: aligned payment enums, request body mapping, and response fields for references/messages/failure reasons.
- `src/app/features/distributor/procurement/pages/centralized-checkout.component.ts`: M-Pesa phone validation, pending-state polling, backend status rendering, terminal-state retry with a fresh idempotency key, and duplicate-submit guard.
- `src/app/features/distributor/procurement/pages/centralized-checkout.component.html`: two friendly options, sandbox and demo notices, waiting state, payment status/reference, and retry action.
- `src/app/features/distributor/procurement/checkout.service.spec.ts`: exact request body tests, single/multi-supplier checkout tests, large total pass-through, and backend failure-state reading.

No card option or separate single-supplier checkout was added. Existing order, fulfilment, and shipment code is not changed; frontend payment results come from backend checkout reads.

## Verification

- `npm.cmd test -- --watch=false` — passed: 16 test files, 53 tests.
- `npm.cmd run build` — passed. The existing Angular CommonJS optimization warning for `leaflet` remains.
- Tests assert exact `MPESA_SANDBOX` and `DEMO` method values and the M-Pesa `phoneNumber` field; cover single- and multi-supplier request structures, a large server-returned demo total, and server-reported failure state.

No live Render payment attempt or M-Pesa callback was run from this workspace. Callback verification remains a backend responsibility; the frontend reads its result through checkout polling.

## Remaining backend contract points

The repository payment guide documents generic `POST /api/v1/payments/initiate` with `provider: "MPESA"`, and does not specify the centralized `/checkouts/{id}/payment` request/response DTO or sandbox method. The `method` key is preserved from the existing centralized frontend request and aligns with the backend-reported validation error; the accepted enum values come from the reported deployed backend error.

The generic guide supports `phoneNumber`, but does not confirm that the centralized checkout payment DTO accepts it alongside `method`. Confirm this DTO field with the backend owner. The response contract in repository docs also does not define the DEMO reference field; the UI displays `paymentReference` or `reference` when returned, otherwise it displays the server payment ID. If the backend uses a different reference property, align the response model to that exact name.

The generic guide uses `SUCCEEDED`, while the centralized checkout frontend has historically used `SUCCESS`; the response mapper/UI now accepts both. Confirm the deployed checkout status names, especially timeout and cancellation, against the centralized endpoint DTO.
