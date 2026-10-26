# Logiflow Manufacturer and Distributor lifecycle — backend API handoff

**Updated:** 2026-10-26
**Scope:** Current Angular workspace behavior, intended cross-workspace workflow, and backend contracts needed to complete it. Paths marked **PROPOSED** are requirements for coordination; they are not confirmed as implemented backend routes.

## Authentication and development mode

The frontend intentionally uses mock authentication during workspace development: `API_CONFIG.useMockAuth` remains `true`. This is a development stand-in for login/session behavior, not a mock for the operational workspace APIs. Feature services still call the configured backend and may receive mock bearer tokens, so live authorization must be revalidated after the team disables mock auth and exercises real login. The frontend must not fabricate user, organization, order, payment, or delivery data to conceal missing API integrations.

Tenant ownership must always be derived from the authenticated principal. Role and organization context are both required for authorization. List responses should be paginated (Spring `content` envelope or documented array), and mutation errors should return a stable message/code and field errors.

## Intended complete lifecycle

### 1. Manufacturer product master and publication

1. A manufacturer user creates a canonical product draft with SKU, name, category, brand, unit, description, and price/listing metadata. New products start as `DRAFT` and are not visible in the distributor catalog.
2. Manufacturer users with product-edit permission update drafts. Only a `MANUFACTURER_ADMIN` (or explicitly authorized product publisher role) may publish, discontinue, or republish a product.
3. Publication status is independent from physical inventory: `DRAFT`, `PUBLISHED`, and `DISCONTINUED` are catalog states; on-hand, reserved, available, and low-stock values are stock state. Zero stock must not silently unpublish an otherwise published product.
4. Manufacturer stock levels and movements remain organization/warehouse-scoped. Purchase-order review checks actual available stock (`onHand - reserved`, or an authoritative `availableQuantity`) and rejects approval when requested quantities cannot be fulfilled.

### 2. Distributor catalog authorization and offers

1. Distributor users browse only published products that the backend permits them to discover. A product can be visible while requiring a distribution authorization.
2. A distributor requests access for a manufacturer product. Backend creates a tenant-scoped `PENDING` request; repeat requests should return the existing pending/approved state or a clear `409`.
3. Manufacturer administrators review requests and approve or reject them. The backend records the actor and timestamps. A manufacturer may revoke a prior approval; revocation prevents new offers and customer sale, subject to the agreed policy for already accepted orders.
4. Only an `APPROVED` distributor/product relationship permits creation or activation of a distributor offer. The backend must enforce this on every write; frontend hiding is not access control.
5. Distributor offers hold distributor-specific selling price, warehouse, stock, reorder threshold, and active/paused state. Publication/authorization, offer activity, and available quantity are separate concerns.
6. Customer-facing marketplace/catalog reads active offers for the requesting distributor and available quantity. It must not expose unpublished, unauthorized, paused, or out-of-stock offers as purchasable.

### 3. Customer order and payment

1. The customer-facing application creates an order against active distributor offers. The distributor workspace is an order consumer; it must not create a client order through a local-only form or mutate payment state manually.
2. Backend validates offer ownership, price, stock, delivery address, and customer identity; reserves stock transactionally and returns a durable order ID/number.
3. Payment initiation belongs to the customer payment flow. Payment provider callbacks/webhooks are verified and reconciled by the backend. Distributor UI reads payment status; it cannot mark an order paid.
4. Backend publishes the confirmed payment/order state to the distributor order list. Define which order states may proceed to fulfillment (normally paid/authorized plus stock reserved). Keep payment status separate from order fulfillment status.
5. Order list/detail responses include customer display name and permitted contact fields, delivery address, item/SKU/quantity/price snapshots, order status, payment status, timestamps, and linked shipment/trip IDs when present.

### 4. Distributor fulfillment, dispatch, and driver delivery proof

