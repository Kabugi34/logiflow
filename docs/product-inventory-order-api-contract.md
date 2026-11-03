# Product, inventory, purchasing, payment, and fulfillment API contract

**Status:** Backend handoff proposal. This document distinguishes routes already referenced by
the Angular application from behavior and contracts that still require backend implementation or
confirmation. A route in the frontend registry is not proof that the deployed API implements the
contract below.

## Current frontend integration and known gaps

The Angular application currently calls these route families:

| Area                            | Frontend-referenced routes                                                                                                                                                                                                     | Current limit                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products                        | `GET/POST /api/v1/products`, `GET/PATCH /api/v1/products/{id}`, `PATCH /api/v1/products/{id}/publication`                                                                                                                      | Manufacturer product create/update and publication use these routes. The read DTO currently lacks confirmed warehouse-specific balances, complete specifications, and canonical manufacturer display name.     |
| Product permissions             | `GET /api/v1/products/authorizations`, `POST /api/v1/products/{id}/authorization-requests`, `PATCH /api/v1/products/authorizations/{id}/decision`                                                                              | Request and decision flows exist in the frontend. The request-note field in this handoff is a proposed body addition.                                                                                          |
| Distributor offers              | `GET /api/stock/items`, `POST /api/stock/offers`, `PATCH /api/stock/offers/{id}`                                                                                                                                               | Offer creation is authorization-gated in the UI. The currently used `sourceStockItemId` field does not unambiguously identify the canonical manufacturer product; see the proposed stable-reference DTO below. |
| Warehouses and staff            | `GET/POST/PATCH /api/v1/warehouses`, `GET/POST /api/v1/members`, member status and invitation routes                                                                                                                           | Manufacturer and Distributor UIs now request reversible warehouse deactivation/reactivation through `PATCH /api/v1/warehouses/{id}`. Backend dependency checks are unverified; no hard-delete action is exposed. |
| Supplier orders                 | `GET/POST /api/v1/purchase-orders`, `GET /api/v1/purchase-orders/{id}`, `GET /api/v1/purchase-orders/{id}/settlements`, `GET /api/v1/manufacturer/purchase-orders`, `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision` | `settlements` is ambiguous and is not treated as verified payment. A PO response may omit `paymentStatus`; the frontend now treats omission as `UNKNOWN` and blocks manufacturer fulfillment.                  |
| Customer orders and payments    | `GET /api/v1/orders`, `PATCH /api/v1/orders/{id}/status`, `POST /api/v1/payments/initiate`, `GET /api/v1/payments/{orderId}/status`                                                                                            | The order detail reads payment status from the API. Initiation responses are not authoritative payment confirmation. Failed, expired, reversed, and unknown statuses are kept distinct.                        |
| Manufacturer shipment and fleet | `POST /api/v1/shipments`, shipment list/detail/status, and existing driver, vehicle, and trip routes                                                                                                                           | Manufacturer dispatch uses the existing shipment workflow. The distributor frontend has no confirmed shipment manifest/receipt API, so PO approval alone is not represented as a received delivery.            |
| Stock audit                     | `POST /api/stock/audits`                                                                                                                                                                                                       | The current manufacturer warehouse adjustment and movement screen uses a clearly labeled browser-session ledger; it is not a durable stock adjustment API.                                                     |

The implementation repository contains no verified backend service contract for the missing
operations. Do not interpret frontend route registration, a successful payment-initiation request,
or a locally updated warehouse ledger as durable backend behavior.

## Organization workflows

### Manufacturer

1. A manufacturer creates a canonical product, including identity, description, category, images,
   specifications, wholesale price, and publication state. Production/inventory creation is a
   manufacturer stock operation; it is not an incoming delivery receipt.
2. The manufacturer assigns product stock to one of its warehouses. Physical, reserved, and
   available quantities are returned per warehouse. Product ownership remains with the
   manufacturer.
3. A distributor requests listing permission. Manufacturer-authorized staff approve or reject the
   request; approval is scoped to the distributor organization and product.
4. An authorized distributor submits a stock purchase order referencing the canonical product and
   requested quantity. The server validates current authorization and reserves available
   manufacturer stock atomically.
5. The manufacturer reviews and accepts or rejects the order. Acceptance is not payment
   confirmation and is not shipment dispatch.
6. The distributor initiates payment through a trusted provider flow. The provider callback is
   verified by the backend. The order becomes fulfillment-eligible only after the backend records
   a successful, reconciled payment.
