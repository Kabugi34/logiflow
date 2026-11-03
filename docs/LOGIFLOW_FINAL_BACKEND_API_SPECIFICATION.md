# Logiflow Final Backend API Specification

**Purpose:** Spring Boot implementation handoff for the Angular Manufacturer and Distributor
workspaces. This document records frontend-observed contracts separately from proposed backend
work. It does not assert that a route exists on the deployed server.

**Audit boundary:** This is a source audit of the Angular repository at the time of writing. The
repository contains no Spring Boot implementation to inspect. The configured API host and frontend
route references were not treated as proof of backend behavior, and no credentials or authenticated
API calls were used to validate the server. Consequently, no server route is classified as
independently verified by this audit.

## 1. Project architecture and integration overview

- Angular standalone feature areas are selected by `src/app/app.routes.ts`; Manufacturer and
  Distributor are separate guarded workspaces under one shared shell.
- Feature services inject `HttpClient`, generally map backend DTOs into signals, and centralize the
  route paths in `src/app/core/api/api-endpoints.ts`. A few services still keep operational state
  locally.
- `API_CONFIG.apiRoot` is `https://distro-backend-09e7.onrender.com/api`; `baseUrl` is
  `https://distro-backend-09e7.onrender.com/api/v1`. Stock, audit, and restock routes use
  `apiRoot` (without `/v1`); most business routes use `baseUrl`. This split must be confirmed and
  kept intentional or normalized by the backend team.
- `useMockAuth` is currently `false`. The mock-auth interceptor, when enabled, handles only auth
  routes; it does not supply mock business data or persist business operations.
- Most collection reads request `?size=100`; there is no consistent Angular paging, sorting, or
  server-side search contract. Some services accept either `{ content: [...] }` or an array;
  Manufacturer inventory currently only reads `content`.
- The count below is **68 distinct HTTP method + route-template combinations actually referenced
  by the Angular source**, counting shared workspace routes once and excluding query variants,
  internal operations, and proposals. It is an inventory count, not a count of confirmed server
  endpoints.

### Workspace page / feature coverage

| Workspace | Routed features audited | API expectation / notable limitation |
|---|---|---|
| Manufacturer | Dashboard, products, listing authorizations, inventory, purchase orders, payments, shipments, logistics/trips/live map, drivers, vehicles, staff, warehouses/operations, reports, settings, profile | Many views aggregate data client-side. Reports and warehouse operations are local-only; product, stock, order, fleet, shipment and settings services call the route references in section 2. |
| Distributor | Dashboard, catalog/offers, inventory/restock, procurement, payments, logistics/trips, drivers, vehicles, staff, warehouses, customers, customer orders, profile | Customer directory is empty/local-only; customer-order creation and dispatch/delivery methods explicitly throw rather than call an API. Warehouse operations are local-only. |
| Shared | Auth/access request/activation/login/recovery, payment history and initiation, shell/navigation, profile, warehouse operation models/service | Auth endpoints are integrated in Angular but server behavior is unverified. Payment history has a frontend call and is still an unverified backend dependency. |

Search, status filtering and sorting visible in the UI are generally client-side over the fetched
collection. The frontend does not send general search, sort, filter, page, or cursor parameters
other than `size=100`, the payment `orderType`/`orderId` query, and the restock/other route-specific
request data described below. Search is not a substitute for server-side organization scoping.

## 2. Existing verified backend integrations

### What “existing” means in this specification

The following inventory distinguishes **frontend-referenced** integrations from **server-verified**
integrations. All routes below are called or registered in Angular. None could be verified against
server source or an authenticated server response in this audit. Treat each as **referenced /
unverified** until backend owners confirm deployment, authorization, schema, persistence, and
status semantics. Routes mentioned only as proposed are not implemented by this document.

### 2.1 Frontend-referenced route inventory

Paths are relative to the configured roots: `/api` for auth and stock-family routes and `/api/v1`
for other routes. `{id}` denotes a URL-encoded path value. Payload and response fields below are
only those modeled or sent by the frontend; `untyped` means Angular does not define a dependable
response contract.

#### Authentication and access requests — 9 operations

| Method and path | Frontend request / response contract | Frontend use |
|---|---|---|
| `POST /api/access-requests` | Multipart form: `organizationType`, `organizationName`, `fullName`, `representativeRole`, `country`, `registrationNumber`, `taxIdentifier`, `personalEmail`, `organizationEmail`, `phoneNumber`, files `incorporationCertificate` and `taxCertificate`, and string `authorizedRepresentative`; response is typed `void`. | Organization access request / documents. |
| `POST /api/access-requests/activate` | JSON: `email`, `token`, `password`, `confirmPassword`; typed `void`. | Account activation. |
| `POST /api/auth/resend-verification` | `{ identifier: email }`; typed `void`. | Resend activation link. |
| `POST /api/auth/login` | `{ identifier, password }`; `AuthSession { accessToken, refreshToken, redirectPath, user }`. User: `id`, optional `fullName`, `email`, `role`, nullable `organizationId`, `organizationName`, `organizationtype`. | Login. |
| `POST /api/auth/refresh` | `{ refreshToken }`; same `AuthSession` response. Excludes the access-token bearer header in the interceptor. | Session renewal. |
| `POST /api/auth/logout` | `{ refreshToken }`; typed `void`. | Logout / refresh-token revocation expectation. |
| `GET /api/users/me` | Authenticated session; `AuthUserResponse` above. | Restore current session. |
| `POST /api/auth/forgot-password` | `{ identifier: email }`; typed `void`. | Password-reset request. |
| `POST /api/auth/reset-password` | `{ identifier: email, otp: token, newPassword }`; typed `void`. | Password reset. |

The mock interceptor can simulate these auth flows only when explicitly enabled. Its demo login,
session maps, activation, and password recovery responses are in-memory demo behavior, not a
production identity provider.

#### Products and listing authorization — 7 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `GET /api/v1/products?size=100` | Array or page `content`; product fields currently consumed include `id`, `sku`, `name`, nullable `category`, optional `brand`, `unit`, `description`, `imageUrl`, `unitPrice`, `publicationStatus`, optional organization/manufacturer IDs and name, optional `sourceStockItemId`, availability and active flags. | Manufacturer product list and Distributor manufacturer catalog / procurement. |
| `POST /api/v1/products` | `multipart/form-data`: serialized `ManufacturerProductDraft` (`name`, `category`, `sku`, `brand`, `unit`, `description`, `unitPrice`, `initialQuantity`, `reorderThreshold`, optional `publicationStatus`) and optional file field `image`; typed product response. | Create Manufacturer product. |
| `PATCH /api/v1/products/{id}` | Same multipart draft shape; optional `image`; typed product response. | Edit Manufacturer product. |
| `PATCH /api/v1/products/{id}/publication` | `{ status: 'DRAFT' \| 'PUBLISHED' \| 'DISCONTINUED' }`; typed product response. | Publish/unpublish/discontinue. |
| `GET /api/v1/products/authorizations` | Array or `{ content }` of `ProductAuthorization`; frontend uses product, distributor, status, and request identifiers/values. | Manufacturer decisions and Distributor authorization state. |
| `POST /api/v1/products/{productId}/authorization-requests` | `{ requestNote: string }`; typed `ProductAuthorization`. | Distributor requests permission. |
| `PATCH /api/v1/products/authorizations/{id}/decision` | `{ decision }`; response is not consumed. Decisions are represented as approve/reject in UI. | Manufacturer approves/rejects request. |

