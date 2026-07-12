import { validateUblDocument } from "./ubl.validator";
import { buildUblInvoice } from "../mappers/invoice-v1.1.mapper";
import { Prisma } from "@prisma/client";
import type { Customer, CustomerInvoice } from "@prisma/client";

const D = (v: number) => new Prisma.Decimal(v);

const baseCustomer: Customer = {
  id: "c1",
  accountBookId: "b1",
  code: "C001",
  name: "Acme Sdn Bhd",
  email: "ap@acme.test",
  phone: null,
  taxId: "C123",
  brn: "202005123456",
  addressLine1: null,
  addressLine2: null,
  city: "KL",
  state: "14",
  postalCode: "50000",
  country: "MY",
  currency: "MYR",
  creditLimit: D(0),
  outstanding: D(0),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const invoice: CustomerInvoice = {
  id: "i1",
  accountBookId: "b1",
  customerId: "c1",
  number: "INV-0001",
  date: new Date("2025-01-15T00:00:00Z"),
  dueDate: new Date("2025-02-15T00:00:00Z"),
  currency: "MYR",
  exchangeRate: D(1),
  subtotal: D(100),
  taxTotal: D(0),
  total: D(100),
  paid: D(0),
  balance: D(100),
  status: "ISSUED",
  notes: null,
  einvoiceStatus: "NOT_SUBMITTED",
  einvoiceUuid: null,
  einvoiceLongId: null,
  einvoiceQR: null,
  einvoiceValidatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UBL validator: extras", () => {
  it("rejects an empty object as a UBL envelope", () => {
    const result = validateUblDocument({} as never);
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBeGreaterThan(0);
  });

  it("flags missing currencyID on monetary amounts", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
      version: "1.1",
    });
    const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
    const monetary = inner.LegalMonetaryTotal as Array<Record<string, unknown>>;
    delete (monetary[0].PayableAmount as Array<Record<string, unknown>>)[0].currencyID;
    const result = validateUblDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "LegalMonetaryTotal/PayableAmount" && i.code === "REQUIRED")).toBe(true);
  });

  it("flags a TaxTypeCode=E line without TaxExemptionReason", () => {
    const doc = buildUblInvoice({
      invoice: {
        ...invoice,
        lines: [
          { description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: "t1" },
        ],
      },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map([
        ["t1", { id: "t1", accountBookId: "b1", code: "EXEMPT", name: "Exempt", rate: D(0), description: null, active: true, taxTypeCode: "E" }],
      ]),
      version: "1.1",
    });
    // Strip TaxExemptionReason from the line category so we can verify the
    // validator flags it. The mapper does not currently set it for code E so
    // we can validate the negative case here.
    const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
    const line = (inner.InvoiceLine as Array<Record<string, unknown>>)[0];
    const tt = (line.TaxTotal as Array<Record<string, unknown>>)[0];
    const sub = (tt.TaxSubtotal as Array<Record<string, unknown>>)[0];
    const cat = (sub.TaxCategory as Array<Record<string, unknown>>)[0];
    delete cat.TaxExemptionReason;
    const result = validateUblDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "REQUIRED" && i.message.includes("TaxExemptionReason"))).toBe(true);
  });

  it("includes a stable document hash in the validation result", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
      version: "1.1",
    });
    const a = validateUblDocument(doc);
    const b = validateUblDocument(doc);
    expect(a.documentHash).toBe(b.documentHash);
    expect(a.documentHash.startsWith("val-")).toBe(true);
  });

  it("validates an invoice with InvoicePeriod, PaymentMeans and AdditionalDocumentReference", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [{ description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
      version: "1.1",
      deliveryDate: new Date("2025-01-20T00:00:00Z"),
      paymentMeansCode: "03",
      paymentAccountNo: "1234567890",
      additionalReferences: [{ id: "FTT-2025-001" }],
    });
    const result = validateUblDocument(doc);
    expect(result.valid).toBe(true);
  });

  it("flags a 5-digit MSIC code as warning when missing", () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
      taxCodes: new Map(),
      version: "1.1",
    });
    const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
    const supplier = ((inner.AccountingSupplierParty as Array<Record<string, unknown>>)[0].Party as Array<Record<string, unknown>>)[0];
    (supplier.IndustryClassificationCode as Array<Record<string, unknown>>)[0]._ = "123";
    const result = validateUblDocument(doc);
    expect(result.warnings.some((w) => w.path?.startsWith("AccountingSupplierParty/IndustryClassificationCode"))).toBe(true);
  });

  describe("Supplier TIN format", () => {
    it("warns when the supplier TIN is not digit-shaped", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "BROKEN-TIN-12345", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
      });
      const result = validateUblDocument(doc);
      expect(result.warnings.some((w) => w.path === "Supplier/PartyTaxScheme/CompanyID" && /LHDNM pattern/.test(w.message))).toBe(true);
    });

    it("accepts a properly-formatted LHDNM TIN with IG prefix", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG1234567890", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
      });
      const result = validateUblDocument(doc);
      expect(result.warnings.some((w) => w.path === "Supplier/PartyTaxScheme/CompanyID" && /LHDNM pattern/.test(w.message))).toBe(false);
    });
  });

  describe("PaymentMeans and AdditionalDocumentReference validation", () => {
    it("warns when PaymentMeansCode is outside the recommended list", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        paymentMeansCode: "ZZ",
      });
      const result = validateUblDocument(doc);
      expect(result.warnings.some((w) => w.path === "PaymentMeans[0].PaymentMeansCode")).toBe(true);
    });

    it("errors when PayeeFinancialAccount has no ID", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        paymentMeansCode: "03",
      });
      // Inject an empty ID into the PayeeFinancialAccount.
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const means = (inner.PaymentMeans as Array<Record<string, unknown>>)[0];
      means.PayeeFinancialAccount = [{ ID: [{ _: "" }] }];
      const result = validateUblDocument(doc);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.path === "PaymentMeans[0].PayeeFinancialAccount.ID")).toBe(true);
    });

    it("warns when PayeeFinancialAccount ID is not digit-shaped", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: "Widget", quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1, taxCodeId: null, taxCode: null, item: null }] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        paymentMeansCode: "03",
        paymentAccountNo: "MAYBE_BANK_ACCOUNT",
      });
      const result = validateUblDocument(doc);
      expect(result.warnings.some((w) => w.path === "PaymentMeans[0].PayeeFinancialAccount.ID")).toBe(true);
    });

    it("errors on duplicated AdditionalDocumentReference IDs", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        additionalReferences: [{ id: "FTT-2025-001" }, { id: "FTT-2025-001" }],
      });
      const result = validateUblDocument(doc);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "FORMAT" && i.message.includes("duplicated"))).toBe(true);
    });

    it("errors when AdditionalDocumentReference has no ID", () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [] },
        customer: baseCustomer,
        supplier: { tin: "IG123", brn: "BRN123", name: "Demo Co" },
        taxCodes: new Map(),
        version: "1.1",
        additionalReferences: [{ id: "" }],
      });
      const result = validateUblDocument(doc);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.path === "AdditionalDocumentReference[0].ID")).toBe(true);
    });
  });

});