7. The manufacturer allocates paid order quantities, picks and packs them, then dispatches them
   using existing driver, vehicle, trip, and tracking functionality. Shipment creation and stock
   deduction must be one idempotent backend operation.
8. The distributor confirms shipment receipt with line-level accepted, damaged, and missing
   quantities. Only accepted quantities increase distributor inventory. Receipt discrepancy
   records must reference the shipment and the responsible user.

### Distributor

1. The distributor browses published manufacturer products with canonical manufacturer identity,
   images, specifications, wholesale pricing, and available stock. Missing response values are
   displayed as unavailable rather than inferred from a boolean or organization identifier.
2. The distributor submits a permission request with an explanatory note. Only an approved
   permission permits an offer or purchase order.
3. After permission approval, the distributor submits a stock purchase order. Payment and
   manufacturer fulfillment are distinct states. Supplier payment must be reconciled by the
   backend/provider before manufacturer picking.
4. The distributor receives the manufacturer shipment. A PO approval is not proof of dispatch or
   receipt. On confirmation, the backend increases distributor on-hand inventory by accepted
   quantities and records damage/missing discrepancies.
5. Distributor offers reference the original manufacturer product. The distributor may edit only
   its selling price, own warehouse, own available quantity within the inventory policy, and offer
   status; it cannot change manufacturer-owned product metadata.
6. A customer submits an order through the customer application. The distributor views the
   customer order and verified payment state, then fulfills it using existing warehouse and
   logistics integration. A successful browser redirect or payment-initiation response never
   marks an order paid.

## Proposed endpoint and DTO contracts

The following are proposed contracts or response extensions. They are not represented as
implemented routes. Reuse an equivalent existing backend route when the server team confirms its
semantics; do not create duplicate fleet, trip, or tracking APIs.

### Product discovery, authorization, offers, and warehouses

**Existing frontend route family:** `GET /api/v1/products`; `POST
/api/v1/products/{productId}/authorization-requests`; manufacturer authorization decision;
`POST /api/stock/offers`; `PATCH /api/stock/offers/{offerId}`.

The product discovery response must preserve canonical identity and all catalog-owned details:

```json
{
  "id": "product-id",
  "manufacturerOrganizationId": "manufacturer-org-id",
  "manufacturerName": "Manufacturer display name",
  "sku": "SKU-001",
  "name": "Product name",
  "description": "Manufacturer-owned description",
  "category": "Category",
  "brand": "Brand",
  "unit": "each",
  "specifications": {},
  "imageUrls": ["https://..."],
  "wholesalePrice": 250.0,
  "currency": "KES",
  "publicationStatus": "PUBLISHED",
  "availableQuantity": 12
}
```

`availableQuantity` is nullable/omitted only when the server cannot provide an authoritative
quantity; it must not be reconstructed from `inStock`. Manufacturer identity must be a display
name plus stable organization ID.

Proposed authorization request:

```http
POST /api/v1/products/{productId}/authorization-requests
```

```json
{ "requestNote": "We intend to offer this product to our regional retail customers." }
```

Response: `{ "id", "productId", "distributorOrganizationId", "status", "requestedAt" }`.
Repeated active requests for the same distributor/product return the existing request or a stable
`409 AUTHORIZATION_REQUEST_EXISTS`, not a duplicate relationship.

Proposed offer DTO for the existing stock-offer route uses the canonical reference:

```json
{
  "manufacturerProductId": "product-id",
  "warehouseId": "distributor-warehouse-id",
  "sellingPrice": 315.0,
  "reorderThreshold": 4,
  "active": true
}
```

The response contains the same `manufacturerProductId`, an immutable manufacturer product
snapshot/reference, distributor-owned price/warehouse/offer state, and authoritative available
quantity. Do not accept client-supplied manufacturer description, image, wholesale price, or
manufacturer ID as authority. Confirm whether the current `sourceStockItemId` API is an alias for
the canonical product reference before switching production traffic.

Warehouse archival is exposed in both workspace UIs as a reversible `INACTIVE` status update
through the existing `PATCH /api/v1/warehouses/{id}` route; this is not a hard delete. Confirm that
the backend enforces organization ownership and rejects deactivation while active stock, orders,
staff assignments, shipments, or other operational records depend on the warehouse. Existing
staff reassignment remains unavailable in the UI. Do not add a hard-delete endpoint; preserve
historical references through archival.

### Purchase order and supplier payment

