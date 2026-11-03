# Logiflow Manufacturer and Distributor lifecycle — backend API handoff

**Updated:** 2026-10-26
**Scope:** Current Angular workspace behavior, intended cross-workspace workflow, and backend contracts needed to complete it. Paths marked **PROPOSED** are requirements for coordination; they are not confirmed as implemented backend routes.

## Backend endpoint checklist

Use this as the implementation checklist for the backend work required by the frontend workflows. This route list describes required behavior; it is not a claim that these routes exist in the deployed backend. Items marked **PROPOSED** need agreement or an equivalent route mapping from the backend team. Detailed payloads, response fields, roles, tenant checks, and state transitions follow below.

### Shared account, organization, and warehouse APIs

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/access-requests` | Submit organization onboarding request with supporting documents. |
| `POST` | `/api/access-requests/activate` | Activate approved account or invited driver/member. |
| `POST` | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` | Login and refresh/revoke sessions. |
| `POST` | `/api/auth/resend-verification`, `/api/auth/forgot-password`, `/api/auth/reset-password` | Resend activation and password recovery. |
| `GET` | `/api/users/me` | Return authenticated user and organization context. |
| `GET`, `POST`, `PATCH` | `/api/v1/warehouses`, `/api/v1/warehouses/{id}` | Tenant-scoped warehouse directory, creation, and permitted edits. |
| `GET`, `POST`, `PATCH` | `/api/v1/members`, `/api/v1/members/invitations`, `/api/v1/members/{id}/status` | Organization employee directory, invitations, and status changes. |

### Manufacturer product, inventory, and procurement APIs

| Method | Route | Purpose |
|---|---|---|
| `GET`, `POST` | `/api/v1/products` | List and create canonical products; manufacturer-admin save publishes a new product immediately. |
| `GET`, `PATCH` | `/api/v1/products/{productId}` | Read and edit product metadata. |
| `PATCH` | `/api/v1/products/{productId}/publication` | Publish, return to draft, or discontinue a product. |
| `GET` | `/api/stock/items?size=100` | Read organization stock and availability. |
| `GET` | `/api/v1/manufacturer/purchase-orders` | List manufacturer procurement orders. |
| `PATCH` | `/api/v1/manufacturer/purchase-orders/{id}/decision` | Approve or reject a purchase order after stock validation. |
| `POST` | `/api/v1/shipments` | Allocate accepted PO quantities to shipment. |
| `GET`, `PATCH` | `/api/v1/shipments`, `/api/v1/shipments/{id}`, `/api/v1/shipments/{id}/status` | Read shipment details and apply allowed audited transitions. |
| `POST` | `/api/stock/audits` | Create a durable stock audit request. |

### Distributor catalog, inventory, procurement, and customer order APIs

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/products` | Discover eligible published products. |
| `GET` | `/api/v1/products/authorizations` | List distributor requests and authorization states. |
| `POST` | `/api/v1/products/{productId}/authorization-requests` | Request permission to offer a manufacturer product. |
| `PATCH` | `/api/v1/products/authorizations/{id}/decision` | Manufacturer decision on a distributor request. |
| `PATCH` | `/api/v1/products/authorizations/{id}/revocation` | **PROPOSED:** Revoke an approved relationship. |
| `GET`, `POST`, `PATCH` | `/api/stock/items`, `/api/stock/offers`, `/api/stock/offers/{id}` | Read stock/offers, create an authorized offer, and pause/resume it. |
| `POST`, `PATCH` | `/api/stock/restock-request`, `/api/stock/restock-request/{id}/status` | Request and cancel restock. |
| `GET`, `POST` | `/api/v1/purchase-orders` | List and create distributor procurement orders. |
| `GET`, `POST` | `/api/v1/purchase-orders/{id}`, `/api/v1/purchase-orders/{id}/settlements` | Read PO detail and record agreed settlement/receipt operations. |
| `GET` | `/api/v1/orders` | Read distributor-owned customer orders, payment states, and fulfillment details. |
| `POST` | `/api/v1/orders` | Customer-app order creation; customer identity from principal and stock reserved transactionally. |
| `GET` | `/api/v1/payments/{orderId}/status` | Read payment status. Initiation belongs to customer flow; provider callbacks are backend-to-backend. |

### Fleet, trip, dispatch, and delivery APIs

| Method | Route | Purpose |
|---|---|---|
| `GET`, `POST` | `/api/v1/drivers` | List tenant drivers and create driver plus activation invitation. |
| `GET`, `PATCH` | `/api/v1/drivers/{id}` | Read and edit driver profile. |
| `POST`, `DELETE` | `/api/v1/drivers/{id}/invitation/resend`, `/api/v1/drivers/{id}/invitation` | Resend or revoke a pending invitation. |
| `PATCH` | `/api/v1/drivers/{id}/status`, `/api/v1/drivers/{id}/operational-status` | Suspend/reactivate account or set permitted availability. |
| `GET`, `POST` | `/api/v1/vehicles` | List tenant vehicles and register a vehicle. |
| `PATCH` | `/api/v1/vehicles/{id}/status`, `/api/v1/vehicles/{id}/assignment` | Update vehicle state or driver assignment. |
| `GET`, `POST` | `/api/v1/trips` | Read trips and create shipment/delivery trips. |
| `PATCH` | `/api/v1/trips/{id}/assign`, `/api/v1/trips/{id}/status` | Assign eligible fleet resources and apply allowed transitions. |
| `POST` | `/api/v1/trips/{id}/dispatch` | **PROPOSED:** Explicitly dispatch eligible trip and notify each customer with a private verification code. |
| `GET` | `/api/v1/trips/{id}/tracking` | Read trip tracking points. |
| `GET` | `/api/v1/driver/trips/active` | **PROPOSED:** Driver's own active trips/stops. |
| `POST` | `/api/v1/driver/orders/{orderId}/delivery-verifications` | **PROPOSED:** Verify customer code and record delivery for one assigned order. |
| `POST` | `/api/v1/trips/{id}/driver-ping`, `/api/v1/trips/{id}/reroute-proposals` | Queue driver ping or create a dispatcher-reviewed reroute proposal. |

### Organization settings APIs

| Method | Route | Purpose |
|---|---|---|
| `GET`, `PATCH` | `/api/v1/organization` | Read/update caller organization settings. |
| `GET`, `PATCH` | `/api/v1/organization/notification-preferences` | Read/update notification preferences. |

## Authentication and development mode

The frontend intentionally uses mock authentication during workspace development: `API_CONFIG.useMockAuth` remains `true`. This is a development stand-in for login/session behavior, not a mock for the operational workspace APIs. Feature services still call the configured backend and may receive mock bearer tokens, so live authorization must be revalidated after the team disables mock auth and exercises real login. The frontend must not fabricate user, organization, order, payment, or delivery data to conceal missing API integrations.

Tenant ownership must always be derived from the authenticated principal. Role and organization context are both required for authorization. List responses should be paginated (Spring `content` envelope or documented array), and mutation errors should return a stable message/code and field errors.

## Intended complete lifecycle

### 1. Manufacturer product master and publication

1. A manufacturer administrator creates a canonical product with SKU, name, category, brand, unit, description, price/listing metadata, and at least one product image. Saving publishes the product immediately so distributors can discover it.
2. Manufacturer users with product-edit permission update product details. Only a `MANUFACTURER_ADMIN` (or explicitly authorized product publisher role) may publish, unpublish, discontinue, or republish a product. Distributor authorization is still required before an offer can be created.
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
- Manufacturer product service separates canonical `/api/v1/products` data from `/api/stock/items` quantities. Creating a product submits its image and `PUBLISHED` state in the create request; edits and later publication changes use their respective API calls.
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
| `POST /api/v1/products` | Create and publish product; accept `multipart/form-data` with product fields, initial stock fields, `publicationStatus=PUBLISHED`, and required `image` file; organization ID comes from principal |
| `GET /api/v1/products/{productId}` | Tenant-authorized detail including `imageUrl` |
| `PATCH /api/v1/products/{productId}` | Edit permitted product fields and optional replacement `image`; preserve publication state and do not mutate stock quantities through metadata update |
| `PATCH /api/v1/products/{productId}/publication` | Body `{ "status": "PUBLISHED" | "DRAFT" | "DISCONTINUED" }`; authorized publisher only |
| `GET /api/v1/products/authorizations?status=&page=&size=` | Caller-organization requests, role/tenant scoped; manufacturer side receives requests for its products, distributor side receives its requests/relationships |
| `POST /api/v1/products/{productId}/authorization-requests` | Distributor asks to list a product; body may include business note; backend derives distributor org |
| `PATCH /api/v1/products/authorizations/{authorizationId}/decision` | Manufacturer admin body `{ "decision": "APPROVED" | "REJECTED", "note": "..." }`; record actor/time |
| `PATCH /api/v1/products/authorizations/{authorizationId}/revocation` | Manufacturer admin revokes approved relationship; audit reason required |

Canonical product DTO needs `id`, `organizationId`, `sku`, `name`, `category`, `brand`, `unit`, `description`, `imageUrl`, `publicationStatus`, created/updated timestamps. Product creation must validate the uploaded image's actual media type and size (PNG, JPEG, or WebP; maximum 5 MB), store it durably, and return its usable `imageUrl`; create the product, initial stock, image reference, and `PUBLISHED` state atomically. Authorization DTO needs `id`, product/manufacturer/distributor IDs and display names, `status` (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`), request/decision timestamps, and optional decision note. Product response must not substitute organization IDs for organization names without documenting that fallback.

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
5. Test end-to-end: manufacturer admin saves an image-backed published product -> distributor requests and receives approval -> distributor creates active offer -> customer places order and payment reconciles -> order becomes dispatch eligible -> dispatcher assigns driver/vehicle and dispatches -> customer receives unique code -> assigned driver verifies each stop -> individual order delivery states and trip aggregate remain correct -> manufacturer/distributor PO receipt remains a separate path.
6. Repeat the tests with mock auth still on for frontend usability, then with real auth enabled for tenant and role enforcement. Mock auth must not be mistaken for backend authorization coverage.

