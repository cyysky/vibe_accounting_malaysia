import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { CreateCustomerInvoiceDto, UpdateCustomerInvoiceDto } from './dto/customer-invoice.dto';

@Injectable()
export class ArService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Customers -----------------------------------------------------------
  listCustomers(bookId?: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.customer.findMany({
      where: bookId ? { accountBookId: bookId } : {},
      orderBy: { code: 'asc' },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async getCustomer(id: string): Promise<Record<string, unknown>> {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c as unknown as Record<string, unknown>;
  }

  async createCustomer(bookId: string, dto: CreateCustomerDto): Promise<Record<string, unknown>> {
    const dup = await this.prisma.customer.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code: dto.code } },
    });
    if (dup) throw new BadRequestException(`Customer code ${dto.code} already exists`);
    return (await this.prisma.customer.create({
      data: {
        accountBookId: bookId,
        code: dto.code,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        taxId: dto.taxId,
        brn: dto.brn,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country ?? 'MY',
        currency: dto.currency ?? 'MYR',
        creditLimit: dto.creditLimit ?? 0,
        active: dto.active ?? true,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto): Promise<Record<string, unknown>> {
    await this.ensureCustomer(id);
    return (await this.prisma.customer.update({ where: { id }, data: dto })) as unknown as Record<string, unknown>;
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.ensureCustomer(id);
    await this.prisma.customer.delete({ where: { id } });
  }

  private async ensureCustomer(id: string): Promise<void> {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
  }

  // --- Invoices ------------------------------------------------------------
  async listInvoices(bookId: string, page = 1, pageSize = 50, customerId?: string): Promise<{
    data: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, pageSize));
    const take = Math.min(200, Math.max(1, pageSize));
    const where = { accountBookId: bookId, ...(customerId ? { customerId } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.customerInvoice.findMany({
        where,
        include: { customer: true, lines: true },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      this.prisma.customerInvoice.count({ where }),
    ]);
    const mapped = data.map((i) => ({
      ...i,
      customerName: i.customer?.name,
      tax: i.taxTotal,
    }));
    return { data: mapped as unknown as Array<Record<string, unknown>>, total, page, pageSize };
  }

  async getInvoice(id: string): Promise<Record<string, unknown>> {
    const inv = await this.prisma.customerInvoice.findUnique({
      where: { id },
      include: { customer: true, lines: { include: { item: true, taxCode: true } } },
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return { ...inv, tax: inv.taxTotal, customerName: inv.customer?.name } as unknown as Record<string, unknown>;
  }

  async createInvoice(bookId: string, dto: CreateCustomerInvoiceDto): Promise<Record<string, unknown>> {
    const cust = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!cust || cust.accountBookId !== bookId) {
      throw new BadRequestException(`Customer ${dto.customerId} not found in this account book`);
    }
    const count = await this.prisma.customerInvoice.count({ where: { accountBookId: bookId } });
    const number = `INV-${String(count + 1).padStart(5, '0')}`;

    let subtotal = 0;
    let taxTotal = 0;
    const lines = await Promise.all(
      dto.lines.map(async (l, idx) => {
        const lineSub = Number(l.quantity) * Number(l.unitPrice) - Number(l.discount ?? 0);
        let taxAmount = 0;
        if (l.taxCodeId) {
          const tc = await this.prisma.taxCode.findUnique({ where: { id: l.taxCodeId } });
          if (tc) taxAmount = +(lineSub * Number(tc.rate)).toFixed(2);
        }
        const lineTotal = +(lineSub + taxAmount).toFixed(2);
        subtotal += lineSub;
        taxTotal += taxAmount;
        return {
          itemId: l.itemId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount ?? 0,
          taxCodeId: l.taxCodeId,
          taxAmount,
          subtotal: +lineSub.toFixed(2),
          total: lineTotal,
          lineNo: idx + 1,
        };
      }),
    );
    const total = +(subtotal + taxTotal).toFixed(2);

    const created = await this.prisma.customerInvoice.create({
      data: {
        accountBookId: bookId,
        customerId: dto.customerId,
        number,
        date: new Date(dto.date),
        dueDate: new Date(dto.dueDate),
        currency: dto.currency ?? 'MYR',
        exchangeRate: dto.exchangeRate ?? 1,
        subtotal: +subtotal.toFixed(2),
        taxTotal: +taxTotal.toFixed(2),
        total,
        balance: total,
        status: dto.status ?? 'ISSUED',
        notes: dto.notes,
        lines: { create: lines },
      },
      include: { customer: true, lines: true },
    });
    // Update customer outstanding
    await this.prisma.customer.update({
      where: { id: dto.customerId },
      data: { outstanding: { increment: total } },
    });
    return { ...created, tax: created.taxTotal, customerName: created.customer?.name } as unknown as Record<string, unknown>;
  }

  async updateInvoice(id: string, dto: UpdateCustomerInvoiceDto): Promise<Record<string, unknown>> {
    await this.ensureInvoice(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    const updated = await this.prisma.customerInvoice.update({
      where: { id },
      data,
      include: { customer: true, lines: true },
    });
    return { ...updated, tax: updated.taxTotal, customerName: updated.customer?.name } as unknown as Record<string, unknown>;
  }

  async deleteInvoice(id: string): Promise<void> {
    const inv = await this.prisma.customerInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    await this.prisma.customerInvoice.delete({ where: { id } });
    await this.prisma.customer.update({
      where: { id: inv.customerId },
      data: { outstanding: { decrement: inv.total } },
    });
  }

  private async ensureInvoice(id: string): Promise<void> {
    const i = await this.prisma.customerInvoice.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Invoice ${id} not found`);
  }
}
