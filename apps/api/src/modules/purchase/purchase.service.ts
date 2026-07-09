import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-order.dto';

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(bookId: string, page = 1, pageSize = 50) {
    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, pageSize));
    const take = Math.min(200, Math.max(1, pageSize));
    const where = { accountBookId: bookId };
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    const mapped = data.map((o) => ({ ...o, supplierName: o.supplier?.name }));
    return { data: mapped, total, page, pageSize };
  }

  async getOrder(id: string) {
    const o = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true } });
    if (!o) throw new NotFoundException(`Purchase order ${id} not found`);
    return { ...o, supplierName: o.supplier?.name };
  }

  async createOrder(bookId: string, dto: CreatePurchaseOrderDto) {
    const sup = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!sup || sup.accountBookId !== bookId) {
      throw new BadRequestException(`Supplier ${dto.supplierId} not found in this account book`);
    }
    const count = await this.prisma.purchaseOrder.count({ where: { accountBookId: bookId } });
    const number = `PO-${String(count + 1).padStart(5, '0')}`;
    return this.prisma.purchaseOrder.create({
      data: {
        accountBookId: bookId,
        supplierId: dto.supplierId,
        number,
        date: new Date(dto.date),
        total: dto.total,
        status: dto.status ?? 'OPEN',
        notes: dto.notes,
      },
      include: { supplier: true },
    });
  }

  async updateOrder(id: string, dto: UpdatePurchaseOrderDto) {
    await this.ensureOrder(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.purchaseOrder.update({ where: { id }, data, include: { supplier: true } });
  }

  async deleteOrder(id: string) {
    await this.ensureOrder(id);
    await this.prisma.purchaseOrder.delete({ where: { id } });
  }

  private async ensureOrder(id: string) {
    const o = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!o) throw new NotFoundException(`Purchase order ${id} not found`);
  }
}
