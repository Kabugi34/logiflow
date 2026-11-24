# Customer application reseller catalogue integration prompt

The customer storefront source was not found in `C:\logiflow`. Keep customer catalogue pages in the separate customer application. The current backend supports catalogue search/detail/image retrieval, but not reseller-listing checkout or purchase flows.

Copy-ready prompt:

```text
Integrate the existing LogiFlow canonical reseller catalogue into this customer application. First inspect this application's current Angular architecture, authentication, routing, API client, design system, pagination and image handling. Preserve its conventions. The customer storefront source is separate from the LogiFlow Manufacturer/Distributor workspace.

Backend contracts confirmed from C:\DISTRO-BACKEND\docs\LOGIFLOW_CANONICAL_RESELLER_API.md and the actual CustomerResellerCatalogController / ResellerListingResponse:

- Authenticated role: CUSTOMER.
- GET /api/v1/customer/catalog/reseller-listings
- Query parameters: search (string), category (string), brand (string), distributorOrganizationId (UUID, optional seller filter), availableOnly (boolean, default false), page (Spring Data zero-based page), size (default 20), and sort (Spring Pageable syntax).
- Response: Spring Page<ResellerListingResponse>, with content, totalElements, totalPages, number, size and pageable metadata as returned by the backend.
- GET /api/v1/customer/catalog/reseller-listings/{id} returns one visible ACTIVE listing with a published and active canonical product.
- GET /api/v1/customer/catalog/reseller-listings/{id}/image returns image bytes for an active visible listing. Use the listing ID for this route.
- ResellerListingResponse fields: id (reseller listing ID), distributorOrganizationId, manufacturerProductId (canonical Manufacturer product ID), retailPrice, currency, status, quantityOnHand, reservedQuantity, availableQuantity, availability, productName, description, imageUrl, brand, category, unit, manufacturerName, distributorName.

Implement customer-facing browse, search/filter, pagination, listing detail and product image retrieval only. Display inherited Manufacturer image/name/description/brand/category/unit with the Distributor/store identity, retail price and backend availability. Keep the three IDs distinct in TypeScript models and templates: id is the reseller listing, manufacturerProductId is canonical product identity, distributorOrganizationId is the seller. Include out-of-stock listings by default; the availability filter should use availableOnly. Clearly label OUT_OF_STOCK and do not imply that payment or receipt happened.

Do not implement or advertise reseller-based cart submission, customer checkout, payment, order creation, inventory reservation, order fulfillment or delivery from reseller listings. The backend explicitly does not support those commerce operations yet. Do not call legacy /api/v1/orders and assume it accepts resellerListingId. Keep existing customer order flows only where they are already supported and clearly distinct from reseller browsing.

The Manufacturer product attributes field is not present in the current ResellerListingResponse. Do not invent or scrape attributes; render only contract-backed fields. If the app needs structured attributes, report the missing API field and wait for an approved backend contract.

Add tests for query serialization, seller/category/brand/availability filters, zero-based pagination, correct distinction of listing/product/seller IDs, image route construction, out-of-stock rendering, empty/loading/error states and preventing any unsupported checkout/order submission. Verify with this application's actual test/build commands and report results.
```
