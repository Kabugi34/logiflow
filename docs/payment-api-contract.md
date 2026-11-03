# Logiflow Payments API Contract

**Status:** Frontend/backend handoff. This document distinguishes routes already referenced by
the Angular application from proposed contracts that still require backend implementation and
confirmation. Frontend navigation or a successful initiation response is not payment evidence.

## Existing frontend integration

The current frontend references:

| Method and route                               | Current use                                                                | Confirmed limitation                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/payments/initiate`               | Starts a customer-order payment attempt with an order ID and phone number. | The current request/response contract does not establish supplier purchase payments, idempotency, provider state, or verified settlement. |
| `GET /api/v1/payments/{orderId}/status`        | Reads payment status for a distributor customer order.                     | The response is order-scoped and does not provide a complete transaction history or all reconciliation metadata.                          |
| `GET /api/v1/purchase-orders/{id}/settlements` | Distributor purchase-order detail screen currently shows settlement rows.  | Settlement status is ambiguous and must not be interpreted as provider-verified payment.                                                  |

These are frontend route references, not verification that the deployed backend supports every
behavior described below. The shared UI calls the customer-order status route for customer
payments. Payment history and the expanded supplier-payment behavior below are proposed backend
contracts and will report an API error until implemented.

## Organization workflows

### Distributor pays manufacturer for a stock purchase

1. The distributor submits a purchase order after the existing listing-permission checks.
2. The manufacturer accepts or rejects the order. Acceptance alone is not payment confirmation
   and does not permit picking, packing, or dispatch.
3. An authorized distributor admin or staff member initiates an M-Pesa payment against the
   accepted purchase order.
4. The backend creates or returns one pending payment attempt and starts provider checkout.
5. Only a verified provider callback/reconciliation changes the payment state to `SUCCEEDED`.
   The manufacturer may fulfill only after its order data reports this server-confirmed state.
6. Failure, timeout, expiration, reversal, and refund are distinct states. A reversed/refunded
   transaction does not become a successful payment.

### Customer pays distributor

1. The customer order is created by the existing customer/mobile workflow.
2. An authorized distributor admin or staff member may request an M-Pesa prompt using the
   customer's phone number when the deployed backend supports that operation.
3. The distributor can view customer collections and their reconciliation details. The payment
   initiation response is only a request acknowledgement.
4. Picking, packing, and dispatch remain blocked until the backend reports `SUCCEEDED`.

The distributor workspace does not gain a frontend control to mark payment successful or manually
reconcile a transaction.

## Proposed API contracts

The following table defines the minimum backend work for the shared frontend service. Existing
routes are extended only where explicitly noted; no new API behavior should be assumed available
until implemented and integration-tested.

| Method and route                                     | Status                                              | Purpose                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/payments/initiate`                     | Existing customer route; proposed request extension | Initiate either an M-Pesa customer-order payment or supplier purchase-order payment.                                        |
| `GET /api/v1/payments?orderType={type}`              | Proposed                                            | Return transaction history visible to the authenticated organization, filtered by order type.                               |
| `GET /api/v1/payments?orderType={type}&orderId={id}` | Proposed                                            | Return the authorized transaction(s) for one order, used to verify supplier-payment status and resolve initiation timeouts. |
| `GET /api/v1/payments/{orderId}/status`              | Existing frontend customer status route             | Return the server-reconciled status for a customer order; include the most recent payment and receipt metadata.             |
| `POST /api/v1/webhooks/payments/mpesa`               | Proposed, provider-to-backend only                  | Receive and verify provider callbacks. This route must not be callable as a user-facing payment confirmation action.        |

### Initiation request

```http
POST /api/v1/payments/initiate
Idempotency-Key: <unique-client-operation-key>
Content-Type: application/json
```

```json
{
  "orderType": "PURCHASE_ORDER",
  "orderId": "purchase-order-id",
  "provider": "MPESA",
  "phoneNumber": "+254712345678"
}
```

`orderType` is either `PURCHASE_ORDER` or `CUSTOMER_ORDER`. For a purchase order, the payer is
the distributor and the payee is the manufacturer. For a customer order, the payer is the
customer and the payee is the distributor. Derive parties, amount, and currency from the
server-owned order; reject client-supplied amount, organization, payer/payee IDs, or a requested
success status. A customer payment prompt initiated by distributor staff must still be authorized
for that distributor's order and audited to the authenticated staff member.

### Initiation response

```json
{
  "paymentId": "payment-id",
  "paymentReference": "LOGI-PAY-000123",
  "provider": "MPESA",
  "status": "PENDING",
  "customerMessage": "Check your phone to complete payment."
}
```

The response state is always non-final (`PENDING` or an explicit initiation failure). It must
never be used to mark an order paid. The UI requires a later authenticated status/history read
backed by verified provider reconciliation.

### Transaction history response

```json
{
  "content": [
    {
      "id": "payment-id",
      "paymentReference": "LOGI-PAY-000123",
      "orderId": "purchase-order-id",
      "orderReference": "PO-2026-00123",
      "orderType": "PURCHASE_ORDER",
      "direction": "OUTGOING",
      "counterpartyName": "Manufacturer name",
      "amount": 1250.0,
      "currency": "KES",
      "provider": "MPESA",
      "status": "PENDING",
      "createdAt": "2026-11-03T08:30:00Z",
      "updatedAt": "2026-11-03T08:30:00Z",
      "reconciledAt": null,
      "reconciliationStatus": "PENDING",
      "reconciliationReference": null,
      "mpesaReceiptNumber": null,
      "failureReason": null
    }
  ]
}
```

`direction` is relative to the authenticated organization. A manufacturer sees incoming supplier
payments. A distributor sees outgoing purchase payments when `orderType=PURCHASE_ORDER` and
incoming customer collections when `orderType=CUSTOMER_ORDER`. The backend—not a client-supplied
organization ID or direction—determines which records the principal may see.

