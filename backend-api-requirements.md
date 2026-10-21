# Frontend API integration status and remaining requirements

**Updated:** 2026-10-21  
**Scope:** Angular manufacturer and distributor workspaces compared with the backend source in `src backend/main/java/com/example/distrobackend/controller`. Authentication is already integrated. This file records what the frontend calls today, what can be tested, and what remains to connect or request from the backend team.

**Route organization:** `src/app/core/api/api.config.ts` contains only backend base URLs. `src/app/core/api/api-endpoints.ts` is the centralized route registry grouped by auth, manufacturer, and distributor. Feature services contain HTTP behavior and response mapping; they should use `API_ENDPOINTS` rather than construct route paths themselves.

## Summary

The Angular app has live calls for manufacturer products and stock, manufacturer purchase-order review, distributor supplier catalog and procurement, distributor catalog offers, warehouse selection/creation, inventory restock requests, distributor inventory, customer orders and M-Pesa payment, and distributor trips/tracking. Purchase orders are shared through the backend: distributor creation persists under `/api/v1/purchase-orders`, and the manufacturer queue reads the same records under `/api/v1/manufacturer/purchase-orders`.

The manufacturer UI may be feature-complete as screens, but most of its staff, warehouse, fleet, shipment, reports, and settings services are not connected to backend endpoints. The distributor UI is still in progress. Its procurement, offer management, warehouse selection, restock, order/payment, and trip-list/tracking paths now call available backend APIs. Customer directory, vehicle/driver data, order-to-trip dispatch, and purchase-order shipment tracking still need backend support or additional wiring.

A live call in code does not guarantee a successful environment test: requests need a valid logged-in user with an organization and the matching role, backend data, a reachable configured API host, and CORS access.

## Status definitions

- **Wired:** Angular makes the request to a backend route with the expected request shape.
- **Partial:** Some operations are live, but important screen fields, lifecycle actions, or response details are still missing.
- **Not wired:** The screen/service does not call a live endpoint.
- **Backend gap/mismatch:** No matching endpoint exists in the supplied backend, or its role/contract does not support the current screen.

## Features wired to live APIs and ready for testing

### Shared authentication

Authentication requests are in `src/app/core/auth/auth-api.service.ts` and use the `/api/auth`, `/api/access-requests`, and `/api/users/me` routes. Login/session, refresh/logout, activation, access request, resend verification, forgot/reset password, and current-user lookup are wired. See the auth service for the exact request fields.

### Manufacturer workspace

| Feature | Live API calls | What can be tested now | Status/limits |
|---|---|---|---|
| Product list and create | `GET /api/stock/items?size=100`; `POST /api/stock/items` | Load organization stock and create a stock item | Partial: product detail/edit, unit/brand/description/image, and movement history are not connected. |
| Inventory center | `GET /api/stock/items?size=100` | Load on-hand, category, reorder threshold; reserved/available values are derived from backend stock fields | Partial: UI presents a single organization terminal; no warehouse-specific selector/data or audit workflow. |
| Incoming distributor purchase orders | `GET /api/v1/manufacturer/purchase-orders`; `PATCH /api/v1/manufacturer/purchase-orders/{id}/decision` | View submitted distributor orders and approve/reject them; frontend maps `ACCEPTED` to backend `APPROVED` | Partial: names display organization IDs; no fulfillment/dispatch action or full status timeline. |

### Distributor workspace

| Feature | Live API calls | What can be tested now | Status/limits |
|---|---|---|---|
| Supplier catalog for procurement | `GET /api/v1/products?size=100` | Load active products visible to the logged-in distributor, grouped by manufacturer organization | Partial: supplier name/location, product unit/description, and accurate available quantity are not supplied by the UI mapping. |
| Procurement purchase orders | `GET /api/v1/purchase-orders`; `GET /api/v1/purchase-orders/{id}`; `GET /api/v1/purchase-orders/{id}/settlements`; `POST /api/v1/purchase-orders` | Create an order against a manufacturer product and see the distributor's persisted orders | Partial: no cancel/amend action, expected delivery, destination, shipment details, or realtime updates. Refresh/reopen the manufacturer queue to see the new order. |
| Distributor inventory and restocking | `GET /api/stock/items?size=100`; `GET/POST /api/stock/restock-request`; `PATCH /api/stock/restock-request/{id}/status` | Load stock, request replenishment for a linked manufacturer offer, and cancel a pending request | Partial: no warehouse-level balances or movement history. |
| Customer orders and payments | `GET /api/v1/orders`; `PATCH /api/v1/orders/{id}/status`; `POST /api/v1/payments/initiate`; `GET /api/v1/payments/{orderId}/status`; `GET /api/stock/items/{id}` | Load orders, enrich line labels from stock, update supported statuses, and initiate/poll M-Pesa payment | Partial: customer directory, creation by distributor, trip dispatch, and delivery proof remain unavailable. |
| Distributor catalog offers and warehouses | `GET /api/v1/products`; `GET /api/stock/items`; `POST/PATCH /api/stock/offers`; `GET/POST /api/v1/warehouses` | Browse supplier products, list/create/pause/resume distributor offers, and choose/create a distributor warehouse | Partial: MOQ, notes, supplier names, and warehouse inventory totals are not provided by these DTOs. |
| Trips and tracking | `GET /api/v1/trips`; `GET /api/v1/trips/{id}/tracking`; `PATCH /api/v1/trips/{id}/status` | View organization trips, route stops/location pings, start scheduled trips, and complete ongoing trips | Partial: no vehicle/driver directory or trip-to-purchase-order association; create/assign actions are service-only pending a usable screen and rider directory. |

