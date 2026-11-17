# Distributor Master Catalog: Backend Requirements

## Frontend integration

The Distributor Master Catalog currently requests:

- `GET /api/v1/products?size=100` for published canonical products.
- `GET /api/v1/products/authorizations` for distributor-specific authorization states.

It displays only canonical products with `publicationStatus: "PUBLISHED"` and a manufacturer organization ID (`manufacturerOrganizationId` or `organizationId`), and excludes stock-item/offer records identified by `sourceStockItemId`. Search matches product name, SKU, and manufacturer name in the returned product rows. The manufacturer filter is derived from these published product rows.

The current frontend derives its manufacturer filter from the manufacturers attached to returned published products. This avoids calling `/api/v1/distributor/catalog/manufacturers`, which is not registered in the current backend and returns 404. Consequently, manufacturers with no published products are not listed until that endpoint is implemented.

## Why products may not be discoverable

The Angular repository contains no backend implementation to verify. The existing API specification notes that the products endpoint does not guarantee a stable manufacturer/product relationship. Likely blockers are backend-side: distributor requests may be scoped to their own organization, published products may not be shared across organizations, manufacturer IDs/names may be missing, or results may be limited to the first 100. The manufacturer create flow already sends `publicationStatus: "PUBLISHED"`; cross-organization visibility must be provided by the backend.

## Required product listing behavior

Keep the existing `GET /api/v1/products` route and apply role-aware visibility:

- Manufacturer users receive products belonging to their own organization, including drafts and discontinued products needed for management.
- Distributor users receive published canonical products from all eligible manufacturer organizations, not just products belonging to the distributor.
- Never return drafts or discontinued products to distributors.
- Do not require a Distributor offer or non-zero stock item for discoverability. Availability is data; published products with zero or unknown stock remain browseable.
- Do not return products or stock belonging to unrelated distributors.

Support deterministic pagination and server-side catalog search/filter parameters: `page`, `size`, `search`, and `manufacturerId`. Search should match product name, SKU, and manufacturer display name case-insensitively. Return a stable page shape such as:

```json
{
  "content": [],
  "totalElements": 0,
  "totalPages": 0,
  "number": 0,
  "size": 20
}
```

Do not silently cap the catalog at the first 100 products. Current client-side search is limited to products returned by the API; server-side search is necessary for complete discovery beyond one page.

For each visible product, return the existing array/page shape with at least:

| Field | Requirement |
|---|---|
| `id` | Stable canonical product ID used for authorization requests. |
| `sku`, `name` | Product identity and search fields. |
| `manufacturerOrganizationId` (or `organizationId`) | Stable owning manufacturer ID; never null or blank for catalog products. |
| `manufacturerName` | Public display name of the owning manufacturer; do not return a generic `"Manufacturer"` placeholder. |
| `publicationStatus` | `"PUBLISHED"` for every product returned to a distributor. |
| `sourceStockItemId` | Omit or return null for canonical products. |
| `category`, `brand`, `unit`, `description`, `imageUrl` | Return when present for catalog display. |
| `unitPrice` | Authorized wholesale price, or null when it is not yet disclosable. |
| `availableQuantity`, `inStock` | Current availability when supported; zero/unknown availability must not hide a published product. |

## Required manufacturer directory endpoint

Optionally implement `GET /api/v1/distributor/catalog/manufacturers` to include eligible manufacturer organizations that do not yet have published products. Require an authenticated Distributor principal and return only active/eligible manufacturer organizations. The frontend no longer calls this endpoint while it is unavailable.

Response may be an array or a page with `content`:

```json
[
  { "id": "manufacturer-org-123", "name": "Acme Manufacturing" }
]
```

`id` is the stable organization ID used to filter products; `name` is its public display name. Include eligible manufacturers even if they have no published products. Do not include private contact, member, or account data.

## Authorization workflow

Keep the existing listing-permission flow:

- `GET /api/v1/products/authorizations` returns the signed-in distributor's requests and statuses.
- `POST /api/v1/products/{productId}/authorization-requests` accepts `{ "requestNote": "..." }`.
- Manufacturer approval changes the request status; it does not transfer product ownership.
- Only an approved distributor may create a catalog offer from the canonical manufacturer product/source stock.

Return normal HTTP errors for unauthenticated/forbidden access, invalid filters, and unknown product IDs. Enforce organization and role checks on the server; do not rely on client-side filtering as authorization.

## Acceptance criteria

1. A manufacturer creates a product with `publicationStatus: "PUBLISHED"`; it appears once in Distributor product results without creating a distributor stock offer.
2. The response includes the canonical product ID and the owning manufacturer's stable ID and public name.
3. Draft and discontinued products are absent from Distributor results but remain visible to the owning manufacturer as appropriate.
4. A Distributor sees eligible manufacturers even when they have no published products, can filter by manufacturer, and can search product/manufacturer name or SKU.
5. Pagination and search return all matching products, not just the first 100.
6. A Distributor can request authorization using the returned canonical product ID; one distributor's authorization state is not exposed to another.
7. Unauthenticated users and users without the Distributor role cannot access the directory; the backend enforces role and organization access independently of the UI.

## Implementation note

The frontend now consumes the directory route above. The backend must implement it for the manufacturer selector to populate; until deployment, the catalog reports a directory load error instead of silently showing an incomplete list. No backend source was present in the Angular repository to change or validate.
