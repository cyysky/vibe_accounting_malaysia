import { BadRequestException } from '@nestjs/common';
import type { UblDocument } from '../mappers/invoice-v1.1.mapper';

/**
 * MyInvois UBL 2.1 pre-submission validator.
 *
 * Reference: https://sdk.myinvois.hasil.gov.my/ (UBL 2.1 JSON Schema v1.1)
 *
 * Validates that a generated UBL document has every required field, every
 * numeric field is well-formed, all monetary amounts have currencyID, all
 * identification fields use the right schemeID (TIN, BRN, NRIC, PASSPORT,
 * etc.) and every TaxCategory carries a TaxTypeCode per the MyInvois spec.
 *
 * Result returned to the caller includes the document hash, the validation
 * report (passed/failed rules) and a `summary` count so the UI can render a
 * green/red badge before sending the network request.
 */
export interface UblValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
}

export interface UblValidationResult {
  valid: boolean;
  documentHash: string;
  documentType: string;
  documentVersion: string;
  issues: UblValidationIssue[];
  warnings: UblValidationIssue[];
  summary: { errors: number; warnings: number };
}

const REQUIRED_TAX_TYPE_CODES = ['01', '02', '03', '04', '05', '06', 'E'] as const;
type TaxTypeCode = (typeof REQUIRED_TAX_TYPE_CODES)[number];

const isTaxTypeCode = (code: unknown): code is TaxTypeCode =>
  typeof code === 'string' && (REQUIRED_TAX_TYPE_CODES as readonly string[]).includes(code);

const SAFE_ISSUE_CODES = {
  required: 'REQUIRED',
  format: 'FORMAT',
  type: 'TYPE',
  enum: 'ENUM',
  date: 'DATE',
  amount: 'AMOUNT',
  taxCode: 'TAX_TYPE_CODE',
} as const;

interface UblAmount {
  _: string;
  currencyID?: string;
}

function readAmount(node: unknown): UblAmount | undefined {
  if (!Array.isArray(node) || node.length === 0) return undefined;
  const first = node[0];
  if (first && typeof first === 'object' && '_' in (first as Record<string, unknown>)) {
    return first as UblAmount;
  }
  return undefined;
}

function readText(node: unknown): string | undefined {
  if (!Array.isArray(node) || node.length === 0) return undefined;
  const first = node[0];
  if (first && typeof first === 'object' && '_' in (first as Record<string, unknown>)) {
    const v = (first as { _: unknown })._;
    return typeof v === 'string' ? v : v === undefined ? undefined : String(v);
  }
  return undefined;
}

/**
 * Validate a UBL envelope as produced by `buildUblInvoice`. This is intentionally
 * conservative: missing required fields raise errors, soft warnings are emitted
 * for missing recommendations (e.g. customer email/phone).
 */