The catalog filters published source products client-side and joins records using product ID/SKU.
The backend response does not currently have a stable, fully modeled manufacturer/product/warehouse
relationship. Do not equate an organization ID or an offer stock-item ID with the canonical
manufacturer product ID.

#### Stock, distributor offers, and restock requests — 8 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `GET /api/stock/items?size=100` | Array or page, depending on service. Fields consumed include `id`, optional `productId`, `sourceStockItemId`, `manufacturerOrganizationId`, `warehouseId`, `sku`, `name`, nullable `category`, `unitPrice`, `quantityOnHand`, optional `reservedQuantity`, `availableQuantity`, `reorderThreshold`, optional manufacturer name and `active`. | Both workspaces' inventory/product screens; Distributor catalog/offer joins and purchase-order enrichment. |
| `GET /api/stock/items/{id}` | `id`, `sku`, `name`, nullable category are consumed for line enrichment. | Distributor customer-order details. |
| `POST /api/stock/audits` | `{ scope: 'ORGANIZATION', terminalId }`; response is untyped. | Manufacturer “request audit”. The audit UI only records that the request was submitted. |
| `GET /api/stock/restock-request?size=100` | Array or page of `{ id, stockItemId, requestedQuantity, status, createdAt }`. | Distributor restock request list. |
| `POST /api/stock/restock-request` | `{ stockItemId, manufacturerOrganizationId, requestedQuantity, note }`; typed restock response. | Distributor requests manufacturer replenishment. |
| `PATCH /api/stock/restock-request/{id}/status` | `{ status: 'CANCELLED' }`; typed restock response. | Cancel restock request. |
| `POST /api/stock/offers` | `{ sourceStockItemId, warehouseId, sku, sellingPrice, reorderThreshold }`; typed stock item response. | Create Distributor offer after UI authorization check. |
| `PATCH /api/stock/offers/{id}` | Optional `{ sellingPrice, reorderThreshold, active }`; typed stock item response. | Edit offer price, threshold, or active status. |

Manufacturer product and inventory services join one stock row per product/SKU and map it to one
synthetic “Organization stock” terminal (`ORG`). Distributor stock uses `quantityOnHand` for its
displayed on-hand balance and does not model reserved stock. The backend must clarify whether
`availableQuantity = quantityOnHand - reservedQuantity`, whether stock is per warehouse, and what
`/api/stock/items` means for a Manufacturer product versus a Distributor offer.

#### Warehouses and organization members — 6 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `GET /api/v1/warehouses?size=100` | Array or page. Consumed: `id`, optional `code`, `name`, `address`, optional `city`, `postalCode`, `siteManager`, `status`/`active`, optional `stockUnits`, `staffCount`. | Manufacturer and Distributor warehouse lists and offer form. |
| `POST /api/v1/warehouses` | `{ code, name, address, city, postalCode, siteManager }`; typed warehouse response. | Create workspace-owned warehouse. |
| `PATCH /api/v1/warehouses/{id}` | `{ status: 'ACTIVE' \| 'INACTIVE' }`; typed warehouse response. | Reversible archive/reactivate in both workspaces. There is no warehouse `DELETE` call in the Angular UI. |
| `GET /api/v1/members?size=100` | Array or page. Manufacturer consumes `id`, name/fullName, email, optional `jobTitle`, `warehouseId`, status and last activity; Distributor consumes member ID/name/email/status/created/last-active. | Staff lists. |
| `POST /api/v1/members/invitations` | Manufacturer sends `{ fullName, email, jobTitle, warehouseId }`; Distributor sends `{ fullName, email }`. Typed invitation response. | Invite staff. |
| `PATCH /api/v1/members/{id}/status` | `{ status }`; response untyped. | Update member status. |

Warehouse response fields such as `stockUnits`, `staffCount`, or default manager labels are
optional and defaulted in the UI. Warehouse staff lists/activities are not fetched. Warehouse
deactivation must be rejected when it would invalidate active stock, assignments, shipments, or
history; no hard-delete request is sent.

