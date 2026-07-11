import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';

function makePrisma() {
  return {
    stockMovement: { findMany: jest.fn(), create: jest.fn() },
    item: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('StockMovementsService', () => {
  it('list scopes to the account book and optionally filters by itemId', async () => {
    const prisma = makePrisma();
    prisma.stockMovement.findMany.mockResolvedValue([{ id: 'mv-1' }]);
    const svc = new StockMovementsService(prisma as never);
    await expect(svc.list('book-1')).resolves.toEqual([{ id: 'mv-1' }]);
    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
      where: { accountBookId: 'book-1' },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
    });
    await svc.list('book-1', 'item-1');
    expect(prisma.stockMovement.findMany).toHaveBeenLastCalledWith({
      where: { accountBookId: 'book-1', itemId: 'item-1' },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('create throws NotFound when item not in book', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', accountBookId: 'other' });
    const svc = new StockMovementsService(prisma as never);
    await expect(svc.create('book-1', { itemId: 'item-1', type: 'RECEIVE', quantity: 1, unitCost: 1, reference: 'PO', notes: '', date: '2025-01-01' } as never)).rejects.toThrow(NotFoundException);
  });

  it('create rejects zero quantity', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', accountBookId: 'book-1' });
    const svc = new StockMovementsService(prisma as never);
    await expect(svc.create('book-1', { itemId: 'item-1', type: 'RECEIVE', quantity: 0, unitCost: 1, reference: '', notes: '', date: '2025-01-01' } as never)).rejects.toThrow(BadRequestException);
  });

  it('create persists movement and increments onHand inside a transaction', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', accountBookId: 'book-1' });
    const created = { id: 'mv-1', accountBookId: 'book-1', itemId: 'item-1', type: 'RECEIVE', quantity: { toString: () => '5' } as never, unitCost: 0, reference: null, notes: null, item: { id: 'item-1' } };
    prisma.stockMovement.create.mockResolvedValue(created);
    prisma.item.update.mockResolvedValue({ onHand: 15 });
    let cb: ((tx: unknown) => unknown) | undefined;
    prisma.$transaction.mockImplementation(async (fn) => fn({ stockMovement: prisma.stockMovement, item: prisma.item }));
    const svc = new StockMovementsService(prisma as never);
    const out = await svc.create('book-1', { itemId: 'item-1', type: 'RECEIVE', quantity: 5, unitCost: 0, reference: 'PO-1', notes: '', date: '2025-01-01' } as never);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.stockMovement.create).toHaveBeenCalled();
    expect(prisma.item.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { onHand: { increment: expect.anything() } } });
    expect((out as unknown as { item: { onHand: number } }).item.onHand).toBe(15);
  });

  it('create with negative quantity decreases onHand', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', accountBookId: 'book-1' });
    prisma.stockMovement.create.mockResolvedValue({ id: 'mv-2', item: { id: 'item-1' } });
    prisma.item.update.mockResolvedValue({ onHand: 7 });
    prisma.$transaction.mockImplementation(async (fn) => fn({ stockMovement: prisma.stockMovement, item: prisma.item }));
    const svc = new StockMovementsService(prisma as never);
    const out = await svc.create('book-1', { itemId: 'item-1', type: 'ISSUE', quantity: -3, unitCost: 0, reference: '', notes: '', date: '2025-01-01' } as never);
    expect((out as unknown as { item: { onHand: number } }).item.onHand).toBe(7);
  });
});
