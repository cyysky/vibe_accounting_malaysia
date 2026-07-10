import { Prisma } from "@prisma/client";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { DocumentSequenceService } from "../../database/document-sequence.service";

/**
 * Auto-post customer / supplier payments to GL.
 * Reuses the same chart-of-accounts conventions as invoice posting:
 *   - 1000 Cash on Hand, 1100 Bank
 *   - 1200 Accounts Receivable, 2000 Accounts Payable
 */
@Injectable()
export class PaymentPostingService {
  private readonly logger = new Logger(PaymentPostingService.name);

  constructor(private readonly prisma: PrismaService, private readonly seq: DocumentSequenceService) {}

  private async accountId(bookId: string, code: string): Promise<string | null> {
    const a = await this.prisma.account.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code } },
    });
    return a?.id ?? null;
  }

  private async ensureOpenFiscalYear(bookId: string, date: Date): Promise<string> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { accountBookId: bookId, startDate: { lte: date }, endDate: { gte: date } },
    });
    if (!fy) throw new BadRequestException("No fiscal year configured for date " + date.toISOString().slice(0, 10));
    if (fy.closed) throw new BadRequestException("Fiscal year " + fy.year + " is closed");
    return fy.id;
  }

  private async nextJournalNumber(bookId: string): Promise<string> {
    return this.seq.next(bookId, "JV", 4);
  }

  async postCustomerPayment(paymentId: string): Promise<string | null> {
    const payment = await this.prisma.customerPayment.findUnique({
      where: { id: paymentId },
      include: { customer: true },
    });
    if (!payment) return null;

    const fiscalYearId = await this.ensureOpenFiscalYear(payment.accountBookId, payment.date);
    const bankId = (await this.accountId(payment.accountBookId, "1100")) ??
      (await this.accountId(payment.accountBookId, "1000"));
    const arId = await this.accountId(payment.accountBookId, "1200");
    if (!arId || !bankId) {
      this.logger.warn(
        "Skipping GL post for customer payment " + payment.number + ": missing Bank/Cash (1100/1000) or AR (1200) account",
      );
      return null;
    }

    const amount = new Prisma.Decimal(payment.amount);
    const number = await this.nextJournalNumber(payment.accountBookId);

    const jv = await this.prisma.journalEntry.create({
      data: {
        accountBookId: payment.accountBookId,
        number,
        fiscalYearId,
        date: payment.date,
        description: "Customer payment " + payment.number + " from " + payment.customer.name,
        reference: payment.number,
        status: "POSTED",
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create: [
            { accountId: bankId, debit: amount, credit: new Prisma.Decimal(0), description: "Receipt " + payment.number },
            { accountId: arId, debit: new Prisma.Decimal(0), credit: amount, description: "AR cleared " + payment.number },
          ],
        },
      },
    });
    await this.prisma.customerPayment.update({ where: { id: payment.id }, data: { journalId: jv.id } });
    this.logger.log("Posted customer payment " + payment.number + " -> JV " + jv.number);
    return jv.id;
  }

  async postSupplierPayment(paymentId: string): Promise<string | null> {
    const payment = await this.prisma.supplierPayment.findUnique({
      where: { id: paymentId },
      include: { supplier: true },
    });
    if (!payment) return null;

    const fiscalYearId = await this.ensureOpenFiscalYear(payment.accountBookId, payment.date);
    const bankId = (await this.accountId(payment.accountBookId, "1100")) ??
      (await this.accountId(payment.accountBookId, "1000"));
    const apId = await this.accountId(payment.accountBookId, "2000");
    if (!apId || !bankId) {
      this.logger.warn(
        "Skipping GL post for supplier payment " + payment.number + ": missing Bank/Cash (1100/1000) or AP (2000) account",
      );
      return null;
    }

    const amount = new Prisma.Decimal(payment.amount);
    const number = await this.nextJournalNumber(payment.accountBookId);

    const jv = await this.prisma.journalEntry.create({
      data: {
        accountBookId: payment.accountBookId,
        number,
        fiscalYearId,
        date: payment.date,
        description: "Supplier payment " + payment.number + " to " + payment.supplier.name,
        reference: payment.number,
        status: "POSTED",
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create: [
            { accountId: apId, debit: amount, credit: new Prisma.Decimal(0), description: "AP cleared " + payment.number },
            { accountId: bankId, debit: new Prisma.Decimal(0), credit: amount, description: "Disbursement " + payment.number },
          ],
        },
      },
    });
    await this.prisma.supplierPayment.update({ where: { id: payment.id }, data: { journalId: jv.id } });
    this.logger.log("Posted supplier payment " + payment.number + " -> JV " + jv.number);
    return jv.id;
  }
}
