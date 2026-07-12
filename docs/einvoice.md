# e-Invoice (MyInvois / LHDNM) integration

Vibe Accounting Malaysia integrates with LHDNM's MyInvois e-invoice
platform.  This document covers the integration architecture, credentials,
signing, and submission lifecycle.

> Authoritative reference: <https://sdk.myinvois.hasil.gov.my/>

## Environments

| Environment | Base URL                                              | Purpose           |
| ----------- | ----------------------------------------------------- | ----------------- |
| SANDBOX     | `https://preprod-api.myinvois.hasil.gov.my`           | Pre-production    |
| PRODUCTION  | `https://api.myinvois.hasil.gov.my`                   | Live              |

The platform ships with **SANDBOX** as the default.  Switch to PRODUCTION
by setting the active `environment` on the EinvoiceConfig record.

## Authentication

MyInvois uses **OAuth2 client_credentials** with scope `InvoicingAPI`.
Tokens are valid for **60 minutes**; we cache them per environment with
a 60-second safety margin.

```
POST {base}/connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=...
client_secret=...
scope=InvoicingAPI
```

Response:

```json
{ "access_token": "...", "expires_in": 3600, "token_type": "Bearer" }
```

The cached token is reused for every subsequent API call; no extra
handshake is needed.

## X.509 document signing

Every submitted document MUST be signed with an X.509 certificate whose
Extended Key Usage includes **Document Signing** (1.3.6.1.5.5.7.3.36)
or **Non-Repudiation** (1.3.6.1.5.5.7.3.2).  Signing is performed
in-process with `node-forge`:

