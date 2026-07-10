/**
 * MyInvois UBL 2.1 JSON Invoice (v1.1) mapper.
 *
 * Reference: https://sdk.myinvois.hasil.gov.my/ (UBL 2.1 JSON Spec, v1.1)
 *
 * Supports documentType: invoice | credit-note | debit-note | refund-note,
 * self-billed variants, supplier/customer full address + contact, MSIC code,
 * allowance/charge line items.
 */
import type { CustomerInvoice, Customer, Item, TaxCode } from "@prisma/client";

export type UblDocument = Record<string, unknown>;

interface MapperLine {
  item?: Item | null;
  taxCode?: TaxCode | null;
  taxCodeId?: string | null;
  description: string;
  quantity: unknown;
  unitPrice: unknown;
  discount: unknown;
  taxAmount: unknown;
  lineNo: number;
}

export interface MapperContext {
  invoice: CustomerInvoice & { lines: MapperLine[] };
  customer: Customer;
  supplier: {
    tin: string;
    brn?: string | null;
    name: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    postalCode?: string | null;
    state?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    msic?: string | null;
  };
  taxCodes: Map<string, TaxCode>;
  documentType?:
    | "invoice"
    | "credit-note"
    | "debit-note"
    | "refund-note"
    | "self-billed-invoice"
    | "self-billed-credit-note"
    | "self-billed-debit-note";
  version?: "1.0" | "1.1";
  format?: "JSON" | "XML";
  billingReferenceId?: string;
}

const COUNTRY_MY = "MYS";
const CURRENCY_DEFAULT = "MYR";

const DOCUMENT_TYPE_CODE: Record<NonNullable<MapperContext["documentType"]>, string> = {
  "invoice": "01",
  "credit-note": "02",
  "debit-note": "03",
  "refund-note": "04",
  "self-billed-invoice": "11",
  "self-billed-credit-note": "12",
  "self-billed-debit-note": "13",
};

export function buildUblInvoice(ctx: MapperContext): UblDocument {
  const v = ctx.version ?? "1.1";
  const dt = ctx.documentType ?? "invoice";
  const code = DOCUMENT_TYPE_CODE[dt];
  const currency = ctx.invoice.currency || CURRENCY_DEFAULT;

  if (!ctx.supplier.tin) {
    throw new Error("Supplier TIN is required for MyInvois submission");
  }

  const document: UblDocument = {
    ID: [{ _: ctx.invoice.number }],
    IssueDate: [{ _: ctx.invoice.date.toISOString().slice(0, 10) }],
    IssueTime: [{ _: ctx.invoice.date.toISOString().slice(11, 19) }],
    DueDate: [{ _: ctx.invoice.dueDate.toISOString().slice(0, 10) }],
    InvoiceTypeCode: [{ _: code, listVersionID: v }],
    DocumentCurrencyCode: [{ _: currency }],
    TaxCurrencyCode: [{ _: currency }],
  };

  if (ctx.billingReferenceId) {
    (document as Record<string, unknown>).BillingReference = [
      { InvoiceDocumentReference: [{ ID: [{ _: ctx.billingReferenceId }] }] },
    ];
  }

  (document as Record<string, unknown>).AccountingSupplierParty = [buildSupplier(ctx.supplier)];
  (document as Record<string, unknown>).AccountingCustomerParty = [buildCustomer(ctx.customer)];
  (document as Record<string, unknown>).InvoiceLine = ctx.invoice.lines.map((l) =>
    buildLine(l, ctx.taxCodes, currency),
  );
  (document as Record<string, unknown>).LegalMonetaryTotal = [
    {
      LineExtensionAmount: [{ _: toString(ctx.invoice.subtotal), currencyID: currency }],
      TaxExclusiveAmount: [{ _: toString(ctx.invoice.subtotal), currencyID: currency }],
      TaxInclusiveAmount: [{ _: toString(ctx.invoice.total), currencyID: currency }],
      AllowanceTotalAmount: [{ _: "0.00", currencyID: currency }],
      ChargeTotalAmount: [{ _: "0.00", currencyID: currency }],
      PayableAmount: [{ _: toString(ctx.invoice.total), currencyID: currency }],
    },
  ];
  (document as Record<string, unknown>).TaxTotal = [
    {
      TaxAmount: [{ _: toString(ctx.invoice.taxTotal), currencyID: currency }],
      TaxSubtotal: groupTaxSubtotals(ctx.invoice.lines, ctx.taxCodes, currency),
    },
  ];

  return {
    _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    Invoice: [document],
  };
}