#### Purchase orders, supplier settlements, and customer orders — 8 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `GET /api/v1/purchase-orders` | Array or `{ content }`; PO fields consumed: `id`, `purchaseOrderNumber`, buyer/supplier organization IDs, `status`, optional `paymentStatus`, `totalAmount`, `submittedAt`, and `items[] { stockItemId, sku, name, quantity, unitPrice, shippedQuantity? }`. | Distributor procurement list. |
| `GET /api/v1/purchase-orders/{id}` | Same PO DTO. | Distributor PO detail. |
| `POST /api/v1/purchase-orders` | `{ supplierOrganizationId, items: [{ stockItemId, quantity }] }`; response typed as PO. | Distributor submits stock purchase. |
| `GET /api/v1/purchase-orders/{id}/settlements` | Array of `{ id, status, amount, currency, note, settledAt }`. | Distributor PO settlements display. A settlement is not proof of provider verification. |
| `GET /api/v1/manufacturer/purchase-orders` | Array or page of PO DTO; Manufacturer additionally maps `buyerOrganizationId`, `submittedAt`, optional payment/review/rejection/fulfilled fields and line `sku`, `name`, `quantity`, `unitPrice`. | Manufacturer receives distributor purchase orders. |
| `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision` | `{ status, note }`; frontend maps accepted to `APPROVED`, pending to `SUBMITTED`; typed PO response. | Manufacturer accepts/rejects. |
| `GET /api/v1/orders` | Array or page; fields consumed: `id`, `orderNumber`, `customerId`, `organizationId`, `status`, `deliveryAddress`, `subtotalAmount`, `totalAmount`, `placedAt`, optional `paymentStatus`, `items[] { stockItemId, quantity, unitPrice }`. | Distributor customer orders. |
| `PATCH /api/v1/orders/{id}/status` | `{ status }`; status is one of `CONFIRMED`, `PROCESSING`, `AWAITING_DISPATCH`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED` in the service API. | Distributor order workflow. |

The customer order form is routed, but `DistributorOrderService.create()` intentionally throws
“Customer order creation is available to customer accounts only.” The Angular UI therefore has no
working create-order API call. Distributor-side dispatch and delivery confirmation methods also
throw because fleet assignment/delivery confirmation contracts are unavailable in that service.
Trip dispatch exists separately; the link between a customer order and that trip is currently
derived by matching order numbers in trip stops.

#### Payments — 3 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `POST /api/v1/payments/initiate` | `Idempotency-Key` header; JSON `{ orderId, orderType: 'PURCHASE_ORDER' \| 'CUSTOMER_ORDER', provider: 'MPESA', phoneNumber }`; response `{ paymentId, paymentReference?, provider?, customerMessage? }`. The service times out after 30 seconds; acknowledgement does not mean payment succeeded. | Shared payment initiation from PO and customer-order detail. |
| `GET /api/v1/payments?orderType=...&orderId=...` | History list/page. Fields consumed: `id` or `paymentId`, references, order ID/type, direction, counterparty name, amount, currency, provider, status, timestamps, reconciliation fields, M-Pesa receipt and failure reason. `orderId` is optional for history filtering. | Shared transaction history and supplier-order payment verification. |
| `GET /api/v1/payments/{orderId}/status` | `{ orderId, paymentId, status, amount, mpesaReceiptNumber, failureReason }`. | Customer-order payment verification. |

Payment `orderType` is used as a history filter, not an authorization identity. Manufacturer history
uses `PURCHASE_ORDER`; Distributor can filter purchase outgoing and customer incoming records.
For purchase orders the frontend gets the status from `/payments` rather than the customer status
route. The current idempotency key is generated per call in the browser; it is not persisted across
reloads.

#### Shipments, trips, tracking, drivers, and vehicles — 23 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `GET /api/v1/shipments?size=100` | Array or `{ content }` of `ManufacturerShipment`-shaped records: IDs, PO reference, destination/freight, quantity, status, trip/driver/vehicle/carrier/origin/destination facility, route and timeline. | Manufacturer shipment list and derived logistics trips. |
| `POST /api/v1/shipments` | `{ purchaseOrderId, destination, freightDetails, quantity, driverId, vehicleId }`; typed shipment response. | Manufacturer shipment allocation. UI blocks unless PO is accepted and payment is `PAID`. |
| `PATCH /api/v1/shipments/{id}/status` | `{ status }`; typed shipment response. | Shipment state changes; transition to `IN_TRANSIT` is UI-gated by accepted/paid PO. |
| `GET /api/v1/trips?size=100` | Distributor `DistributorTrip[]` or page. Trip fields include `id`, `tripNumber`, `type`, `status`, origin, stops, items, schedule/distance, optional driver and vehicle IDs. | Distributor trip list. Manufacturer trips are derived from shipments instead. |
| `POST /api/v1/trips` | `TripDraft { tripType, origin, scheduledStartLabel?, totalDistanceKm?, stops[] }`; stop fields include sequence, location, optional ETA/distance/order/stock item/restock quantity/contact. | Distributor creates trip. |
| `GET /api/v1/trips/{id}/tracking` | `TripPing[] { id, lat, lng, recordedAt }`. | Distributor tracking view. |
| `PATCH /api/v1/trips/{id}/assign` | `{ driverId, vehicleId }`; typed trip response. | Assign existing fleet resources to trip. |
| `POST /api/v1/trips/{id}/dispatch` | Empty JSON object; typed trip response. | Dispatch trip. |
| `PATCH /api/v1/trips/{id}/status` | `{ status, note }`; typed trip response. | Update trip status. |
| `POST /api/v1/trips/{id}/driver-ping` | Empty JSON object; response untyped. | Manufacturer request driver update. |
| `POST /api/v1/trips/{id}/reroute-proposals` | Empty JSON object; response untyped. | Manufacturer propose reroute. |
| `GET /api/v1/drivers?size=100` | Array/page. Fields consumed include ID, names, email, phone, license, account/operational status, base warehouse, creation time, optional vehicle and invitation state. | Both workspaces' driver directories. |
| `POST /api/v1/drivers` | Manufacturer and Distributor submit driver identity/contact/license/base warehouse fields; Manufacturer uses `{ fullName,email,phoneNumber,licenseNumber,baseWarehouseId }`; Distributor equivalent. | Register/invite driver. |
| `PATCH /api/v1/drivers/{id}` | Distributor profile update: `{ fullName, phoneNumber, licenseNumber, baseWarehouseId }`; typed driver response. | Edit Distributor driver profile. |
| `POST /api/v1/drivers/{id}/invitation/resend` | Empty JSON object; response untyped. | Resend driver invite. |
| `DELETE /api/v1/drivers/{id}/invitation` | No body; response untyped. | Revoke pending invitation. |
| `PATCH /api/v1/drivers/{id}/status` | `{ status: 'SUSPENDED' \| 'ACTIVE' }`; response untyped. | Suspend/reactivate account. |
| `PATCH /api/v1/drivers/{id}/operational-status` | `{ status: 'AVAILABLE' \| 'OFF_DUTY' }`; response untyped. | Set availability. |
| `PATCH /api/v1/driver-applications/{id}/decision` | `{ decision: 'APPROVED' \| 'REJECTED' }`; response untyped. | Approve/reject driver application. |
| `GET /api/v1/vehicles?size=100` | Array/page. Distributor consumes ID, model/type, plate/registration, status and optional position; Manufacturer consumes vehicle capacity/condition/assignment/trip fields. | Fleet directory. |
| `POST /api/v1/vehicles` | Manufacturer: `{ plate, type, maxWeightCapacity }`; Distributor: `{ model, plate }`; typed vehicle response. | Register vehicle. |
| `PATCH /api/v1/vehicles/{id}` | Manufacturer sends `{ driverId }` (nullable to unassign); response untyped by caller. | Assign/unassign driver. |
| `PATCH /api/v1/vehicles/{id}/status` | Manufacturer sends `{ status }` (condition labels); Distributor sends `{ status }` (`AVAILABLE`, `MAINTENANCE`, `OUT_OF_SERVICE`). | Update vehicle operational/service status. |

The route-template count above is 23 for this group, counting the shared driver/vehicle
route templates only once. Manufacturer logistics does not fetch a distinct trip resource; it
derives trip display data from shipment records and fleet state. Some UI metrics, route progress,
location labels, invitation resend counts, and service/operational statuses are synthesized by
Angular and must not be persisted as authoritative backend facts.

#### Organization profile and notification preferences — 4 operations

| Method and path | Request / response known to Angular | Frontend use |
|---|---|---|
| `GET /api/v1/organization` | Partial `OrganizationProfile { registeredName, taxRegistrationId, timezone, defaultWarehouseId }`. | Manufacturer settings. |
| `PATCH /api/v1/organization` | Full same profile; typed profile response. | Save Manufacturer organization settings. |
| `GET /api/v1/organization/notification-preferences` | Partial `{ dispatchExceptionsSms, purchaseOrderApprovalsEmail, weeklyCapacityForecasts }`. | Manufacturer preferences. |
| `PATCH /api/v1/organization/notification-preferences` | Same preference fields; typed response. | Save preferences. |

### 2.2 Existing integration classification

| Classification | Findings |
|---|---|
| Frontend implemented and route referenced, server unverified | Auth, products, listing permissions, stock reads, audits request, warehouse CRUD/status, members, fleet, PO, customer-order reads/status, shipment, trips, payment initiation/history/status references, restock and offer routes, organization settings. |
| Partially integrated | Inventory balances are read-only and inconsistently mapped; settlements are displayed but not verified payments; manufacturer dispatch is a shipment status/API flow; payment authorization for supplier PO is based on order `paymentStatus`; Distributor fulfillment mixes order status and trips; warehouse archive is status PATCH only. |
| Missing from Angular backend integration | Durable warehouse receipt/put-away/picking/packing/adjustment/movement APIs; distributor shipment receipt confirmation; manufacturer production/stock receipt; payment callback/webhook API (provider-to-backend); customer directory API; customer order creation from this workspace; Distributor order-to-trip assignment/dispatch/delivery API; dashboard aggregation and report endpoints; notification delivery/read history. |
| Local/UI-only or synthesized | Warehouse operation ledger, warehouse receipt intake derived from in-transit PO/shipment state, allocation/pick/pack/dispatch stock changes, storage locations and movement IDs; manufacturer report snapshots (zero/empty), much of manufacturer dashboard, client-generated dashboard aggregations, synthetic trip progress/driver and vehicle position values, customer directory (empty), PDF/print output. |

## 3. Manufacturer workspace: complete API specification

### 3.1 Product catalog and publication

Use the shared product endpoints in section 2. Product ownership must be assigned from the
authenticated Manufacturer organization, never accepted from a request-body organization ID.
Product identity is Manufacturer-owned; distributors may not update the canonical description,
specifications, image, category, wholesale price, or SKU. The current Manufacturer editor sends a
single `image` file and product draft fields; the current UI model has no structured
specifications collection, product images collection, or explicit product-to-warehouse rows.
Those are open contract questions, not fields to infer.

The create draft includes `initialQuantity` and `reorderThreshold` in the same multipart form as
the product. The Angular code cannot establish whether the backend creates stock atomically,
what warehouse owns that quantity, or whether the field is currently accepted. Confirm or split
product creation from a warehouse-scoped production/stock operation.

### 3.2 Listing permission decisions

Manufacturer reads authorization requests and sends approve/reject decision patches. Backend must
scope both the product and request to the Manufacturer organization and persist decision actor,
timestamp, and reason if supported. The UI decision body is only modeled as `{ decision }`; any
note/reason field requires frontend/backend confirmation.

### 3.3 Manufacturer stock and warehouses

Manufacturer stock read is `GET /api/stock/items?size=100`; the UI displays on-hand and reserved
quantities and derives available quantities. It has no durable stock correction, production,
warehouse location, or movement-history write. `POST /api/stock/audits` is only an audit request,
not a quantity adjustment. Warehouses can be created and set `ACTIVE`/`INACTIVE`, but there is no
warehouse-specific stock read or staff assignment action in the Manufacturer warehouse service.
Warehouse operations at `/manufacturer/warehouses/operations` are browser-session state and must
not be treated as operational records.

### 3.4 Distributor purchase-order fulfillment

Manufacturer reads incoming POs and sends a decision. UI status mapping is:

| Backend value seen/assumed by mapper | UI value |
|---|---|
| `APPROVED` | `ACCEPTED` |
| `FULFILLED` | `FULFILLED` |
| `REJECTED` | `REJECTED` |
| Any other/unrecognized status | `PENDING` |

This lossy mapping is not a complete status contract. The service expects `paymentStatus` on the
PO and maps absent/unknown status to unknown payment. Shipment create/status methods block locally
unless the loaded PO is `ACCEPTED` and `paymentStatus === 'PAID'`. The backend must independently
enforce that rule, reserve stock once, validate selected warehouse and vehicle capacity, and
perform shipment/stock transactions atomically.

### 3.5 Shipment, fleet, trips and tracking

Manufacturer creates shipments and updates shipment status. Manufacturer logistics is derived from
shipments and reads drivers/vehicles from the shared fleet routes; there is no independent
Manufacturer `GET /trips` call in that feature service. Ping and reroute-proposal routes are called
but response contracts are untyped. Shipment delivery/receipt by the Distributor has no matching
front-end confirmation call; an API must not infer that Distributor stock increased merely from a
Manufacturer shipment status of `DELIVERED`.

### 3.6 Dashboard, reports, settings, and staff

- Dashboard is computed from PO/product services. Fleet and shipment KPIs are hardcoded to zero or
  empty; pending PO totals are client-side.
- Reports return hardcoded zero metrics, empty series and no warehouses. There are no report API
  calls.
- Settings call the organization and notification preference endpoints; fetch errors are ignored
  and default empty/false values remain in the UI.
- Staff directory/invitation/status calls use `/members`. Driver rows are merged from fleet and
  warehouse assignment is inferred from route-zone text (`Coast` maps to `MBA-C4`, otherwise
  `NBO-A1`). This is not a trustworthy warehouse relationship. Staff assignment must be stored and
  read from an explicit backend association.

## 4. Distributor workspace: complete API specification

### 4.1 Manufacturer catalog, permission and own offers

The catalog reads `/products`, `/stock/items`, `/warehouses`, and `/products/authorizations`.
Published Manufacturer products and Distributor offers are joined client-side using
`sourceStockItemId`/SKU and manufacturer ID. The UI requires authorization status `APPROVED` before
creating an offer; backend must repeat that permission check and verify source product ownership,
warehouse ownership, price, and available stock.

Offer creation sends `sourceStockItemId`, `warehouseId`, `sku`, `sellingPrice`, and
`reorderThreshold`; offer updates permit `sellingPrice`, `reorderThreshold`, and `active`. The UI
does not send quantity in offer creation. Distributor stock must originate from confirmed receipt
or another auditable inventory operation, not from an offer's listing request. Returned offer
records currently lack source description, image, brand, and wholesale price; the UI attempts a
catalog join and otherwise displays blanks. Preserve immutable Manufacturer-owned data server-side.

### 4.2 Supplier procurement, payment and inbound receipt

The Distributor can submit a PO with supplier organization and stock-item quantities. Local checks
require approved listing permission and positive integer quantity. Backend must resolve current
price, supplier/product identity, available inventory, and PO total itself. The frontend does not
send amount, currency, logistics cost, delivery address, warehouse assignment, or idempotency key
for PO creation.

The PO detail can read `/settlements`; this is not trusted proof that payment succeeded. Shared
payment initiation exists, but there is no dedicated supplier-payment status endpoint: the
frontend queries the proposed/used `GET /payments?orderType=PURCHASE_ORDER&orderId={id}`. Payment
state must come from verified backend reconciliation. Procurement marks approved as a UI
processing state, and dispatched/shipped statuses as in transit; it does not expose a distinct
Distributor receipt confirmation API.

### 4.3 Inventory, restock and warehouse operations

Distributor inventory reads stock items and displays `quantityOnHand`, selling `unitPrice`, and
reorder threshold. It does not receive or display separate reserved/available values. Restock
requests send stock item, manufacturer organization, quantity, and optional note; cancellation is
a status patch. No manufacturer-side restock-request list/acceptance service is present in the
audited Manufacturer features; the manufacturer PO workflow is separate. Clarify whether
restock requests remain a distinct business flow or are legacy UI.

Distributor warehouse create/archive uses the shared warehouse endpoints. The Distributor has no
manufacturer-style production UI, but it does have local-only warehouse operations at
`/distributor/warehouses/operations` (receiving, put-away, picking, packing, dispatch, adjustments
and movements). Those operations are not backed by these stock/warehouse endpoints.

### 4.4 Customer directory, customer orders and delivery

Customer directory service holds an empty signal and exposes no API. Customer order retrieval
calls `GET /api/v1/orders`. The order form route exists, but the service deliberately rejects
creation locally; customer order creation is expected to belong to a customer/mobile workflow,
which is outside this Angular Distributor feature.

The service offers status patch and payment initiation/status-check operations. UI blocks
fulfillment status updates unless payment is `PAID`; server must enforce this and valid transitions.
`dispatch()` and `confirmDelivery()` are explicit throwing stubs, not API calls. Distributor
logistics can create/assign/dispatch trips, but no current API contract explicitly links a
customer order to an assigned delivery trip from the order service. Trips and order groups are
associated in UI by order number stored on trip stops.

### 4.5 Dashboard, staff and fleet

Dashboard metrics are derived client-side from fetched orders, stock, POs, fleet, and trips. Data
is capped by the current list fetches and may be incomplete. Staff and fleet are read/written via
the shared `/members`, `/drivers`, and `/vehicles` routes. Distributor employee warehouse display
is joined from driver `baseWarehouseId`, while employee rows are always shown as “Unassigned”;
there is no member-to-warehouse update operation in the current staff service. Driver/vehicle
status mapping and some location values are locally synthesized.

## 5. Shared authentication, users, roles and organization isolation

### Current frontend behavior

- The route guards restore the session and allow Manufacturer organization users with
  `MANUFACTURER_ADMIN` or `MANUFACTURER_STAFF`, and Distributor users with `DISTRIBUTOR_ADMIN` or
  `DISTRIBUTOR_STAFF`. Guard checks are navigation controls only.
- Auth access/refresh tokens are held in browser `sessionStorage`. The auth interceptor attaches
  the bearer token only to requests whose origin/path match the configured API root; refresh is
  excluded. A 401 clears the local user except for `/users/me`, where session restoration handles
  refresh.
- Current `AuthUserResponse` includes a single `role` string and one organization ID/type. The
  frontend normalizes that to a single role. No granular permission matrix is represented.
- Profile display reads the current session object and calls no profile endpoint beyond session
  restoration.

### Backend requirements

1. Authenticate every business request; derive `userId`, organization ID/type, and roles from the
   validated principal. Never trust a body/query organization, party, direction, warehouse owner,
   or customer ID as authorization proof.
2. Apply organization scoping to all reads, list counts, mutations, downloadable documents, and
   nested IDs. Cross-organization IDs must not leak existence or data.
3. Enforce role permissions on the server for access-request review, product publication, listing
   decisions, staff invitations/status, inventory operations, payment visibility, fleet
   assignment, and dispatch. Confirm whether staff/admin roles have equal permissions; Angular
   currently does not distinguish them.
4. Make auth responses and `/users/me` consistently return organization and role claims required
   by the guards; define token rotation/revocation, expiry, activation, recovery, rate limiting,
   and access-request file policy.
5. Keep provider webhook authentication separate from user bearer auth. A frontend status response
   or M-Pesa initiation acknowledgment must never be treated as payment settlement.

## 6. Complete business workflows and state transitions

The following are state values observed in the frontend or proposals needed to make existing UI
actions safe. Any transition not enforced in the backend remains an unresolved dependency.

| Domain | Observed frontend states / transitions | Required server behavior |
|---|---|---|
| Product | `DRAFT`, `PUBLISHED`, `DISCONTINUED` | Validate publication authority and canonical manufacturer ownership; preserve historical references. |
| Listing authorization | `NONE`, `PENDING`, `APPROVED`, `REJECTED`; Manufacturer decision | One active request per distributor/product unless explicitly renewed; audited decisions and server-side purchase/offer authorization. |
| Purchase order | UI `PENDING`, `ACCEPTED`, `REJECTED`, `FULFILLED`; mapper sees `SUBMITTED`, `APPROVED`, `FULFILLED`, `REJECTED` | Define canonical enum and legal transitions. Submitted/accepted is not paid. Reserve stock once; only paid/eligible accepted orders may be picked/packed/dispatched. |
| Payment | UI `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REVERSED`, `REFUNDED`, `UNKNOWN`; transaction `SUCCEEDED` maps to UI `PAID` | Append-only attempts; verified provider result and reconciliation; idempotent callbacks; reversal/refund never count as successful settlement. |
| Shipment | `IN_TRANSIT`, `DELIVERED`, `BORDER_HOLD` | Define lifecycle, who can change it, dispatch and receipt actor, timestamp, manifest, discrepancy handling. Do not auto-receive Distributor inventory based on status alone. |
| Customer order | `PENDING`, `CONFIRMED`, `PROCESSING`, `AWAITING_DISPATCH`, `IN_TRANSIT`, `DELIVERED`, `PARTIALLY_DELIVERED`, `CANCELLED`, `REFUNDED`, `FAILED` plus legacy `PREPARING`, `REROUTED`, `COMPLETED` | Normalize status set; payment prerequisite; reserve/release stock; enforce ordered transitions and link order to trip/delivery. |
| Trip | `SCHEDULED`, `ONGOING`, `COMPLETED`, `DELAYED`, `CANCELLED`; type `RESTOCK`/`DELIVERY` | Validate vehicle/driver availability and organization; dispatch once; record events and track ordered stops. |
| Driver / vehicle | Driver account `INVITED`, `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `INVITATION_EXPIRED`; operational `AVAILABLE`, `ON_TRIP`, `OFF_DUTY`; vehicle status varies by workspace | Use one canonical enum set, enforce assignment exclusivity, prevent suspension/reassignment during active trips. |
| Warehouse | `ACTIVE`, `INACTIVE` | Archive only with no blocking active dependencies; retain historical records. There is no UI hard-delete route. |
| Warehouse operations (local UI) | Receipt `PENDING`→`RECEIVED`; order `AWAITING_PICK`→`PICKING`→`READY_TO_PACK`→`READY_TO_DISPATCH`→`DISPATCHED` | Proposed durable transitions described in section 8; enforce transactions, duplicate prevention, quantities, actor, timestamps, and inventory movement references. |

