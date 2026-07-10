import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { DocumentSequenceService } from "../../database/document-sequence.service";
import { PostingService } from "../gl/posting.service";
import { CreateDebitNoteDto, UpdateDebitNoteDto } from "./dto/debit-note.dto";

@Injectable()
export class DebitNotesService {
  private readonly logger = new Logger(DebitNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seq: DocumentSequenceService,
    private readonly posting: PostingService,
  ) {}

  async list(bookId: string, supplierId?: string) {
    return this.prisma.debitNote.findMany({
      where: { accountBookId: bookId, ...(supplierId ? { supplierId } : {}) },
      include: { supplier: true, lines: { include: { item: true, taxCode: true } }, invoice: true },
      orderBy: { date: "desc" },
    });
  }

  async get(id: string) {
    const dn = await this.prisma.debitNote.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { item: true, taxCode: true } }, invoice: true },
    });
    if (!dn) throw new NotFoundException(`Debit note ${id} not found`);
    return dn;
  }

  async create(bookId: string, dto: CreateDebitNoteDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || supplier.accountBookId !== bookId) {
      throw new BadRequestException(`Supplier ${dto.supplierId} not found in this account book`);
    }
    if (dto.invoiceId) {
      const inv = await this.prisma.supplierInvoice.findUnique({ where: { id: dto.invoiceId } });
      if (!inv || inv.accountBookId !== bookId) {
        throw new BadRequestException(`Bill ${dto.invoiceId} not found in this account book`);
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
    const number = await this.seq.next(bookId, "DN");

    const created = await this.prisma.debitNote.create({
      data: {
        accountBookId: bookId,
        supplierId: dto.supplierId,
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
      include: { supplier: true, lines: true },
    });

    if (created.status === "ISSUED") {
      await this.prisma.supplier.update({
        where: { id: dto.supplierId },
        data: { outstanding: { increment: total } },
      });
    }

    try {
      await this.posting.postDebitNote(created.id);
    } catch (err) {
      this.logger.warn(`GL post skipped for debit note ${created.number}: ${(err as Error).message}`);
    }

    return this.get(created.id);
  }

  async update(id: string, dto: UpdateDebitNoteDto) {
    const dn = await this.ensureExists(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.debitNote.update({ where: { id: dn.id }, data });
  }

  async remove(id: string) {
    const dn = await this.ensureExists(id);
    if (dn.status === "APPLIED") {
      throw new BadRequestException("Cannot delete a debit note that has been applied to bills");
    }
    await this.prisma.debitNote.delete({ where: { id: dn.id } });
    await this.prisma.supplier.update({
      where: { id: dn.supplierId },
      data: { outstanding: { decrement: Number(dn.total) } },
    });
  }

  private async ensureExists(id: string) {
    const dn = await this.prisma.debitNote.findUnique({ where: { id } });
    if (!dn) throw new NotFoundException(`Debit note ${id} not found`);
    return dn;
  }
}