function buildSupplier(s: MapperContext["supplier"]): UblDocument {
  const addr: UblDocument = {
    CityName: [{ _: s.city ?? "NA" }],
    PostalZone: [{ _: s.postalCode ?? "00000" }],
    CountrySubentityCode: [{ _: "17" }],
    Country: [{ IdentificationCode: [{ _: s.country ?? COUNTRY_MY }] }],
  };
  if (s.addressLine1) (addr as Record<string, unknown>).Street = [{ _: s.addressLine1 }];
  if (s.addressLine2) {
    const existing = (addr as Record<string, unknown>).Street as Array<Record<string, unknown>> | undefined;
    if (existing) {
      existing[0] = { ...existing[0], Line: [{ _: s.addressLine2 }] };
    } else {
      (addr as Record<string, unknown>).AdditionalStreet = [{ _: s.addressLine2 }];
    }
  }

  const party: UblDocument = {
    IndustryClassificationCode: [{ _: s.msic ?? "00000", name: s.msic ? "MSIC" : "Generic" }],
    PartyIdentification: [
      s.brn ? { ID: [{ _: s.brn, schemeID: "BRN" }] } : { ID: [{ _: s.tin, schemeID: "TIN" }] },
    ],
    PartyName: [{ Name: [{ _: s.name }] }],
    PostalAddress: [addr],
    PartyTaxScheme: [
      {
        RegistrationName: [{ _: s.name }],
        CompanyID: [{ _: s.tin, schemeID: "TIN" }],
        TaxScheme: [{ ID: [{ _: "VAT", schemeID: "UN/ECE 5153", schemeAgencyID: "6" }] }],
      },
    ],
    PartyLegalEntity: [
      {
        RegistrationName: [{ _: s.name }],
        CompanyID: [{ _: s.brn ?? s.tin, schemeID: s.brn ? "BRN" : "TIN" }],
      },
    ],
  };

  if (s.email || s.phone) {
    const contact: UblDocument = {};
    if (s.email) (contact as Record<string, unknown>).ElectronicMail = [{ _: s.email }];
    if (s.phone) (contact as Record<string, unknown>).Telephone = [{ _: s.phone }];
    (party as Record<string, unknown>).Contact = [contact];
  }

  return { Party: [party] };
}

function buildCustomer(c: Customer): UblDocument {
  const addr: UblDocument = {
    CityName: [{ _: c.city ?? "NA" }],
    PostalZone: [{ _: c.postalCode ?? "00000" }],
    CountrySubentityCode: [{ _: c.state ?? "17" }],
    Country: [{ IdentificationCode: [{ _: c.country ?? COUNTRY_MY }] }],
  };
  if (c.addressLine1) (addr as Record<string, unknown>).Street = [{ _: c.addressLine1 }];
  if (c.addressLine2) {
    const existing = (addr as Record<string, unknown>).Street as Array<Record<string, unknown>> | undefined;
    if (existing) {
      existing[0] = { ...existing[0], Line: [{ _: c.addressLine2 }] };
    } else {
      (addr as Record<string, unknown>).AdditionalStreet = [{ _: c.addressLine2 }];
    }
  }

  const idScheme = c.taxId ? "TIN" : c.brn ? "BRN" : "TIN";
  const idValue = c.taxId ?? c.brn ?? "";

  const party: UblDocument = {
    PartyIdentification: idValue ? [{ ID: [{ _: idValue, schemeID: idScheme }] }] : [],
    PartyName: [{ Name: [{ _: c.name }] }],
    PostalAddress: [addr],
    PartyLegalEntity: [
      {
        RegistrationName: [{ _: c.name }],
        CompanyID: [{ _: idValue, schemeID: idScheme }],
      },
    ],
  };

  if (c.taxId) {
    (party as Record<string, unknown>).PartyTaxScheme = [
      {
        RegistrationName: [{ _: c.name }],
        CompanyID: [{ _: c.taxId, schemeID: "TIN" }],
        TaxScheme: [{ ID: [{ _: "VAT", schemeID: "UN/ECE 5153", schemeAgencyID: "6" }] }],
      },
    ];
  }

  if (c.email || c.phone) {
    const contact: UblDocument = {};
    if (c.email) (contact as Record<string, unknown>).ElectronicMail = [{ _: c.email }];
    if (c.phone) (contact as Record<string, unknown>).Telephone = [{ _: c.phone }];
    (party as Record<string, unknown>).Contact = [contact];
  }

  return { Party: [party] };
}