## Backend Codex implementation rules and frontend payload catalogue

Treat this document as the requested behavior and the existing Angular services as the evidence of current wire calls. A UI form or an in-memory service does **not** mean the backend already receives that data. If a form is marked local-only below, implement the endpoint and then wire the frontend service; do not claim that the current UI has persisted it. Proposed routes are contracts to implement, not deployed routes. Preserve the shared organization scope and role checks on every request. Do not implement a second login prompt for a user with a valid session.

### Authentication context and organization scoping

- The Angular auth interceptor attaches `Authorization: Bearer <accessToken>` to trusted API requests. `API_CONFIG.useMockAuth` is currently `true`; it mocks only auth endpoints, while operations such as warehouse/driver APIs still reach the configured live backend. The mock token is not a live backend credential. Live authorization acceptance must be tested after using real auth.
- Derive `userId`, `organizationId`, `organizationType`, and roles from the verified token. Ignore or reject client-supplied tenant IDs on create/update. Verify the resource organization on every read/write, including nested IDs (`baseWarehouseId`, `productId`, `vehicleId`, `tripId`).
- A missing/expired token returns `401`; a valid session with insufficient role returns `403`. Do not return `401` merely because a signed-in user is not an administrator. Frontend role gating improves usability but is not a substitute for backend policy.

### Driver onboarding: required end-to-end behavior

#### Driver form data and create invitation request

The current Distributor driver form collects UI fields `name`, `email`, `phone`, `license`, and optional `baseWarehouseId`. Manufacturer's fleet driver form collects the same. Both workspaces now call the driver API for create, profile update, invitation actions, account status, and operational availability; both also call driver/vehicle list endpoints. Map the UI names to this canonical backend create payload:

```http
POST /api/v1/drivers
```

```json
{
  "fullName": "Amina Njeri",
  "email": "amina.personal@example.com",
  "phoneNumber": "+254712345678",
  "licenseNumber": "DL-123456",
  "baseWarehouseId": "wh_123"
}
```

`baseWarehouseId` may be `null`/omitted. The frontend does not send organization ID, account status, user role, invitation token, or password. **When an administrator clicks Save, the frontend sends this POST; the backend must persist the profile, create the invitation, and send/queue the activation email to the `email` in this body as part of the request lifecycle.** The browser must not send the email itself. Backend derives organization from the admin; creates a least-privilege user with role `DRIVER`; validates email, phone, licence, and warehouse ownership; prevents duplicate active/pending driver identity according to the agreed global account policy; and atomically creates the invitation. Return `201` with driver profile plus `invitationStatus` (`QUEUED`, `SENT`, or `FAILED`) and `invitationExpiresAt`; never return the secret activation token. A failed email should still report whether the driver record was committed and expose a resend action rather than pretending delivery succeeded.

#### Invitation and account lifecycle

