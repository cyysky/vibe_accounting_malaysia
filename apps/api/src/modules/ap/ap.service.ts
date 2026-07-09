import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { CreateSupplierInvoiceDto, UpdateSupplierInvoiceDto } from './dto/supplier-invoice.dto';

@Injectable()
export class ApService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Suppliers -----------------------------------------------------------
  listSuppliers(bookId?: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.supplier.findMany({
      where: bookId ? { accountBookId: bookId } : {},
      orderBy: { code: 'asc' },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async getSupplier(id: string): Promise<Record<string, unknown>> {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
    return s as unknown as Record<string, unknown>;
  }

  async createSupplier(bookId: string, dto: CreateSupplierDto): Promise<Record<string, unknown>> {
    const dup = await this.prisma.supplier.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code: dto.code } },
    });
    if (dup) throw new BadRequestException(`Supplier code ${dto.code} already exists`);
    return (await this.prisma.supplier.create({
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
        active: dto.active ?? true,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<Record<string, unknown>> {
    await this.ensureSupplier(id);
    return (await this.prisma.supplier.update({ where: { id }, data: dto })) as unknown as Record<string, unknown>;
  }

  async deleteSupplier(id: string): Promise<void> {
    await this.ensureSupplier(id);
    await this.prisma.supplier.delete({ where: { id } });
  }

  private async ensureSupplier(id: string): Promise<void> {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
  }

  // --- Supplier invoices ---------------------------------------------------
  async listInvoices(bookId: string, page = 1, pageSize = 50, supplierId?: string) {
    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, pageSize));
    const take = Math.min(200, Math.max(1, pageSize));
    const where = { accountBookId: bookId, ...(supplierId ? { supplierId } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.supplierInvoice.findMany({
        where,
        include: { supplier: true, lines: true },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      this.prisma.supplierInvoice.count({ where }),
    ]);
    const mapped = data.map((i) => ({ ...i, supplierName: i.supplier?.name, tax: i.taxTotal }));
    return { data: mapped as unknown as Array<Record<string, unknown>>, total, page, pageSize };
  }

  async getInvoice(id: string): Promise<Record<string, unknown>> {
    const inv = await this.prisma.supplierInvoice.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { item: true, taxCode: true } } },
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return { ...inv, tax: inv.taxTotal, supplierName: inv.supplier?.name } as unknown as Record<string, unknown>;
  }

  async createInvoice(bookId: string, dto: CreateSupplierInvoiceDto): Promise<Record<string, unknown>> {
    const sup = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!sup || sup.accountBookId !== bookId) {
      throw new BadRequestException(`Supplier ${dto.supplierId} not found in this account book`);
    }
    const count = await this.prisma.supplierInvoice.count({ where: { accountBookId: bookId } });
    const number = `BILL-${String(count + 1).padStart(5, '0')}`;

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

    const created = await this.prisma.supplierInvoice.create({
      data: {
        accountBookId: bookId,
        supplierId: dto.supplierId,
        number,
        date: new Date(dto.date),
        dueDate: new Date(dto.dueDate),
        currency: dto.currency ?? 'MYR',
        subtotal: +subtotal.toFixed(2),
        taxTotal: +taxTotal.toFixed(2),
        total,
        balance: total,
        status: dto.status ?? 'ISSUED',
        notes: dto.notes,
        lines: { create: lines },
      },
      include: { supplier: true, lines: true },
    });
    await this.prisma.supplier.update({
      where: { id: dto.supplierId },
      data: { outstanding: { increment: total } },
    });
    return { ...created, tax: created.taxTotal, supplierName: created.supplier?.name } as unknown as Record<string, unknown>;
  }

  async updateInvoice(id: string, dto: UpdateSupplierInvoiceDto): Promise<Record<string, unknown>> {
    await this.ensureInvoice(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data,
      include: { supplier: true, lines: true },
    });
    return { ...updated, tax: updated.taxTotal, supplierName: updated.supplier?.name } as unknown as Record<string, unknown>;
  }

  async deleteInvoice(id: string): Promise<void> {
    const inv = await this.prisma.supplierInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    await this.prisma.supplierInvoice.delete({ where: { id } });
    await this.prisma.supplier.update({
      where: { id: inv.supplierId },
      data: { outstanding: { decrement: inv.total } },
    });
  }

  private async ensureInvoice(id: string): Promise<void> {
    const i = await this.prisma.supplierInvoice.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Invoice ${id} not found`);
  }
}