## 7. Database entities, relationships and persistence requirements

These are entity concepts supported by the Angular models and operations, not claims about existing
database tables. Backend team should map them to current Spring/JPA structures where possible.

| Entity | Required relationship / invariant |
|---|---|
| Organization, User, Membership/Role | User belongs to an organization with server-enforced role(s). Requests/invites, access requests and audit events record the actor and tenant. |
| ManufacturerProduct | Owned by one Manufacturer organization; canonical identity, SKU, description, images/specifications and wholesale price. |
| Warehouse | Owned by one organization. `INACTIVE` preserves history. Product stock/location references must be tenant-consistent. |
| InventoryBalance / InventoryLocation | Unique product + warehouse (+ location where applicable); maintain physical/on-hand, reserved/allocated, and available consistently. Prevent negative balances and stale writes. |
| InventoryMovement | Immutable signed quantity, movement type, SKU/product, warehouse/location, reference type/ID, user, timestamp, reason and idempotency key. Every mutation references an operation/order/receipt/adjustment. |
| ListingAuthorization | Canonical product, requesting Distributor organization, status, request note, decision actor/time/reason. Unique active authorization per product/distributor. |
| DistributorOffer | Distributor-owned commercial values and active state, linked by stable `manufacturerProductId`; never duplicate or mutate Manufacturer-owned fields. |
| PurchaseOrder / PurchaseOrderLine | Buyer Distributor, supplier Manufacturer, canonical product, quantity, server-calculated unit price/total, status, warehouse, reservation, payment and shipment references. |
| PaymentTransaction / ReconciliationEvent | Order/type, payer/payee organizations, amount/currency, provider/reference, lifecycle state, provider callback identity, idempotency key, reconciliation time/result, receipt/failure details. Preserve attempts and reversal/refund history. |
| Shipment / ShipmentLine / Receipt | PO, origin/destination organizations and warehouses, allocated line quantities, driver, vehicle, trip, dispatch timestamp, receipt quantities (accepted/damaged/missing), receiving actor and discrepancy evidence. |
| Customer / CustomerOrder / OrderLine | Customer ownership/organization as relevant, product, quantity, price, destination, payment, stock reservation, trip/shipment, and state. Customer-directory visibility is Distributor-scoped. |
| Driver / Vehicle / Trip / Stop / TrackingPoint | Organization-owned resources; exclusive active driver/vehicle assignment; trip has linked order/PO/shipment references and sequenced stops/tracking events. |
| WarehouseReceipt / PutAway / PickPack / StockAdjustment | Durable operational records with references to incoming shipment or order, accepted/damaged/missing and packed/picked quantities, location, reason, actor, timestamp, and resulting movement rows. |
| NotificationPreference / NotificationDelivery | Organization preference values and delivery outcome/attempt history; current UI only saves Manufacturer preferences. |
| AuditEvent | Actor, tenant, operation, resource, before/after state as appropriate, timestamp, trace/correlation ID, and outcome; do not make immutable ledger data editable through generic CRUD. |