1. Distributor staff can create a delivery shipment/trip only from eligible confirmed orders. Backend validates payment, reserved stock, distributor ownership, destination, and that orders are not already assigned. A trip may contain multiple orders/stops; each stop retains the order ID and individual recipient/destination.
2. Dispatcher assigns an active organization driver and a suitable available vehicle. Assignment is atomic and rejects cross-tenant, suspended, already-assigned, or capacity-conflicting resources.
3. Dispatch is an explicit backend transition, not a direct order status patch. Backend records dispatcher/time, changes trip to `ONGOING` and eligible orders to `IN_TRANSIT`, and sends a unique, time-bound delivery verification code to each order's registered customer contact. The frontend/driver app must not generate or reveal this code.
4. The driver app lists only the assigned driver's active stops. At each stop the driver submits the customer-provided code to the backend. Backend checks the order/trip/driver relationship, expiry, attempt limits, and one-time use; on success it records delivered timestamp, actor, recipient/proof, and marks that individual order `DELIVERED`.
5. A trip completion event does not mark all orders delivered. For multi-stop delivery, each order has its own status; shipment aggregate can be `PARTIALLY_DELIVERED` until all required stops are verified, then `COMPLETED`. Cancelled/failed stops remain individually visible.
6. Status changes must be idempotent and auditable. Web clients can refresh/poll; if realtime is introduced, define event names, cursor/reconnect semantics, and tenant authorization.

### 5. Separate manufacturer procurement lifecycle

Distributor purchase orders to manufacturers are a separate B2B procurement flow, not customer delivery orders. Distributor submits PO; manufacturer reviews/approves/rejects it; fulfillment/shipment and partial receipt update the PO and create distributor stock movements. A trip being completed is not proof that all PO quantities were received.

## Current frontend implementation and gaps

- Mock auth remains enabled by design in `src/app/core/api/api.config.ts`; no change is requested to that switch.
- Manufacturer product service now separates canonical `/api/v1/products` data from `/api/stock/items` quantities, supports create/edit/publication calls, and treats API errors as load errors. Product publication requires the proposed publication field/endpoint described below.
- Manufacturer product list has publication controls gated to `MANUFACTURER_ADMIN`; distribution request review has the same role gate. Backend must enforce both.
- Distributor catalog filters to `PUBLISHED`, adds request/approval state UI, and will only expose Add to catalog after approval. Backend authorization and publication APIs are currently **proposed/unverified**; if they are unavailable, the catalog displays the API error and listing must remain denied.
- Distributor offers, warehouses, procurement, inventory/restock, purchase orders, customer order reads, and trips use existing route families noted below. Verify every route against backend role rules and DTOs.
- Manufacturer PO approval now derives available stock from the corresponding SKU instead of treating every line as zero stock.
- Distributor customer order detail is read-only for payment/order delivery states. The customer app initiates payment; driver verification confirms delivery. Distributor order listing explains that incoming orders originate from the customer app.
- The distributor trip create/assignment/status UI is present, but vehicle/driver directory data and order eligibility are not fully backed by live APIs. Driver OTP app/API is not present in this frontend and remains a backend/mobile integration requirement.
- No UI should infer product availability from publication, infer order delivery from trip completion, or treat payment pending as paid.

## Existing route families used by the frontend (verify implementation/authorization)

| Workspace | Current operation | Route |
|---|---|---|
| Shared auth | access request, activation, login/refresh/logout, current user | `/api/access-requests`, `/api/access-requests/activate`, `/api/auth/*`, `/api/users/me` (mock intercepted while configured) |
| Manufacturer | stock list | `GET /api/stock/items?size=100` |
| Manufacturer | procurement queue and decision | `GET /api/v1/manufacturer/purchase-orders`, `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision` |
| Distributor | product discovery | `GET /api/v1/products?size=100` |
| Distributor | own stock/offers | `/api/stock/items`, `/api/stock/offers`, `/api/stock/offers/{id}` |
| Distributor | warehouses | `/api/v1/warehouses` |
| Distributor | procurement | `/api/v1/purchase-orders` and detail/settlement routes |
| Distributor | customer order/payment reads | `/api/v1/orders`, `/api/v1/payments/{orderId}/status` |
| Distributor | trips/assign/status/tracking | `/api/v1/trips`, `/api/v1/trips/{id}/assign`, `/status`, `/tracking` |

