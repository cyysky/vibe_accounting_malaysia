import { Test } from '@nestjs/testing';
import { StockService } from './stock.service';
import { PrismaService } from '../../database/prisma.service';

describe('StockService', () => {
  let service: StockService;
  let prisma: { item: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock } };

  beforeEach(async () => {
    prisma = { item: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [StockService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(StockService);
  });

  it('lists items scoped to a book', async () => {
    prisma.item.findMany.mockResolvedValue([]);
    await service.listItems('book-1');
    expect(prisma.item.findMany).toHaveBeenCalledWith({ where: { accountBookId: 'book-1' }, orderBy: { code: 'asc' } });
  });

  it('rejects duplicate item code', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'x', code: 'ITEM-001' });
    await expect(service.createItem('book-1', { code: 'ITEM-001', name: 'X', uom: 'PCS', cost: 0, price: 0, onHand: 0, reorderLevel: 0 } as never)).rejects.toThrow(/exists/);
  });

  it('lowStock returns only items at or below reorder level', async () => {
    prisma.item.findMany.mockResolvedValue([
      { id: '1', code: 'A', name: 'A', uom: 'PCS', cost: 0, price: 0, onHand: 5, reorderLevel: 10, active: true },
      { id: '2', code: 'B', name: 'B', uom: 'PCS', cost: 0, price: 0, onHand: 100, reorderLevel: 10, active: true },
      { id: '3', code: 'C', name: 'C', uom: 'PCS', cost: 0, price: 0, onHand: 0, reorderLevel: 0, active: true },
    ]);
    const low = await service.lowStock('book-1');
    expect(low).toHaveLength(2);
  });
});