1. Only a `MANUFACTURER_ADMIN` or `DISTRIBUTOR_ADMIN` for the same organization may invite a driver. Create driver record as account `INVITED`; operational state is `OFF_DUTY` until activated and explicitly available. Do not set a submitted password.
2. Send an HTTPS invitation URL to the personal email. Token must be opaque, high entropy, single use, expiry-bound, linked to the email/user/organization, stored hashed, and absent from API reads/logs. Use a configurable expiry (recommended 24 hours). Resend revokes all previous unused tokens.
3. Driver opens the existing activation flow and submits `POST /api/access-requests/activate` with `{ "email": "...", "token": "...", "password": "...", "confirmPassword": "..." }`. Extend the handler so it resolves either an approved organization access request or a driver invitation by token; verify matching email, expiry, unused state, password policy and confirmation. Consume token atomically, set the credential, and mark the driver account `ACTIVE`. Return the normal activation response without leaking token state. A driver then signs in and is limited to their own assigned trips/stops and delivery actions.
4. Expired, revoked, already-used, wrong-email, and invalid-token cases return safe machine codes and user-safe messages. Resend/forgot flows must not reveal whether an email is registered. Rate limit invite, resend, activation attempts, and code attempts. Delivery failure is visible to the inviter and retryable without creating a second driver.
5. Implement `POST /api/v1/drivers/{id}/invitation/resend` and `DELETE /api/v1/drivers/{id}/invitation` for resend/revoke of a still-invited profile. Revoke is soft: preserve audit history and profile identity. A later invite can reuse the profile according to email uniqueness policy.
6. Implement `GET /api/v1/drivers?search=&accountStatus=&operationalStatus=&page=&size=`, `GET /api/v1/drivers/{id}`, and `PATCH /api/v1/drivers/{id}`. Editable profile body is `{ "fullName", "phoneNumber", "licenseNumber", "baseWarehouseId" }`; email should be immutable after invitation or changed only through a verified email-change flow. Reject edits while on an active trip and validate the warehouse belongs to the same organization.
7. Implement `PATCH /api/v1/drivers/{id}/status` with `{ "status": "SUSPENDED" | "ACTIVE" }`; suspend/reactivate only authorized same-organization admins. Reject suspension while a trip is active. Suspension blocks login and dispatch eligibility, but preserves trip and audit records. Reactivation returns account status to `ACTIVE`; operational availability stays `OFF_DUTY` until explicitly changed.
8. Implement `PATCH /api/v1/drivers/{id}/operational-status` with `{ "status": "AVAILABLE" | "OFF_DUTY" }`. Only an active driver (or explicitly authorized dispatcher) may change availability; backend owns `ON_TRIP`, which is set/cleared by trip assignment/completion. Reject manual transition to `ON_TRIP` and any availability changes during an active trip.

Driver DTO fields: `id`, `organizationId`, `fullName`, `email`, `phoneNumber`, `licenseNumber`, `accountStatus` (`INVITED`, `INVITATION_EXPIRED`, `ACTIVE`, `SUSPENDED`; keep `PENDING_APPROVAL` only for a distinct application process), `operationalStatus` (`AVAILABLE`, `ON_TRIP`, `OFF_DUTY`), nullable `baseWarehouseId`, nullable `vehicleId`/`activeTripId`, `invitationExpiresAt`, and created/updated timestamps. Include active-trip lock metadata if useful. Do not conflate account access with operating availability.

The current UI still exposes `APPROVE`/`REJECT` for legacy `PENDING_APPROVAL` drivers. Do not use that state for ordinary invited drivers. Either remove those controls when the service is wired, or support a separate driver application-review resource (`PENDING_APPROVAL` -> `ACTIVE`/`REJECTED`) with a documented origin and explicit decision endpoint. Rejecting an application is an audited soft decision, never destructive row deletion.

#### Required driver security and audit behavior

- Driver can read only their own profile, active assignments, stop/customer details necessary for delivery, and allowed trip history. Driver cannot browse a whole distributor/manufacturer directory or another tenant's records.
- Admin/dispatcher lists and details are organization scoped. Manufacturer and Distributor driver identities must not cross organization boundaries even if email or ID is guessed.
- Trip assignment accepts only an activated, unsuspended, operationally `AVAILABLE` driver in the trip owner's organization. Use a transaction/lock to prevent assigning the same driver to two active trips. Assignment updates driver operational status to `ON_TRIP` and creates an audit event.
- Audit invite, email result, resend, revoke, token activation, profile change, suspension/reactivation, availability change, assignment, dispatch, delivery verification, and failed verification. Keep secrets/passwords out of audit detail.

### Driver and vehicle management payloads currently represented by forms

Distributor and Manufacturer fleet list and mutation forms call the corresponding tenant-scoped APIs. Employee forms also submit to organization member invitation/status endpoints. The forms' raw inputs and contracts are:

| UI form | Current form data | Backend operation to implement |
|---|---|---|
| Driver invite | UI `{ name, email, phone, license, baseWarehouseId }`; client maps to canonical body above. | `POST /api/v1/drivers`; backend creates profile and emails activation link. |
| Driver edit | UI profile fields; email is disabled after invitation. | `PATCH /api/v1/drivers/{id}` with `{ fullName, phoneNumber, licenseNumber, baseWarehouseId }`. |
| Driver account action | Resend, revoke, suspend, reactivate; legacy approve/reject only for pending applications. | Invitation resend/revoke, account status, or driver application decision endpoints specified above. |
| Distributor vehicle create | `{ model, plate }` | `POST /api/v1/vehicles` with `{ "model": "...", "plate": "..." }`; backend derives org and initializes status `AVAILABLE`. |
| Manufacturer vehicle create | `{ plate, type, maxWeightCapacity }` | `POST /api/v1/vehicles` with `{ "plate": "...", "type": "...", "maxWeightCapacity": 26000 }`. Validate positive capacity and unique plate per organization. |
| Vehicle status update | Distributor selects `AVAILABLE`, `MAINTENANCE`, `OUT_OF_SERVICE`; Manufacturer uses condition `READY`, `MAINTENANCE`, `OUT_OF_SERVICE` and maps `READY` to `AVAILABLE` | `PATCH /api/v1/vehicles/{id}/status` with `{ "status": "AVAILABLE" | "MAINTENANCE" | "OUT_OF_SERVICE" }`. Reject edits during active trip. |
| Assign vehicle/driver | Distributor trip UI sends `{ "driverId": "...", "vehicleId": "..." }`; Manufacturer vehicle assignment calls vehicle assignment API with `{ "driverId": "..." | null }`. | `PATCH /api/v1/trips/{id}/assign` and `PATCH /api/v1/vehicles/{id}/assignment`; validate both IDs atomically and keep assignments consistent. |

Required vehicle DTO: `id`, `organizationId`, `plate`, canonical `type`, optional `model`, `maxWeightCapacity`, `status`, `baseWarehouseId`, nullable assigned `driverId` and `activeTripId`, timestamps. `GET /api/v1/vehicles?status=&search=&page=&size=` is required by dispatch selectors; response is tenant scoped. `POST /api/v1/vehicles` accepts business fields and derives ID/organization/status server side.