Existing frontend paths do not imply all operations are implemented in the supplied backend. Check backend controllers, DTOs, and `@PreAuthorize`/organization scoping before enabling live use.

## Required API contract — manufacturer products and authorization

The following routes are **PROPOSED** where no matching backend route has been confirmed. Backend and frontend should agree the exact prefix/DTOs before live integration.

| Method / path | Purpose |
|---|---|
| `GET /api/v1/products?publicationStatus=&page=&size=` | Product list scoped to caller's manufacturer organization; distributor discovery returns only discoverable published products |
| `POST /api/v1/products` | Create product draft; organization ID comes from principal; return stable ID and `publicationStatus: DRAFT` |
| `GET /api/v1/products/{productId}` | Tenant-authorized detail |
| `PATCH /api/v1/products/{productId}` | Edit permitted product fields; do not mutate stock quantities through product metadata update |
| `PATCH /api/v1/products/{productId}/publication` | Body `{ "status": "PUBLISHED" | "DRAFT" | "DISCONTINUED" }`; authorized publisher only |
| `GET /api/v1/products/authorizations?status=&page=&size=` | Caller-organization requests, role/tenant scoped; manufacturer side receives requests for its products, distributor side receives its requests/relationships |
| `POST /api/v1/products/{productId}/authorization-requests` | Distributor asks to list a product; body may include business note; backend derives distributor org |
| `PATCH /api/v1/products/authorizations/{authorizationId}/decision` | Manufacturer admin body `{ "decision": "APPROVED" | "REJECTED", "note": "..." }`; record actor/time |
| `PATCH /api/v1/products/authorizations/{authorizationId}/revocation` | Manufacturer admin revokes approved relationship; audit reason required |

