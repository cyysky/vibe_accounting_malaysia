import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(bookId: string, page = 1, pageSize = 50) {
    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, pageSize));
    const take = Math.min(200, Math.max(1, pageSize));
    const where = { accountBookId: bookId };
    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: { customer: true },
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
    const o = await this.prisma.salesOrder.findUnique({ where: { id }, include: { customer: true } });
    if (!o) throw new NotFoundException(`Sales order ${id} not found`);
    return { ...o, customerName: o.customer?.name };
  }

  async createOrder(bookId: string, dto: CreateSalesOrderDto) {
    const cust = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!cust || cust.accountBookId !== bookId) {
      throw new BadRequestException(`Customer ${dto.customerId} not found in this account book`);
    }
    const count = await this.prisma.salesOrder.count({ where: { accountBookId: bookId } });
    const number = `SO-${String(count + 1).padStart(5, '0')}`;
    return this.prisma.salesOrder.create({
      data: {
        accountBookId: bookId,
        customerId: dto.customerId,
        number,
        date: new Date(dto.date),
        total: dto.total,
        status: dto.status ?? 'OPEN',
        notes: dto.notes,
      },
      include: { customer: true },
    });
  }

  async updateOrder(id: string, dto: UpdateSalesOrderDto) {
    await this.ensureOrder(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.salesOrder.update({ where: { id }, data, include: { customer: true } });
  }

  async deleteOrder(id: string) {
    await this.ensureOrder(id);
    await this.prisma.salesOrder.delete({ where: { id } });
  }

  private async ensureOrder(id: string) {
    const o = await this.prisma.salesOrder.findUnique({ where: { id } });
    if (!o) throw new NotFoundException(`Sales order ${id} not found`);
  }
}