### Cross-workspace purchase flow to test

1. Sign in as a manufacturer organization and create an active stock item with stock available.
2. Sign in as the distributor and open procurement. Confirm the manufacturer's active product appears.
3. Submit a purchase order with one or more lines.
4. Sign in as the manufacturer and refresh/open the purchase-order queue. The order should appear there because it is stored by the shared backend, not copied between browser workspaces.
5. Approve or reject the order. Sign in as the distributor and refresh procurement to see the updated status.

This is a request/refresh workflow. The current UI does not use push updates to refresh the other workspace immediately.

## Manufacturer features not wired or incomplete

### Products and stock detail

Backend routes exist for additional operations, but Angular does not call them yet:

- `GET /api/stock/items/{id}` for item detail.
- `PATCH /api/stock/items/{id}` or the product catalog `PUT /api/v1/products/{id}` for edits.
- `GET /api/stock/items/{id}/movements` and `POST /api/stock/items/{id}/movements` for stock history/adjustments.
- `GET /api/stock/items/low-stock` for a server-filtered low-stock list.
- Product catalog routes under `/api/v1/products` include categories, detail, inventory, and status update. The frontend product service still uses stock item routes and does not expose those operations.

Connect item detail/edit and movement history to the product details screen. Confirm which of the two product/stock route families is canonical before building more UI around both.

### Purchase-order detail and fulfillment

Backend provides `GET /api/v1/manufacturer/purchase-orders/{id}` and `GET .../{id}/settlements`; the manufacturer screen currently loads the queue and decision action only. Add detail/settlement reads if the review screen requires them. The backend currently exposes no distinct manufacturer shipment/fulfillment endpoint in the supplied controller.

### Inventory audit and warehouse breakdown

The frontend audit button is unsupported. There is no stock-audit endpoint in the supplied backend. Manufacturer inventory is currently shown as one organization-level terminal. `GET/POST /api/v1/warehouses` exists, but `WarehouseController` only permits distributor roles for listing/creation; manufacturer users cannot use it under the current authorization rules. To support the manufacturer warehouse UI, backend access rules and warehouse inventory/detail APIs need to be defined.

### Staff and invitations

Angular staff/employee services are local-only. Backend has organization member and invitation routes:

- `GET /api/v1/organization/members`
- `PATCH /api/v1/organization/members/{userId}/status`
- `GET/POST /api/v1/organization/invitations`
- `DELETE /api/v1/organization/invitations/{invitationId}`

Wire the directory and invite actions to these routes; confirm whether driver profiles should appear in the same directory or a future fleet route.

### Fleet, shipments, and logistics

Manufacturer fleet and shipment services are local-only. No vehicle/driver CRUD or shipment controller is present in the supplied backend. Backend does have `/api/v1/trips` list/detail/create, assignment, status, and location/tracking routes. These are trip resources rather than a complete shipment/fleet API; Angular currently does not call them.

To complete these screens, either connect appropriate trip use cases and define how they relate to purchase-order fulfillment, or add the missing driver/vehicle/shipment resources, including assignments, stops, delivery confirmation, and shipment status.

### Dashboard, reports, and settings

- Backend `GET /api/organization/dashboard` returns organization-level counts (members, stock items, orders, payments, trips); the manufacturer dashboard does not call it. It does not provide the detailed fleet, shipment, delivery, or value metrics shown by the screen.
- Manufacturer dashboard currently derives pending purchase-order values locally and returns zero for shipment/fleet/delivery metrics.
- Manufacturer report service is not connected. Backend report routes are under `/api/v1/reports/*` and `/api/v1/analytics*` in the admin controller, which is restricted to `SUPER_ADMIN`; they are not suitable for manufacturer users without a role/tenant-scoped API.
- Manufacturer settings service is not connected. `/api/v1/settings` is an admin settings route, not an organization profile/settings API.

Define tenant-scoped dashboard/report endpoints and organization profile/settings routes or adjust backend authorization and response contracts before wiring these screens.

## Distributor features not wired or incomplete

### Catalog offer management