Employee invitation forms are separate from driver onboarding. Manufacturer employee form collects `{ name, email, jobTitle, warehouseId }`; Distributor employee form collects `{ name, email }`. They now call organization member invitation/status APIs and load the directory through `GET /api/v1/members?size=100`. Implement `POST /api/v1/members/invitations`, `GET /api/v1/members`, and `PATCH /api/v1/members/{id}/status`. The create endpoint must send/queue the activation email to the submitted address and return delivery state as with driver invitations. Backend must apply the correct staff role from the caller's organization, enforce approved job-title/role policies and warehouse ownership, use the same invitation token protections as driver onboarding, and return server-issued stable IDs. Never allow a frontend to self-select a system role. The directory response should include `id`, `fullName`, `email`, `jobTitle`, nullable `warehouseId`, `status`, `createdAt`, and optional `lastActiveAt` in a page envelope.

### Other current form request bodies backend must preserve/implement

These are current HTTP payloads from frontend service adapters (confirm backend DTOs match before changing them):

#### Organization access request and account setup

The public access request form submits multipart data to `POST /api/access-requests` with text fields `organizationType` (`MANUFACTURER`/`DISTRIBUTOR`), `organizationName`, `fullName`, `representativeRole`, `country`, `registrationNumber`, `taxIdentifier`, `personalEmail`, `organizationEmail`, `phoneNumber`, and `authorizedRepresentative` (`true`), plus file parts `incorporationCertificate` and `taxCertificate` (PDF/JPG/PNG, each max 5 MB). Store files privately, inspect actual media type/size, and keep the request pending administrator review. Do not accept a public URL or treat browser MIME as proof of file type. The separate access request handoff in `docs/access-request-backend-handoff.md` is the same field-level source.

Auth calls currently send: login `POST /api/auth/login` body `{ identifier, password }`; refresh `{ refreshToken }`; logout `{ refreshToken }`; activation `POST /api/access-requests/activate` body `{ email, token, password, confirmPassword }`; resend activation and password-reset request `{ identifier }`; password reset body `{ identifier: email, otp: token, newPassword: password }`. `GET /api/users/me` returns current user/profile. While mock auth is enabled these auth operations are intercepted in the browser; production backend must implement the real equivalents, issue short-lived access and rotating refresh tokens, bind roles and organization claims, and revoke refresh sessions on logout. Do not store passwords or raw activation/reset tokens.

| Feature | Operation and current JSON body |
|---|---|
| Shared warehouse | `POST /api/v1/warehouses`: `{ code, name, address, city, postalCode, siteManager }`. Tenant comes from principal. `PATCH /api/v1/warehouses/{id}` currently sends `{ status }`. |
| Manufacturer product | `POST /api/v1/products` receives multipart fields `name, category, brand, unit, description, sku, unitPrice, initialQuantity, reorderThreshold, publicationStatus=PUBLISHED` plus required `image` file. It must atomically persist product, initial stock, image, and published state, returning `imageUrl`. `PATCH /api/v1/products/{id}` accepts the editable fields and optional replacement `image`, preserving publication state. Publication body: `{ status: "DRAFT" | "PUBLISHED" | "DISCONTINUED" }`. |
| Distributor catalog offer | `POST /api/stock/offers` receives `{ sourceStockItemId, warehouseId, sku, sellingPrice, reorderThreshold }`; verify approved authorization, source product, and distributor-owned warehouse. Pause/resume: `PATCH /api/stock/offers/{id}` body `{ active: boolean }`. |
| Distributor restock | `POST /api/stock/restock-request` receives `{ stockItemId, manufacturerOrganizationId, requestedQuantity, note }`; validate product relationship and positive integer. Cancel: `PATCH /api/stock/restock-request/{id}/status` body `{ status: "CANCELLED" }`. |
| Distributor purchase order | `POST /api/v1/purchase-orders` receives `{ supplierOrganizationId, items: [{ stockItemId, quantity }] }`. Validate supplier, availability, and snapshot price server-side. |
| Manufacturer PO decision | `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision` receives `{ status: "APPROVED" | "REJECTED", note }`. Recheck stock and actor role at mutation time. |
| Manufacturer shipment allocation | `POST /api/v1/shipments` receives `{ purchaseOrderId, destination, freightDetails, quantity, driverId, vehicleId }`. Resolve origin, carrier, trip/shipment IDs, route and timeline server-side; validate accepted PO quantities and same-organization eligible driver/vehicle, then atomically reserve/assign resources and link shipment to PO. Return the persisted shipment including server IDs and status. |
| Shipment status | `PATCH /api/v1/shipments/{id}/status` receives `{ status: "IN_TRANSIT" | "DELIVERED" }` from shipment audit UI (border hold release requests `IN_TRANSIT`). Enforce allowed transitions, dispatch/receipt proof and actor role server-side; a status patch must not bypass proof requirements. |
| Manufacturer organization settings | `GET/PATCH /api/v1/organization`; patch body `{ registeredName, taxRegistrationId, timezone, defaultWarehouseId }`. Scope to the caller's organization and validate warehouse ownership. |
| Manufacturer notification preferences | `GET/PATCH /api/v1/organization/notification-preferences`; body `{ dispatchExceptionsSms, purchaseOrderApprovalsEmail, weeklyCapacityForecasts }`. Persist according to agreed organization/user preference ownership and return persisted values. |
| Manufacturer stock audit | `POST /api/stock/audits` receives `{ scope: "ORGANIZATION", terminalId }`; create a durable request with requester, organization, status, timestamps and audit trail. Validate terminal ownership if terminal-level audits are supported. |
| Manufacturer live logistics actions | `POST /api/v1/trips/{id}/driver-ping` and `POST /api/v1/trips/{id}/reroute-proposals`, both with `{}`. Ping queues a driver notification and returns queue/delivery state; reroute creates a dispatcher-review proposal and does not change the active route until approved. Enforce ownership/role and audit both. |
| Distributor trip create | `POST /api/v1/trips` receives `{ tripType, origin: { name, address, latitude, longitude }, scheduledStartLabel?, stops: [{ sequence, location: { name, address, latitude, longitude }, etaLabel?, distanceFromPreviousKm?, orderId?, stockItemId?, restockQuantity?, contactName?, contactPhone? }] }`. Validate all IDs and never trust submitted contact data over the order's saved contact. |
| Trip assignment/status/dispatch | Assignment `{ driverId, vehicleId }`; generic status `{ status, note }` must not bypass dispatch or delivery proof. Dispatch `POST /api/v1/trips/{id}/dispatch` body `{}`; backend sends customer verification messages and never returns codes to distributor clients. |
| Order/payment | Distributor UI reads `GET /api/v1/orders`, `GET /api/v1/payments/{orderId}/status`; these states are read-only. Customer app owns order creation/payment initiation. Provider callback is backend-to-backend, verified and idempotent. |

