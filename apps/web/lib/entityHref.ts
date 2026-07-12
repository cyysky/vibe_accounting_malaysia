/**
 * Single source of truth for entity-name → detail-page deep-links.
 *
 * Both the audit-log page and the dashboard page use this helper so the
 * system-wide linking rules stay in sync. Add new entities here as new
 * detail pages are introduced.
 *
 * Returns null when the entity has no detail page (e.g. audit log for an
 * entity that is only navigated via a parent list).
 */
export function entityHref(entity: string, entityId: string): string | null {
  switch (entity) {
    case "CustomerInvoice":
      return "/receivables/" + entityId;
    case "SupplierInvoice":
      return "/payables/" + entityId;
    case "CreditNote":
      return "/receivables/credit-notes/" + entityId;
    case "DebitNote":
      return "/payables/debit-notes/" + entityId;
    case "CustomerPayment":
      return "/receivables/payments/" + entityId;
    case "SupplierPayment":
      return "/payables/payments/" + entityId;
    case "RecurringInvoice":
      return "/recurring/" + entityId;
    case "SalesOrder":
      return "/sales/" + entityId;
    case "PurchaseOrder":
      return "/purchase/" + entityId;
    case "Customer":
      return "/receivables/customers/" + entityId;
    case "Supplier":
      return "/payables/suppliers/" + entityId;
    case "JournalEntry":
      return entityId ? "/dashboard/journal/" + entityId : "/dashboard/journal";
    case "Item":
    case "StockItem":
      return "/stock/" + entityId;
    case "StockMovement":
      return "/stock/movements/" + entityId;
    case "User":
      return "/settings/users/" + entityId;
    case "AccountBook":
      return "/settings/books/" + entityId;
    case "FiscalYear":
      return "/settings/fiscal-years/" + entityId;
    case "TaxCode":
      return "/settings/tax-codes/" + entityId;
    case "BankAccount":
      return "/settings/bank-accounts/" + entityId;
    case "EinvoiceSubmission":
      return entityId ? "/receivables/" + entityId : "/einvoice/submissions";
    case "EinvoiceConfig":
      return "/einvoice/configs";
    default:
      return null;
  }
}

/**
 * All entity names that have a known detail page. Used by the audit-log
 * filter UI to populate the entity dropdown.
 */
export const KNOWN_ENTITIES: ReadonlyArray<string> = [
  "CustomerInvoice",
  "SupplierInvoice",
  "JournalEntry",
  "CustomerPayment",
  "SupplierPayment",
  "EinvoiceSubmission",
  "EinvoiceConfig",
  "Customer",
  "Supplier",
  "Item",
  "User",
  "AccountBook",
  "FiscalYear",
  "TaxCode",
  "BankAccount",
  "CreditNote",
  "DebitNote",
  "RecurringInvoice",
  "SalesOrder",
  "PurchaseOrder",
  "StockItem",
  "StockMovement",
] as const;

/** Audit actions that the system produces. Used by the audit-log filter UI. */
export const KNOWN_ACTIONS: ReadonlyArray<string> = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "POST",
  "SUBMIT",
  "VALIDATE",
  "CANCEL",
  "REJECT",
  "POLL",
  "PAY",
  "CLOSE",
  "REOPEN",
] as const;
