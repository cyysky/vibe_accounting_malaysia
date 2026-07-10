import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { DocumentSequenceService } from "../../database/document-sequence.service";
import { PostingService } from "../gl/posting.service";
import { CreateCreditNoteDto, UpdateCreditNoteDto } from "./dto/credit-note.dto";

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seq: DocumentSequenceService,
    private readonly posting: PostingService,
  ) {}

  async list(bookId: string, customerId?: string) {
    return this.prisma.creditNote.findMany({
      where: { accountBookId: bookId, ...(customerId ? { customerId } : {}) },
      include: { customer: true, lines: { include: { item: true, taxCode: true } }, invoice: true },
      orderBy: { date: "desc" },
    });
  }

  async get(id: string) {
    const cn = await this.prisma.creditNote.findUnique({
      where: { id },
      include: { customer: true, lines: { include: { item: true, taxCode: true } }, invoice: true },
    });
    if (!cn) throw new NotFoundException(`Credit note ${id} not found`);
    return cn;
  }

  async create(bookId: string, dto: CreateCreditNoteDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || customer.accountBookId !== bookId) {
      throw new BadRequestException(`Customer ${dto.customerId} not found in this account book`);
    }
    if (dto.invoiceId) {
      const inv = await this.prisma.customerInvoice.findUnique({ where: { id: dto.invoiceId } });
      if (!inv || inv.accountBookId !== bookId) {
        throw new BadRequestException(`Invoice ${dto.invoiceId} not found in this account book`);
      }
    }

    let subtotal = 0;
    let taxTotal = 0;
    const lines = await Promise.all(
      dto.lines.map(async (l, idx) => {
        const qty = Number(l.quantity);
        const price = Number(l.unitPrice);
        const discount = Number(l.discount ?? 0);
        const lineSub = qty * price - discount;
        let taxAmount = 0;
        if (l.taxCodeId) {
          const tc = await this.prisma.taxCode.findUnique({ where: { id: l.taxCodeId } });
          if (!tc) throw new BadRequestException(`Tax code ${l.taxCodeId} not found`);
          taxAmount = +(lineSub * Number(tc.rate)).toFixed(2);
        }
        subtotal += lineSub;
        taxTotal += taxAmount;
        return {
          itemId: l.itemId,
          description: l.description,
          quantity: qty,
          unitPrice: price,
          discount,
          taxCodeId: l.taxCodeId,
          taxAmount,
          subtotal: +lineSub.toFixed(2),
          total: +(lineSub + taxAmount).toFixed(2),
          lineNo: idx + 1,
        };
      }),
    );
    const total = +(subtotal + taxTotal).toFixed(2);
    const number = await this.seq.next(bookId, "CN");

    const created = await this.prisma.creditNote.create({
      data: {
        accountBookId: bookId,
        customerId: dto.customerId,
        invoiceId: dto.invoiceId,
        number,
        date: new Date(dto.date),
        reason: dto.reason,
        currency: dto.currency ?? "MYR",
        subtotal: +subtotal.toFixed(2),
        taxTotal: +taxTotal.toFixed(2),
        total,
        status: dto.status ?? "ISSUED",
        notes: dto.notes,
        lines: { create: lines },
      },
      include: { customer: true, lines: true },
    });

    // Optionally reduce the customer's outstanding balance
    if (created.status === "ISSUED") {
      await this.prisma.customer.update({
        where: { id: dto.customerId },
        data: { outstanding: { decrement: total } },
      });
    }

    // Auto-post to GL (DR Sales Returns, CR AR)
    try {
      await this.posting.postCreditNote(created.id);
    } catch (err) {
      this.logger.warn(`GL post skipped for credit note ${created.number}: ${(err as Error).message}`);
    }

    return this.get(created.id);
  }

  async update(id: string, dto: UpdateCreditNoteDto) {
    const cn = await this.ensureExists(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.creditNote.update({ where: { id: cn.id }, data });
  }

  async remove(id: string) {
    const cn = await this.ensureExists(id);
    if (cn.status === "APPLIED") {
      throw new BadRequestException("Cannot delete a credit note that has been applied to invoices");
    }
    await this.prisma.creditNote.delete({ where: { id: cn.id } });
    await this.prisma.customer.update({
      where: { id: cn.customerId },
      data: { outstanding: { increment: Number(cn.total) } },
    });
  }

  private async ensureExists(id: string) {
    const cn = await this.prisma.creditNote.findUnique({ where: { id } });
    if (!cn) throw new NotFoundException(`Credit note ${id} not found`);
    return cn;
  }
}
