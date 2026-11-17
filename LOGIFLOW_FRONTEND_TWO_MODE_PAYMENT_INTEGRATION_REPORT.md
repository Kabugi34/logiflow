# LogiFlow Frontend Two-Mode Payment Integration Report

## Scope and evidence

Reviewed the Distributor centralized checkout component and service, shared payment service and models, payment API contract, existing frontend/backend alignment reports, API endpoint registry, and Manufacturer purchase-order/shipment workflows. The two requested integration guides and the latest backend payment implementation report were not present in this workspace. No backend source or confirmed OpenAPI schema is included here, so endpoint and DTO behavior could not be verified against the running backend.

## Existing frontend issues found

- Centralized checkout rejected fewer than two supplier groups, including a valid single-manufacturer purchase.
- Its screen repeated that unsupported minimum-supplier restriction.
- Calling payment when a payment already existed set the busy state and returned without clearing it.
- The centralized checkout payment model currently advertises `DEMO_MPESA` and `DEMO_CARD`; it has no Daraja phone-number request contract, M-Pesa sandbox mode, demo transaction reference contract, or verified backend mode enum available in this workspace. This conflicts with the requested two supported choices and cannot safely be translated into a new API payload without the backend report/DTOs.

## Changes made

- Removed the two-supplier minimum. Checkout creation now permits any non-empty set of grouped lines, including one supplier and one product; empty checkout and per-supplier warehouse validation remain.
- Removed the user-facing warning that instructed users to add a second supplier.
- Guarded checkout payment submission when a payment already exists; it now refreshes backend checkout state instead of starting another attempt.

## Existing integration surface

The current checkout service references:

- `POST /api/v1/checkouts` to create a checkout.
- `GET /api/v1/checkouts/{id}`, `/orders`, `/payment`, and `/allocations` for checkout reads.
- `POST /api/v1/checkouts/{id}/payment` and `/cancel` for payment initiation and cancellation.
- `GET /api/v1/checkouts` for checkout history.

These routes and payloads are present as frontend references only. The supplied `docs/payment-api-contract.md` documents `/payments/initiate` and `/payments/{orderId}/status` in a previous payment model and explicitly identifies supplier checkout extensions as proposed/unverified. It does not verify these centralized checkout routes or the newly requested two payment modes.

## Journey coverage and gaps

- Product discovery and authorization request/approval use existing Distributor catalog and Manufacturer authorization workflows.
- The current procurement flow still contains the earlier manufacturer PO approval path described in the existing frontend alignment report. The requested removal of this approval path requires an implemented backend purchase transition; none was confirmed here.
- Existing Manufacturer PO, shipment, Distributor tracking and receipt integrations remain governed by the prior alignment report. No backend evidence was available to verify that checkout child POs map to those records or that checkout payment unlocks fulfilment.
- The current centralized checkout view shows checkout reference, grouped supplier orders, line quantities/prices, supplier totals, destination warehouse IDs, overall total, payment status, and allocation status. It does not have verified M-Pesa sandbox and LogiFlow Demo payment options or a phone entry field.
- No safe implementation of sandbox initiation/polling or backend-controlled demo results can be made from the available contracts. The existing DEMO card/M-Pesa labels are not accepted as evidence of the requested backend modes. No frontend success simulation was added.
- No tenant-isolation runtime verification or end-to-end backend workflow test could be performed without a backend environment and test accounts.

## Files changed

- `src/app/features/distributor/procurement/pages/centralized-checkout.component.ts`
- `src/app/features/distributor/procurement/pages/centralized-checkout.component.html`

## Remaining backend inputs required

Provide the two requested checkout/payment guides and latest backend implementation report, or backend source/OpenAPI DTOs confirming: supported payment mode enum, checkout payment initiation request and response, status polling/read behavior, transaction-reference fields, failure/cancel/timeout states, child PO/payment linkage, fulfillment eligibility, and checkout history access. These are necessary to finish the requested payment integration without inventing routes or response fields.

## Verification

- Angular production build: passed (`npm.cmd run build`); the existing CommonJS `leaflet` optimization warning remains.
- Angular test suite: passed, 15 files and 47 tests (`npm.cmd test -- --watch=false`). These tests do not verify backend payment outcomes, tenant isolation, or full fulfillment/receipt flows.


