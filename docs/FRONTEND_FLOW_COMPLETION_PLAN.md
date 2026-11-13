# Frontend flow completion plan

This is the frontend implementation handoff based on the Angular code in this workspace and the backend controllers/services in `C:\DISTRO-BACKEND`. No frontend source files were changed.

## Can the UI add a driver and email them now?

**Not reliably.** The backend has driver invitations and email delivery, but the UI calls the wrong route and its activation flow does not match the invitation API.

Both Manufacturer and Distributor fleet services post driver creation to `POST /api/v1/drivers`. The backend maps this route to `DriverController.registerForReview`, a platform-admin workflow. Organization administrators must use `POST /api/v1/drivers/invitations`, which accepts `CreateDriverInvitationRequest` (`fullName`, `email`, `phoneNumber`, `licenseNumber`). However, the current backend `InvitationService.createDriver` only permits DISTRIBUTOR organizations, so a Manufacturer admin still cannot invite a driver even after the frontend switches to that endpoint. The business rule must be clarified and the backend authorization/ownership logic expanded if Manufacturer drivers are intended. The UI currently submits `nationalId`, `licenseExpiryDate`, and `baseWarehouseId` too; the invitation DTO does not store these fields.

When the correct invite endpoint is called, the backend creates an `INVITED` driver account and a hashed, expiring invitation token, then publishes an email event after the database transaction commits. **Email is sent only if `app.mail.enabled=true` and Mailgun or JavaMail is configured.** If mail is disabled or delivery fails, the API still may commit the invitation and its response does not report actual delivery status. The UI should not claim “email sent” from the current response.

The backend email link points to `/accept-invitation?token=...`, but Angular has no `/accept-invitation` route. Its `/auth/activate` page expects `email` and `token` and posts `{email, token, password, confirmPassword}` to `/api/access-requests/activate`. Driver invitation acceptance is `POST /api/invitations/{token}/accept` with `{phoneNumber, password}`. Drivers must then complete phone OTP verification before login. The invitation API exists, but the present activation page cannot complete it. No driver mobile app was present in the inspected workspace, so mobile deep-link behavior is unverified.

| Method/path | Purpose and contract |
| --- | --- |
| `POST /api/v1/drivers/invitations` | Org-admin invite; `CreateDriverInvitationRequest` → `InvitationResponse`. Its `id` is the invitation ID, not the driver ID. |
| `POST /api/v1/drivers/{driverId}/invitation/resend` | Resend an expired/revoked invitation. |
| `DELETE /api/v1/drivers/{driverId}/invitation` | Revoke a pending invitation. |
| `GET /api/invitations/{token}` | Validate/display public invitation details. |
| `POST /api/invitations/{token}/accept` | Accept with `{phoneNumber,password}` → registration response. |
| Existing OTP verification API | Verify driver phone before allowing login. |

### Frontend changes needed for driver onboarding

1. Change both fleet services to call `/drivers/invitations`; first enable Manufacturer organizations in backend invitation policy if Manufacturer-managed drivers are required. Map the invitation response separately from `DriverResponse`.
2. Either remove national ID/licence expiry/base warehouse from this invite form or add backend persistence for them. Do not silently discard submitted values.
3. Refresh the driver list after creating an invitation to get the actual driver user ID before enabling driver actions. Model invitation state separately from account state.
4. Add an invitation acceptance route that reads `token`, calls `GET /api/invitations/{token}`, then `POST /api/invitations/{token}/accept`, and guides the driver through OTP verification. Or implement a verified app/universal link in the mobile app.
5. Point the email link to a real web/mobile route. Configure `app.mail.enabled`, provider credentials/from address and frontend base URL. Add delivery state/retry support if the UI must distinguish queued, sent and failed.
6. Test duplicate email/phone, expired/revoked token, resend, single-use acceptance, phone mismatch, OTP expiry and login gating.

## Is the full manufacturer → distributor → customer flow done?

**No, not end to end.** Backend resources exist for product publication, authorization, purchase orders, settlement, shipments/trips, receipt, distributor stock offers and customer orders. Frontend/API mismatches and warehouse mutations kept only in local service state still prevent one complete persisted flow.

| Stage | Current state and frontend work needed |
| --- | --- |
| Product publication and discovery | Product APIs exist. Verify published products only expose public data and physical stock is not inferred from publication status. |
| Authorization | Product authorization APIs exist. Show server-backed pending/approved/rejected states; do not allow PO submission before approval. |
| Purchase and payment | PO and M-Pesa APIs exist. Keep payment pending until backend callback/status confirms settlement; test failure, delayed and duplicate callbacks. |
| Receipt | The warehouse UI synthesizes receipt data from PO shipment fields. Read persisted shipment details and call `POST /api/v1/purchase-order-shipments/{shipmentId}/receive` with each line’s accepted/damaged/missing quantities; refresh stock and history from API. |
| Put-away | Call `GET/POST /api/stock/items/{stockItemId}/locations`; currently the operations UI changes its local state only. |
| Pick and pack | Call `POST /api/v1/orders/{orderId}/warehouse/pick` with `{orderItemId,pickedQuantity}` and `/warehouse/pack` with `{packageCount}`. Reload progress from API and render server validation errors. Current operations mutation is local-only. |
| Dispatch | Dispatch persisted trip through `POST /api/v1/trips/{tripId}/dispatch`, then refresh trip/order/stock. Never deduct stock in the client. Current warehouse mutation is local-only. |
| Adjustment/history | Submit via authenticated stock audit/movement APIs with reason and quantity; refresh server balance and movement history. Current operations mutation is local-only. |
| Distributor offer | Offer APIs exist. Enable listing only after receipt appears in available stock; verify backend rejects listing beyond availability and customer catalog only shows active, in-stock offers. |
| Customer checkout | Customer orders exist, but backend does not model a single checkout split into orders across multiple distributors. Constrain UI to one distributor per checkout or implement split checkout in backend. |

The warehouse integration gap is mainly in `src/app/features/warehouse-operations/warehouse-operations.service.ts` and the distributor/manufacturer warehouse operations pages. These pages currently synchronize API data into a local operations model and mutate receipt, put-away, pick, pack, dispatch and adjustment state locally.

### Backend gaps and external requirements

- Product authorization exists, but a separate persistent distributor/manufacturer partnership lifecycle is missing.
- Shipment model supports one shipment per purchase order with full-order receipt accounting; partial/multiple shipment allocation needs shipment-line persistence.
- Multi-distributor split checkout is not represented in the customer-order model.
- Database-backed migration/E2E tests require PostgreSQL. M-Pesa E2E requires Daraja sandbox credentials and reachable callback URL. Email requires mail-provider configuration.

## Verification checklist

The previous backend suite on 2026-11-09 passed 122 tests with the PostgreSQL-dependent application-context test excluded. It does not verify the entire workflow against a live database, email provider or Daraja.

Frontend `npm test -- --watch=false` on 2026-11-10 passed **13 test files and 43 tests**. Frontend unit tests are not API end-to-end tests.

Before declaring the workflow complete, verify: (1) product creation/publication and tenant-safe discovery, (2) authorization and rejection of unauthorized PO, (3) successful/failed/duplicate/delayed M-Pesa callbacks, (4) shipment assignment and availability rules, (5) correct/incorrect/expired/reused delivery OTP and assigned-driver checks, (6) receipt quantities and one-time stock increment, (7) put-away location totals, (8) over-pick/invalid status/duplicate dispatch rejection and one-time stock deduction, (9) offers constrained by received available stock and customer discovery/order, (10) cross-tenant isolation and concurrent stock reservation.

