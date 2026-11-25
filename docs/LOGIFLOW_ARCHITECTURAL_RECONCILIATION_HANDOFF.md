# LogiFlow lifecycle reconciliation — backend handoff

## Purpose and boundaries

This document hands off backend and customer application work needed to complete the wholesale-to-resale lifecycle. The Angular repository contains no backend source and no separate customer storefront source. Existing routes below are the routes the frontend already calls; their live server behavior was not verified from this repository. Proposed routes are explicitly labeled and must be aligned with backend conventions before implementation. No backend or driver mobile application files were changed.

## Canonical reseller API update (2026-11-24)

The backend repository is available at `C:\DISTRO-BACKEND`. Its `docs/LOGIFLOW_CANONICAL_RESELLER_API.md`, controllers, service and DTOs confirm that Distributor reseller listing management and customer catalogue retrieval are now implemented. This supersedes the earlier “backend capabilities required” statements below for listing eligibility, listing management, and read-only customer catalogue. The current frontend integrates Distributor listing management; the customer storefront is outside this repository.

Confirmed Distributor routes are `GET /api/v1/distributor/reseller-listings`, `GET /api/v1/distributor/reseller-listings/eligible-products`, `POST /api/v1/distributor/reseller-listings` with `{ manufacturerProductId, retailPrice }`, `GET /api/v1/distributor/reseller-listings/{id}`, `PATCH /api/v1/distributor/reseller-listings/{id}/price` with `{ retailPrice }`, `POST /{id}/pause`, `POST /{id}/resume`, and `DELETE /{id}`. Controllers restrict these operations to Distributor admin/staff and derive tenant ownership from the authenticated principal. The backend creates or reuses one listing per Distributor/product pair.

The customer read-only catalogue routes are `GET /api/v1/customer/catalog/reseller-listings` with `search`, `category`, `brand`, optional `distributorOrganizationId`, `availableOnly`, and Spring `page`, `size`, `sort`; `GET /{id}`; and `GET /{id}/image`. Customer checkout, payment, reseller-order creation, listing-backed stock reservation/consumption and fulfillment are explicitly not implemented. The customer application prompt is [CUSTOMER_RESELLER_CATALOGUE_CODEX_PROMPT.md](CUSTOMER_RESELLER_CATALOGUE_CODEX_PROMPT.md).

DTO limitations confirmed in backend source: `EligibleResellerProductResponse.from()` currently returns `imageUrl: null`; the frontend reads the canonical image from the authenticated published-product image route. Neither the eligible-product nor reseller-listing response includes structured product attributes. No attributes are fabricated or edited in this frontend. The backend `ResellerListingResponse.imageUrl` points to a CUSTOMER-only image controller, so Distributor listing detail uses the canonical product image endpoint instead.

## Frontend work completed in this reconciliation

- Centralized wholesale checkout now accepts published source products without requiring a separate product-authorization approval in the client. Manufacturer authorization screens and the legacy direct PO path remain available as isolated legacy workflows.
- Manufacturer discovery and product selection continue to use published canonical Manufacturer product IDs, metadata and wholesale prices. Checkout uses the existing centralized checkout/payment service.
- The Purchases area now presents one primary purchase-cart action. Product discovery remains in the Catalog area; existing purchase history remains available.
- Unknown Manufacturer PO, Distributor PO and Distributor customer-order status strings map to `UNKNOWN`; they no longer silently become `PENDING` or `SUBMITTED`.
- The Manufacturer product browser and Distributor offer counter are labeled to distinguish Manufacturer source products from legacy stock offers.

This does not implement reseller listings. The current `/api/stock/offers` model represents Distributor stock items and asks for warehouse, SKU and reorder threshold. It is not evidence of a canonical-product reseller relationship, paid-purchase eligibility or a customer-facing seller listing. Reusing it for those semantics would risk creating duplicate or wrongly owned products.

## Existing frontend contracts in use

