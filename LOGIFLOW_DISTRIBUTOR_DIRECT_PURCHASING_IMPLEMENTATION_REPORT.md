# LogiFlow Distributor Direct Purchasing Implementation Report

## Summary

Approved distributor products now open the centralized checkout flow with the selected SKU and supplier preselected. The former catalog and Purchases page links to the single-supplier draft PO form have been replaced with Buy Stock / Checkout actions. Authorization remains a separate gate: products without APPROVED authorization do not expose Buy Stock.

The draft PO form and history routes remain available for compatibility and existing records, but are no longer the normal purchase journey.

## Previous workflow

The old catalog action opened a single-manufacturer draft PO builder. That builder called `POST /api/v1/purchase-orders`, after which the Manufacturer workspace could require a separate PO decision before payment. It was therefore not the centralized buyer checkout flow: it created a supplier PO directly, had no one-payment-per-checkout semantics, and represented manufacturer approval as a step in the purchasing path. The new approved-product action enters `POST /api/v1/checkouts`; the backend creates the child POs and owns checkout pricing and payment state.

## Workflow and changes

1. The distributor requests listing authorization from the Master Catalog. Pending, rejected and revoked products remain unavailable for buying.
2. For an approved product, **Buy Stock** opens `/distributor/procurement/checkout` with supplier and SKU query parameters. The flow preselects that product and displays its description, catalog unit price and any numeric availability returned by the products API.
3. The buyer selects quantities and an active destination warehouse for each supplier. Quantities are bounded by numeric availability when the API returns it. The checkout server remains authoritative for stock, MOQ, current price and commercial terms.
4. The buyer reviews the server-created checkout, grouped supplier POs, line prices, line totals, destination warehouse IDs and checkout total.
5. One DEMO payment can be initiated for the checkout. The UI labels the simulation clearly, sends no card or PIN data, reuses an idempotency key for retries, polls the backend for a terminal payment result and reloads checkout state by its URL reference.
6. On successful payment the buyer can open existing distributor shipment tracking and receipt operations. Supplier orders and their fulfillment remain independent; allocation display says explicitly that allocations are not payouts.

Manufacturer purchase-order and shipment features continue to use their existing server-owned data and status gates. No client-side payment success, fulfillment, settlement or inventory receipt is simulated.

## Files updated

- `src/app/features/distributor/catalog/pages/master-catalog.component.html`: changed the approved product action to Buy Stock and routed it directly to checkout.
- `src/app/features/distributor/procurement/pages/procurement-center.component.html`: replaced the new draft PO CTA with checkout links.
- `src/app/features/distributor/procurement/pages/centralized-checkout.component.ts` and `.html`: added product preselection, quantity and warehouse selection, server checkout review, payment initiation/polling, refresh/resume, cancellation and post-payment navigation.
- `src/app/features/distributor/procurement/procurement.service.ts`: carries optional numeric availability and product description/unit from the product API into the purchasing flow.
- `src/app/features/distributor/procurement/checkout.service.ts`: calls checkout create/read/payment/history/orders/allocation/cancel endpoints.
- `src/app/core/api/api-endpoints.ts`: registers centralized checkout routes and manufacturer financial-status route.
- `src/app/features/distributor/procurement/checkout.service.spec.ts`: verifies checkout and demo payment request payloads and idempotency headers.

The existing draft PO route, purchase-order history, product authorization workflow, manufacturer incoming PO pages and shipment/receipt services were retained.

## Backend endpoints used or registered

Centralized checkout integration follows the supplied 2026-11-17 backend guide:

- `GET /api/v1/products`, `GET /api/v1/products/authorizations`, and `GET /api/v1/warehouses` for approved products and buyer warehouses.
- `POST /api/v1/checkouts` with one idempotency key for a cart submission.
- `GET /api/v1/checkouts/{id}` for authoritative checkout, child POs, payment and allocations.
- `POST /api/v1/checkouts/{id}/payment` with `DEMO_MPESA` or `DEMO_CARD`; `GET /api/v1/checkouts/{id}/payment` is available through the service.
- `GET /api/v1/checkouts`, `/orders` and `/allocations`, and `POST /api/v1/checkouts/{id}/cancel` are registered in the service.
- Existing PO and distributor shipment/receipt services remain the fulfillment path.
- `GET /api/v1/manufacturer/purchase-orders/{id}/financial-status` is registered for manufacturer allocation status.

## Contract gaps / limits

- The supplied centralized checkout guide requires **at least two distinct supplier groups** in `POST /checkouts`. A direct Buy Stock action can open with one supplier preselected, but the current backend contract will not create or accept a one-supplier checkout. The UI explains that another supplier is required. A backend-supported single-supplier checkout (or an explicit rule change) is needed to pay for one manufacturer alone.
- Checkout validates MOQ and availability, but the supplied product/checkout response schema does not define a numeric MOQ field. Numeric quantity availability is used as an input limit only when returned by `/products`; if it is omitted, the client cannot enforce a maximum before submit and the backend remains authoritative.
- The supplied checkout response includes server line totals and a total amount but no separate charge breakdown. The UI shows those returned amounts and does not invent fees.
- The guide does not define the Manufacturer PO list DTO fields for distributor business name, checkout ID/payment status, or destination warehouse. Manufacturer views can only show those details when the existing PO read endpoint actually returns them. The manufacturer financial-status endpoint describes supplier allocations/settlement, not by itself the buyer checkout payment result. Confirm the PO projection exposes backend-confirmed checkout payment and destination before changing manufacturer shipment gates.
- The guide’s successful-payment behavior and supplier allocation semantics are implemented backend-side. No backend source or live integration environment was included, so manufacturer tenant isolation, actual payment configuration/outcomes, shipment creation and inventory receipt were not exercised end to end.

## Verification

- `npm.cmd run build` — passed. Angular reports the existing Leaflet CommonJS optimization warning.
- `npm.cmd test -- --watch=false` — passed: 15 test files and 47 tests, including two checkout service tests.
- `npm.cmd run build` — passed after the checkout flow changes. Angular reports the existing Leaflet CommonJS optimization warning.
- Live API/end-to-end testing was not possible from this frontend-only workspace.
