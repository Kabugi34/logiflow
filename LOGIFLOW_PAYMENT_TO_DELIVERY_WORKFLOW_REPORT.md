# Payment-to-delivery workflow audit

## Scope and source documents

This change is frontend-only. The pasted task names
`LOGIFLOW_MANUFACTURER_DISTRIBUTOR_API_INTEGRATION_GUIDE.md`, but that guide is not present in
this checkout. The available references are `docs/LOGIFLOW_FINAL_BACKEND_API_SPECIFICATION.md`,
`docs/payment-api-contract.md`, and `docs/product-inventory-order-api-contract.md`. These are
frontend observations and handoff contracts; they do not verify deployed backend behavior.

## Connected behavior

- Distributor centralized checkout requires a destination warehouse for each supplier order and
  sends its `destinationWarehouseId` in the checkout request.
- Manufacturer purchase-order mapping now reads the existing `destinationWarehouseId` response
  field. The purchase-order detail and paid-order warehouse queue display that destination and the
  receiving Distributor organization. When the PO API omits the destination, the UI says it is
  unavailable instead of implying that a destination was saved.
- Manufacturer shipment allocation pre-fills and locks the PO's destination. If the API did not
  return it, allocation is blocked and the UI explains that the PO API must return the checkout
  destination; the Manufacturer cannot substitute a different warehouse.
- Manufacturer payment verification continues to use the backend transaction read for the specific
  PO. Only a verified successful transaction maps to `PAID` and unlocks the warehouse queue. The PO
  detail shows the server-reported amount, currency, provider/mode, and transaction reference when
  that transaction exists. No initiation response or client-side action marks an order paid.
- The manufacturer can allocate an existing shipment for an accepted, paid PO and dispatch it using
  the existing shipment status API. Failed API calls do not mark dispatch successful.

## Remaining backend/API gaps

- The PO API must persist and return the Distributor-selected `destinationWarehouseId` on the
  Manufacturer PO endpoint. The checkout response already models it, but an authenticated backend
  response has not been verified. A warehouse name/address is also not currently in the PO DTO, so
  the UI identifies the destination by warehouse ID.
- The Manufacturer warehouse pick/pack endpoints currently support Distributor customer orders,
  not Manufacturer purchase-order lines. PO item IDs and paid-PO pick/pack state are not modeled
  sufficiently for those operations. The manufacturer UI does not simulate those actions.
- The existing shipment create payload carries PO ID, destination, and carrier. It has no confirmed
  line quantities, trip association, or driver/vehicle assignment fields. Trip assignment exists as
  a separate integration, but this frontend does not have a confirmed shipment-to-trip contract for
  linking the two. Shipment views cannot reliably derive trip driver/vehicle or live location from
  the PO shipment.
- No confirmed Distributor receipt/acceptance API exists for supplier shipments. A Manufacturer
  shipment delivery state is not proof that stock was received by the Distributor. No distributor
  inventory receipt or discrepancy is fabricated.
- OTP delivery confirmation and shipment-to-driver completion are not connected to the Manufacturer
  PO shipment. A supplier PO delivered to a Distributor is not treated as fulfillment of a
  Distributor customer order.
- Payment transaction history, PO payment reconciliation and shipment enforcement remain
  backend-owned and require authenticated integration validation. The source guide's requested
  end-to-end backend confirmation cannot be claimed from the frontend repository alone.

## Verification

- `npm.cmd test -- --watch=false`: 16 test files passed, 56 tests passed.
- `npm.cmd run build`: succeeded. Angular reported the existing CommonJS optimization warning for
  Leaflet; deployed API behavior was not exercised.