| Operation | Existing request / response | Notes |
|---|---|---|
| Manufacturer source product discovery | `GET /api/v1/products?size=100`; page or array with `id`, `sku`, `name`, `publicationStatus`, `manufacturerOrganizationId` or `organizationId`, `manufacturerName`, `unitPrice`, optional description/category/brand/unit/image and availability | Distributor filters to published canonical products. The backend must scope visibility by role and keep ownership fields stable. |
| Centralized wholesale checkout | `POST /api/v1/checkouts` with `Idempotency-Key`; `{ supplierOrders: [{ supplierOrganizationId, destinationWarehouseId, items: [{ stockItemId, quantity, distributorOfferId? }] }] }`; returns checkout, supplier PO lines, payment, allocations | Existing `stockItemId` currently represents the product/stock reference returned by the product endpoint. Confirm whether this is the canonical product ID or an inventory ID; do not infer. |
| Checkout payment | `POST /api/v1/checkouts/{checkoutId}/payment`, `{ method: 'DEMO' | 'MPESA_SANDBOX', phoneNumber? }`, `Idempotency-Key`; response contains server status | Client waits for and refreshes backend confirmation. A payment initiation acknowledgement is not payment success. |
| Checkout state | `GET /api/v1/checkouts/{id}` and payment/orders/allocations subresources | Checkout `PAID` means wholesale payment only. It must not imply stock received or sellable. |
| Manufacturer PO operations | `GET /api/v1/manufacturer/purchase-orders`, `/.../{id}`, current decision/retry/pick/pack calls under `/api/v1/manufacturer/purchase-orders/{id}` | Keep one PO-backed fulfillment authority. Server owns payment verification, stock reservation and fulfillment transitions. Confirm those route contracts and response states against the deployed backend. |
| Wholesale receipt | `POST /api/v1/purchase-order-shipments/{shipmentId}/receive` | The existing frontend contract records accepted, damaged and missing quantities. Confirm atomic, one-time stock posting and response balances. |
| Distributor customer orders | `GET /api/v1/orders`, `PATCH /api/v1/orders/{id}/status` | Customer creation is intentionally unavailable in this Distributor workspace. `DistributorOrderService.create()` throws. Dispatch and delivery confirmation are also not integrated. |
| Legacy listing permission and offers | `GET /api/v1/products/authorizations`, `POST /api/v1/products/{id}/authorization-requests`, `PATCH /api/v1/products/authorizations/{id}/decision`; `POST /api/stock/offers`, `PATCH /api/stock/offers/{id}` | Retain while older authorization/stock-offer users depend on them. Do not treat these as the new reseller listing API without backend confirmation and migration. |
| Trips and tracking | `/api/v1/trips` list/create/assign/dispatch/tracking operations exist in the Distributor client | Manufacturer trips are currently synthesized from shipments; trip/order linking currently uses order-number matching in the Distributor. Stable resource IDs and Manufacturer trip APIs are still needed. |

## Backend capabilities required

### 1. Resale eligibility derived from settled wholesale purchase

After a Distributor checkout has backend-confirmed successful payment, create or expose eligibility for each paid supplier PO line. Eligibility must be scoped to the authenticated buyer organization and reference at minimum:

- `purchaseOrderId`, `purchaseOrderLineId` (stable line ID), `checkoutId`, and payment confirmation reference/state;
- canonical `manufacturerProductId`, `manufacturerOrganizationId`, and authenticated `distributorOrganizationId`;
- purchased quantity and quantities received/accepted, damaged, missing, reserved and currently sellable;
- eligibility/listing state and timestamps.

Payment success makes the product eligible to list; it does not increase sellable quantity. A paid order with a stock exception remains paid and reports fulfillment/inventory exception independently. The API must prevent unpaid, other-tenant, or unrelated product lines from being listed.

### 2. Distributor resale eligibility and listing operations

Provide authenticated Distributor operations to:

- list this Distributor's eligible purchased products with canonical Manufacturer product metadata and receipt-backed availability;
- create/publish a reseller listing by submitting only `manufacturerProductId` (or a stable eligible purchase-line reference) and `retailPrice`;
- update `retailPrice`, pause/resume, or remove a listing where business rules allow;
- retrieve the Distributor's listings and listing status.

The server must derive Distributor identity from authentication. It must reject a product without eligible paid purchase history and prevent editing canonical name, description, image, brand, category, unit, attributes, wholesale price, Manufacturer identity or stock through the listing API. Listing identity must be independent and stable, e.g. `resellerListingId`.

Suggested response shape (field names are a proposal for contract discussion, not an existing API):

```json
{
  "id": "reseller-listing-id",
  "distributorOrganizationId": "seller-org-id",
  "manufacturerProductId": "canonical-product-id",
  "purchaseOrderLineId": "paid-po-line-id",
  "retailPrice": 850,
  "status": "ACTIVE",
  "availability": {
    "acceptedQuantity": 0,
    "reservedQuantity": 0,
    "availableQuantity": 0,
    "state": "OUT_OF_STOCK"
  },
  "product": {
    "name": "Premium Cement 50kg",
    "description": "...",
    "imageUrl": "...",
    "brand": "...",
    "category": "...",
    "unit": "bag",
    "attributes": {}
  },
  "manufacturer": { "id": "manufacturer-org-id", "name": "Source Manufacturer" },
  "distributor": { "id": "seller-org-id", "name": "Selling Distributor" }
}
```