For every endpoint document whether the API returns a resource or wrapper, enum casing, nullability, pagination and sorting. Frontend currently accepts arrays or `{ content: [...] }` for many lists; standardize on page envelopes. Return persisted server resources from mutations so the client never invents IDs or statuses.

### Backend implementation sequence

1. Implement verified principal/tenant authorization and common error/page envelopes; test both organization admin types and cross-tenant denial.
2. Implement shared warehouse API and real driver, vehicle, and employee endpoints. The frontend mutations now target these routes; verify backend route and DTO compatibility. Implement organization settings, notification preference, stock audit, manufacturer shipment, and logistics action routes listed above.
3. Implement invitation email, secure activation, resend/revoke/expiry, driver login claims, and status management. Test invite through first login.
4. Implement product publication/authorization and offers, followed by customer order/stock reservation/payment reconciliation.
5. Implement driver/vehicle assignment, dispatch notification, driver stop list, one-time delivery verification, partial delivery aggregate, and audit.
6. Implement separate manufacturer PO decision, shipment, partial receipt, and stock movement flow.

Do not return fabricated success from unimplemented routes. `201 Created` means the record exists durably; invitation delivery state is reported separately. Preserve retry safety and user-visible API errors without exposing stack traces or secrets.

---

## Workspace-wide feature audit and end-to-end implementation map

**Audit added:** 2026-10-28
**Evidence reviewed:** Angular route registry, feature services, API endpoint registry, form components, and current UI-derived dashboard/report models. “Current call” means the browser service issues an HTTP request; it does not prove that the deployed server implements or persists that route. Routes marked **MISSING** have no durable backend call in the current feature service.

### 1. How the two workspaces fit together

The Manufacturer and Distributor areas are two organization-scoped views over shared business records. They are not independent copies of products, warehouses, drivers, or orders. The intended business chain is:

```text
Manufacturer publishes product + initial stock
        ↓
Distributor discovers product → requests authorization
        ↓                                      ↓
Manufacturer approves relationship ← authorization decision
        ↓
Distributor activates offer from authorized source stock
        ↓
Customer app places order against offer → stock reservation + payment workflow
        ↓
Distributor fulfills/dispatches customer order → driver stop + customer verification
        ↓
Distributor replenishes from Manufacturer with purchase order
        ↓
Manufacturer accepts PO → shipment allocation/dispatch → Distributor receipt
        ↓
Manufacturer inventory increases; Distributor replenishment and customer stock reconcile
```

The same organization-scoped warehouse, member, driver, vehicle and trip resources appear in both workspaces where role policy permits. The server must be the source of truth for identity, organization ownership, stock, money, state transitions, assignment, delivery proof, audit history, and cross-workspace visibility. A browser route, hidden button, or client-side status is never authorization.

### 2. Transport and persistence contract shared by every feature

1. Feature services call `HttpClient` using `API_ENDPOINTS`; the root URL is configured in `src/app/core/api/api.config.ts`. Authenticated requests use the auth interceptor, which attaches the bearer access token to trusted API origins. The activity and error interceptors supply UI loading/error behavior; they do not provide persistence or authorization.
2. The current `API_CONFIG.useMockAuth` setting is `true`. Only authentication calls are intercepted by mock auth. Operational requests still go to the configured API. The mock token is not proof that the real backend accepts the live principal. Before production, use real login/refresh and test tenant/role checks.
3. Read calls populate Angular signals/services. Mutations should return the persisted resource and stable server IDs; clients should refresh or reconcile from that response. The current services vary between arrays and `{ content }` and often request `size=100`; standardize list responses on a documented page envelope, filters, sorting, and total count. Do not silently treat a failed request as an empty successful dataset.
4. For writes, validate input in the client for usability and again in the backend for correctness. The backend derives user and tenant from a verified principal; checks ownership of every referenced nested ID; applies role and state-transition rules; commits related updates transactionally; records actor/time; and returns a stable machine-readable error code for rejected transitions.
5. Use idempotency keys for externally retryable creates (orders, payments, invitations, POs, shipments, dispatch, delivery verification) and transactional outbox/event handling for emails, SMS, provider callbacks and other side effects. A timeout must not create duplicate business records on retry.
6. Cross-workspace events should be persisted as domain records with audit entries, then exposed through role-scoped reads or notifications. Suggested events include `ProductPublished`, `AuthorizationRequested/Decided/Revoked`, `OfferActivated`, `CustomerOrderPlaced`, `PaymentSettled`, `PurchaseOrderSubmitted/Decided`, `ShipmentDispatched/Received`, `TripDispatched`, and `OrderDelivered`. Event names are implementation guidance, not a required broker choice.

### 3. Feature inventory by workspace

#### Shared onboarding, authentication, profile, and organization access

| UI feature/action | Current data path | Backend behavior needed / audit |
|---|---|---|
| Public access request | Multipart `POST /api/access-requests`, text fields and two certificate files; detailed payload above and `docs/access-request-backend-handoff.md`. | Persist pending application and private files; validate contents/size; deduplicate safely; admin review and decision; notify applicant. Approval must lead to invitation/activation, organization membership and initial admin role. The public request itself must not create an authenticated tenant. |
| Activate account / resend activation | `POST /api/access-requests/activate`; resend `POST /api/auth/resend-verification`. | Consume single-use, hashed, expiring invitation token; create credential and activate invited account; rate limit and avoid account enumeration. Shared by organization representative, member and driver invitation flows. |
| Login / refresh / logout / reset password | `POST /api/auth/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/users/me`. Mocked in current dev mode. | Issue short-lived access and rotating refresh tokens, bind org/type/roles, revoke refresh session, handle reset with one-time OTP/token; return canonical profile. The guard loads `/me` to enforce workspace access; server must repeat authorization on every resource. |
| Profile and shell preferences | Profile route uses current auth user; appearance and sidebar state use browser `localStorage`. | Profile edits currently have no clear API call: add `GET/PATCH /api/users/me` only for persisted editable profile fields if the product requires them. Theme and sidebar are device preferences and do not require backend persistence unless cross-device sync is a requirement. |

#### Manufacturer workspace

