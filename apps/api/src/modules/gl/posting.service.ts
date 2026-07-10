import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service that auto-posts accounting transactions to the General Ledger.
 *
 * Today it handles:
 *   - Sales invoice:   DR Accounts Receivable, CR Sales Revenue + CR Tax (SST) Payable
 *   - Customer payment: DR Cash/Bank,     CR Accounts Receivable
 *   - Supplier bill:   DR Expense (or Inventory),  DR Input Tax,  CR Accounts Payable
 *
 * Each account is looked up by the *type* and code convention used by the
 * default seed chart of accounts:
 *   - 1200 Accounts Receivable
 *   - 2000 Accounts Payable
 *   - 2100 SST Payable (output tax)
 *   - 4000 Sales Revenue
 *   - 5000 Cost of Goods Sold / Purchases
 *   - 1000 Cash on Hand / 1100 Bank
 *
 * Posting is skipped silently if the required GL accounts are missing
 * (so this works on books with custom COA), but the journal entry is
 * NOT created in that case.
 */
@Injectable()
export class PostingService {
  private readonly logger = new Logger(PostingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the account id for a given book + code, or null. */
  private async accountId(bookId: string, code: string): Promise<string | null> {
    const a = await this.prisma.account.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code } },
    });
    return a?.id ?? null;
  }

  /** True if a journal can be posted for the given date (within an open fiscal year). */
  private async ensureOpenFiscalYear(bookId: string, date: Date): Promise<string> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: {
        accountBookId: bookId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    if (!fy) {
      throw new BadRequestException(
        `No fiscal year configured for date ${date.toISOString().slice(0, 10)}. Create one via POST /gl/fiscal-years.`,
      );
    }
    if (fy.closed) {
      throw new BadRequestException(`Fiscal year ${fy.year} is closed`);
    }
    return fy.id;
  }

  /**
   * Post a customer invoice to GL.
   *  DR AR (subtotal + tax)
   *  CR Sales (subtotal)
   *  CR SST Payable (tax)
   */
  async postCustomerInvoice(invoiceId: string): Promise<string | null> {
    const invoice = await this.prisma.customerInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });
    if (!invoice) return null;

    const fiscalYearId = await this.ensureOpenFiscalYear(invoice.accountBookId, invoice.date);
    const arId = await this.accountId(invoice.accountBookId, '1200');
    const salesId = await this.accountId(invoice.accountBookId, '4000');
    const taxId = await this.accountId(invoice.accountBookId, '2100');

    if (!arId || !salesId) {
      this.logger.warn(
        `Skipping GL post for invoice ${invoice.number}: missing AR or Sales account in book ${invoice.accountBookId}`,
      );
      return null;
    }

    const subtotal = new Prisma.Decimal(invoice.subtotal);
    const taxTotal = new Prisma.Decimal(invoice.taxTotal);
    const total = new Prisma.Decimal(invoice.total);

    const lines: Array<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description?: string }> = [
      { accountId: arId, debit: total, credit: new Prisma.Decimal(0), description: `AR for ${invoice.number}` },
      { accountId: salesId, debit: new Prisma.Decimal(0), credit: subtotal, description: `Sales for ${invoice.number}` },
    ];
    if (taxTotal.gt(0) && taxId) {
      lines.push({ accountId: taxId, debit: new Prisma.Decimal(0), credit: taxTotal, description: `SST for ${invoice.number}` });
    }

    // Numbered JV-#####
    const count = await this.prisma.journalEntry.count({ where: { accountBookId: invoice.accountBookId } });
    const number = `JV-${String(count + 1).padStart(4, '0')}`;

    const created = await this.prisma.journalEntry.create({
      data: {
        accountBookId: invoice.accountBookId,
        number,
        fiscalYearId,
        date: invoice.date,
        description: `Auto-posted from invoice ${invoice.number}`,
        reference: invoice.number,
        status: 'POSTED',
        totalDebit: total,
        totalCredit: total,
        lines: { create: lines },
      },
    });
    this.logger.log(`Posted invoice ${invoice.number} -> JV ${created.number}`);
    return created.id;
  }

  /**
   * Post a supplier bill to GL.
   *  DR Purchases (subtotal)
   *  DR SST Receivable / Input Tax (tax)
   *  CR AP (total)
   *
   * Note: Input-tax account (2110) is optional.  If absent we still post
   * the tax line to the SST payable account for simplicity.
   */
  async postSupplierInvoice(invoiceId: string): Promise<string | null> {
    const invoice = await this.prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });
    if (!invoice) return null;

    const fiscalYearId = await this.ensureOpenFiscalYear(invoice.accountBookId, invoice.date);
    const apId = await this.accountId(invoice.accountBookId, '2000');
    const purchasesId = await this.accountId(invoice.accountBookId, '5000');
    const inputTaxId = (await this.accountId(invoice.accountBookId, '2110')) ??
      (await this.accountId(invoice.accountBookId, '2100'));

    if (!apId || !purchasesId) {
      this.logger.warn(
        `Skipping GL post for bill ${invoice.number}: missing AP or Purchases account`,
      );
      return null;
    }

    const subtotal = new Prisma.Decimal(invoice.subtotal);
    const taxTotal = new Prisma.Decimal(invoice.taxTotal);
    const total = new Prisma.Decimal(invoice.total);

    const lines: Array<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description?: string }> = [
      { accountId: purchasesId, debit: subtotal, credit: new Prisma.Decimal(0), description: `Purchases for ${invoice.number}` },
      { accountId: apId, debit: new Prisma.Decimal(0), credit: total, description: `AP for ${invoice.number}` },
    ];
    if (taxTotal.gt(0) && inputTaxId) {
      lines.push({ accountId: inputTaxId, debit: taxTotal, credit: new Prisma.Decimal(0), description: `Input tax for ${invoice.number}` });
    }

    const count = await this.prisma.journalEntry.count({ where: { accountBookId: invoice.accountBookId } });
    const number = `JV-${String(count + 1).padStart(4, '0')}`;

    const created = await this.prisma.journalEntry.create({
      data: {
        accountBookId: invoice.accountBookId,
        number,
        fiscalYearId,
        date: invoice.date,
        description: `Auto-posted from supplier bill ${invoice.number}`,
        reference: invoice.number,
        status: 'POSTED',
        totalDebit: total,
        totalCredit: total,
        lines: { create: lines },
      },
    });
    this.logger.log(`Posted bill ${invoice.number} -> JV ${created.number}`);
    return created.id;
  }

  /**
   * Post a credit note (refund / sales return).
   *  DR Sales Returns / Sales (subtotal)
   *  DR SST Payable (tax)
   *  CR Accounts Receivable (total)
   *
   * Sales Returns is typically 4100 in a Malaysian COA; we fall back to 4000
   * if not present.
   */
  async postCreditNote(creditNoteId: string): Promise<string | null> {
    const cn = await this.prisma.creditNote.findUnique({ where: { id: creditNoteId } });
    if (!cn) return null;

    const fiscalYearId = await this.ensureOpenFiscalYear(cn.accountBookId, cn.date);
    const arId = await this.accountId(cn.accountBookId, "1200");
    const returnsId = (await this.accountId(cn.accountBookId, "4100")) ??
      (await this.accountId(cn.accountBookId, "4000"));
    const taxId = await this.accountId(cn.accountBookId, "2100");

    if (!arId || !returnsId) {
      this.logger.warn(
        `Skipping GL post for credit note ${cn.number}: missing AR or Sales Returns account`,
      );
      return null;
    }

    const subtotal = new Prisma.Decimal(cn.subtotal);
    const taxTotal = new Prisma.Decimal(cn.taxTotal);
    const total = new Prisma.Decimal(cn.total);

    const lines: Array<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description?: string }> = [
      { accountId: returnsId, debit: subtotal, credit: new Prisma.Decimal(0), description: `Sales return ${cn.number}` },
      { accountId: arId, debit: new Prisma.Decimal(0), credit: total, description: `AR cleared ${cn.number}` },
    ];
    if (taxTotal.gt(0) && taxId) {
      lines.unshift({ accountId: taxId, debit: taxTotal, credit: new Prisma.Decimal(0), description: `SST reversal ${cn.number}` });
    }

    const count = await this.prisma.journalEntry.count({ where: { accountBookId: cn.accountBookId } });
    const number = `JV-${String(count + 1).padStart(4, "0")}`;

    const created = await this.prisma.journalEntry.create({
      data: {
        accountBookId: cn.accountBookId,
        number,
        fiscalYearId,
        date: cn.date,
        description: `Auto-posted from credit note ${cn.number}`,
        reference: cn.number,
        status: "POSTED",
        totalDebit: total,
        totalCredit: total,
        lines: { create: lines },
      },
    });
    this.logger.log(`Posted credit note ${cn.number} -> JV ${created.number}`);
    return created.id;
  }

  /**
   * Post a debit note (additional supplier charge).
   *  DR Purchases / Expense (subtotal)
   *  DR Input Tax (tax)
   *  CR Accounts Payable (total)
   */
  async postDebitNote(debitNoteId: string): Promise<string | null> {
    const dn = await this.prisma.debitNote.findUnique({ where: { id: debitNoteId } });
    if (!dn) return null;

    const fiscalYearId = await this.ensureOpenFiscalYear(dn.accountBookId, dn.date);
    const apId = await this.accountId(dn.accountBookId, "2000");
    const purchasesId = await this.accountId(dn.accountBookId, "5000");
    const inputTaxId = (await this.accountId(dn.accountBookId, "2110")) ??
      (await this.accountId(dn.accountBookId, "2100"));

    if (!apId || !purchasesId) {
      this.logger.warn(
        `Skipping GL post for debit note ${dn.number}: missing AP or Purchases account`,
      );
      return null;
    }

    const subtotal = new Prisma.Decimal(dn.subtotal);
    const taxTotal = new Prisma.Decimal(dn.taxTotal);
    const total = new Prisma.Decimal(dn.total);

    const lines: Array<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description?: string }> = [
      { accountId: purchasesId, debit: subtotal, credit: new Prisma.Decimal(0), description: `Purchases ${dn.number}` },
      { accountId: apId, debit: new Prisma.Decimal(0), credit: total, description: `AP ${dn.number}` },
    ];
    if (taxTotal.gt(0) && inputTaxId) {
      lines.push({ accountId: inputTaxId, debit: taxTotal, credit: new Prisma.Decimal(0), description: `Input tax ${dn.number}` });
    }

    const count = await this.prisma.journalEntry.count({ where: { accountBookId: dn.accountBookId } });
    const number = `JV-${String(count + 1).padStart(4, "0")}`;

    const created = await this.prisma.journalEntry.create({
      data: {
        accountBookId: dn.accountBookId,
        number,
        fiscalYearId,
        date: dn.date,
        description: `Auto-posted from debit note ${dn.number}`,
        reference: dn.number,
        status: "POSTED",
        totalDebit: total,
        totalCredit: total,
        lines: { create: lines },
      },
    });
    this.logger.log(`Posted debit note ${dn.number} -> JV ${created.number}`);
    return created.id;
  }
}
