import { entityHref, KNOWN_ENTITIES, KNOWN_ACTIONS } from "./entityHref";

describe("entityHref", () => {
  it("routes the most common entities to their detail pages", () => {
    const cases: Array<[string, string, string]> = [
      ["CustomerInvoice", "ci1", "/receivables/ci1"],
      ["SupplierInvoice", "si1", "/payables/si1"],
      ["CreditNote", "cn1", "/receivables/credit-notes/cn1"],
      ["DebitNote", "dn1", "/payables/debit-notes/dn1"],
      ["CustomerPayment", "cp1", "/receivables/payments/cp1"],
      ["SupplierPayment", "sp1", "/payables/payments/sp1"],
      ["RecurringInvoice", "ri1", "/recurring/ri1"],
      ["SalesOrder", "so1", "/sales/so1"],
      ["PurchaseOrder", "po1", "/purchase/po1"],
      ["Customer", "c1", "/receivables/customers/c1"],
      ["Supplier", "s1", "/payables/suppliers/s1"],
      ["JournalEntry", "j1", "/dashboard/journal/j1"],
      ["Item", "i1", "/stock/i1"],
      ["StockMovement", "sm1", "/stock/movements/sm1"],
      ["User", "u1", "/settings/users/u1"],
      ["AccountBook", "ab1", "/settings/books/ab1"],
      ["FiscalYear", "fy1", "/settings/fiscal-years/fy1"],
      ["TaxCode", "tc1", "/settings/tax-codes/tc1"],
      ["BankAccount", "ba1", "/settings/bank-accounts/ba1"],
    ];
    for (const [entity, id, expected] of cases) {
      expect(entityHref(entity, id)).toBe(expected);
    }
  });

  it("routes JournalEntry to the list when no id is provided", () => {
    expect(entityHref("JournalEntry", "")).toBe("/dashboard/journal");
  });

  it("routes EinvoiceSubmission to the underlying invoice if available", () => {
    expect(entityHref("EinvoiceSubmission", "sub1")).toBe("/receivables/sub1");
    expect(entityHref("EinvoiceSubmission", "")).toBe("/einvoice/submissions");
  });

  it("routes EinvoiceConfig to the configs page", () => {
    expect(entityHref("EinvoiceConfig", "ec1")).toBe("/einvoice/configs");
  });

  it("returns null for unknown entities", () => {
    expect(entityHref("SomethingNew", "x")).toBeNull();
    expect(entityHref("", "")).toBeNull();
  });

  it("exposes a non-empty KNOWN_ENTITIES list with the new entities", () => {
    expect(KNOWN_ENTITIES.length).toBeGreaterThanOrEqual(20);
    expect(KNOWN_ENTITIES).toContain("CreditNote");
    expect(KNOWN_ENTITIES).toContain("DebitNote");
    expect(KNOWN_ENTITIES).toContain("CustomerPayment");
    expect(KNOWN_ENTITIES).toContain("SupplierPayment");
    expect(KNOWN_ENTITIES).toContain("RecurringInvoice");
  });

  it("exposes all supported KNOWN_ACTIONS", () => {
    for (const a of ["CREATE", "UPDATE", "DELETE", "POST", "SUBMIT", "VALIDATE", "CANCEL", "REJECT", "POLL", "PAY", "CLOSE", "REOPEN"]) {
      expect(KNOWN_ACTIONS).toContain(a);
    }
  });

  it("every entity in KNOWN_ENTITIES resolves to a non-null href", () => {
    for (const e of KNOWN_ENTITIES) {
      expect(entityHref(e, "x")).not.toBeNull();
    }
  });
});