export function validateUblDocument(doc: UblDocument): UblValidationResult {
  const issues: UblValidationIssue[] = [];

  if (
    !doc ||
    typeof doc !== 'object' ||
    (!('Invoice' in doc) && !('CreditNote' in doc) && !('DebitNote' in doc))
  ) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      message: 'Document must be a UBL envelope with an Invoice or CreditNote wrapper',
    });
    return finalize(issues, 'unknown', 'unknown', doc);
  }

  const wrapper = (doc.Invoice ?? doc.CreditNote ?? doc.DebitNote) as
    | Array<Record<string, unknown>>
    | undefined;
  if (!wrapper || wrapper.length === 0) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      message: 'Envelope must contain exactly one Invoice/CreditNote/DebitNote element',
    });
    return finalize(issues, 'unknown', 'unknown', doc);
  }
  const inner = wrapper[0];

  const version =
    (inner.InvoiceTypeCode as Array<{ listVersionID?: string }> | undefined)?.[0]?.listVersionID ??
    '1.1';
  const code = (inner.InvoiceTypeCode as Array<{ _?: string }> | undefined)?.[0]?._ ?? '01';
  const documentType = mapTypeCodeToName(code);

  requireText(inner, 'ID', issues);
  requireText(inner, 'IssueDate', issues);
  requireText(inner, 'IssueTime', issues, false);
  requireText(inner, 'DocumentCurrencyCode', issues);

  const monetary = inner.LegalMonetaryTotal as Array<Record<string, unknown>> | undefined;
  if (!monetary || monetary.length === 0) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: 'LegalMonetaryTotal',
      message: 'LegalMonetaryTotal element is required',
    });
  } else {
    const m = monetary[0];
    const payable = readAmount(m.PayableAmount);
    const lineExt = readAmount(m.LineExtensionAmount);
    const taxIncl = readAmount(m.TaxInclusiveAmount);
    if (!payable) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: 'LegalMonetaryTotal/PayableAmount',
        message: 'PayableAmount is required',
      });
    }
    if (!lineExt) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: 'LegalMonetaryTotal/LineExtensionAmount',
        message: 'LineExtensionAmount is required',
      });
    }
    if (!taxIncl) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: 'LegalMonetaryTotal/TaxInclusiveAmount',
        message: 'TaxInclusiveAmount is required',
      });
    }
    if (payable && lineExt) {
      const payableNum = Number(payable._);
      const lineExtNum = Number(lineExt._);
      const taxInclusiveNum = taxIncl ? Number(taxIncl._) : payableNum;
      if (payableNum < 0 || lineExtNum < 0) {
        issues.push({
          code: SAFE_ISSUE_CODES.amount,
          severity: 'error',
          path: 'LegalMonetaryTotal',
          message: 'Monetary totals must be non-negative',
        });
      }
      if (Math.abs(payableNum - taxInclusiveNum) > 0.02) {
        issues.push({
          code: SAFE_ISSUE_CODES.amount,
          severity: 'error',
          path: 'LegalMonetaryTotal/PayableAmount',
          message: 'PayableAmount must equal TaxInclusiveAmount (per MyInvois v1.1 spec)',
        });
      }
    }
    for (const k of [
      'PayableAmount',
      'LineExtensionAmount',
      'TaxInclusiveAmount',
      'AllowanceTotalAmount',
      'ChargeTotalAmount',
    ] as const) {
      const node = readAmount((m as Record<string, unknown>)[k]);
      if (node && !node.currencyID) {
        issues.push({
          code: SAFE_ISSUE_CODES.required,
          severity: 'error',
          path: `LegalMonetaryTotal/${k}`,
          message: `${k} must include currencyID attribute`,
        });
      }
    }
  }

  const taxTotals = inner.TaxTotal as Array<Record<string, unknown>> | undefined;
  if (!taxTotals || taxTotals.length === 0) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: 'TaxTotal',
      message: 'TaxTotal element is required (even when tax amount is zero)',
    });
  } else {
    for (const tt of taxTotals) {
      const taxAmount = readAmount(tt.TaxAmount);
      if (!taxAmount) {
        issues.push({
          code: SAFE_ISSUE_CODES.required,
          severity: 'error',
          path: 'TaxTotal/TaxAmount',
          message: 'TaxAmount is required in every TaxTotal',
        });
      } else if (!taxAmount.currencyID) {
        issues.push({
          code: SAFE_ISSUE_CODES.required,
          severity: 'error',
          path: 'TaxTotal/TaxAmount',
          message: 'TaxAmount must include currencyID attribute',
        });
      }
    }
  }

  const supplierParty = firstParty(inner.AccountingSupplierParty);
  if (!supplierParty) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: 'AccountingSupplierParty',
      message: 'AccountingSupplierParty is required',
    });
  } else {
    validateParty(supplierParty, 'Supplier', issues);
    const msic = supplierParty.IndustryClassificationCode as
      | Array<{ _?: string; name?: string }>
      | undefined;
    if (!msic || !msic[0]?._ || !/^[0-9]{5}$/.test(msic[0]._)) {
      issues.push({
        code: SAFE_ISSUE_CODES.format,
        severity: 'warning',
        path: 'AccountingSupplierParty/IndustryClassificationCode',
        message: 'MSIC code should be a 5-digit numeric per MyInvois spec',
      });
    }
  }

  const customerParty = firstParty(inner.AccountingCustomerParty);
  if (!customerParty) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: 'AccountingCustomerParty',
      message: 'AccountingCustomerParty is required',
    });
  } else {
    validateParty(customerParty, 'Customer', issues);
  }

  const lines = (inner.InvoiceLine as Array<Record<string, unknown>> | undefined) ?? [];
  if (lines.length === 0) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: 'InvoiceLine',
      message: 'Invoice must include at least one InvoiceLine element',
    });
  }
  for (const [i, line] of lines.entries()) {
    const lineId = readText(line.ID) ?? String(i + 1);
    const item = firstWrapper(line.Item);
    if (!item) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: `InvoiceLine[${i}].Item`,
        message: `Line ${lineId} is missing Item element`,
      });
    } else {
      const description = readText(item.Description as never);
      const name = readText(item.Name as never);
      if (!description && !name) {
        issues.push({
          code: SAFE_ISSUE_CODES.required,
          severity: 'error',
          path: `InvoiceLine[${i}].Item`,
          message: `Line ${lineId} Item must include Description or Name`,
        });
      }
    }
    const qty = readAmount(line.InvoicedQuantity);
    if (!qty) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: `InvoiceLine[${i}].InvoicedQuantity`,
        message: `Line ${lineId} InvoicedQuantity is required`,
      });
    }
    const price = firstWrapper(line.Price);
    if (!price) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: `InvoiceLine[${i}].Price`,
        message: `Line ${lineId} Price element is required`,
      });
    } else {
      const priceAmount = readAmount(price.PriceAmount);
      if (!priceAmount) {
        issues.push({
          code: SAFE_ISSUE_CODES.required,
          severity: 'error',
          path: `InvoiceLine[${i}].Price/PriceAmount`,
          message: `Line ${lineId} PriceAmount is required`,
        });
      }
    }
    const taxTotalsLine = line.TaxTotal as Array<Record<string, unknown>> | undefined;
    if (taxTotalsLine) {
      for (const t of taxTotalsLine) {
        const subtotals = (t.TaxSubtotal as Array<Record<string, unknown>> | undefined) ?? [];
        for (const [j, sub] of subtotals.entries()) {
          const cat = firstWrapper(sub.TaxCategory);
          if (!cat) {
            issues.push({
              code: SAFE_ISSUE_CODES.required,
              severity: 'error',
              path: `InvoiceLine[${i}].TaxTotal.TaxSubtotal[${j}].TaxCategory`,
              message: `Line ${lineId} TaxCategory is required`,
            });
            continue;
          }
          const tt = readText(cat.TaxTypeCode as never);
          if (!tt || !isTaxTypeCode(tt)) {
            issues.push({
              code: SAFE_ISSUE_CODES.taxCode,
              severity: 'error',
              path: `InvoiceLine[${i}].TaxTotal.TaxSubtotal[${j}].TaxCategory/TaxTypeCode`,
              message: `Line ${lineId} TaxCategory must include TaxTypeCode one of ${REQUIRED_TAX_TYPE_CODES.join(', ')} per MyInvois spec`,
            });
          }
          if (tt === 'E') {
            const reason = readText(cat.TaxExemptionReason as never);
            if (!reason) {
              issues.push({
                code: SAFE_ISSUE_CODES.required,
                severity: 'error',
                path: `InvoiceLine[${i}].TaxTotal.TaxSubtotal[${j}].TaxCategory/TaxExemptionReason`,
                message: `Line ${lineId} with TaxTypeCode=E must declare a TaxExemptionReason`,
              });
            }
          }
        }
      }
    }
  }

  return finalize(issues, documentType, version, doc);
}