The exact eligible-product and reseller-listing URLs should follow the backend's versioning and resource conventions. Do not deploy URLs copied from this example without agreement.

### 3. Customer catalogue, cart and order ownership

The customer catalogue must return reseller listings, never bare Manufacturer wholesale products as retail inventory. Search and pagination should be server-side and return the stable listing ID, canonical product metadata, Distributor/store identity, retail price, active state and current availability.

Customer cart/order lines must reference `resellerListingId`; the backend must derive and persist the correct `distributorOrganizationId` and snapshot retail price/product identity at purchase time. A checkout request must never identify the Manufacturer product as the sole seller key. If a cart contains multiple sellers, define whether checkout splits into one order per Distributor or rejects mixed sellers; the current customer-order model does not document a multi-seller checkout contract.

At checkout, atomically validate availability and reserve only backend-confirmed accepted Distributor stock. Reject quantities above current availability. On cancellation/payment failure release reservation according to the agreed lifecycle; on fulfillment deduct exactly the fulfilled quantity. Customer payment and Distributor-to-Manufacturer wholesale payment must have separate order IDs, payment records, reporting and reconciliation.

### 4. Distributor-to-customer fulfillment and delivery

Expose stable order-to-trip relationships and the authorized Distributor operations to reserve, pick, pack, assign supported trips, dispatch, track, and complete customer orders. Do not rely on order-number matching. Customer delivery confirmation must use its own customer-facing verification contract and authorization checks; Driver invitation phone OTP and Manufacturer-to-Distributor receipt reconciliation are different workflows.

The handoff must specify customer OTP lifecycle (issuance, expiry, retry limits, one-time verification, assigned trip/order validation, audit event) and the completion response. Do not reuse driver invitation OTP or the wholesale receiving endpoint.

### 5. Existing lifecycle contract clarifications

- Confirm the source product ID accepted in centralized checkout and how PO lines preserve canonical product and stable line IDs.
- Confirm duplicate/partial payment callback behavior and idempotency for checkout and payment.
- Confirm whether PO payment success is independent of inventory reservation failure and expose both states without changing paid status.
- Return accepted/damaged/missing receipt reconciliation and before/after stock balances; prevent duplicate receipt stock increments.
- Confirm whether PO-specific pick/pack calls are deployed and return authoritative quantities and fulfillment state.
- Provide Manufacturer trip list/detail/create-from-consignment or consolidation APIs, including stable shipment/consignment IDs, eligible consolidation groups, trip assignment and dispatch.
- Return unknown/new statuses verbatim or in a documented enum; clients must render an unknown state without treating it as pending, approved or paid.
- Apply organization/role checks to every query and mutation; never trust IDs or ownership sent by the browser.

## Customer application boundary

No customer storefront, customer cart, customer-account checkout screen or customer catalogue source was found under `src/app`. The current code has a Distributor customer directory and customer-order read screens, but no supported Distributor-side customer-order creation API. The customer storefront and customer-account order creation must be implemented in the separate customer application, if it exists, not in the Manufacturer or Distributor workspaces.

## Copy-ready backend Codex prompt