| Feature | Current transfer/action | Backend implementation and linkage |
|---|---|---|
| Dashboard and attention panel | Combines product and manufacturer PO service data. Only pending PO count/value are derived from loaded PO rows; active fleet, shipment, delivery KPIs are zero and active shipment/driver lists are empty. Product “attention” is inferred from product status. | Add tenant-scoped dashboard aggregation (or complete domain reads) for actual active shipments/trips, drivers/vehicles, delivery SLA and stock alerts. Define period, timezone, currency and numerator/denominator semantics. Never return hard-coded zeros as measured values. Link each metric to its source records and drill-down filters. |
| Product directory, create/edit/details, publication | `GET/POST /api/v1/products`; create/update uses multipart product fields plus image; `PATCH /products/{id}`; publication `PATCH /products/{id}/publication`. Product create currently includes initial stock and publication status. | Persist canonical product/SKU, image in private/object storage with controlled URL, initial stock movement, warehouse/source ownership and publish state atomically. Enforce SKU uniqueness per agreed scope and valid price/unit/quantity. Published product becomes discoverable to distributor subject to visibility policy. Edit publication via explicit transition. |
| Distributor product authorizations | Manufacturer reads `/products/authorizations`; decision `PATCH /products/authorizations/{id}/decision`. | Store relationship per distributor/product, decision actor/time/note and status. Only authorized manufacturer admins decide. Approval is a prerequisite to offer creation; revocation prevents new sales per agreed treatment of existing offers/orders. Distributor requests are linked to an organization, not merely an email. |
| Inventory and stock audit | Read `GET /api/stock/items?size=100`; audit `POST /api/stock/audits` with `{ scope, terminalId }`. | Stock is a ledger/balance updated by product opening stock, accepted procurement receipts, shipment allocation/dispatch rules and adjustments. Audit request must be durable and trigger a workflow; define how physical counts are submitted/reconciled, variance approvals and immutable adjustment entries. UI currently requests an audit but has no count/reconciliation workflow. |
| Purchase order review | Reads `/api/v1/manufacturer/purchase-orders` and stock; decision `PATCH .../{id}/decision` `{ status, note }`. | A Distributor PO is a request against supplier and product stock. Validate pending state, supplier ownership, quantity/availability and current stock when accepting; reserve or allocate stock according to policy. Reject/approve idempotently with actor, note and timestamp. Decision makes accepted PO eligible for shipment allocation. |
| Shipment creation/list/audit | `POST /api/v1/shipments` allocation body; GET list/detail; `PATCH /shipments/{id}/status`. | Create shipment from accepted PO quantities only; server selects/validates origin and links order lines, shipment, trip, driver, vehicle, route and timeline. Support partial allocation and partial receipt with remaining quantities. Dispatch and delivery states require proof and audited transitions; a generic status patch may not bypass dispatch/receipt. Shipment delivery must cause the Distributor receipt flow and inventory movement exactly once. |
| Warehouses | Shared `GET/POST /api/v1/warehouses`, `PATCH /{id}` currently status only. | Same tenant-scoped warehouse records as Distributor workspace when organizations coincide. Validate address/code and unique code within organization. Status changes must block new allocations as appropriate without erasing existing stock or history. Stock/staff/activity cards currently have zero/default fallbacks if aggregate DTO fields are absent; expose authoritative values or label unavailable. |
| Staff directory/invitations | `GET /members?size=100`, `POST /members/invitations` with `{ fullName,email,jobTitle,warehouseId }`, `PATCH /members/{id}/status`. | Persist member identity/membership and role derived from policy; send activation invitation; validate job title, warehouse ownership and permitted status change. Return invitation delivery state. Member status changes should revoke or restore access while retaining audit history. |
| Drivers and vehicles | Fleet service reads lists; driver create/edit/status/invite/availability and vehicle create/status/assignment use API calls described above. | Same fleet lifecycle and constraints in driver section above. Manufacturer shipment dispatch links assigned driver/vehicle; active-trip locks and availability are maintained by server. Do not let driver account state imply operational availability. |
| Logistics overview, trip details, map, ping, reroute | Reads trips/tracking; ping `POST /trips/{id}/driver-ping` `{}`; reroute proposal `POST /trips/{id}/reroute-proposals` `{}`. Some map UI consumes current trip rows. | Provide authoritative trip, stop, event and location/telemetry reads. Ping is a queued notification action with delivery result, not a fabricated location update. Reroute is a proposal requiring dispatcher approval; approved route updates must preserve original route and audit actor/reason. Define telemetry freshness and empty/stale states. Shipment/trip may be linked one-to-one or one-to-many; document cardinality. |
| Reports and export | `ManufacturerReportService` is a local placeholder: empty warehouse list and zero-valued metrics; exports may be generated from loaded data. No report aggregation endpoint. | Implement scoped report query API for date range, warehouse, timezone and metric definitions: inventory accuracy, PO lead time, on-time SLA, driver utilization, shipment volume and warehouse distribution. Return provenance/period/units and pagination where needed. Export must use the same authorized result set; do not imply zero when data is unavailable. |
| Settings | `GET/PATCH /api/v1/organization`; `GET/PATCH /organization/notification-preferences`. | Persist organization profile and preference ownership (organization-level vs user-level), validate default warehouse tenant, and return saved state. Notification preferences must affect actual notification routing/jobs, not only the form. |

#### Distributor workspace

