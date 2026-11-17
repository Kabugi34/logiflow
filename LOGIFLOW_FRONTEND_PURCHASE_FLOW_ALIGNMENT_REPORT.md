# LogiFlow frontend purchase-flow alignment report

## Audit findings

- The distributor catalog's **Purchase Stock** action opens the existing PO builder. That builder creates a record through `POST /api/v1/purchase-orders`; it does not start checkout directly. It also requires a manufacturer authorization, as intended by product permissions.
- The PO UI exposes payment only after the manufacturer PO decision changes the order to its accepted/approved state. The integration guide describes this as the current supplier workflow. The requested revised spec instead removes that approval step, but no verified backend transition or purchase endpoint implementing direct paid purchase is present in this Angular repository or the API guide.
- Purchase-order payment calls the generic `/payments/initiate` and `/payments/{orderId}/status` routes with `orderType=PURCHASE_ORDER`. The payment guide documents the existing routes for customer orders and explicitly marks supplier-order support as proposed/unverified.
- The distributor PO form does not have a confirmed destination warehouse request field. The API handoff lists `destinationWarehouseId` as a proposed extension only.
- Manufacturer PO DTO mapping used the buyer organization ID as its display name. Distributor PO mapping likewise used supplier ID as the manufacturer name. The former now uses an unavailable label; the latter uses manufacturer display name from the already loaded product DTO when available.
- Inbound logistics summary is derived from the PO read model; shipment manifest and distributor receipt linkage are not confirmed by the guide. It cannot be represented as a verified shipment/receipt journey from current contracts alone.
- `LOGIFLOW_PURCHASE_FLOW_PATCH.md` was not found in the workspace or alongside the supplied pasted-text attachment. No Spring Boot source project is present in this checkout. The integration guides are handoff documents and explicitly distinguish proposed contracts from implemented routes.

## Changes implemented

- Renamed the Distributor navigation item and purchase-history page to **Purchases**; the page action now reads **Purchase Stock**.
- Purchase history now renders truthful payment-aware labels for existing states: awaiting manufacturer review, payment pending, awaiting payment, paid—awaiting fulfilment, fulfilled, rejected, and cancelled.
- Removed UUID-as-business-name fallbacks from authorization, distributor PO, and manufacturer incoming PO displays. Manufacturer names are resolved from the actual product DTO when available; otherwise the UI says the name is unavailable.
- The existing purchase form continues to require approved authorization, provides a product/quantity/price preview, and requires review confirmation before creating the existing PO.
- Manufacturer shipment allocation and dispatch remain blocked unless the API read model reports both accepted PO state and backend-confirmed `PAID` status.
- No frontend payment-success simulation or card processing was added. A browser-only simulation would not update server purchase/payment records and would violate the revised requirement that DEMO state be backend-generated.

## Existing endpoints referenced by the frontend

- Authorization and product catalog: `GET /api/v1/products`, `GET /api/v1/products/authorizations`, `POST /api/v1/products/{productId}/authorization-requests`, `GET /api/v1/products/authorizations/incoming`, `PATCH /api/v1/products/authorizations/{id}/decision`.
- Purchase orders: `GET/POST /api/v1/purchase-orders`, `GET /api/v1/purchase-orders/{id}`, `GET /api/v1/purchase-orders/{id}/settlements`, `GET /api/v1/manufacturer/purchase-orders`, and `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision`.
- Payments: `POST /api/v1/payments/initiate` and `GET /api/v1/payments/{orderId}/status`. The payment guide documents these as customer-order integrations; supplier PO use is proposed/unverified.
- Manufacturer fulfillment: existing manufacturer shipment create/list/detail/status routes and trip assignment/dispatch routes.
- Distributor inbound logistics: existing trip/tracking routes; no verified PO shipment-manifest receipt endpoint is documented.

These are frontend route references. No deployed backend was available in this workspace for live verification.

## Provider support and environments

- **M-Pesa:** The frontend contains a generic STK initiation/status UI, but the backend guide does not verify its use with `PURCHASE_ORDER`. Callback verification/reconciliation is backend-owned and was not available here to inspect.
- **Bank card:** No card checkout route or provider implementation was found in the frontend or API guide. The existing PO detail UI identifies card payment as unavailable.
- **DEMO / SANDBOX / PRODUCTION:** No backend-controlled environment selector or payment mode DTO/configuration was found in this frontend. No DEMO success simulator was added because client-only success would create false payment evidence. No provider credential or backend callback behavior can be claimed as verified.

## Remaining integration blockers

1. Supply the updated `LOGIFLOW_PURCHASE_FLOW_PATCH.md` and Spring Boot backend source (or confirmed OpenAPI contract) to implement the intended workflow against real transitions.
2. Backend must define/reuse a durable purchase endpoint and status transition that creates the purchase and permits payment without a second manufacturer approval, while preserving organization isolation and immutable price/quantity snapshots.
3. Backend must confirm PO payment initiation/status/history for M-Pesa, verified callbacks, and how the manufacturer read model exposes server-confirmed paid purchases. Card checkout and callback/status integration are missing if card is required outside DEMO.
4. Backend must implement a controlled DEMO mode that returns backend-generated transaction references and updates purchase/payment records, while guaranteeing simulation cannot be enabled in PRODUCTION.
5. Confirm and return destination warehouse identity/name in purchase and shipment DTOs, plus manufacturer/distributor business display names for all role-scoped views.
6. Confirm shipment line allocations, dispatch state transitions, inbound manifest, and distributor receipt endpoints before presenting dispatch or receipt as complete.

The requested live end-to-end purchase → payment → fulfilment → dispatch → receipt journey is therefore not verifiable or fully implementable against the supplied frontend/API materials alone.

## Verification

- `npm.cmd run build` — passed; Angular reported the existing Leaflet CommonJS optimization warning.
- `npm.cmd test -- --watch=false` — passed: 14 test files, 45 tests.
- The API-driven end-to-end flow was not run because no backend source/test environment or confirmed direct-purchase/payment contracts were supplied.
