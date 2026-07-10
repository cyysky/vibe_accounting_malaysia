import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateStockMovementDto } from './dto/stock-movement.dto';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(bookId: string) {
    return this.prisma.stockMovement.findMany({
      where: { accountBookId: bookId },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(bookId: string, dto: CreateStockMovementDto) {
    const item = await this.prisma.item.findUnique({ where: { id: dto.itemId } });
    if (!item || item.accountBookId !== bookId) {
      throw new NotFoundException('Item ' + dto.itemId + ' not found in this account book');
    }
    const qty = new Prisma.Decimal(dto.quantity);
    if (qty.eq(0)) throw new BadRequestException('quantity must be non-zero');

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          accountBookId: bookId,
          itemId: dto.itemId,
          type: dto.type,
          quantity: qty,
          unitCost: dto.unitCost ?? 0,
          reference: dto.reference,
          notes: dto.notes,
        },
        include: { item: true },
      });
      const updatedItem = await tx.item.update({
        where: { id: dto.itemId },
        data: { onHand: { increment: qty } },
      });
      return { ...movement, item: { ...movement.item, onHand: updatedItem.onHand } };
    });
  }
}
