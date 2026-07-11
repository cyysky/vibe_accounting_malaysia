import { buildUblInvoice, toStateCode } from "./invoice-v1.1.mapper";
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
});
