import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { DocumentSequenceService } from "../../database/document-sequence.service";
import { PaymentPostingService } from "../gl/posting-payments";
import { CreateCustomerPaymentDto, CreateSupplierPaymentDto } from "./dto/payment.dto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seq: DocumentSequenceService,
    private readonly posting: PaymentPostingService,
  ) {}

  // ---- Customer payments ----
  listCustomerPayments(bookId: string) {
    return this.prisma.customerPayment.findMany({
      where: { accountBookId: bookId },
      orderBy: { date: "desc" },
      include: { customer: true, applications: { include: { invoice: true } } },
    });
  }
  getCustomerPayment(id: string) {
    return this.prisma.customerPayment.findUnique({
      where: { id },
      include: { customer: true, applications: { include: { invoice: true } } },
    });
  }

  async createCustomerPayment(bookId: string, dto: CreateCustomerPaymentDto) {
    if (!dto.customerId) throw new BadRequestException("customerId required");
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || customer.accountBookId !== bookId) {
      throw new NotFoundException("Customer " + dto.customerId + " not found in this account book");
    }
    const amount = new Prisma.Decimal(dto.amount);

    const apps = dto.applications ?? [];
    let applied = new Prisma.Decimal(0);
    if (apps.length > 0) {
      const sum = apps.reduce((s, a) => s + a.amount, 0);
      if (Math.abs(sum - dto.amount) > 0.01) {
        throw new BadRequestException(
          "Sum of applications (" + sum.toFixed(2) + ") must equal payment amount (" + dto.amount.toFixed(2) + ")",
        );
      }
      applied = new Prisma.Decimal(sum);
      for (const a of apps) {
        const inv = await this.prisma.customerInvoice.findUnique({ where: { id: a.invoiceId } });
        if (!inv || inv.accountBookId !== bookId) {
          throw new NotFoundException("Invoice " + a.invoiceId + " not found in this account book");
        }
        const outstanding = new Prisma.Decimal(inv.total).sub(new Prisma.Decimal(inv.paid));
        if (new Prisma.Decimal(a.amount).gt(outstanding)) {
          throw new BadRequestException(
            "Application " + a.amount + " exceeds invoice " + inv.number + " outstanding " + outstanding.toFixed(2),
          );
        }
      }
    }

    const number = await this.seq.next(bookId, "RCP");

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: {
          accountBookId: bookId,
          number,
          customerId: dto.customerId,
          date: new Date(dto.date),
          amount,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          applications: { create: apps.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) },
        },
        include: { applications: true },
      });

      for (const a of apps) {
        const inv = await tx.customerInvoice.findUnique({ where: { id: a.invoiceId } });
        if (!inv) continue;
        const newPaid = new Prisma.Decimal(inv.paid).add(a.amount);
        const newBalance = new Prisma.Decimal(inv.total).sub(newPaid);
        const newStatus = newBalance.lte(0) ? "PAID" : (newPaid.gt(0) ? "PARTIAL" : inv.status);
        await tx.customerInvoice.update({
          where: { id: a.invoiceId },
          data: { paid: newPaid, balance: newBalance, status: newStatus as never },
        });
      }
      await tx.customer.update({
        where: { id: dto.customerId },
        data: { outstanding: { decrement: applied } },
      });
      return payment;
    });

    try {
      await this.posting.postCustomerPayment(result.id);
    } catch (err) {
      this.logger.warn("GL post skipped for customer payment " + number + ": " + (err as Error).message);
    }
    return this.getCustomerPayment(result.id);
  }

  // ---- Supplier payments ----
  listSupplierPayments(bookId: string) {
    return this.prisma.supplierPayment.findMany({
      where: { accountBookId: bookId },
      orderBy: { date: "desc" },
      include: { supplier: true, applications: { include: { invoice: true } } },
    });
  }
  getSupplierPayment(id: string) {
    return this.prisma.supplierPayment.findUnique({
      where: { id },
      include: { supplier: true, applications: { include: { invoice: true } } },
    });
  }

  async createSupplierPayment(bookId: string, dto: CreateSupplierPaymentDto) {
    if (!dto.supplierId) throw new BadRequestException("supplierId required");
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || supplier.accountBookId !== bookId) {
      throw new NotFoundException("Supplier " + dto.supplierId + " not found in this account book");
    }
    const amount = new Prisma.Decimal(dto.amount);

    const apps = dto.applications ?? [];
    let applied = new Prisma.Decimal(0);
    if (apps.length > 0) {
      const sum = apps.reduce((s, a) => s + a.amount, 0);
      if (Math.abs(sum - dto.amount) > 0.01) {
        throw new BadRequestException(
          "Sum of applications (" + sum.toFixed(2) + ") must equal payment amount (" + dto.amount.toFixed(2) + ")",
        );
      }
      applied = new Prisma.Decimal(sum);
      for (const a of apps) {
        const inv = await this.prisma.supplierInvoice.findUnique({ where: { id: a.invoiceId } });
        if (!inv || inv.accountBookId !== bookId) {
          throw new NotFoundException("Invoice " + a.invoiceId + " not found in this account book");
        }
        const outstanding = new Prisma.Decimal(inv.total).sub(new Prisma.Decimal(inv.paid));
        if (new Prisma.Decimal(a.amount).gt(outstanding)) {
          throw new BadRequestException(
            "Application " + a.amount + " exceeds bill " + inv.number + " outstanding " + outstanding.toFixed(2),
          );
        }
      }
    }

    const number = await this.seq.next(bookId, "PAY");

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          accountBookId: bookId,
          number,
          supplierId: dto.supplierId,
          date: new Date(dto.date),
          amount,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          applications: { create: apps.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) },
        },
        include: { applications: true },
      });
      for (const a of apps) {
        const inv = await tx.supplierInvoice.findUnique({ where: { id: a.invoiceId } });
        if (!inv) continue;
        const newPaid = new Prisma.Decimal(inv.paid).add(a.amount);
        const newBalance = new Prisma.Decimal(inv.total).sub(newPaid);
        const newStatus = newBalance.lte(0) ? "PAID" : (newPaid.gt(0) ? "PARTIAL" : inv.status);
        await tx.supplierInvoice.update({
          where: { id: a.invoiceId },
          data: { paid: newPaid, balance: newBalance, status: newStatus as never },
        });
      }
      await tx.supplier.update({
        where: { id: dto.supplierId },
        data: { outstanding: { decrement: applied } },
      });
      return payment;
    });

    try {
      await this.posting.postSupplierPayment(result.id);
    } catch (err) {
      this.logger.warn("GL post skipped for supplier payment " + number + ": " + (err as Error).message);
    }
    return this.getSupplierPayment(result.id);
  }
}