**Concurrency:** Use database transactions and row/version locking or equivalent conditional
updates for stock reservation, receipt, adjustments, payment settlement, pick/pack, and dispatch.
Enforce unique constraints for idempotency keys, provider callback IDs, movement operation
references, active driver/vehicle assignments, and order-to-shipment dispatch where the business
rule requires uniqueness. Use optimistic versioning or compare-and-set to reject stale client
updates.

## 8. Payment, reconciliation, inventory and shipment integrations

### 8.1 Payment initiation and history

The Angular payment contract is detailed in `docs/payment-api-contract.md`. It is a proposal
document, not proof of server implementation. Core contract requirements:

- Initiation derives parties, order total, currency, and eligibility on the server; request may
  contain only order ID/type, provider, and customer phone. Reject client-supplied amount, payee,
  payer, organization, or success status.
- Return an attempt ID/reference and non-final `PENDING` result. Keep timeout distinct from provider
  failure; on timeout, client retries must first be reconciled or use the same idempotency result.
- Manufacturer payment visibility is incoming supplier payment; Distributor sees outgoing
  supplier payments and incoming customer collections. Scope by principal organization, not a
  client `direction`.
- Reconciliation status, provider transaction ID, amount/currency match, receipt number, callback
  timestamp, failure reason, and reconciliation reference must be persisted. Duplicate callbacks
  must be acknowledged without duplicate order or inventory transitions.

