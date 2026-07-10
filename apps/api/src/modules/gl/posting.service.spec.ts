import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PostingService } from './posting.service';
import { PrismaService } from '../../database/prisma.service';
import { DocumentSequenceService } from '../../database/document-sequence.service';
const makeSeq = () => ({ next: jest.fn().mockResolvedValue('TEST-00001') }) as any;


describe('PostingService', () => {
  let svc: PostingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn() },
      fiscalYear: { findFirst: jest.fn() },
      journalEntry: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      customerInvoice: { findUnique: jest.fn() },
      supplierInvoice: { findUnique: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [PostingService, { provide: PrismaService, useValue: prisma }, { provide: DocumentSequenceService, useValue: makeSeq() }],
    }).compile();
    svc = mod.get(PostingService);
  });

  describe('customer invoice posting', () => {
    it('posts DR AR, CR Sales, CR SST when all accounts present', async () => {
      prisma.customerInvoice.findUnique.mockResolvedValue({
        id: 'inv-1', accountBookId: 'book-1', number: 'INV-00001',
        date: new Date('2025-06-01'), subtotal: new Prisma.Decimal(100),
        taxTotal: new Prisma.Decimal(8), total: new Prisma.Decimal(108),
      });
      prisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1', year: 2025, closed: false });
      prisma.account.findUnique
        .mockResolvedValueOnce({ id: 'ar' })     // 1200
        .mockResolvedValueOnce({ id: 'sales' })  // 4000
        .mockResolvedValueOnce({ id: 'sst' });   // 2100
      prisma.journalEntry.create.mockResolvedValue({ id: 'jv-1', number: 'JV-0001' });

      const jvId = await svc.postCustomerInvoice('inv-1');
      expect(jvId).toBe('jv-1');
      const createArgs = prisma.journalEntry.create.mock.calls[0][0];
      const lines = createArgs.data.lines.create;
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatchObject({ accountId: 'ar', debit: new Prisma.Decimal(108) });
      expect(lines[1]).toMatchObject({ accountId: 'sales', credit: new Prisma.Decimal(100) });
      expect(lines[2]).toMatchObject({ accountId: 'sst', credit: new Prisma.Decimal(8) });
    });

    it('skips posting when AR/Sales accounts missing', async () => {
      prisma.customerInvoice.findUnique.mockResolvedValue({
        id: 'inv-1', accountBookId: 'book-1', number: 'INV-00001',
        date: new Date('2025-06-01'), subtotal: new Prisma.Decimal(100),
        taxTotal: new Prisma.Decimal(8), total: new Prisma.Decimal(108),
      });
      prisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1', year: 2025, closed: false });
      prisma.account.findUnique.mockResolvedValue(null);
      const jvId = await svc.postCustomerInvoice('inv-1');
      expect(jvId).toBeNull();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });
});
