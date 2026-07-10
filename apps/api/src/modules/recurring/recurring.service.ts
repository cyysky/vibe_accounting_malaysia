import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { RecurringFrequency } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ArService } from "../ar/ar.service";
import { CreateRecurringDto, UpdateRecurringDto } from "./dto/recurring.dto";

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ar: ArService,
  ) {}

  list(bookId: string) {
    return this.prisma.recurringInvoice.findMany({
      where: { accountBookId: bookId },
      include: { customer: true, lines: { include: { item: true, taxCode: true } } },
      orderBy: { nextRunDate: "asc" },
    });
  }

  async get(id: string) {
    const r = await this.prisma.recurringInvoice.findUnique({
      where: { id },
      include: { customer: true, lines: { include: { item: true, taxCode: true } } },
    });
    if (!r) throw new NotFoundException(`Recurring template ${id} not found`);
    return r;
  }

  async create(bookId: string, dto: CreateRecurringDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || customer.accountBookId !== bookId) {
      throw new BadRequestException(`Customer ${dto.customerId} not found in this account book`);
    }
    for (const l of dto.lines) {
      if (l.taxCodeId) {
        const tc = await this.prisma.taxCode.findUnique({ where: { id: l.taxCodeId } });
        if (!tc) throw new BadRequestException(`Tax code ${l.taxCodeId} not found`);
      }
    }
    const nextRunDate = new Date(dto.startDate);
    return this.prisma.recurringInvoice.create({
      data: {
        accountBookId: bookId,
        customerId: dto.customerId,
        name: dto.name,
        frequency: dto.frequency,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        nextRunDate,
        currency: dto.currency ?? "MYR",
        notes: dto.notes,
        active: dto.active ?? true,
        lines: {
          create: dto.lines.map((l, idx) => ({
            itemId: l.itemId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxCodeId: l.taxCodeId,
            lineNo: idx + 1,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async update(id: string, dto: UpdateRecurringDto) {
    const r = await this.ensure(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.lines) {
      await this.prisma.recurringInvoiceLine.deleteMany({ where: { recurringId: r.id } });
      data.lines = {
        create: dto.lines.map((l, idx) => ({
          itemId: l.itemId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxCodeId: l.taxCodeId,
          lineNo: idx + 1,
        })),
      };
    }
    return this.prisma.recurringInvoice.update({ where: { id: r.id }, data, include: { lines: true } });
  }

  async remove(id: string) {
    const r = await this.ensure(id);
    await this.prisma.recurringInvoice.delete({ where: { id: r.id } });
  }

  /**
   * Generate a real customer invoice from a template and advance nextRunDate.
   */
  async run(id: string) {
    const tpl = await this.get(id);
    if (!tpl.active) throw new BadRequestException("Template is inactive");
    const today = new Date();
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const invoice = await this.ar.createInvoice(tpl.accountBookId, {
      customerId: tpl.customerId,
      date: today.toISOString(),
      dueDate: dueDate.toISOString(),
      currency: tpl.currency,
      notes: tpl.notes ?? `Generated from recurring template "${tpl.name}"`,
      lines: tpl.lines.map((l) => ({
        itemId: l.itemId ?? undefined,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        taxCodeId: l.taxCodeId ?? undefined,
      })),
    });
    const next = advance(tpl.frequency, today);
    await this.prisma.recurringInvoice.update({
      where: { id: tpl.id },
      data: { lastRunDate: today, nextRunDate: next },
    });
    this.logger.log(`Generated invoice from recurring ${tpl.name}`);
    return invoice;
  }

  /**
   * Process every template whose nextRunDate <= today.

  /**
   * Preview the next `count` invoice dates that this template will be
   * generated for, starting from `from` (defaults to today).  Pure
   * date computation, no DB writes.
   */
  async previewDue(id: string, count = 5, from?: Date) {
    const tpl = await this.get(id);
    const dates: string[] = [];
    let cursor = from ?? new Date(tpl.nextRunDate);
    for (let i = 0; i < count; i += 1) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor = advance(tpl.frequency, cursor);
      if (tpl.endDate && cursor > tpl.endDate) break;
    }
    return { id: tpl.id, name: tpl.name, frequency: tpl.frequency, dates };
  }

  /**
   * Process every template whose nextRunDate <= today.
   */
  async runDue(bookId: string) {
    const due = await this.prisma.recurringInvoice.findMany({
      where: { accountBookId: bookId, active: true, nextRunDate: { lte: new Date() } },
    });
    const results: Array<{ templateId: string; invoiceId: string; number: string }> = [];
    for (const t of due) {
      try {
        const inv = (await this.run(t.id)) as { id: string; number: string };
        results.push({ templateId: t.id, invoiceId: inv.id, number: inv.number });
      } catch (err) {
        this.logger.warn(`Recurring ${t.id} failed: ${(err as Error).message}`);
      }
    }
    return { processed: results.length, results };
  }

  private async ensure(id: string) {
    const r = await this.prisma.recurringInvoice.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`Recurring template ${id} not found`);
    return r;
  }
}

function advance(freq: RecurringFrequency, from: Date): Date {
  const d = new Date(from);
  switch (freq) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}