| Feature | Current transfer/action | Backend implementation and linkage |
|---|---|---|
| Dashboard | Derives customer order and payment counts, stock value/units/categories, POs, manufacturers, trips and fleet from loaded services. | Values are only as accurate as source reads; define period and currency, timezone, status mapping, and exclude stale data. Prefer aggregation endpoint for consistent snapshots; drilldowns should use same filter semantics. |
| Master catalog/manufacturer network | Reads published products and authorization records from `/products` and `/products/authorizations`; request `POST /products/{id}/authorization-requests` with empty body. | Product discovery follows publication/visibility. Persist authorization request with distributor organization derived from principal. Return existing relationship/request state to avoid duplicates. Manufacturer approval unlocks offer creation. Manufacturer network should be sourced from approved/supplying relationships or a dedicated directory; current displayed manufacturer data is derived from catalog and may not represent all eligible suppliers. |
| Catalog offer create/pause/resume | Reads stock, product authorization, warehouses; creates warehouse locally in shared API when requested; `POST /api/stock/offers` `{ sourceStockItemId, warehouseId, sku, sellingPrice, reorderThreshold }`; `PATCH /offers/{id}` `{ active }`. | Offer references canonical source stock/product and Distributor warehouse; validate approved authorization, selling price, stock and warehouse ownership. Active offer is what customer order creation may consume. Pausing prevents new order placement; define existing reserved order policy. Never duplicate manufacturer product stock as unlinked distributor inventory. |
| Inventory and restock | Reads `/api/stock/items`, restock requests; creates `/api/stock/restock-request` `{ stockItemId, manufacturerOrganizationId, requestedQuantity, note }`; cancellation PATCH status. | Restock request links an authorized supplier/product and eventually a Distributor PO or agreed replenishment workflow. Clarify whether restock request and PO are two separate stages or one duplicated workflow. Quantity must be positive; cancellation only while pending. Receipt of shipment updates Distributor stock once and closes/fulfills request/PO quantities. |
| Customer orders | Current service reads `/api/v1/orders`; it also exposes `PATCH /orders/{id}/status` and `POST /payments/initiate`. UI order form currently collects customer/order details; some selected customer/product data may be assembled client side. | Ownership conflict to resolve: handoff says customer-facing app owns order creation/payment and Distributor UI is read-only, but current Distributor service still contains order status mutation/payment initiation and form page. If this workspace remains an operations dashboard, remove or disable those calls/forms and keep order/payment state read-only. If Distributor staff is intended to create orders for customers, define an explicit staff-assisted endpoint with customer identity/consent and payment ownership; never let it set paid status. Payment initiation should be customer-owned; provider webhook verified server-side and idempotent. Order stock reservation, price/tax/shipping snapshot, contact address, cancellation/refund policy, and payment state transitions are backend-owned. |
| Customers | `DistributorCustomerService` is an in-memory empty signal; no HTTP endpoint. Customer directory/detail UI is not durable. | **MISSING:** Decide whether customers are global customer accounts or Distributor-scoped customer relationships. Implement scoped `GET/POST /api/v1/customers`, `GET/PATCH /{id}` and status/archive if business requires durable customer management. Order creation should reference a durable customer and snapshot validated contact/delivery address. Restrict PII to staff needing it and driver only for assigned stop. |
| Procurement | Catalog/manufacturer/product reads; distributor PO `GET/POST /api/v1/purchase-orders`, detail and settlement endpoints. Form submits `{ supplierOrganizationId, items:[{ stockItemId, quantity }] }`; price must be snapshotted server-side. | Persist PO and line snapshots, supplier/distributor tenant, currency, quantities, state, terms and audit. Supplier must be an eligible manufacturer; item must be published/authorized and source stock available. Manufacturer sees same PO in review queue. Settlement/receipt endpoint must record durable payment/receipt with proof and idempotency; define settlement meaning (financial payment vs physical receipt) because current route name/body does not distinguish them. Partial fulfilment must retain ordered/accepted/shipped/received quantities. |
| Warehouses | Same shared `GET/POST/PATCH /api/v1/warehouses`. | Shared tenant resource; ensure stock and offer warehouse IDs resolve to same Distributor org. Warehouse creation from offer form must not be a hidden side effect without showing successful persisted warehouse. |
| Staff directory/invitations | `GET /members`, `POST /members/invitations` `{ fullName,email }`, `PATCH /members/{id}/status`; drivers merged into staff view from fleet service. | Persist employee membership and invitations. Distributor staff role is derived, not client supplied. The UI currently fills job title/warehouse/access role with display defaults; provide DTO fields if authoritative or label them as presentation defaults. |
| Drivers, vehicles, fleet | Same tenant fleet APIs as manufacturer; Distributor vehicle create body `{ model, plate }`, status updates; drivers invited/edited/availability changes. | Vehicle DTO must normalize Manufacturer `type/capacity` and Distributor `model` forms into canonical fields. Preserve attributes rather than dropping them in workspace-specific adapters. Fleet should join to trips and current stops by stable IDs; do not infer current order from arbitrary customer order status. |
| Logistics/trips | `GET /trips`, `/tracking`; `POST /trips`; assignment PATCH `{ driverId, vehicleId }`; dispatch POST `{}`; generic status PATCH `{ status,note }`. Form draft contains origin/stops and labels, optional order/stock references and contacts. | Persist trip and ordered stops; validate stop order, geography, referenced orders/stock, and quantity. Derive customer contact from order, not submitted client fields. Assignment atomically locks driver and vehicle. Dispatch sends one-time time-limited verification code per customer order via backend; code is never returned to Distributor UI. Driver app/API must expose assigned active stops and accept code/proof with attempt limits, expiry and one-time use. Partial trip delivery updates each order and trip aggregates separately. Generic status must not bypass dispatch or proof. Current frontend does not include driver app/stop verification UI. |
| Orders/payments and delivery view | Distributor sees order/payment states from `/orders` and `/payments/{orderId}/status`. | These are read models over customer order, payment provider reconciliation, shipment/trip fulfillment. Backend should expose `orderId`, source offer, line snapshots, customer delivery summary, payment status, fulfillment status, shipment/trip linkage and event timestamps with field-level privacy. Never accept a Distributor PATCH that directly marks paid/delivered. |
| Maps/live tracking | Trip tracking API read; UI map plots returned coordinates/route. | Backend or driver/mobile telemetry source must submit signed/authenticated timestamped location updates tied to assigned driver/trip. Validate actor and freshness, retain suitable history, return latest point plus timestamp/accuracy. A map drawing a route does not mean live GPS exists; report stale/unavailable state. |

### 4. Cross-feature dependency and state ownership map

| Record/state | Created or owned by | Consumers/dependent flow | Required invariant |
|---|---|---|---|
| Organization and membership | Access-request approval/admin lifecycle | All Manufacturer/Distributor resources; shared warehouses and fleet | Tenant derived from principal; organization type and role determine permitted workspace and actions. |
| Product and initial stock ledger | Manufacturer product publish/create | Distributor catalog, authorization, offers, PO line selection | One canonical product; publication and stock changes audited; product ID stable across both workspaces. |
| Product authorization | Distributor requests; Manufacturer decides/revokes | Distributor offer and customer sale eligibility | Unique active relationship per distributor/product; backend checks it on every offer/order write. |
| Warehouse | Organization admin in either workspace | Offers, stock balances, employee/driver base, product/shipment origin | Every reference belongs to same tenant; warehouse status constrains new operations. |
| Distributor offer and stock | Distributor offers source product in warehouse; stock ledger changes by purchase receipt/sale | Customer order creation, stock alert dashboard, restock | Active offer cannot exceed available stock policy; customer reservation is atomic and released on permitted cancel/failure. |
| Customer and customer order | Customer application, or explicit assisted-sales operation if defined | Distributor read/fulfill, payment, trip stops, reports | Customer identity/contact is verified/authorized; order snapshots offer price and address; no cross-tenant order visibility. |
| Payment | Customer initiates; backend/provider callback owns settlement | Distributor order read state, reconciliation, refund workflow | Signed provider callback, idempotent transition, immutable transaction reference; no workspace UI marks paid. |
| Distributor purchase order | Distributor submits; Manufacturer decides | Shipment allocation, inventory movement, settlement/receipt, dashboards | Ordered, approved, shipped, received and settled are distinct quantities/states with partial operations supported. |
| Shipment | Manufacturer allocates accepted PO | Manufacturer logistics and Distributor receiving/inventory | Shipment quantity cannot exceed accepted unallocated PO quantity; dispatch/delivery/receipt evidence audited. |
| Driver, vehicle and trip | Organization fleet admin/dispatcher; driver owns availability; backend owns assignment and ON_TRIP | Dispatch, tracking, stop proof, shipment/customer fulfillment | Same-tenant eligible resources; mutually exclusive active assignment; backend state machine only. |
| Delivery proof | Assigned driver submits customer code/proof | Customer order and trip/shipment completion; inventory/reconciliation | One code per order, time-bound, rate-limited, single-use; backend stores result and actor, not plaintext secret. |
| Dashboard/report | Read-only aggregation of domain records | Both workspaces | Derived only from authorized source records; definitions and filters consistent with list pages; no fake zero/empty as complete result. |