For the shared Payments workspace, provider reconciliation, history DTOs, M-Pesa callbacks, and
idempotency requirements, see [payment-api-contract.md](./payment-api-contract.md).

The current PO create route is `POST /api/v1/purchase-orders`; retain its route if backend
semantics match. Proposed request:

```json
{
  "supplierOrganizationId": "manufacturer-org-id",
  "items": [{ "manufacturerProductId": "product-id", "quantity": 3 }],
  "destinationWarehouseId": "distributor-warehouse-id"
}
```

The server validates approved listing permission, product publication, organization ownership,
positive integer quantities, stock availability, price, warehouse ownership, and order amount.
It snapshots price and product identity and reserves manufacturer stock within the same
transaction as creating the PO.

PO responses must include:

```json
{
  "id": "po-id",
  "status": "ACCEPTED",
  "paymentStatus": "PENDING",
  "currency": "KES",
  "totalAmount": 750.0,
  "items": [
    {
      "manufacturerProductId": "product-id",
      "sku": "SKU-001",
      "name": "Product name",
      "quantity": 3,
      "shippedQuantity": 0,
      "receivedQuantity": 0,
      "unitPrice": 250.0
    }
  ]
}
```

The existing `/purchase-orders/{id}/settlements` contract is not sufficiently clear to treat as
payment confirmation. Proposed actions, whether new routes or equivalent server methods:

| Method and route                                      | Purpose                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/purchase-orders/{id}/payments/initiate` | Start provider checkout; returns a payment reference and `PENDING`, never `PAID`.                                                |
| `GET /api/v1/purchase-orders/{id}/payments/status`    | Read server-reconciled payment state for the authorized parties.                                                                 |
| `POST /api/v1/webhooks/payments/{provider}`           | Backend-only callback; verify signature, amount, currency, parties, and provider transaction before applying a state transition. |

An alternative is to generalize the existing payments API by payment purpose and order type, but
the provider reference and idempotency rules must remain explicit. Supplier PO fulfillment is
blocked unless the PO response reports backend-verified `paymentStatus: PAID`.

### Manufacturer shipment, distributor receipt, and inventory

Manufacturer shipment creation already references `POST /api/v1/shipments`; the frontend's
current payload does not identify per-product quantities. Extend/confirm that contract to accept
the PO and its line quantities, existing assigned driver/vehicle, and an idempotency key:

```json
{
  "purchaseOrderId": "po-id",
  "items": [{ "manufacturerProductId": "product-id", "quantity": 3 }],
  "driverId": "driver-id",
  "vehicleId": "vehicle-id",
  "idempotencyKey": "client-generated-unique-key"
}
```

The backend verifies paid/accepted PO state, shipment quantity not greater than the unshipped
balance, driver/vehicle tenant ownership and availability, and trip eligibility. Shipment, trip
association, PO shipped quantities, inventory movement, and stock reservation updates commit
atomically. The response includes shipment ID, trip ID, dispatch timestamp, and item quantities.
The existing trip/tracking service remains the source of logistics status and tracking.

No distributor shipment-manifest/receipt contract is confirmed in the frontend. Proposed options:

| Method and route                               | Purpose                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/v1/shipments?purchaseOrderId={id}`   | List authorized inbound shipment manifests and per-item shipped/received balances. |
| `POST /api/v1/shipments/{shipmentId}/receipts` | Confirm received, damaged, and missing quantities per shipment item.               |

Receipt request example:

```json
{
  "idempotencyKey": "client-generated-unique-key",
  "items": [
    {
      "manufacturerProductId": "product-id",
      "acceptedQuantity": 2,
      "damagedQuantity": 1,
      "missingQuantity": 0
    }
  ],
  "note": "One unit had packaging damage"
}
```

For each line, accepted + damaged + missing must equal the remaining expected shipment quantity.
Only accepted quantity increases distributor physical stock. Manufacturer dispatch decreases
manufacturer stock once; distributor dispatch of a customer order decreases distributor stock
once. Each movement references the shipment/order and immutable movement ID.

### Customer payment and fulfillment

The frontend already uses `POST /api/v1/payments/initiate` and
`GET /api/v1/payments/{orderId}/status`. Confirm that:

- Initiation response state is only `PENDING`; client messaging is not payment proof.
- Status reads are authenticated and tenant-scoped, return amount/currency/order and provider
  transaction reference, and are updated only by the backend reconciliation workflow.
