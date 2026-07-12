import { buildUblInvoice, toCountryCode, toStateCode } from "./invoice-v1.1.mapper";
import type { Customer, CustomerInvoice } from "@prisma/client";
import { Prisma } from "@prisma/client";

describe("UBL mapper: MyInvois SDK compliance extras", () => {
  const D = (v: number) => new Prisma.Decimal(v);
  const baseCustomer: Customer = {
    id: "c1", accountBookId: "b1", code: "C001", name: "Acme",
    email: null, phone: null, taxId: "C123", brn: null,
    addressLine1: null, addressLine2: null, city: "KL", state: "14",
    postalCode: "50000", country: "MY", currency: "MYR",
    creditLimit: D(0), outstanding: D(0), active: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  const invoice: CustomerInvoice = {
    id: "i1", accountBookId: "b1", customerId: "c1", number: "INV-0001",
    date: new Date("2025-01-15T00:00:00Z"), dueDate: new Date("2025-02-15T00:00:00Z"),
    currency: "MYR", exchangeRate: D(1), subtotal: D(100), taxTotal: D(8), total: D(108),
    paid: D(0), balance: D(108), status: "ISSUED", notes: null,
    einvoiceStatus: "NOT_SUBMITTED", einvoiceUuid: null, einvoiceLongId: null,
    einvoiceQR: null, einvoiceValidatedAt: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  describe("toStateCode", () => {
    it("maps common state names to ISO-3166-2:MY codes", () => {
      expect(toStateCode("Selangor")).toBe("10");
      expect(toStateCode("Kuala Lumpur")).toBe("14");
      expect(toStateCode("Wilayah Persekutuan Kuala Lumpur")).toBe("14");
      expect(toStateCode("Pulau Pinang")).toBe("07");
      expect(toStateCode("Penang")).toBe("07");
      expect(toStateCode("Sabah")).toBe("12");
    });

    it("passes through valid 2-digit codes", () => {
      expect(toStateCode("01")).toBe("01");
      expect(toStateCode("17")).toBe("17");
    });

    it("falls back to 17 (Not Applicable) for unknown input", () => {
      expect(toStateCode("")).toBe("17");
      expect(toStateCode(null)).toBe("17");
      expect(toStateCode(undefined)).toBe("17");
      expect(toStateCode("Atlantis")).toBe("17");
    });
  });

  it("emits ISO alpha-3 Country code from free-form country name", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: { ...baseCustomer, country: "SG" },
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co", country: "Malaysia" },
      taxCodes: new Map(),
      documentType: "invoice",
    });
    const root = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    const supplierAddr = ((root.AccountingSupplierParty as Array<Record<string, unknown>>)[0].Party as Array<Record<string, unknown>>)[0].PostalAddress as Array<Record<string, unknown>>;
    const customerAddr = ((root.AccountingCustomerParty as Array<Record<string, unknown>>)[0].Party as Array<Record<string, unknown>>)[0].PostalAddress as Array<Record<string, unknown>>;
    expect(((supplierAddr[0].Country as Array<Record<string, unknown>>)[0].IdentificationCode as Array<{ _: string }>)[0]._).toBe("MYS");
    expect(((customerAddr[0].Country as Array<Record<string, unknown>>)[0].IdentificationCode as Array<{ _: string }>)[0]._).toBe("SGP");
  });

  it("emits self-billed-refund-note document type code 14", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
      documentType: "self-billed-refund-note",
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    expect((inv.InvoiceTypeCode as Array<{ _: string }>)[0]._).toBe("14");
  });

  it("emits refund-note document type code 04", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
      documentType: "refund-note",
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    expect((inv.InvoiceTypeCode as Array<{ _: string }>)[0]._).toBe("04");
  });

  it("maps customer state name to ISO state code in PostalAddress", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: { ...baseCustomer, state: "Selangor" },
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    const customerAddr = (
      ((inv.AccountingCustomerParty as Array<Record<string, unknown>>)[0].Party as Array<Record<string, unknown>>)[0]
        .PostalAddress as Array<Record<string, unknown>>
    )[0];
    expect((customerAddr.CountrySubentityCode as Array<{ _: string }>)[0]._).toBe("10");
  });

  it("aggregates allowance totals across lines", () => {
    const doc = buildUblInvoice({
      invoice: {
        ...invoice,
        lines: [
          { description: "A", quantity: 1, unitPrice: 100, discount: 5, taxAmount: 0, lineNo: 1 },
          { description: "B", quantity: 1, unitPrice: 100, discount: 3, taxAmount: 0, lineNo: 2 },
        ],
      },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    const monetary = (inv.LegalMonetaryTotal as Array<Record<string, unknown>>)[0];
    expect((monetary.AllowanceTotalAmount as Array<{ _: string }>)[0]._).toBe("8.00");
  });

  describe("toCountryCode", () => {
    it("passes through 3-letter ISO codes", () => {
      expect(toCountryCode("MYS")).toBe("MYS");
      expect(toCountryCode("SGP")).toBe("SGP");
      expect(toCountryCode("USA")).toBe("USA");
    });
    it("uppercases 3-letter codes", () => {
      expect(toCountryCode("mys")).toBe("MYS");
    });
    it("maps common free-form names", () => {
      expect(toCountryCode("Malaysia")).toBe("MYS");
      expect(toCountryCode("Singapore")).toBe("SGP");
      expect(toCountryCode("United States")).toBe("USA");
      expect(toCountryCode("South Korea")).toBe("KOR");
      expect(toCountryCode("Hong Kong")).toBe("HKG");
      expect(toCountryCode("Brunei")).toBe("BRN");
    });
    it("maps 2-letter ISO alpha-2 codes for common countries", () => {
      expect(toCountryCode("MY")).toBe("MYS");
      expect(toCountryCode("SG")).toBe("SGP");
      expect(toCountryCode("ID")).toBe("IDN");
      expect(toCountryCode("US")).toBe("USA");
    });
    it("falls back to MYS for null/empty/unknown", () => {
      expect(toCountryCode(null)).toBe("MYS");
      expect(toCountryCode(undefined)).toBe("MYS");
      expect(toCountryCode("")).toBe("MYS");
      expect(toCountryCode("Atlantis")).toBe("MYS");
    });
  });

  describe("InvoicePeriod (delivery date)", () => {
    it("emits InvoicePeriod StartDate when deliveryDate is provided", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: null, name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        deliveryDate: new Date("2025-01-20T00:00:00Z"),
      });
      const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
      const period = ubl.InvoicePeriod as Array<Record<string, unknown>>;
      expect(period).toBeDefined();
      expect(period[0].StartDate).toEqual([{ _: "2025-01-20" }]);
    });
    it("omits InvoicePeriod when deliveryDate is null/undefined", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: null, name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
      });
      const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
      expect(ubl.InvoicePeriod).toBeUndefined();
    });
  });

  describe("PaymentMeans with PayeeFinancialAccount", () => {
    it("emits PaymentMeansCode alone when no account number is provided", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: null, name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        paymentMeansCode: "03",
      });
      const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
      const means = ubl.PaymentMeans as Array<Record<string, unknown>>;
      expect(means[0].PaymentMeansCode).toEqual([{ _: "03" }]);
      expect(means[0].PayeeFinancialAccount).toBeUndefined();
    });
    it("emits PayeeFinancialAccount when paymentAccountNo is set", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: null, name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        paymentMeansCode: "03",
        paymentAccountNo: "1234567890",
      });
      const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
      const means = ubl.PaymentMeans as Array<Record<string, unknown>>;
      const acct = means[0].PayeeFinancialAccount as Array<Record<string, unknown>>;
      expect(acct[0].ID).toEqual([{ _: "1234567890" }]);
    });
  });

  describe("AdditionalDocumentReference (FTT / WHT)", () => {
    it("emits one AdditionalDocumentReference per entry", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: null, name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        additionalReferences: [
          { id: "FTT-2025-001", documentType: "FTT", documentDescription: "Tourism tax reference" },
          { id: "WHT-2025-007" },
        ],
      });
      const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
      const refs = ubl.AdditionalDocumentReference as Array<Record<string, unknown>>;
      expect(refs).toHaveLength(2);
      expect(refs[0].ID).toEqual([{ _: "FTT-2025-001" }]);
      expect(refs[0].DocumentType).toBe("FTT");
      expect((refs[0].DocumentDescription as Array<{ _: string }>)[0]._).toBe("Tourism tax reference");
      expect(refs[1].ID).toEqual([{ _: "WHT-2025-007" }]);
      expect(refs[1].DocumentType).toBeUndefined();
      expect(refs[1].DocumentDescription).toBeUndefined();
    });
    it("omits AdditionalDocumentReference when array is empty", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: null, name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        additionalReferences: [],
      });
      const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
      expect(ubl.AdditionalDocumentReference).toBeUndefined();
    });
  });

});