Canonical product DTO needs `id`, `organizationId`, `sku`, `name`, `category`, `brand`, `unit`, `description`, `publicationStatus`, created/updated timestamps. Authorization DTO needs `id`, product/manufacturer/distributor IDs and display names, `status` (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`), request/decision timestamps, and optional decision note. Product response must not substitute organization IDs for organization names without documenting that fallback.

## Required API contract — stock, offers, fleet, trips, delivery, payments

- Stock list/detail must return `productId` or an unambiguous SKU, `quantityOnHand`, `reservedQuantity`, authoritative `availableQuantity`, reorder threshold, warehouse ID, and active status. Manufacturer PO review needs this information for approval validation.
- Distributor offer create/update must validate approved product authorization and return canonical `sourceProductId`, source stock linkage, distributor org, warehouse, selling price, available quantity, active state, SKU/name/unit/brand. Offer pause must remove the listing from customer purchase results.
- **PROPOSED:** `GET /api/v1/drivers?status=ACTIVE`, `GET /api/v1/vehicles?status=AVAILABLE`; responses must be scoped to the caller's org. Existing driver onboarding requirements elsewhere in this document remain applicable.
- Extend `PATCH /api/v1/trips/{id}/assign` to accept `{ "driverId": "...", "vehicleId": "..." }` (or agree one canonical naming scheme); atomically validate availability and tenant ownership.
- **PROPOSED:** `POST /api/v1/trips/{id}/dispatch` as explicit dispatch action. Backend validates assigned driver/vehicle and every order, records status, and triggers customer delivery-code notification. Do not return verification codes to distributor clients.
- **PROPOSED, driver/mobile API:** `GET /api/v1/driver/trips/active` and `POST /api/v1/driver/orders/{orderId}/delivery-verifications` with `{ "code": "...", "recipientName": "...", "note": "..." }`. Validate order-specific assignment, expiring one-time code, attempt limits, and idempotency. Return the order delivery result, never the secret code.
- Separate status vocabularies: payment (`PENDING`, `PROCESSING`, `CONFIRMED`, `FAILED`, `REVERSED`, `RECONCILED`); order (at minimum `PENDING_PAYMENT`, `CONFIRMED`, `PREPARING`, `READY_FOR_DISPATCH`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `DELIVERED`, `CANCELLED`); trip (`SCHEDULED`, `ONGOING`, `COMPLETED`, `DELAYED`, `CANCELLED`). Do not collapse one resource status into another.
- Payment provider callbacks must be authenticated/verified and idempotent. Distributor workspace reads status only. Provider customer prompt initiation belongs in customer app.
- Order and trip read APIs should include linked IDs and individual delivery status; multi-order trip response includes per-stop order IDs and statuses. No trip `COMPLETED` response may imply all orders are delivered.

## Customer order contract

Use existing `POST /api/v1/orders` only if it is already the customer-facing authenticated contract. Otherwise define it with customer identity from the principal, distributor offer line IDs/quantities, delivery address, and payment method. Backend reserves stock transactionally and snapshots product name/SKU/price. Distributor `GET /api/v1/orders` is scoped to the distributor and returns customer display/contact fields permitted for fulfillment, order/payment states, line snapshots, and shipment references. No distributor-side local order creation is required.

## Warehouse creation and directory — shared manufacturer/distributor contract

Both workspaces use the shared tenant-scoped `GET /api/v1/warehouses?size=100` and `POST /api/v1/warehouses` route. The frontend sends the same create payload from either workspace:

```json
{
  "code": "NBO-01",
  "name": "Nairobi Central Warehouse",
  "address": "12 Industrial Road",
  "city": "Nairobi",
  "postalCode": "00100",
  "siteManager": "Sam Manager"
}
```

The authenticated principal determines the owning organization and type; clients must not supply an arbitrary organization ID or require a second login. Permit `MANUFACTURER_ADMIN` and `DISTRIBUTOR_ADMIN` to create sites for their own organization (and staff roles only when explicitly granted warehouse-management permission). Return `id`, `organizationId`, `code`, `name`, address fields, `siteManager`, `status`/`active`, and timestamps. Validate unique warehouse code per organization and return `409` for duplicates. `GET` must only list the caller's organization. Support `PATCH /api/v1/warehouses/{warehouseId}` for status changes and permitted edits, with the same tenant and role checks.

The current client maps optional `stockUnits` and `staffCount` to zero when those aggregates are absent, and shows no live activity/staff detail until corresponding APIs exist. If those fields are needed as authoritative UI values, include them in the warehouse read DTO or provide warehouse stock/staff/activity APIs; do not treat the zero fallback as verified backend data. In development `useMockAuth` remains enabled; operational warehouse requests still reach the backend and the backend must accept a real access token when live auth is enabled.

## Procurement and receipt API requirements

Keep existing distributor `POST /api/v1/purchase-orders` and manufacturer queue/decision flow if their DTOs meet the existing screens. Add cancellation/amendment rules, expected delivery/destination, status history, shipment link, partial receipt with received quantities, and receipt-generated stock movements. Manufacturer approval must validate available quantity server-side; the frontend stock check is advisory only.

## API behavior and acceptance criteria

1. All organization resources derive tenant from principal; another organization's IDs return `404` or the agreed non-disclosing response. Enforce role and organization membership in backend even when buttons are hidden.
2. Use transaction boundaries for stock reservation, PO receipt, authorization decision, dispatch assignment, and one-time delivery verification. Require idempotency keys where clients/providers may retry.
3. Use ISO-8601 timestamps, stable IDs, paginated `content` envelopes, consistent field-error payloads, and `400/401/403/404/409/429` semantics.
4. Validate every state transition and return machine-readable conflict details. Preserve audit actor, time, and reason for product publication, authorization, order/payment, trip assignment, dispatch, delivery verification, and receipt.
5. Test end-to-end: manufacturer drafts and publishes product -> distributor requests and receives approval -> distributor creates active offer -> customer places order and payment reconciles -> order becomes dispatch eligible -> dispatcher assigns driver/vehicle and dispatches -> customer receives unique code -> assigned driver verifies each stop -> individual order delivery states and trip aggregate remain correct -> manufacturer/distributor PO receipt remains a separate path.
6. Repeat the tests with mock auth still on for frontend usability, then with real auth enabled for tenant and role enforcement. Mock auth must not be mistaken for backend authorization coverage.
