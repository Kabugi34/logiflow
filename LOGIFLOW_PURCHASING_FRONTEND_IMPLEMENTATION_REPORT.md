# LogiFlow purchasing frontend implementation report

## Files changed

- `src/app/features/manufacturer/products/pages/product-authorizations.component.ts`
- `src/app/features/distributor/catalog/pages/master-catalog.component.html`
- `src/app/features/distributor/procurement/pages/purchase-order-form.component.ts`
- `src/app/features/distributor/procurement/pages/purchase-order-form.component.html`
- `src/app/features/distributor/procurement/pages/purchase-order-details.component.html`
- `src/app/features/manufacturer/purchase-orders/purchase-order.service.ts`

## UI functionality implemented

- Manufacturer distribution request rows now open a detail dialog showing distributor organization identity as returned by the authorization DTO, product, submission date, status, proposal note, target market, sales channels, geography, strategy, and any agreed wholesale price/minimum quantity returned by the API.
- Missing distributor name and contact person/email/phone are explicitly shown as unavailable. No organization/contact information is synthesized.
- Approved products in the distributor catalog link into the existing purchase-order form with the manufacturer and SKU preselected. The current manufacturer authorization gate remains in place.
- The purchase-order form previews products, quantity, backend product unit price and calculated line/order subtotal, and requires an explicit review confirmation before submission.
- The existing M-Pesa component remains the purchase-order payment UI and uses backend status verification. Bank card is shown as unavailable because no documented or implemented card checkout exists.
- Manufacturer PO payment status is now read only from the PO `paymentStatus`; ambiguous settlement rows are no longer used as payment proof. Existing dispatch screens continue to require accepted orders and backend-confirmed `PAID` status.

## Existing backend APIs consumed

The UI uses the existing routes registered in `src/app/core/api/api-endpoints.ts` and already wired in services:

- `GET /api/v1/products/authorizations/incoming`
- `PATCH /api/v1/products/authorizations/{id}/decision`
- `GET /api/v1/products/authorizations` and `GET /api/v1/products`
- `POST /api/v1/purchase-orders`, `GET /api/v1/purchase-orders`, and `GET /api/v1/purchase-orders/{id}`
- `GET /api/v1/payments/{orderId}/status` and `POST /api/v1/payments/initiate` (the UI sends `orderType: PURCHASE_ORDER` and provider `MPESA`; server-side support for this order type must be verified)
- `GET /api/v1/manufacturer/purchase-orders`, `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision`, and the existing manufacturer shipment/trip routes

## Missing backend fields or capabilities

The repository's `docs/product-inventory-order-api-contract.md` identifies its expanded DTOs as proposals, not verified deployed contracts. In particular:

- The authorization request DTO currently consumed by the frontend does not document distributor business details or contact person/email/phone. The UI cannot display those fields until an actual response DTO/API supplies them.
- No documented manufacturer action requests more information on an authorization request. The current decision route only has the implemented approve/reject UI.
- The current PO create implementation submits supplier and items with `stockItemId`/quantity. A destination warehouse is proposed in the handoff but is not confirmed in the implemented request/response DTO. The purchase form therefore does not submit a guessed `destinationWarehouseId`.
- The PO response does not reliably provide manufacturer display name, destination warehouse, currency/complete amount snapshot, or complete fulfillment quantities according to the integration guide. The UI can only display what current services receive.
- The current supplier payment API contract is not verified as supporting purchase orders. The integration guide describes customer-order initiation/status as implemented and supplier purchase payments as needing backend confirmation/routes. M-Pesa PO initiation remains subject to that backend validation.
- No bank-card payment endpoint/provider is documented or implemented. No card processing was added.
- The documented payment states include pending/success/failure and expiry/reversal/refund variants; a distinct cancelled state and a purchase-order cancellation/status endpoint are not established in the current DTOs.
- Existing shipment creation/status endpoints support the manufacturer workflow, but the handoff calls out missing confirmed line-level PO allocation/idempotent dispatch contract details. Distributor shipment manifest/receipt APIs are also not confirmed.

## Payment methods actually supported

- **M-Pesa:** Existing generic `MPESA` initiation and payment status verification are used by the UI; backend confirmation, provider reconciliation, and applicability to `PURCHASE_ORDER` remain an integration dependency.
- **Bank card:** Unavailable; no card payment flow was found in the frontend or documented backend contracts.

## Verification

- `npm.cmd run build` — passed. Angular emitted the existing CommonJS optimization warning for Leaflet.
- `npm.cmd test -- --watch=false` — passed: 14 test files, 45 tests.
- `git diff --check` — passed.

The live end-to-end journey cannot be confirmed in this frontend-only repository without a running backend and the missing confirmed DTO/endpoint contracts above.
