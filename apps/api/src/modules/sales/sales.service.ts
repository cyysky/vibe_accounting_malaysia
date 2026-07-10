import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DocumentSequenceService } from '../../database/document-sequence.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';

interface OrderLineInput {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
}

function computeLineTotals(line: OrderLineInput, taxRate: number) {
  const gross = Number(line.quantity) * Number(line.unitPrice);
  const discount = Number(line.discount ?? 0);
  const subtotal = Math.max(0, gross - discount);
  const taxAmount = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + taxAmount).toFixed(2);
  return { subtotal: subtotal.toFixed(2), taxAmount: taxAmount.toFixed(2), total: total.toFixed(2) };
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly seq: DocumentSequenceService) {}

  async listOrders(bookId: string, page = 1, pageSize = 50) {
    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, pageSize));
    const take = Math.min(200, Math.max(1, pageSize));
    const where = { accountBookId: bookId };
    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: { customer: true, lines: { include: { item: true, taxCode: true } } },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    const mapped = data.map((o) => ({ ...o, customerName: o.customer?.name }));
    return { data: mapped, total, page, pageSize };
  }

  async getOrder(id: string) {
    const o = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: { customer: true, lines: { include: { item: true, taxCode: true } } },
    });
    if (!o) throw new NotFoundException(`Sales order ${id} not found`);
    return { ...o, customerName: o.customer?.name };
  }

  async createOrder(bookId: string, dto: CreateSalesOrderDto) {
    const cust = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!cust || cust.accountBookId !== bookId) {
      throw new BadRequestException(`Customer ${dto.customerId} not found in this account book`);
    }
    const number = await this.seq.next(bookId, "SO");

    // Compute totals from lines if provided
    const lines = dto.lines && dto.lines.length > 0 ? await this.prepareLines(bookId, dto.lines) : null;
    const subtotal = lines ? lines.reduce((s, l) => s + Number(l.subtotal), 0) : 0;
    const taxTotal = lines ? lines.reduce((s, l) => s + Number(l.taxAmount), 0) : 0;
    const total = lines ? lines.reduce((s, l) => s + Number(l.total), 0) : (dto.total ?? 0);

    return this.prisma.salesOrder.create({
      data: {
        accountBookId: bookId,
        customerId: dto.customerId,
        number,
        date: new Date(dto.date),
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        taxTotal: new Prisma.Decimal(taxTotal.toFixed(2)),
        total: new Prisma.Decimal(total.toFixed(2)),
        status: dto.status ?? 'OPEN',
        notes: dto.notes,
        ...(lines && lines.length > 0
          ? { lines: { create: lines.map((l, i) => ({ ...l, lineNo: i + 1 })) } }
          : {}),
      },
      include: { customer: true, lines: { include: { item: true, taxCode: true } } },
    });
  }

  async updateOrder(id: string, dto: UpdateSalesOrderDto) {
    await this.ensureOrder(id);
    const data: Record<string, unknown> = {};
    if (dto.date) data.date = new Date(dto.date);
    if (dto.total !== undefined) data.total = new Prisma.Decimal(dto.total);
    if (dto.status) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.lines && dto.lines.length > 0) {
      const order = await this.prisma.salesOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException(`Sales order ${id} not found`);
      const prepared = await this.prepareLines(order.accountBookId, dto.lines);
      const subtotal = prepared.reduce((s, l) => s + Number(l.subtotal), 0);
      const taxTotal = prepared.reduce((s, l) => s + Number(l.taxAmount), 0);
      const total = prepared.reduce((s, l) => s + Number(l.total), 0);
      data.subtotal = new Prisma.Decimal(subtotal.toFixed(2));
      data.taxTotal = new Prisma.Decimal(taxTotal.toFixed(2));
      data.total = new Prisma.Decimal(total.toFixed(2));
      data.lines = {
        deleteMany: {},
        create: prepared.map((l, i) => ({ ...l, lineNo: i + 1 })),
      };
    }
    return this.prisma.salesOrder.update({
      where: { id },
      data: data as Prisma.SalesOrderUpdateInput,
      include: { customer: true, lines: { include: { item: true, taxCode: true } } },
    });
  }

  async deleteOrder(id: string) {
    await this.ensureOrder(id);
    await this.prisma.salesOrder.delete({ where: { id } });
  }

  private async ensureOrder(id: string) {
    const o = await this.prisma.salesOrder.findUnique({ where: { id } });
    if (!o) throw new NotFoundException(`Sales order ${id} not found`);
  }

  private async prepareLines(bookId: string, lines: OrderLineInput[]) {
    // Pre-fetch tax codes used to compute tax amounts
    const taxCodeIds = Array.from(new Set(lines.map((l) => l.taxCodeId).filter((id): id is string => !!id)));
    const taxCodes = taxCodeIds.length
      ? await this.prisma.taxCode.findMany({ where: { id: { in: taxCodeIds } } })
      : [];
    const rateMap = new Map(taxCodes.map((t) => [t.id, Number(t.rate) / 100]));

    return lines.map((l) => {
      const rate = l.taxCodeId ? rateMap.get(l.taxCodeId) ?? 0 : 0;
      const totals = computeLineTotals(l, rate);
      return {
        itemId: l.itemId ?? null,
        description: l.description,
        quantity: new Prisma.Decimal(l.quantity),
        unitPrice: new Prisma.Decimal(l.unitPrice),
        discount: new Prisma.Decimal(l.discount ?? 0),
        taxCodeId: l.taxCodeId ?? null,
        ...totals,
      };
    });
  }
}
