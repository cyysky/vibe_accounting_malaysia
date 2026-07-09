import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  listItems(bookId?: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.item.findMany({
      where: bookId ? { accountBookId: bookId } : {},
      orderBy: { code: 'asc' },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async getItem(id: string): Promise<Record<string, unknown>> {
    const i = await this.prisma.item.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Item ${id} not found`);
    return i as unknown as Record<string, unknown>;
  }

  async createItem(bookId: string, dto: CreateItemDto): Promise<Record<string, unknown>> {
    const dup = await this.prisma.item.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code: dto.code } },
    });
    if (dup) throw new BadRequestException(`Item code ${dto.code} already exists`);
    return (await this.prisma.item.create({
      data: {
        accountBookId: bookId,
        code: dto.code,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        uom: dto.uom ?? 'PCS',
        cost: dto.cost ?? 0,
        price: dto.price ?? 0,
        onHand: dto.onHand ?? 0,
        reorderLevel: dto.reorderLevel ?? 0,
        classification: dto.classification,
        active: dto.active ?? true,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<Record<string, unknown>> {
    await this.ensureItem(id);
    return (await this.prisma.item.update({ where: { id }, data: dto })) as unknown as Record<string, unknown>;
  }

  async deleteItem(id: string): Promise<void> {
    await this.ensureItem(id);
    await this.prisma.item.delete({ where: { id } });
  }

  async lowStock(bookId: string): Promise<Array<Record<string, unknown>>> {
    const items = await this.prisma.item.findMany({ where: { accountBookId: bookId, active: true } });
    return items
      .filter((i) => Number(i.onHand) <= Number(i.reorderLevel))
      .map((i) => i as unknown as Record<string, unknown>);
  }

  private async ensureItem(id: string): Promise<void> {
    const i = await this.prisma.item.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Item ${id} not found`);
  }
}
