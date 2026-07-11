import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountBooksService } from './account-books.service';

function makePrisma() {
  return {
    accountBook: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('AccountBooksService', () => {
  it('list returns ordered account books', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findMany.mockResolvedValue([{ id: 'b1', code: 'A' }]);
    const svc = new AccountBooksService(prisma as never);
    const out = await svc.list();
    expect(out).toEqual([{ id: 'b1', code: 'A' }]);
    expect(prisma.accountBook.findMany).toHaveBeenCalledWith({ orderBy: { code: 'asc' } });
  });

  it('get returns the book or throws NotFound', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue({ id: 'b1', code: 'A' });
    const svc = new AccountBooksService(prisma as never);
    await expect(svc.get('b1')).resolves.toEqual({ id: 'b1', code: 'A' });
    prisma.accountBook.findUnique.mockResolvedValue(null);
    await expect(svc.get('missing')).rejects.toThrow(NotFoundException);
  });

  it('create rejects duplicate code', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue({ id: 'existing', code: 'A' });
    const svc = new AccountBooksService(prisma as never);
    await expect(svc.create({ code: 'A', name: 'A book', baseCurrency: 'MYR', timezone: 'Asia/Kuala_Lumpur', industryCode: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, country: 'MY', taxId: null } as never)).rejects.toThrow(BadRequestException);
    expect(prisma.accountBook.create).not.toHaveBeenCalled();
  });

  it('create defaults active to true and persists provided fields', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue(null);
    prisma.accountBook.create.mockResolvedValue({ id: 'b1', code: 'A', name: 'A book', baseCurrency: 'MYR', active: true });
    const svc = new AccountBooksService(prisma as never);
    const out = await svc.create({ code: 'A', name: 'A book', baseCurrency: 'MYR', timezone: 'Asia/Kuala_Lumpur', industryCode: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, country: 'MY', taxId: null } as never);
    expect(out).toMatchObject({ id: 'b1', active: true });
    const call = prisma.accountBook.create.mock.calls[0][0];
    expect(call.data.active).toBe(true);
  });

  it('create preserves caller-supplied active=false', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue(null);
    prisma.accountBook.create.mockResolvedValue({ id: 'b1', active: false });
    const svc = new AccountBooksService(prisma as never);
    await svc.create({ code: 'B', name: 'B', baseCurrency: 'MYR', timezone: 'Asia/KL', industryCode: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, country: 'MY', taxId: null, active: false } as never);
    expect(prisma.accountBook.create.mock.calls[0][0].data.active).toBe(false);
  });

  it('update throws NotFound when book missing', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue(null);
    const svc = new AccountBooksService(prisma as never);
    await expect(svc.update('nope', { name: 'X' } as never)).rejects.toThrow(NotFoundException);
    expect(prisma.accountBook.update).not.toHaveBeenCalled();
  });

  it('update writes provided fields and returns updated book', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.accountBook.update.mockResolvedValue({ id: 'b1', name: 'New' });
    const svc = new AccountBooksService(prisma as never);
    const out = await svc.update('b1', { name: 'New' } as never);
    expect(out).toEqual({ id: 'b1', name: 'New' });
    expect(prisma.accountBook.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { name: 'New' } });
  });

  it('remove throws NotFound when book missing', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue(null);
    const svc = new AccountBooksService(prisma as never);
    await expect(svc.remove('nope')).rejects.toThrow(NotFoundException);
    expect(prisma.accountBook.delete).not.toHaveBeenCalled();
  });

  it('remove deletes when present', async () => {
    const prisma = makePrisma();
    prisma.accountBook.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.accountBook.delete.mockResolvedValue(undefined);
    const svc = new AccountBooksService(prisma as never);
    await svc.remove('b1');
    expect(prisma.accountBook.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });
});