### 5. Audit gaps and frontend/backend alignment work

These are concrete gaps observed in the current Angular source and should be tracked alongside backend implementation:

1. **Order ownership mismatch:** `DistributorOrderService` includes status PATCH and payment initiation, while this handoff assigns order creation/payment to the customer app and says Distributor is read-only. Remove the inappropriate UI/service actions or ratify a separate assisted-sales API and update the state ownership contract before enabling them.
2. **Customer directory is local-only:** `DistributorCustomerService` has an empty in-memory collection and no API route. Durable customer lookup/create/edit cannot work until customer policy and endpoints are defined.
3. **Manufacturer dashboard is incomplete:** active fleet, shipment, delivery, and alert details are empty/zero or inferred from product status. Add source API fields or a dashboard aggregate endpoint and show unavailable/loading/error distinctly.
4. **Manufacturer reports are placeholders:** no server request, warehouse filter data or report values. Add report APIs with metric definitions and access scope, or mark the screen unavailable until implemented.
5. **Distributor dashboard relies on independently loaded data:** metrics can be incomplete if one service fails or data pages are truncated at 100. Add a consistent aggregate endpoint or make pagination/filtering and partial-load presentation explicit.
6. **Trip-to-order and trip-to-shipment semantics:** current trip stops may reference `orderId` or `stockItemId`; Manufacturer shipments also carry driver/vehicle and a route/trip. Define resource cardinality, event ownership, receipt flow, and how a trip containing several orders affects each individual order and overall trip status.
7. **Restock request versus purchase order:** both UI concepts can represent replenishment. Specify whether one creates the other, how quantities/statuses synchronize, and which one is the commercial commitment to avoid duplicate stock demand.
8. **PO settlement versus receipt ambiguity:** existing `/{id}/settlements` route name does not say whether it records money, physical receiving, or both. Split financial settlement from receipt if they have separate evidence/state transitions.
9. **Fleet schema differs by workspace:** Distributor vehicle form sends model/plate; Manufacturer sends plate/type/capacity. Backend and DTO mapping must preserve canonical vehicle data across both views and define base warehouse/assignment semantics.
10. **Display-only aggregates and member attributes:** warehouse `stockUnits`/`staffCount`, manufacturer member job title/warehouse, Distributor customer directory, and last-active/location labels need explicit source/nullable semantics. UI fallbacks (`0`, `Unassigned`, em dash) must not be reported as measured data.
11. **Legacy driver application states:** UI exposes approve/reject for `PENDING_APPROVAL`; standard invitation onboarding uses `INVITED`. Keep application review as a separately identified origin/resource or remove those controls. Do not silently map application decisions to invitation activation.
12. **Pagination and errors:** several services accept either raw arrays or page envelopes and some swallow load errors. Define one envelope and filter/query contracts; distinguish no records from unavailable data; mutations must surface backend errors and avoid optimistic state that implies a committed write.
13. **Mock-auth boundary:** operations are live calls despite mocked auth. Do not treat successful development display as authenticated backend acceptance. Re-run role and cross-tenant checks with real credentials before enabling operational use.

### 6. Recommended implementation order for a working integrated flow

1. Agree identity/tenant model, enums, common page/error DTOs, audit fields, idempotency policy and authorization matrix; turn off mock auth in a controlled integration environment and validate real login/refresh.
2. Complete access-request review, activation and invitation email; implement organizations, members, warehouses, drivers and vehicles with tenant ownership and real DTOs.
3. Implement canonical Manufacturer products, image storage and stock ledger; implement Distributor product discovery and authorization request/decision/revocation.
4. Implement Distributor warehouse offers, available stock and restock/PO relationship. Decide the restock-vs-PO and settlement-vs-receipt semantics before exposing both flows.
5. Implement Distributor customer/order ownership model and customer app order/payment path. Remove or formally replace the conflicting Distributor order mutation/payment calls. Add idempotent stock reservation and payment provider reconciliation.
6. Implement Manufacturer PO review, partial allocation, shipment creation, dispatch and Distributor receipt. Tie ledger entries and PO/shipment quantities together transactionally.
7. Implement trip/driver/vehicle assignment, dispatch notification, driver stop API/app, proof verification, live location and order-level partial delivery. Then expose accurate order/trip/shipment status reads.
8. Add dashboard aggregates and report queries only after source lifecycle data is reliable; validate every KPI against underlying records and timezone/currency definitions.
9. Add organization settings, notification preferences, stock count/reconciliation, reroute approval and audit search; verify that configured preferences actually drive jobs and all actions create durable audit records.

### 7. Minimum end-to-end acceptance scenarios

- Approved Manufacturer creates and publishes a product with opening stock; authorized Distributor can discover it, but a different Distributor cannot see private data or sell without approval.
- Distributor requests product authorization; Manufacturer records actor/note/time on approval or rejection; approved Distributor creates an offer in its own warehouse; paused/revoked offers cannot receive new customer orders.
- Customer creates an order against an active offer; backend snapshots price/address, reserves stock once, payment callback updates payment once, and Distributor sees read-only status.
- Distributor submits PO; Manufacturer sees the same persisted PO and decides against current stock; partial shipment allocation cannot exceed accepted quantity; Distributor receipt updates both parties' quantities and stock ledger once.
- Admin invites a driver/member; activation link is sent without exposing token; activation creates a least-privilege account; cross-tenant profile/warehouse/vehicle/trip IDs are rejected.
- Dispatcher assigns an available same-tenant driver and vehicle atomically; a concurrent assignment cannot reuse either; dispatch creates per-order codes and notifications; codes never appear in Distributor API responses.
- Assigned driver submits a valid code once; order becomes delivered with proof/audit; replay, expired code, wrong trip/driver, excessive attempts, and cross-tenant access are rejected; partial stop completion leaves remaining orders active.
- Manufacturer/Distributor dashboard and reports reconcile to source orders, stock movements, POs, shipments, trips and delivery events for a fixed date range; failed source services are reported as unavailable instead of zero.
- Every mutation is tested for retry safety and audited actor/time; every read/list/detail is tested for organization and role boundaries with real authentication.
