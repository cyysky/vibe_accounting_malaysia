import { Test } from '@nestjs/testing';
import { GlService } from './gl.service';
import { PrismaService } from '../../database/prisma.service';

describe('GlService', () => {
  let service: GlService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      journalEntry: { count: jest.fn().mockResolvedValue(0), create: jest.fn(), findMany: jest.fn() },
      account: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      fiscalYear: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      taxCode: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [GlService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GlService);
  });

  describe('journals', () => {
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

    it('rejects when no fiscal year is configured for the date', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      await expect(
        service.createJournal('book-1', {
          date: '2025-01-01',
          description: 'test',
          lines: [
            { accountId: 'a', debit: 100, credit: 0 },
            { accountId: 'b', debit: 0, credit: 100 },
          ],
        } as never),
      ).rejects.toThrow(/fiscal year/);
    });

    it('rejects when the fiscal year is closed', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1', year: 2024, closed: true });
      prisma.account.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      await expect(
        service.createJournal('book-1', {
          date: '2025-01-01',
          description: 'test',
          lines: [
            { accountId: 'a', debit: 100, credit: 0 },
            { accountId: 'b', debit: 0, credit: 100 },
          ],
        } as never),
      ).rejects.toThrow(/closed/);
    });

    it('creates a balanced journal entry', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1', year: 2025, closed: false });
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

  describe('tax codes', () => {
    it('creates a tax code', async () => {
      prisma.taxCode.create.mockResolvedValue({ id: 't1', code: 'SVAT-12', rate: { toString: () => '0.1200' } });
      const r = await service.createTaxCode('book-1', { code: 'SVAT-12', name: '12%', rate: 0.12 } as never);
      expect(r).toMatchObject({ code: 'SVAT-12' });
    });

    it('rejects duplicate tax code', async () => {
      prisma.taxCode.findUnique = jest.fn().mockResolvedValue({ id: 'existing' });
      await expect(service.createTaxCode('book-1', { code: 'SVAT-12', name: '12%', rate: 0.12 } as never)).rejects.toThrow(/already exists/);
    });
  });

  describe('fiscal years', () => {
    it('creates a fiscal year', async () => {
      prisma.fiscalYear.findUnique = jest.fn().mockResolvedValue(null);
      prisma.fiscalYear.create = jest.fn().mockResolvedValue({ id: 'fy-1', year: 2025 });
      const r = await service.createFiscalYear('book-1', { year: 2025, startDate: '2025-01-01', endDate: '2025-12-31' } as never);
      expect(r).toMatchObject({ year: 2025 });
    });

    it('rejects fiscal year when end <= start', async () => {
      await expect(
        service.createFiscalYear('book-1', { year: 2025, startDate: '2025-12-31', endDate: '2025-01-01' } as never),
      ).rejects.toThrow(/after startDate/);
    });
  });
});