- Signed provider callbacks verify provider signature, expected amount, currency, payment party,
  order, replay window, and unique transaction reference.
- Duplicate callbacks and duplicate initiation requests are idempotent. A repeated provider event
  cannot reserve or deduct stock twice.
- `FAILED`, `EXPIRED`, and `REVERSED` remain distinct. A reversal triggers the configured
  cancellation/hold/refund policy and never silently becomes pending or paid.

Suggested payment response:

```json
{
  "orderId": "customer-order-id",
  "paymentId": "payment-id",
  "status": "PENDING",
  "amount": 315.0,
  "currency": "KES",
  "providerTransactionReference": null,
  "failureReason": null,
  "updatedAt": "2026-10-28T09:00:00Z"
}
```

Customer-order creation, stock reservation, payment reconciliation, picking eligibility, and order
state transitions are backend-owned. Confirm whether distributor assisted sales are supported;
otherwise the distributor workspace must not create customer orders or directly mark them paid.

## Entity relationships and ownership

- `Organization` owns its `Warehouse`, staff, stock balance, offer, and outbound order/shipment
  records.
- `ManufacturerProduct` belongs to exactly one manufacturer organization. Its catalog fields and
  source images/specifications are manufacturer-owned.
- `InventoryBalance` is keyed by organization + warehouse + product and stores physical on-hand,
  reserved, and available quantities. `available = onHand - reserved`; availability cannot be
  negative.
- `ListingAuthorization` joins one manufacturer product and one distributor organization. It has
  status, request/decision timestamps, requesting/deciding users, and optional reason.
- `DistributorOffer` belongs to the distributor and references a stable manufacturer product ID.
  Its selling price, distributor warehouse, own quantity, reorder threshold, and active state are
  separate from manufacturer-owned product data.
- `PurchaseOrder` belongs to the distributor and names its manufacturer supplier. Its line items
  reference manufacturer products and preserve immutable price/product snapshots, ordered,
  reserved, shipped, received, and outstanding quantities.
- `Payment` is linked to exactly one business order/purpose and includes payer, payee, amount,
  currency, provider, provider transaction ID, idempotency key, state, and reconciliation audit.
- `Shipment` links the manufacturer PO, the existing trip, assigned driver/vehicle, line quantities,
  timestamps, and receipt evidence.
- `InventoryMovement` is append-only, tenant-scoped, and references a source transaction, actor,
  timestamp, reason, quantity delta, and before/after balance or ledger sequence.

## State lifecycles and transition rules

| Aggregate             | Lifecycle                                                                                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product               | `DRAFT -> PUBLISHED -> DISCONTINUED`; unpublish/republish requires an authorized manufacturer role. Publication and stock are independent.                                                                                                                 |
| Listing authorization | `PENDING -> APPROVED                                                                                                                                                                                                                                       | REJECTED`; approved may become `REVOKED`. Repeated decisions are idempotent or conflict with a stable error.                                            |
| Supplier PO           | `SUBMITTED -> ACCEPTED                                                                                                                                                                                                                                     | REJECTED`; accepted may be `PARTIALLY_SHIPPED -> SHIPPED -> PARTIALLY_RECEIVED -> RECEIVED`, or cancelled only when unshipped balances can be released. |
| Payment               | `PENDING -> SUCCEEDED                                                                                                                                                                                                                                      | FAILED                                                                                                                                                  | EXPIRED`; `SUCCEEDED -> REVERSED` only through verified provider/refund reconciliation. Terminal states do not return to pending. Frontend cannot write payment state. |
| Shipment              | `CREATED -> ASSIGNED -> DISPATCHED -> IN_TRANSIT -> DELIVERED -> RECEIVED/CLOSED`; only valid states supported by the existing trip workflow may be exposed. A shipment cannot exceed paid, accepted, unshipped PO balances.                               |
| Customer order        | `PAYMENT_PENDING -> CONFIRMED -> PICKING -> PACKED -> READY_FOR_DISPATCH -> IN_TRANSIT -> DELIVERED`; cancellation, failure, and refund transitions release reservations exactly once. Payment policy must be explicit for any cash-on-delivery exception. |
| Inventory movement    | Append-only `PRODUCTION`, `RESERVATION`, `RELEASE`, `SHIPMENT_DISPATCH`, `RECEIPT`, `PICK`, `ADJUSTMENT`, `CUSTOMER_DISPATCH`, and `REVERSAL` references. Corrections append compensating movements; no historical row edits.                              |

