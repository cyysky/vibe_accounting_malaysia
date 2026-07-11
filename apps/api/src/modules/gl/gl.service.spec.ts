import { Test } from '@nestjs/testing';
import { GlService } from './gl.service';
import { PrismaService } from '../../database/prisma.service';
import { DocumentSequenceService } from '../../database/document-sequence.service';
const makeSeq = () => ({ next: jest.fn().mockResolvedValue('TEST-00001') }) as any;


describe('GlService', () => {
  let service: GlService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      account: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      fiscalYear: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      taxCode: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [GlService, { provide: PrismaService, useValue: prisma }, { provide: DocumentSequenceService, useValue: makeSeq() }],
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


  describe('reverseJournal', () => {
    it('rejects reversing a journal that is not POSTED', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'j2',
        accountBookId: 'book-1',
        number: 'JV-0002',
        date: new Date(),
        status: 'DRAFT',
        description: '',
        reference: null,
        lines: [],
      });
      await expect(service.reverseJournal('book-1', 'j2')).rejects.toThrow(/Only POSTED/);
    });

    it('rejects reversing a journal that has already been reversed', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'j3',
        accountBookId: 'book-1',
        number: 'JV-0003',
        date: new Date(),
        status: 'REVERSED',
        description: '',
        reference: null,
        lines: [],
      });
      await expect(service.reverseJournal('book-1', 'j3')).rejects.toThrow(/already reversed/);
    });

    it('rejects reversing a journal that does not belong to the book', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'j4',
        accountBookId: 'other-book',
        number: 'JV-0004',
        date: new Date(),
        status: 'POSTED',
        description: '',
        reference: null,
        lines: [],
      });
      await expect(service.reverseJournal('book-1', 'j4')).rejects.toThrow(/not found/);
    });

    it('creates a reversal with flipped debits/credits and marks the source REVERSED', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'j5',
        accountBookId: 'book-1',
        number: 'JV-0005',
        date: new Date('2025-03-01'),
        status: 'POSTED',
        description: 'original',
        reference: null,
        totalDebit: PrismaDecimal(100),
        totalCredit: PrismaDecimal(100),
        lines: [
          { id: 'l1', journalId: 'j5', accountId: 'a1', debit: PrismaDecimal(100), credit: PrismaDecimal(0), description: null, lineNo: 1 },
          { id: 'l2', journalId: 'j5', accountId: 'a2', debit: PrismaDecimal(0), credit: PrismaDecimal(100), description: null, lineNo: 2 },
        ],
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'j6', number: 'JV-0099', lines: [] });
      prisma.journalEntry.update.mockResolvedValue({});
      prisma.$transaction = jest.fn(async (cb) => {
        const tx = {
          journalEntry: {
            create: prisma.journalEntry.create,
            update: prisma.journalEntry.update,
          },
        };
        return cb(tx);
      });
      await service.reverseJournal('book-1', 'j5', 'oops');
      const createCall = prisma.journalEntry.create.mock.calls[0][0];
      expect(createCall.data.description).toMatch(/REVERSAL of JV-0005/);
      // The first line should have debit 0 (was 100) and credit 100 (was 0).
      expect(Number(createCall.data.lines.create[0].debit)).toBe(0);
      expect(Number(createCall.data.lines.create[0].credit)).toBe(100);
      expect(prisma.journalEntry.update).toHaveBeenCalledWith({ where: { id: 'j5' }, data: { status: 'REVERSED' } });
    });
  });
});

function PrismaDecimal(v: number) {
  return new (require('@prisma/client').Prisma.Decimal)(v);
}