function buildLine(line: MapperLine, taxCodes: Map<string, TaxCode>, currency: string): UblDocument {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  const discount = Number(line.discount ?? 0);
  const lineSub = qty * price - discount;
  const tc = line.taxCodeId ? taxCodes.get(line.taxCodeId) : undefined;
  const taxAmount = Number(line.taxAmount ?? 0);
  const lineTotal = lineSub + taxAmount;

  const out: UblDocument = {
    ID: [{ _: String(line.lineNo) }],
    InvoicedQuantity: [{ _: toString(qty, 4), unitCode: line.item?.uom ?? "C62" }],
    LineExtensionAmount: [{ _: toString(lineSub), currencyID: currency }],
    Item: [
      {
        Description: [{ _: line.description }],
        Name: [{ _: line.item?.name ?? line.description }],
        CommodityClassification: line.item?.classification
          ? [{ CommodityCode: [{ _: line.item.classification, listID: "CLASS" }] }]
          : [],
      },
    ],
    Price: [
      {
        PriceAmount: [{ _: toString(price), currencyID: currency }],
      },
    ],
  };
  if (discount > 0) {
    (out as Record<string, unknown[]>).AllowanceCharge = [
      {
        ChargeIndicator: [{ _: false }],
        AllowanceChargeReason: [{ _: "Line discount" }],
        Amount: [{ _: toString(discount), currencyID: currency }],
      },
    ];
  }
  const taxCategory: UblDocument = {
    ID: [{ _: tc ? tc.code : "06" }],
    Name: [{ _: tc ? tc.name : "Not Applicable" }],
    Percent: [{ _: tc ? String(Number(tc.rate) * 100) : "0" }],
    TaxScheme: [{ ID: [{ _: "VAT", schemeID: "UN/ECE 5153", schemeAgencyID: "6" }] }],
  };
  // Tax type code per MyInvois spec (01-06 or E)
  if (tc) {
    const code = tc.taxTypeCode ?? "01";
    (taxCategory as Record<string, unknown[]>).TaxTypeCode = [{ _: code }];
  } else {
    (taxCategory as Record<string, unknown[]>).TaxTypeCode = [{ _: "06" }];
    (taxCategory as Record<string, unknown[]>).TaxExemptionReason = [
      { _: "Not Applicable" },
    ];
  }

  if (tc || taxAmount > 0) {
    (out as Record<string, unknown[]>)["TaxTotal"] = [
      {
        TaxAmount: [{ _: toString(taxAmount), currencyID: currency }],
        RoundingAmount: [{ _: toString(lineTotal), currencyID: currency }],
        TaxSubtotal: [
          {
            TaxableAmount: [{ _: toString(lineSub), currencyID: currency }],
            TaxAmount: [{ _: toString(taxAmount), currencyID: currency }],
            TaxCategory: [taxCategory],
          },
        ],
      },
    ];
  }
  return out;
}

function groupTaxSubtotals(lines: MapperLine[], taxCodes: Map<string, TaxCode>, currency: string): UblDocument[] {
  const buckets = new Map<string, { taxable: number; tax: number; tc: TaxCode }>();
  for (const l of lines) {
    if (!l.taxCodeId) continue;
    const tc = taxCodes.get(l.taxCodeId);
    if (!tc) continue;
    const lineSub = Number(l.quantity) * Number(l.unitPrice) - Number(l.discount ?? 0);
    const tax = Number(l.taxAmount ?? 0);
    const cur = buckets.get(tc.id) ?? { taxable: 0, tax: 0, tc };
    cur.taxable += lineSub;
    cur.tax += tax;
    buckets.set(tc.id, cur);
  }
  return Array.from(buckets.values()).map((b) => {
    const category: UblDocument = {
      ID: [{ _: b.tc.code }],
      Name: [{ _: b.tc.name }],
      Percent: [{ _: String(Number(b.tc.rate) * 100) }],
      TaxScheme: [{ ID: [{ _: "VAT", schemeID: "UN/ECE 5153", schemeAgencyID: "6" }] }],
    };
    (category as Record<string, unknown[]>).TaxTypeCode = [
      { _: b.tc.taxTypeCode ?? "01" },
    ];
    return {
      TaxableAmount: [{ _: toString(b.taxable), currencyID: currency }],
      TaxAmount: [{ _: toString(b.tax), currencyID: currency }],
      TaxCategory: [category],
    };
  });
}

function toString(n: unknown, fractionDigits = 2): string {
  return Number(n ?? 0).toFixed(fractionDigits);
}
