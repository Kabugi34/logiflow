# Access request API handoff

Please update `POST /access-requests` to accept `multipart/form-data`. The frontend now sends these fields:

| Field | Type | Required |
|---|---|---|
| `organizationType` | `MANUFACTURER` or `DISTRIBUTOR` | Yes |
| `organizationName` | Text | Yes |
| `country` | Text | Yes |
| `registrationNumber` | Text | Yes |
| `taxIdentifier` | Text (KRA PIN in Kenya) | Yes |
| `fullName` | Text | Yes |
| `representativeRole` | `Manager` or `Supervisor` | Yes |
| `personalEmail` | Email | Yes |
| `organizationEmail` | Email | Yes |
| `phoneNumber` | International phone | Yes |
| `authorizedRepresentative` | `true` | Yes |
| `incorporationCertificate` | PDF/JPG/PNG, max 5 MB | Yes |
| `taxCertificate` | PDF/JPG/PNG, max 5 MB | Yes |

Only accept `Manager` or `Supervisor` for `representativeRole`. Keep the request pending super-admin review. Store uploaded files in private storage and return an appropriate success response (for example HTTP 202); do not expose public file URLs. Validate representative role, file content, size, and all fields on the server. The frontend currently only needs a successful response and shows its existing review-pending message.

Example request:

```bash
curl -X POST "$API_URL/access-requests" \
  -F 'organizationType=DISTRIBUTOR' \
  -F 'organizationName=Example Distribution Ltd' \
  -F 'country=Kenya' \
  -F 'registrationNumber=CPR-123456' \
  -F 'taxIdentifier=P123456789Z' \
  -F 'fullName=Example Manager' \
  -F 'representativeRole=Manager' \
  -F 'personalEmail=manager@example.com' \
  -F 'organizationEmail=info@example.com' \
  -F 'phoneNumber=+254700000000' \
  -F 'authorizedRepresentative=true' \
  -F 'incorporationCertificate=@incorporation.pdf;type=application/pdf' \
  -F 'taxCertificate=@tax-certificate.pdf;type=application/pdf'
```