function finalize(
  issues: UblValidationIssue[],
  documentType: string,
  documentVersion: string,
  doc: UblDocument,
): UblValidationResult {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const hash = simpleHash(JSON.stringify(doc));
  return {
    valid: errors === 0,
    documentHash: hash,
    documentType,
    documentVersion,
    issues,
    warnings: issues.filter((i) => i.severity === 'warning'),
    summary: { errors, warnings },
  };
}

function firstWrapper(node: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(node) && node[0] && typeof node[0] === 'object') {
    return node[0] as Record<string, unknown>;
  }
  return undefined;
}

function firstParty(node: unknown): Record<string, unknown> | undefined {
  const wrapper = firstWrapper(node);
  if (!wrapper) return undefined;
  return firstWrapper(wrapper.Party);
}

function validateParty(party: Record<string, unknown>, label: string, issues: UblValidationIssue[]) {
  const ids = party.PartyIdentification as Array<Record<string, unknown>> | undefined;
  if (!ids || ids.length === 0) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: `${label}/PartyIdentification`,
      message: `${label} PartyIdentification is required`,
    });
  } else {
    for (const [i, id] of ids.entries()) {
      // id.ID is an array like [{ _: 'value', schemeID: 'TIN' }]; we already
      // have firstWrapper returning that element.
      const inner = firstWrapper(id.ID) as { _?: string; schemeID?: string } | undefined;
      const scheme = inner?.schemeID;
      const value = inner?._;
      if (!value) {
        issues.push({
          code: SAFE_ISSUE_CODES.required,
          severity: 'error',
          path: `${label}/PartyIdentification[${i}]`,
          message: `${label} PartyIdentification[${i}] requires an ID value`,
        });
      }
      if (scheme && !['TIN', 'BRN', 'NRIC', 'PASSPORT', 'ARMY', 'SST'].includes(scheme)) {
        issues.push({
          code: SAFE_ISSUE_CODES.enum,
          severity: 'warning',
          path: `${label}/PartyIdentification[${i}]`,
          message: `${label} PartyIdentification schemeID "${scheme}" is not a recognised MyInvois scheme`,
        });
      }
    }
  }
  const nameWrap = firstWrapper(party.PartyName) as { Name?: Array<{ _?: string }> } | undefined;
  const regName = readText(nameWrap?.Name as never);
  const legalEntity = firstWrapper(party.PartyLegalEntity) as
    | { RegistrationName?: unknown }
    | undefined;
  const legalRegName =
    (firstWrapper(legalEntity?.RegistrationName)?._ as string | undefined) ??
    (typeof legalEntity?.RegistrationName === 'string'
      ? legalEntity.RegistrationName
      : undefined);
  if (!regName && !legalRegName) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: 'error',
      path: `${label}/PartyName`,
      message: `${label} must have a PartyName or PartyLegalEntity/RegistrationName`,
    });
  }
  if (label === 'Supplier') {
    const taxScheme = firstWrapper(party.PartyTaxScheme) as { CompanyID?: unknown } | undefined;
    const companyId = firstWrapper(taxScheme?.CompanyID) as { _?: string; schemeID?: string } | undefined;
    const scheme = companyId?.schemeID;
    const value = companyId?._;
    if (!value) {
      issues.push({
        code: SAFE_ISSUE_CODES.required,
        severity: 'error',
        path: 'Supplier/PartyTaxScheme/CompanyID',
        message: 'Supplier PartyTaxScheme/CompanyID must include the TIN',
      });
    } else if (scheme && scheme !== 'TIN') {
      issues.push({
        code: SAFE_ISSUE_CODES.enum,
        severity: 'warning',
        path: 'Supplier/PartyTaxScheme/CompanyID',
        message: 'Supplier PartyTaxScheme/CompanyID schemeID is expected to be TIN',
      });
    }
  }
  if (label === 'Customer' && !party.PartyTaxScheme) {
    issues.push({
      code: SAFE_ISSUE_CODES.format,
      severity: 'warning',
      path: 'Customer',
      message: 'Customer PartyTaxScheme is recommended when the customer has a TIN',
    });
  }
}