### 8.2 M-Pesa provider callback / webhook (proposed; no Angular endpoint)

The callback must be provider-to-backend, signature/credential validated according to provider
requirements, protected from replay, and never exposed as a frontend “mark paid” operation. Store
the raw callback securely with redaction/retention policy, provider event ID, verification
outcome, and processing result. Reconcile amount, currency, merchant/account, order, and payment
reference before recording success. Mismatches go to an exception queue; they must not unblock
fulfillment. Support pending, successful, failed, expired, reversed, and refunded records.
Provider credentials stay in backend secrets management.

### 8.3 Inventory and operational APIs missing from Angular (proposed contracts)

The shared Warehouse Operations service currently applies these operations only in a local
signal-backed ledger. The paths below are **proposals**, not existing route references. They are
based on the implemented UI/model shape and should be aligned with the backend team's existing API
conventions before implementation.

| Proposed operation | Suggested route | Minimum body/data supported by the current UI |
|---|---|---|
| Read balances / movements | `GET /api/v1/warehouses/{warehouseId}/inventory` and `GET /api/v1/warehouses/{warehouseId}/inventory/movements` | Product/SKU, on-hand, allocated, staged, available, location balances; movement ID/type/signed quantity/reference/reason/user/time. Query filtering/pagination is needed. |
| List inbound receipts | `GET /api/v1/warehouses/{warehouseId}/receipts` | Receipt ID/reference, PO/shipment, lines with SKU/product/expected quantity, status. |
| Confirm receipt | `POST /api/v1/warehouses/{warehouseId}/receipts/{receiptId}/confirm` | Line-level accepted, damaged and missing quantities; require total equals expected; optional note. Actor/time from principal. |
| Put away | `POST /api/v1/warehouses/{warehouseId}/put-aways` | SKU/product, location, positive quantity, receipt/reference. User from principal. |
| List eligible picking orders | `GET /api/v1/warehouses/{warehouseId}/picking-orders` | Paid/eligible order lines, requested, allocated and picked quantities and current status. |
| Confirm pick | `POST /api/v1/warehouses/{warehouseId}/orders/{orderId}/picks` | Line ID/SKU and positive picked quantity; reject beyond remaining allocated/available amount. |
| Confirm pack | `POST /api/v1/warehouses/{warehouseId}/orders/{orderId}/packs` | Per-line packed quantities and positive package count; only after full pick. |
| Dispatch packed orders | `POST /api/v1/warehouses/{warehouseId}/dispatches` | Unique order IDs, existing assigned `tripId`, `vehicleId`, `driverId`; server-recorded dispatch timestamp and movement refs. Current local UI requires all three identifiers and responsible user (server should use principal). |
| Adjust inventory | `POST /api/v1/warehouses/{warehouseId}/inventory/adjustments` | SKU/product, signed non-zero integer quantity, required reason, optional reference; actor/time from principal. |