```text
Implement the backend support for LogiFlow's Manufacturer-to-Distributor wholesale purchasing and Distributor-to-customer resale lifecycle. First inspect the existing backend entities, migrations, API conventions, authorization rules, payment processing, inventory ledger, shipments, trips, customer orders and tests. Preserve existing clients and data; do not assume the route or field proposals below already exist.

Target lifecycle:
1. Manufacturer publishes a canonical source product.
2. Distributor buys it through the existing centralized checkout and payment flow.
3. Only backend-confirmed paid supplier PO lines grant that authenticated Distributor resale eligibility.
4. Eligibility is separate from physical receipt. Wholesale payment never creates sellable stock.
5. Distributor creates a reseller listing referencing the canonical Manufacturer product and an eligible paid PO line. Distributor submits only retail price and allowed listing controls. Product identity/metadata remain canonical and read-only.
6. Distributor sellable availability increases only by accepted quantities in an idempotent goods receipt; damaged and missing quantities are reconciled separately.
7. Customer catalogue returns Distributor-owned reseller listings, inherited Manufacturer metadata, retail price, seller identity and accepted-stock-backed availability.
8. Customer cart/order lines reference the stable reseller listing ID and correct Distributor. Customer payment/order fulfillment/delivery remains separate from wholesale purchase/payment/receipt.

Before coding, verify the actual centralized checkout contract and all existing deployed routes. Keep legacy product authorization and /api/stock/offers compatible unless dependency analysis proves a safe migration. Do not let a legacy authorization decision grant reseller eligibility. Do not create duplicate Manufacturer products for Distributor listings.

Implement tenant-safe, role-checked APIs for: Distributor eligible purchases; Distributor reseller listing list/create/update/pause; customer-facing reseller catalogue; customer cart/checkout/order creation and payment; inventory reservation/release/deduction; stable order-to-trip linkage; Distributor order fulfillment/dispatch; and customer delivery verification, but only where equivalent APIs do not already exist. Choose routes matching the repository's established conventions and document them; do not blindly copy suggested paths. The listing-create request should contain the canonical product ID (or eligible purchase-line ID) and retail price only. Derive Distributor identity from authentication. Return stable resellerListingId, manufacturerProductId, distributorOrganizationId, retailPrice, listing state, canonical product metadata, seller identity and accepted/reserved/available quantity.

Required invariants: unpaid purchases cannot list; one Distributor cannot list another's purchase; Manufacturer cannot change Distributor retail price; Distributor cannot mutate canonical metadata; out-of-stock listings may remain visible but checkout cannot exceed accepted available stock; receipt is idempotent and only accepted units enter sellable inventory; payment success remains recorded if stock fulfillment has an exception; wholesale and customer payment flows never share order identity; status transitions are server-authoritative; unknown client statuses cannot become PENDING implicitly.

Define behavior for mixed-seller carts, payment success with stock shortage, partial/damaged/missing receipts, canceled/failed customer payments, reservation expiry, partial fulfillment, returns/refunds and concurrent checkout. Include audit history and idempotency keys for payment, receipt and order actions. Keep customer delivery OTP distinct from driver-invitation OTP and wholesale receipt.

Add migrations only when required, preserve existing data, and provide API examples/OpenAPI updates. Add backend tests for cross-tenant isolation, role authorization, unpaid eligibility denial, canonical metadata immutability, duplicate receipt, concurrent stock reservation, over-quantity rejection, payment/stock exception separation, seller attribution, idempotent callbacks and customer delivery OTP. Report changed files, migration/rollout steps, compatibility impacts and tests actually run. Do not edit frontend or driver mobile application code in this backend task.
```

## Copy-ready customer application Codex prompt

```text
Inspect this customer application's existing architecture and integrate LogiFlow customer shopping with the backend reseller-listing contract. Do not build these screens in the Manufacturer or Distributor web workspace.

Replace any retail browsing of bare Manufacturer wholesale products with the authenticated/public customer catalogue of active Distributor reseller listings. Display canonical Manufacturer product name, image, description, brand, category and attributes as read-only data alongside the listing's retail price, selling Distributor/store identity and backend availability. Carry the stable resellerListingId and seller organization through product detail, cart and checkout. Never use only manufacturerProductId to identify the seller.

At checkout, submit listing IDs and quantities to the customer-account checkout API. Let the backend validate current accepted Distributor stock, reserve inventory, calculate price and attribute each order to the correct Distributor. Display server-confirmed customer payment status and customer order state. Keep customer payment separate from the Distributor's wholesale payment. Handle mixed-seller behavior according to the backend contract; do not split orders locally unless the server explicitly requires it.

Integrate customer delivery tracking and the customer delivery-verification/OTP flow only after confirming its actual backend contract. Do not reuse driver invitation phone OTP or wholesale receipt confirmation. Show loading, unavailable, out-of-stock, price/availability refresh, pending payment, failure and unknown status states honestly. Do not mock successful payment, stock reservation, order placement or delivery.

Preserve existing account, authentication, navigation and accessibility conventions. Add tests for correct seller attribution, stale/insufficient inventory, payment pending/failure, order ownership and delivery verification. First identify the actual backend routes and request/response types; do not invent endpoint paths. Report any missing backend contract precisely instead of presenting an incomplete purchase as successful.
```

## Validation and remaining dependencies

Validation completed: `npm.cmd run build` passed. `npm.cmd test -- --no-watch` passed (16 test files, 59 tests). `npm test -- --run` is not supported by this Angular CLI and was not used. `package.json` defines no lint script, so linting was unavailable. Server-side behavior, deployment state, reseller listing, customer checkout, customer delivery verification and Manufacturer trip APIs remain unverified or missing from this frontend repository.