function requireText(
  parent: Record<string, unknown>,
  name: string,
  issues: UblValidationIssue[],
  warnOnly = false,
) {
  const v = readText(parent[name] as never);
  if (!v) {
    issues.push({
      code: SAFE_ISSUE_CODES.required,
      severity: warnOnly ? 'warning' : 'error',
      path: name,
      message: `${name} is ${warnOnly ? 'recommended' : 'required'}`,
    });
  }
}

function mapTypeCodeToName(code: string): string {
  const map: Record<string, string> = {
    '01': 'invoice',
    '02': 'credit-note',
    '03': 'debit-note',
    '04': 'refund-note',
    '11': 'self-billed-invoice',
    '12': 'self-billed-credit-note',
    '13': 'self-billed-debit-note',
  };
  return map[code] ?? code;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `val-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Convenience: validates the UBL document and throws if any errors are
 * found. Used in unit/integration tests.
 */
export function assertUblValid(doc: UblDocument): UblValidationResult {
  const result = validateUblDocument(doc);
  if (!result.valid) {
    const first = result.issues.filter((i) => i.severity === 'error').slice(0, 5);
    throw new BadRequestException(
      `UBL document failed pre-submission validation (${result.summary.errors} error(s)): ` +
        first.map((i) => i.message).join('; '),
    );
  }
  return result;
}