Do not implement this suggested URL set if the Spring application already has equivalent domain
routes. The required behavior and transaction semantics matter more than the path examples. All
mutations must be atomic, tenant-checked, idempotent for retries, and return the persisted order,
balance, and movement identifiers. Receipt confirmation is the only inbound path that adds
accepted quantities; dispatched quantities are deducted once at dispatch; `available` excludes
reservation; picking moves stock to staged and does not release allocation; packing does not
deduct inventory a second time.

### 8.4 Shipment receipt and manufacturer production (missing)

The front end has no distributor shipment-receipt API and no manufacturer production/stock
creation workflow separate from product creation. Backend owners and product stakeholders must
confirm expected endpoints and ownership semantics. Minimum behavior: receipt is linked to a
specific shipment/PO manifest; each line has expected/accepted/damaged/missing quantity; accepted
increases Distributor physical stock only once; discrepancies create auditable movements/claims.
Manufacturer stock is produced/adjusted into a specific Manufacturer warehouse; it must not be
modeled as incoming delivery receipt.

## 9. File uploads, notifications and external integrations

| Integration | Frontend evidence | Backend requirement / gap |
|---|---|---|
| Access request certificates | Multipart `incorporationCertificate` and `taxCertificate` on `POST /api/access-requests`. | Validate type/size, malware scan, private storage, access control, retention, and audit. Exact accepted file formats/limits are not represented in the API model. |
| Product image | Optional multipart `image` on product create/update; response uses one `imageUrl`. | Define accepted formats/size, private/public access policy, replacement and deletion semantics, storage response URL lifecycle. No multi-image upload contract exists in Angular. |
| M-Pesa | Frontend sends provider `MPESA`, order ID/type, phone; displays initiation message and polls/reads status. | Backend provider integration, callback verification, reconciliation and credentials. No frontend callback. |
| Notifications | Manufacturer settings read/write 3 boolean preferences. | Actual email/SMS delivery, subscriptions, attempts, failures and opt-out policy are not implemented in the Angular API integration. |
| Map/tracking | UI consumes trip tracking pings and map coordinates. | Define coordinate validation, timestamp ordering, retention and authorization. Manufacturer logistics does not fetch a separate trip feed. |
| PO PDF / print | Distributor and Manufacturer purchase-order screens render/print a client-side document. | No server PDF generation or file API is called; printed fields reflect current frontend DTO data. |

## 10. API security, validation, error handling and reliability requirements

### Validation

- Validate IDs and tenant ownership for every nested route and relationship.
- Quantities must be finite integers and positive where increasing/picking/packing; adjustment
  quantity is non-zero signed integer. Enforce accepted + damaged + missing = expected.
- Validate price/currency from server-owned catalog/pricing; never accept computed totals as truth.
- Enforce warehouse/product/order consistency, active warehouse status, approved listing permission,
  driver/vehicle availability, order/payment prerequisites, and state transitions server-side.
- Reject stock updates that would make physical stock less than reserved/staged stock or available
  stock negative.
- Define validation error field paths and return no partial writes on failure.

### Idempotency, transactionality, auditability

- Require `Idempotency-Key` for business mutations that can be retried: payment initiation,
  purchase-order submission, receipt confirmation, stock adjustment, dispatch, and provider
  callback processing. Persist scope + key + result; duplicate requests return the original result.
- Perform order status, reservation/balance, payment state, shipment/trip assignment, and movement
  writes in a transaction or a recoverable outbox/saga with explicit compensation.
- Ensure one successful payment settlement and one dispatch deduction per order/manifest. Uniquely
  identify each stock movement by operation reference. Avoid “read then write” race conditions.
- Keep immutable audit/movement records with authenticated actor and UTC timestamp. Do not rely on
  `user` strings sent by the browser.
- Use correlation IDs for requests and logs; redact secrets, access tokens, provider credentials,
  and sensitive payment data.

### HTTP errors (proposed common envelope; confirm backend conventions)

The frontend often displays `error.error.message`; some services discard error details and show
generic messages. Standardize a stable shape such as:

```json
{
  "code": "INSUFFICIENT_AVAILABLE_STOCK",
  "message": "Requested quantity exceeds available stock.",
  "fieldErrors": [],
  "correlationId": "request-id"
}
```

Use `400` for malformed/invalid transition input, `401` unauthenticated, `403` forbidden,
`404` absent or inaccessible resource (avoid cross-tenant existence leaks), `409` stale version,
duplicate business operation or state conflict, `422` domain validation where adopted, `429` rate
limit, and `5xx` for unexpected dependency/server failures. Do not return `200` with a
success-shaped fallback on failed persistence. Payment provider unavailability must preserve
pending/unknown state and provide a safe status-reconciliation path.

## 11. Missing, incomplete and ambiguous requirements requiring confirmation

1. **Server truth:** No Spring Boot source or server contract was present in the inspected project.
   All API references in section 2 are unverified, not confirmed operational endpoints.
2. **API root split:** Confirm whether stock/audit/restock routes intentionally use `/api/...` while
   most other routes use `/api/v1/...`.
3. **Product schema:** Current product model has a single image URL and no specifications schema,
   manufacturer warehouse relation, or multiple image representation. Confirm canonical product
   identity and stable IDs, spec types, wholesale-price precision/currency, and stock creation.
