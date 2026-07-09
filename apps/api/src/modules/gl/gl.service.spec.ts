import { Test } from '@nestjs/testing';
import { GlService } from './gl.service';
import { PrismaService } from '../../database/prisma.service';

describe('GlService', () => {
  let service: GlService;
  let prisma: { journalEntry: { count: jest.Mock; create: jest.Mock }; account: { findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      journalEntry: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      account: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        GlService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(GlService);
  });

  it('rejects unbalanced journal entries', async () => {
    await expect(
      service.createJournal('book-1', {
        date: '2025-01-01',
        description: 'test',
        lines: [
          { accountId: 'a', debit: 100, credit: 0 },
          { accountId: 'b', debit: 0, credit: 50 },
        ],
      } as never),
    ).rejects.toThrow(/balance/);
  });

  it('creates a balanced journal entry', async () => {
    prisma.account.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    prisma.journalEntry.create.mockResolvedValue({ id: 'j1', number: 'JV-0001' });
    const result = await service.createJournal('book-1', {
      date: '2025-01-01',
      description: 'test',
      lines: [
        { accountId: 'a', debit: 100, credit: 0 },
        { accountId: 'b', debit: 0, credit: 100 },
      ],
    } as never);
    expect(result).toMatchObject({ number: 'JV-0001' });
    expect(prisma.journalEntry.create).toHaveBeenCalled();
  });
});
