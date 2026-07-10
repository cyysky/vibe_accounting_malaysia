import { Test } from '@nestjs/testing';
import { ArService } from './ar.service';
import { PrismaService } from '../../database/prisma.service';
import { DocumentSequenceService } from '../../database/document-sequence.service';
import { PostingService } from '../gl/posting.service';
const makeSeq = () => ({ next: jest.fn().mockResolvedValue('TEST-00001') }) as any;


describe('ArService', () => {
  let service: ArService;
  let prisma: { customer: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock }; customerInvoice: { findUnique: jest.Mock; delete: jest.Mock; count: jest.Mock; create: jest.Mock; findMany: jest.Mock }; taxCode: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      customer: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      customerInvoice: { findUnique: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn(), findMany: jest.fn() },
      taxCode: { findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [ArService, { provide: PrismaService, useValue: prisma }, { provide: DocumentSequenceService, useValue: makeSeq() }, { provide: PostingService, useValue: { postCustomerInvoice: jest.fn().mockResolvedValue(null), postSupplierInvoice: jest.fn().mockResolvedValue(null) } }],
    }).compile();
    service = module.get(ArService);
  });

  it('rejects invoice with customer from a different book', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1', accountBookId: 'other' });
    await expect(
      service.createInvoice('book-1', { customerId: 'c1', date: '2025-01-01', dueDate: '2025-02-01', lines: [{ description: 'X', quantity: 1, unitPrice: 10 }] } as never),
    ).rejects.toThrow();
  });

  it('creates invoice with totals', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1', accountBookId: 'book-1' });
    prisma.taxCode.findUnique.mockResolvedValue({ id: 't1', code: 'SVAT-08', name: 'Sales 8%', rate: 0.08 });
    prisma.customerInvoice.create.mockResolvedValue({ id: 'i1', number: 'INV-00001', total: 108 });
    const result = await service.createInvoice('book-1', {
      customerId: 'c1', date: '2025-01-01', dueDate: '2025-02-01',
      lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, taxCodeId: 't1' }],
    } as never);
    expect(result).toMatchObject({ number: 'INV-00001' });
    expect(prisma.customerInvoice.create).toHaveBeenCalled();
    expect(prisma.customer.update).toHaveBeenCalled();
  });
});