## Authorization, validation, idempotency, and errors

- Derive organization ownership and acting user from the authenticated principal, never request
  body organization IDs. Verify every referenced product, warehouse, PO, shipment, driver, and
  vehicle belongs to the caller's permitted organization/workflow.
- Enforce role capabilities on the server: product publication, authorization decision, inventory
  adjustment, PO approval, shipment creation, receipt confirmation, warehouse archival, and staff
  assignment are separate privileges where applicable.
- Validate positive integer quantities, nonnegative money, supported currency/precision,
  warehouse assignment, publication/authorization, status transitions, available stock, line-level
  shipped/received balances, and required reasons for adjustments.
- Use an idempotency key for payment initiation, provider callbacks, PO submission, shipment
  dispatch, shipment receipt, customer order submission, and inventory mutation. Store the key
  against the operation and return the original result on retry.
- Apply stock reservation/receipt/dispatch and corresponding order/shipment transitions within a
  single database transaction or use a durable outbox with idempotent consumers. Do not report
  success before a durable commit.
- Never trust a client-supplied `PAID`, payment receipt number, user identity, stock balance, or
  manufacturer-owned snapshot.
- Return stable problem responses, for example:

```json
{
  "code": "INSUFFICIENT_AVAILABLE_STOCK",
  "message": "Requested quantity exceeds available stock.",
  "fieldErrors": [{ "field": "items[0].quantity", "code": "OUT_OF_RANGE" }],
  "correlationId": "request-id"
}
```

Suggested codes include `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`,
`INVALID_STATE_TRANSITION`, `INSUFFICIENT_AVAILABLE_STOCK`,
`AUTHORIZATION_REQUIRED`, `PAYMENT_NOT_RECONCILED`, `IDEMPOTENCY_CONFLICT`, and
`WAREHOUSE_HAS_DEPENDENCIES`. Do not leak cross-organization record existence in `404` vs `403`
responses.

## Frontend behavior and limitations

- Customer and supplier payment states normalize known backend success values to the existing
  `PAID` display state. Failed, expired, reversed, and unknown values remain distinct. Unknown or
  absent payment never grants fulfillment.
- Manufacturer picking, packing, and dispatch are blocked unless the PO is accepted and its API
  response says `paymentStatus: PAID`. No frontend payment confirmation action is provided.
- Distributor PO submission now requires an approved listing authorization. Product data shown in
  the catalog preserves manufacturer description and image; wholesale price and available quantity
  display only values provided by the API.
- The distributor receipt adapter accepts only shipment-like `IN_TRANSIT` PO state and positive,
  line-level `shippedQuantity`. `PROCESSING`/approval alone does not create receipt work. A proper
  shipment manifest and receipt endpoint is still needed for reliable partial deliveries.
- Manufacturer workspaces do not display or create incoming stock receipts. Manufacturer
  warehouse put-away, picking, packing, adjustments, and movement history still use a
  browser-session ledger and are not durable backend inventory operations.
- Authentication was not bypassed and no authenticated end-to-end UI walkthrough is claimed.
  Backend tenancy and authorization must be verified server-side.

## Assumptions and questions for the team

1. Confirm whether wholesale prices in product DTOs include tax, currency, and validity/version.
2. Confirm whether distributors purchase by manufacturer product ID or a manufacturer warehouse
   stock-item ID; the current frontend `sourceStockItemId` name is ambiguous.
3. Confirm whether a listing authorization applies to one product, a product family, or a time
   period, and whether revocation blocks existing offers/orders.
4. Confirm whether payment is required before PO acceptance, after acceptance but before shipment,
   or at another milestone; the proposed safe default blocks manufacturer fulfillment until
   reconciled success.
5. Define partial shipment, back-order, cancellation, refund, returned-goods, and payment reversal
   policies.
6. Define whether distributor staff may make assisted customer orders or only view customer-app
   orders; align the existing `PATCH /orders/{id}/status` behavior accordingly.
7. Define warehouse location hierarchy, capacity, stock ownership at multiple manufacturer
   warehouses, and warehouse archival rules.
8. Confirm the authoritative receipt source and how shipment manifests connect to existing trip
   stops, tracking, delivery evidence, and driver/vehicle assignments.
9. Confirm which roles can perform manual stock adjustments and what evidence/reason is required.
10. The current Angular development authentication setting remains separate from these API
    contracts; backend authorization must be tested with real authenticated organizations before
    release.