The existing customer status response should include at least `orderId`, `paymentId`, `status`,
`amount`, `mpesaReceiptNumber`, and `failureReason`. Prefer aligning it with the transaction DTO
above without breaking its existing frontend route.

## Status lifecycle and reconciliation

| State       | Meaning                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PENDING`   | Checkout initiated; provider settlement is not verified.                                                                                                |
| `SUCCEEDED` | Provider callback was authenticated and amount/order/party/currency reconciled. This is the only fulfillment-eligible payment state.                    |
| `FAILED`    | Provider or backend reports a terminal failure. A new attempt may be made under the order's retry policy.                                               |
| `EXPIRED`   | Checkout expired without verified success. A new attempt may be made under the order's retry policy.                                                    |
| `REVERSED`  | Previously settled payment has been reversed. Keep the reversal linked to the original payment and apply the configured order hold/cancellation policy. |
| `REFUNDED`  | A verified refund has completed. Keep it distinct from a reversal and link it to the original payment/refund transaction.                               |

Recommended transitions are `PENDING -> SUCCEEDED | FAILED | EXPIRED`, then
`SUCCEEDED -> REVERSED | REFUNDED` only through verified provider/refund events. Terminal states
must not silently revert to pending or success. Preserve the raw provider event and append an
auditable reconciliation record.

### M-Pesa callback/webhook requirements

- Keep Daraja/provider credentials exclusively in backend secret storage; never return them to the
  Angular application.
- Verify the provider's callback authenticity using the supported provider mechanism. Validate
  merchant/account identity, provider transaction ID, amount, currency, order, payer/payee, and
  expected transaction state before updating any payment.
- Persist callback events and reconciliation results. Deduplicate by provider event/transaction
  identity and idempotency key. A repeated callback returns an idempotent acknowledgement and does
  not create another payment, reserve stock again, or deduct stock twice.
- Reject invalid signatures, unknown transactions, amount/currency mismatches, replayed or
  out-of-window events, and callbacks inconsistent with terminal state. Alert/reconcile unmatched
  events without exposing payment secrets.
- Treat provider callback acknowledgement, customer-facing prompt text, and frontend polling as
  separate from a verified successful state.

## Order integration and inventory constraints

- Purchase-order payment creation and payment state are linked to one supplier PO, its buyer and
  supplier organizations, amount, currency, and immutable order snapshot.
- Customer-order payment is linked to one customer order, customer/payer, distributor/payee,
  amount, and currency.
- The backend is authoritative for payment-required order transitions. Do not allow picking,
  packing, shipment creation, or dispatch until the order is eligible and has
  `paymentStatus=SUCCEEDED`; any cash-on-delivery exception must be an explicit server policy.
- A reversal/refund after reservation or fulfillment invokes an explicit cancellation, hold,
  refund, and stock-release policy. Do not mutate inventory directly from the UI.
- Commit payment reconciliation and its order state update atomically, or use an outbox with
  idempotent consumers. Return success only after durable persistence.

## Authorization, idempotency, and errors

- Derive user, organization, payer, payee, and order ownership from the authenticated principal
  and server-owned records. The API must isolate Manufacturer and Distributor transaction data.
- Permit transaction history access only to authorized members of the relevant organization.
  Separate payment initiation, financial-record viewing, refund/reversal handling, and
  reconciliation privileges as backend capabilities. Current frontend roles are organization
  admin/staff; the server remains the security boundary.
- Use `Idempotency-Key` for initiation, provider callbacks, refunds, and any payment-linked order
  mutation. Repeating an initiation for the same order while a payment is pending should return the
  existing attempt or a stable conflict, not create duplicate prompts/charges.
- Never let frontend code submit a payment status, provider receipt as proof, reconciliation
  result, amount, or party identity.
- Return stable problem responses, for example:

```json
{
  "code": "PAYMENT_NOT_RECONCILED",
  "message": "Order fulfillment requires a reconciled successful payment.",
  "fieldErrors": [],
  "correlationId": "request-id"
}
```

Recommended codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`PAYMENT_NOT_RECONCILED`, `PAYMENT_PENDING`, `PAYMENT_ALREADY_PENDING`,
`IDEMPOTENCY_CONFLICT`, `INVALID_STATE_TRANSITION`, `VALIDATION_ERROR`,
`PROVIDER_VERIFICATION_FAILED`, and `RECONCILIATION_REQUIRED`. Do not leak cross-organization
record existence in `403` versus `404` responses.

## Frontend behavior and remaining backend dependencies

- Payment requests are sent through one shared Angular payment service. The UI suppresses
  concurrent duplicate initiation requests per order, sends an idempotency key, times out stalled
  requests, and requires a status read before retrying an ambiguous attempt.
- An initiation response displays pending only; the payment component never treats that response
  as proof of payment. Status updates are emitted to order views only after a status/history GET.
- Failed/expired attempts can be retried after status verification. Pending, reversed, and
  refunded transactions cannot be retried from the payment control. A status-read failure is
  surfaced and does not mutate order state.
- The Distributor UI has separate supplier-payment and customer-collection history filters. The
  Manufacturer UI displays incoming distributor transactions. Views remain empty/error states
  until the backend history API returns authenticated data.
- Supplier payment initiation/status, transaction history, provider callback reconciliation, and
  backend enforcement of payment-gated fulfillment are not confirmed as implemented. The
  existing settlement route is not treated as authoritative payment evidence.
- The current customer-order API remains the only frontend-referenced payment initiation/status
  path. Adding `orderType`, provider selection, idempotency, and supplier PO support requires
  backend contract confirmation and integration tests.