1. Load `.p12` (PKCS#12) from `cfg.certPath`.
2. Verify EKU; throw if not Document Signing / Non-Repudiation.
3. Compute SHA-256 digest of the canonical JSON document.
4. Create a detached PKCS#7 signature with authenticated attributes:
   - contentType
   - messageDigest
   - signingTime
5. Encode as base64 DER.

The signature is sent in the `documentSignature` field of the
submission payload, alongside the base64-encoded document.

For local development set `DISABLE_SIGNING=1` and the platform emits a
placeholder signature.  The MyInvois SANDBOX will reject it, but the
rest of the lifecycle (submission record, poll, cancel) is still
exercised.

## Document types

| `documentType`       | Meaning                                  |
| -------------------- | ---------------------------------------- |
| `invoice`            | Standard sales invoice (01)              |
| `credit-note`        | Credit note (02)                         |
| `debit-note`         | Debit note (03)                          |
| `refund-note`        | Refund note (04)                         |
| `self-billed-invoice` etc. | Self-billed variants                |

Supported versions: `1.0` and `1.1`.  Vibe Accounting Malaysia defaults
to `1.1` and emits JSON (XML is also supported by the MyInvois API).

### MyInvois UBL 2.1 v1.1 document type codes

| Code | Document type             | Mapper `documentType` value     |
| ---- | ------------------------- | ------------------------------- |
| 01   | Invoice                   | `invoice`                       |
| 02   | Credit note               | `credit-note`                   |
| 03   | Debit note                | `debit-note`                    |
| 04   | Refund note               | `refund-note`                   |
| 11   | Self-billed invoice        | `self-billed-invoice`           |
| 12   | Self-billed credit note    | `self-billed-credit-note`       |
| 13   | Self-billed debit note     | `self-billed-debit-note`        |
| 14   | Self-billed refund note    | `self-billed-refund-note`       |

### Malaysian state codes

The mapper resolves free-form state names (`Selangor`, `Wilayah Persekutuan
Kuala Lumpur`, `Penang`/`Pulau Pinang`, ...) to the ISO-3166-2:MY 2-digit
codes required by MyInvois.  State `17` (Not Applicable) is used when the
state is unknown.

| Code | State                                |
| ---- | ------------------------------------ |
| 01   | Johor                                |
| 02   | Kedah                                |
| 03   | Kelantan                             |
| 04   | Melaka / Malacca                     |
| 05   | Negeri Sembilan                      |
| 06   | Pahang                               |
| 07   | Pulau Pinang / Penang                |
| 08   | Perak                                |
| 09   | Perlis                               |
| 10   | Selangor                             |
| 11   | Terengganu                           |
| 12   | Sabah                                |
| 13   | Sarawak                              |
| 14   | Wilayah Persekutuan Kuala Lumpur     |
| 15   | Wilayah Persekutuan Labuan           |
| 16   | Wilayah Persekutuan Putrajaya        |
| 17   | Not Applicable                       |

The mapper (`buildUblInvoice` in `apps/api/src/modules/einvoice/mappers/invoice-v1.1.mapper.ts`)
emits the canonical UBL 2.1 JSON v1.1 shape with:

- **Allowance / charge** on each line when a discount is present
- Multi-line supplier and customer addresses (Street + Line)
- Supplier and customer contact (ElectronicMail + Telephone)
- MSIC industry code from the `AccountBook.industryCode`
- Per-currency precision (the invoice currency is propagated to all monetary fields)
- TIN validation: the mapper throws if the supplier TIN is empty
- Optional `BillingReference` to link credit/debit notes to their source invoice

## UBL 2.1 JSON structure

The mapper (`apps/api/src/modules/einvoice/mappers/invoice-v1.1.mapper.ts`)
produces a document matching the MyInvois UBL 2.1 JSON v1.1 schema:

```json
{
  "_D": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  "_A": "...",
  "_B": "...",
  "Invoice": [
    {
      "ID": [{ "_": "INV-00001" }],
      "IssueDate": [{ "_": "2025-01-15" }],
      "IssueTime": [{ "_": "09:30:00" }],
      "DueDate":   [{ "_": "2025-02-14" }],
      "InvoiceTypeCode": [{ "_": "01", "listVersionID": "1.1" }],
      "DocumentCurrencyCode": [{ "_": "MYR" }],
      "TaxCurrencyCode": [{ "_": "MYR" }],
      "AccountingSupplierParty": [ ... ],
      "AccountingCustomerParty": [ ... ],
      "InvoiceLine": [ ... ],
      "LegalMonetaryTotal": [ ... ],
      "TaxTotal": [ ... ]
    }
  ]
}
```

Mandatory party fields:

- **Supplier**: BRN (`PartyIdentification`), TIN (`PartyTaxScheme`),
  MSIC code (`IndustryClassificationCode`), address.
- **Customer**: BRN or TIN (`PartyIdentification`), address.

The mapper throws on missing TIN at the API layer.

## PaymentMeans codes

Per the [MyInvois PaymentMeans list](https://sdk.myinvois.hasil.gov.my/codes/payment-means/) the platform exposes the full set of UBL 2.1 PaymentMeans codes via `PAYMENT_MODE_CODES` in `apps/api/src/modules/einvoice/einvoice.config.ts`:

| Code | Display name             |
| ---- | ------------------------ |
| 01   | Cash                     |
| 02   | Cheque                   |
| 03   | Bank Transfer            |
| 04   | Credit Card              |
| 05   | Debit Card               |
| 06   | e-Wallet / Online Banking |
| 07   | Direct Debit             |
| 08   | FPX                      |
| 09   | e-Money                  |
| 10   | PayPal / Online Payment  |

Use the helper `paymentModeDisplayName(code)` to render the human-readable label in the UI.

## Country codes

The mapper exposes a `toCountryCode(input)` helper that resolves free-form country names (`"Malaysia"`, `"SG"`, `"United States"`, ...) to the ISO-3166-1 alpha-3 codes MyInvois requires in `PostalAddress/Country/IdentificationCode`. Covers all ASEAN neighbours plus major trading partners (USA, UK, AU, CN, HK, JP, KR, PH, VN, IN, BN). Falls back to `MYS` for unknown / empty input.

## InvoicePeriod (delivery date), PaymentMeans + PayeeFinancialAccount, AdditionalDocumentReference

The mapper accepts three optional extensions on the mapper context (and the
`SubmitInvoiceDto`) so callers can attach richer metadata per
[MyInvois SDK](https://sdk.myinvois.hasil.gov.my/):

| Field                                | UBL 2.1 path                                | Purpose                                                       |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------- |
| `deliveryDate`                       | `InvoicePeriod[0].StartDate`                | Goods / service delivery date (taxpoint).                      |
| `paymentMeansCode` (e.g. `"03"`)     | `PaymentMeans[0].PaymentMeansCode`          | Mode of payment (01 Cash → 10 PayPal / Online).               |
| `paymentAccountNo`                   | `PaymentMeans[0].PayeeFinancialAccount[0].ID` | Supplier bank account for direct credit / IBAN equivalents.   |
| `additionalReferences[]`             | `AdditionalDocumentReference[]`              | FTT (tourism tax), withholding tax or other regulator refs.   |

Example payload:

```json
{
  "version": "1.1",
  "format": "JSON",
  "deliveryDate": "2025-01-20",
  "paymentMeansCode": "03",
  "paymentAccountNo": "1234567890",
  "additionalReferences": [
    { "id": "FTT-2025-001", "documentType": "FTT", "documentDescription": "Tourism tax reference" }
  ]
}
```

All four fields are optional. The mapper omits the corresponding UBL block when
the value is absent so existing invoice flows are unaffected.

## Pre-submission validation

Before every submission we run a 100% in-process UBL 2.1 v1.1 conformance
check (`validateUblDocument` in
`apps/api/src/modules/einvoice/validators/ubl.validator.ts`).  This lets the
UI surface problems *before* the document is sent to MyInvois.

The validator checks for:

- All MyInvois-mandated header fields (`ID`, `IssueDate`,
  `DocumentCurrencyCode`, `LegalMonetaryTotal`, `TaxTotal`).
- `PayableAmount == TaxInclusiveAmount` per the MyInvois v1.1 spec.
- Every monetary total carries a `currencyID` attribute.
- Supplier `PartyIdentification` + `PartyTaxScheme/CompanyID` is populated
  and schemeID is `TIN`.
- Customer `PartyIdentification` has a value and recognised schemeID
  (`TIN`, `BRN`, `NRIC`, `PASSPORT`, `ARMY`).
- IndustryClassificationCode (MSIC) is 5-digit numeric.
- Each `InvoiceLine` declares `Item` (Description or Name), a positive
  `InvoicedQuantity` + a `Price/PriceAmount` and at least one
  `TaxCategory/TaxSubtotal`.
- Every `TaxCategory` declares a `TaxTypeCode` in the MyInvois
  enumeration (`01`-`06` or `E`); `E` requires a `TaxExemptionReason`.
- `PaymentMeans[].PaymentMeansCode` is in the recommended list
  (`01`-`99`) — out-of-range codes emit a warning. When a
  `PayeeFinancialAccount` is supplied the validator enforces a non-empty
  `ID` and a digit-shape format check (`[0-9 -]{6,34}`).
- `AdditionalDocumentReference[].ID` is required and must be unique
  within the document (duplicate IDs raise an error).

The validator returns a structured report:

```ts
interface UblValidationResult {
  valid: boolean;
  documentHash: string;   // short deterministic hash for UI display
  documentType: string;   // invoice, credit-note, …
  documentVersion: string; // '1.1'
  issues: Array<{ code: string; severity: 'error' | 'warning'; message: string; path?: string }>;
  summary: { errors: number; warnings: number };
}
```

Two ways to use it:

| Trigger                                  | Endpoint                                                            |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Manual check from the invoice detail UI  | `POST /api/einvoice/invoices/:id/validate`                          |
| Same call with `validateOnly: true`      | `POST /api/einvoice/invoices/:id/submit { validateOnly: true }`     |

The submit endpoint refuses to talk to MyInvois if the validator reports
one or more errors.  It will not throw when there are only warnings
(missing customer PartyTaxScheme, MSIC not 5 digits, etc.) — those are
recommendations per the spec.

In the invoice detail page the **Validate** button (`ShieldCheck` icon)
calls the validator and renders an amber / emerald panel summarising the
results.

## Submission lifecycle

```
1. POST /api/einvoice/invoices/:id/submit
   - mapper builds UBL JSON
   - signer produces PKCS#7
   - client POSTs to /api/v1.0/documentsubmissions
   - EinvoiceSubmission row created with attempts=1
   - invoice.einvoiceStatus -> PENDING (or INVALID if rejected)

2. POST /api/einvoice/submissions/:id/poll
   - client GETs /api/v1.0/documents/search?submissionUid=...
   - status code (1=submitted, 2=valid, 3=invalid, 4=cancelled)
   - invoice.einvoiceStatus and einvoiceUuid/LongId updated

3. POST /api/einvoice/submissions/:id/cancel
   - client PUTs /api/v1.0/documents/{uid}/state { status: "cancelled", reason }
   - invoice.einvoiceStatus -> CANCELLED
```

## Status code reference

| Code | Name       | Meaning                                            |
| ---- | ---------- | -------------------------------------------------- |
| 1    | Submitted  | Document accepted by MyInvois, awaiting validation |
| 2    | Valid      | Document validated, has QR code and long id        |
| 3    | Invalid    | Document rejected (validation failed)              |
| 4    | Cancelled  | Document cancelled by taxpayer                     |

## API reference

| Endpoint                                          | Description                              |
| ------------------------------------------------- | ---------------------------------------- |
| `GET    /api/einvoice/configs`                    | List configured environments             |
| `POST   /api/einvoice/configs`                    | Create or upsert a configuration         |
| `PUT    /api/einvoice/configs/:id`                | Update configuration                    |
| `DELETE /api/einvoice/configs/:id`                | Remove configuration                    |
| `POST   /api/einvoice/invoices/:id/submit`        | Submit invoice to MyInvois               |
| `GET    /api/einvoice/submissions?invoiceId=...`  | List submissions                        |
| `GET    /api/einvoice/submissions/:id`            | Get one submission                      |
| `POST   /api/einvoice/submissions/:id/poll`       | Poll MyInvois for status                |
| `POST   /api/einvoice/submissions/:id/cancel`     | Cancel a submitted document             |

Full Swagger docs at `http://localhost:8080/api/docs`.