4. **Stock model:** Confirm warehouse-level balances, `quantityOnHand` vs available/reserved/staged,
   `reorderThreshold`, and whether stock endpoints return one row per product, warehouse, or offer.
5. **PO contract:** Status values vary between UI and API mapper. Confirm exact enum, payment
   prerequisite ordering, reservation timing/release on rejection/cancellation, PO idempotency and
   who can accept/reject.
6. **Restock requests:** There is a Distributor create/list/cancel flow but no corresponding
   Manufacturer fulfillment/decision UI. Confirm whether this is supported, legacy, or separate
   from purchase orders.
7. **Payment:** Confirm whether `/payments`, `/payments/initiate`, and the order-status route are
   deployed; history status semantics, supplier payment reconciliation source, callback security,
   support for multiple attempts/refunds, and whether `settlements` has an authoritative source.
8. **Customer orders:** Customer creation is external to this workspace and throws in the
   Distributor service. Confirm the customer/mobile API and which customer/order data Distributor
   users may read.
9. **Distributor shipment receipt:** No frontend API/action to accept a supplier shipment exists.
   Confirm receipt/discrepancy workflow and whether the distributor inventory must update on
   receipt confirmation rather than shipment delivery.
10. **Warehouse operations:** Receiving, put-away, picking, packing, dispatch, adjustment, and
    movement state are only in a route-scoped in-memory service. Their durable endpoint and
    integration with actual PO/order/trip services remain unimplemented.
11. **Trip/order linkage:** Distributor trip stops include optional `orderId`; the order service
    joins by order number. Confirm authoritative relationship, dispatch owner, delivery proof, and
    how Manufacturer shipment trips relate to shared trips.
12. **Role matrix:** Guards only distinguish workspace roles. Confirm which admin/staff actions
    may invite, adjust stock, reconcile payments, approve listing requests, and dispatch.
13. **Warehouse archive rules:** UI uses `PATCH status`; confirm server dependency checks, archival
    semantics and whether warehouse staff/product assignments are retained.
14. **Staff / driver assignment:** Manufacturer driver-to-warehouse display uses hardcoded
    route-zone mappings; Distributor member employee rows show no warehouse assignment. Confirm
    canonical assignment entities and APIs.
15. **Reports and dashboard:** Manufacturer report data is all zero/empty; KPIs are partly
    client-derived from capped lists. Confirm desired time zone, definitions, aggregation,
    pagination, and whether server aggregation endpoints are required.
16. **Search and paging:** Current UI mostly searches/filters fetched lists in memory and requests
    up to 100 records. Confirm page-number/cursor convention, sort format, maximum page size, and
    whether server-side search is required.
17. **Notifications:** Only Manufacturer preferences are represented; Distributor preferences,
    delivery tracking, and notification content are unspecified.
18. **Vehicle/trip enums:** Manufacturer and Distributor use different vehicle/status mappings;
    agree canonical API values and compatibility mapping before enforcing transition validation.
19. **Access request and uploads:** Confirm file limits, supported formats, retention, and document
    access rules.
20. **Customer directory:** The route is present but service has no backend call. Confirm the
    source and fields for distributor-scoped customers.

## 12. Complete API implementation checklist mapped to frontend features

### Referenced route implementation / verification

- [ ] Confirm and integration-test each of the 68 frontend method/route references in section 2;
      document current server version, authentication, authorization, payload, response and error
      behavior for each.
- [ ] Resolve `/api` versus `/api/v1` route-root inconsistency.
- [ ] Keep auth routes and token contract compatible with current auth interceptor and guards;
      verify `useMockAuth=false` against the real environment.
- [ ] Define consistent page response and query semantics; support or document each `size=100`
      consumer and any client-side truncation consequences.
- [ ] Make product, stock, catalog, authorization, warehouse, member, fleet, PO, settlement,
      shipment, order, trip, payment, and settings DTOs explicit OpenAPI schemas.
- [ ] Verify image/certificate multipart requests and file response lifecycle.
- [ ] Verify all PO/payment/shipment/order/trip and stock mutation preconditions on the server.

### Missing backend capability / frontend integration

- [ ] Add durable per-warehouse stock, location, reservation, movement and adjustment operations.
- [ ] Add warehouse receipt confirmation with line-level accepted/damaged/missing and idempotency.
- [ ] Add put-away and storage-location listing.
- [ ] Add picking allocation, pick confirmation, packing/package count and ready-to-dispatch
      transition.
- [ ] Add dispatch transaction linked to existing trip, assigned driver and vehicle; deduct once.
- [ ] Add Distributor shipment receipt/confirmation and accepted stock posting.
- [ ] Add provider-verified M-Pesa callback/reconciliation and authoritative supplier payment status.
- [ ] Implement or document customer directory and customer order create/dispatch/delivery surfaces;
      do not treat current throwing stubs as working actions.
- [ ] Add manufacturer production/stock additions and explicit product-to-warehouse assignment if
      those workflows are required.
- [ ] Decide whether restock requests are supported and implement the Manufacturer-side action or
      remove/replace that flow intentionally.
- [ ] Add dashboard/report aggregation only after KPI definitions and paging/time-zone rules are
      confirmed.
- [ ] Add notification delivery and event history if operationally required.
- [ ] Replace hardcoded driver/warehouse and synthesized location/metrics with persisted data.

### Reliability, tenancy and acceptance

- [ ] Enforce organization and role ownership for every read and write, independently of Angular
      guards/buttons.
- [ ] Enforce quantity, status, relationship, payment, and warehouse dependency validation.
- [ ] Add idempotency, transactions/locking, immutable audit/movement history and conflict behavior.
- [ ] Test cross-tenant access, duplicate payment callback/initiation, duplicate receipt/dispatch,
      simultaneous stock reservation, negative-stock prevention, invalid transitions, archived
      warehouse dependencies, and compensation after dependency failure.
- [ ] Verify that failure responses leave no partial order/payment/inventory/shipment writes.
- [ ] Publish the final server OpenAPI document from the implemented Spring contracts and reconcile
      it with this frontend handoff before release.

## Audit conclusion

The Angular source makes **68 distinct method/route-template references**; this document inventories
them and maps all routed Manufacturer, Distributor, and shared feature families to their current
integration status. It also identifies the local-only warehouse ledger, missing supplier receipt,
customer-directory/order actions, reporting gaps, and backend-proposed operational/payment behavior.

This is a comprehensive **frontend expectation and gap specification**, not proof that the server
implements those 68 operations, and not a claim that unresolved product, payment, receipt,
authorization, role, and workflow questions can be implemented without confirmation. Backend
owners must resolve section 11 and verify deployed contracts before treating this as a final
server-side contract.