Catalog offer management is partially wired. Angular reads manufacturer products from `/api/v1/products`, this distributor's offers from `/api/stock/items`, creates offers through `POST /api/stock/offers`, and pauses/resumes them through `PATCH /api/stock/offers/{id}`. It reads warehouses from `/api/v1/warehouses` and supports initial warehouse creation through `POST /api/v1/warehouses`. The form sends `sourceStockItemId`, `warehouseId`, `sku`, `sellingPrice`, and `reorderThreshold`. MOQ, notes, brand/unit, and manufacturer display name are not available in the backend contract. Warehouse creation requires `DISTRIBUTOR_ADMIN`.
### Customers

The distributor customer directory remains unwired, and there is no customer directory controller in the supplied backend. Add tenant-scoped customer list/detail/create/update routes if this feature is in scope. Customer order responses currently include customer IDs, but the directory needs display/contact fields.

### Fleet, trips, and inbound purchase-order tracking

Distributor trip support is partially wired. Angular reads `/api/v1/trips`, loads a selected trip's `/tracking` locations, updates scheduled trips to ongoing and ongoing trips to completed, and groups DELIVERY trips with customer orders when stop `orderNumber` matches. The API service also supports create and driver assignment, but the screen does not expose those actions because no vehicle/driver directory is available to select an assignment. No vehicle/driver directory endpoints, manufacturer shipment resource, inbound receipt endpoint, or purchase-order tracking link is supplied. A RESTOCK or DELIVERY trip cannot currently be reliably associated with a distributor purchase order.

### Distributor dashboard

Dashboard counts now derive from live orders, procurement orders, inventory, and trip APIs where those sources are available. Driver/vehicle fields remain empty because no fleet directory exists. The backend `GET /api/organization/dashboard` is still not called and returns only coarse counts; an aggregate route is needed for paid orders, delivery performance, and fleet metrics.

### Payment workflow

M-Pesa payment initiation and status lookup are wired from distributor order details: `POST /api/v1/payments/initiate` and `GET /api/v1/payments/{orderId}/status`. The UI accepts a Kenyan mobile number, requests an STK prompt, polls for confirmation, and reflects the current payment status for the session. Payment history/list and payment detail routes remain unused.

## Backend routes and operations still not fully integrated

Still not called include customer-directory CRUD, vehicle/driver list and assignment discovery, shipment creation/receipt, purchase-order tracking linked to trips, warehouse inventory breakdown, stock movement history, trip create/assignment UI, payment history/detail, organization notifications, member/invitation management, and organization-specific reports/settings. The backend lacks several of these routes; others exist but are not yet connected to a screen. Check controller role rules before expanding access; some routes are admin-only or role-limited.

## Shared integration checks

1. **API host and route prefix:** `API_CONFIG` currently has both `apiRoot` (`/api`) and `baseUrl` (`/api/v1`). Calls use both because the backend exposes both route families. Keep them aligned with the configured backend host.
2. **Tenant scoping:** Stock, orders, and purchase orders derive organization scope from the authenticated user. Test with the correct organization role; do not send another tenant's ID to bypass scope.
3. **Pagination:** Spring endpoints return page envelopes. The wired procurement and purchase-order services accept a page `content` field and an array; other services may expect only `content`. Confirm page size and total behavior for larger test data.
4. **Status enums:** Purchase-order UI `ACCEPTED` maps to backend `APPROVED`. Order and trip transitions are restricted by backend state rules.
5. **Cross-workspace refresh:** The shared PO lifecycle is server-persisted but currently refresh-based, not realtime.
6. **Test identities and data:** Use one manufacturer and one distributor with active stock in the manufacturer organization. The distributor catalog and PO create call require that stock to be visible and available.
7. **Not yet integrated:** WebSockets/push notifications, stock audit, shipment fulfillment, and organization-specific reports/settings are not implemented as live Angular calls.

## Frontend files with live API calls

- Auth: `src/app/core/auth/auth-api.service.ts`, `src/app/core/auth/auth.service.ts`
- Manufacturer: `src/app/features/manufacturer/products/product.service.ts`, `src/app/features/manufacturer/inventory/inventory.service.ts`, `src/app/features/manufacturer/purchase-orders/purchase-order.service.ts`
- Distributor: `src/app/features/distributor/procurement/procurement.service.ts`, `src/app/features/distributor/procurement/pages/purchase-order-details.component.ts`, `src/app/features/distributor/inventory/inventory.service.ts`, `src/app/features/distributor/orders/order.service.ts`, `src/app/features/distributor/orders/pages/order-details.component.ts`, `src/app/features/distributor/catalog/catalog.service.ts`, `src/app/features/distributor/logistics/trip.service.ts`, `src/app/features/distributor/logistics/pages/distributor-logistics.component.ts`

Other services under `src/app/features/manufacturer` and `src/app/features/distributor` should be treated as local/placeholder unless they contain an explicit HTTP request.




