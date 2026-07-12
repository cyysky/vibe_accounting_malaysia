import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma.service';
import { GlService } from '../gl/gl.service';
import { DashboardService } from '../dashboard/dashboard.service';

describe('ReportsService.cashFlow', () => {
  let svc: ReportsService;
  let prisma: { journalEntry: { findMany: jest.Mock } };
  let gl: GlService;
  let dashboard: DashboardService;

  beforeEach(() => {
    prisma = {
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'j1', number: 'JV-0001', date: new Date('2026-01-15'),
            status: 'POSTED', createdAt: new Date(), updatedAt: new Date(), description: null,
            accountBookId: 'b1', postedAt: new Date(),
            lines: [
              {
                id: 'l1', journalId: 'j1', accountId: 'a1',
                description: null, debit: 0, credit: 100,
                account: { id: 'a1', code: '4000', name: 'Sales', type: 'REVENUE' } as never,
              },
              {
                id: 'l2', journalId: 'j1', accountId: 'a2',
                description: null, debit: 50, credit: 0,
                account: { id: 'a2', code: '6000', name: 'Rent', type: 'EXPENSE' } as never,
              },
              {
                id: 'l3', journalId: 'j1', accountId: 'a3',
                description: null, debit: 30, credit: 0,
                account: { id: 'a3', code: '1500', name: 'Inventory', type: 'ASSET' } as never,
              },
            ],
          },
        ]),
      },
    };
    svc = new ReportsService(prisma as never, glStub, dashboardStub);
  });

  it('sums revenue, expenses, assets (investing) into operating/investing buckets', async () => {
    const result = await svc.cashFlow('b1', '2026-01-01', '2026-12-31');
    // operating = revenue - expenses = 100 - 50 = 50
    expect(result.operating).toBeCloseTo(50, 5);
    // investing adds back the inventory movement: 30 (delta = 30 - 0)
    expect(result.investing).toBeCloseTo(30, 5);
    // net = 80
    expect(result.net).toBeCloseTo(80, 5);
    expect(result.journalCount).toBe(1);
  });

  it('works without a from/to range', async () => {
    const result = await svc.cashFlow('b1');
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
    expect(result.operating).toBeCloseTo(50, 5);
  });
});

// Stubs so the constructor doesn't explode.
const glStub = {} as GlService;
const dashboardStub = {} as DashboardService;


describe('ReportsService.generalLedger', () => {
  function makeSvc(journals: unknown[], accounts: unknown[]) {
    const prisma: any = {
      journalEntry: {
        findMany: jest.fn().mockResolvedValue(journals),
      },
      account: {
        findMany: jest.fn().mockResolvedValue(accounts),
      },
    };
    return { svc: new ReportsService(prisma as never, glStub, dashboardStub), prisma };
  }

  const sampleJournals = [
    {
      id: 'j1', number: 'JV-0001', date: new Date('2025-01-15'),
      status: 'POSTED', createdAt: new Date(), updatedAt: new Date(), description: 'Sale',
      accountBookId: 'b1', postedAt: new Date(),
      lines: [
        { id: 'l1', journalId: 'j1', accountId: 'a1', description: null, debit: 100, credit: 0, account: { id: 'a1', code: '1100', name: 'Cash', type: 'ASSET' } as never },
        { id: 'l2', journalId: 'j1', accountId: 'a2', description: null, debit: 0, credit: 100, account: { id: 'a2', code: '4000', name: 'Sales', type: 'REVENUE' } as never },
      ],
    },
  ];
  const sampleAccounts = [
    { id: 'a1', code: '1100', name: 'Cash', type: 'ASSET' },
    { id: 'a2', code: '4000', name: 'Sales', type: 'REVENUE' },
  ];

  it('applies account filter as a lines.some.account OR clause', async () => {
    const { svc, prisma } = makeSvc(sampleJournals, sampleAccounts);
    await svc.generalLedger('b1', '2025-01-01', '2025-01-31', '1100');
    const call = prisma.journalEntry.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      accountBookId: 'b1',
      status: 'POSTED',
      lines: { some: { account: { OR: [{ id: '1100' }, { code: '1100' }] } } },
    });
  });

  it('omits the lines filter when no account is provided', async () => {
    const { svc, prisma } = makeSvc(sampleJournals, sampleAccounts);
    await svc.generalLedger('b1', '2025-01-01', '2025-01-31');
    const call = prisma.journalEntry.findMany.mock.calls[0][0];
    expect(call.where.lines).toBeUndefined();
  });
});

describe('ReportsService.arAging', () => {
  function makePrisma() {
    return {
      customerInvoice: { findMany: jest.fn() },
    };
  }
  function buildService(prisma: ReturnType<typeof makePrisma>) {
    const gl = {} as never;
    const dashboard = {} as never;
    const svc = new (require('./reports.service').ReportsService)(prisma as never, gl, dashboard);
    return svc;
  }
  function dueIn(days: number): Date {
    return new Date(Date.now() + days * 86_400_000);
  }

  it('groups open invoices into the four aging buckets per customer', async () => {
    const prisma = makePrisma();
    prisma.customerInvoice.findMany.mockResolvedValue([
      { id: 'i1', customerId: 'c1', customer: { name: 'A' }, dueDate: dueIn(-15), balance: 100, number: 'INV-1', date: new Date() },
      { id: 'i2', customerId: 'c1', customer: { name: 'A' }, dueDate: dueIn(-45), balance: 200, number: 'INV-2', date: new Date() },
      { id: 'i3', customerId: 'c1', customer: { name: 'A' }, dueDate: dueIn(-120), balance: 50, number: 'INV-3', date: new Date() },
    ]);
    const svc = buildService(prisma);
    const res = await svc.arAging('book-1');
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].buckets.d1_30).toBe(100);
    expect(res.rows[0].buckets.d31_60).toBe(200);
    expect(res.rows[0].buckets.d90_plus).toBe(50);
    expect(res.rows[0].buckets.total).toBe(350);
    expect(res.totals.total).toBe(350);
    expect(res.rows[0].invoices).toHaveLength(3);
  });

  it('skips invoices with a zero or negative balance', async () => {
    const prisma = makePrisma();
    prisma.customerInvoice.findMany.mockResolvedValue([
      { id: 'i1', customerId: 'c1', customer: { name: 'A' }, dueDate: dueIn(-10), balance: 0, number: 'INV-1', date: new Date() },
      { id: 'i2', customerId: 'c2', customer: { name: 'B' }, dueDate: dueIn(-5), balance: -50, number: 'INV-2', date: new Date() },
    ]);
    const svc = buildService(prisma);
    const res = await svc.arAging('book-1');
    expect(res.rows).toHaveLength(0);
    expect(res.totals.total).toBe(0);
  });

  it('orders rows by outstanding balance descending', async () => {
    const prisma = makePrisma();
    prisma.customerInvoice.findMany.mockResolvedValue([
      { id: 'i1', customerId: 'low', customer: { name: 'L' }, dueDate: dueIn(-10), balance: 50, number: 'L1', date: new Date() },
      { id: 'i2', customerId: 'high', customer: { name: 'H' }, dueDate: dueIn(-10), balance: 500, number: 'H1', date: new Date() },
    ]);
    const svc = buildService(prisma);
    const res = await svc.arAging('book-1');
    expect(res.rows[0].customerName).toBe('H');
    expect(res.rows[1].customerName).toBe('L');
  });

  it('uses the supplied asOf date for the today-relative calculation', async () => {
    const prisma = makePrisma();
    prisma.customerInvoice.findMany.mockResolvedValue([
      { id: 'i1', customerId: 'c1', customer: { name: 'A' }, dueDate: new Date('2025-01-01'), balance: 100, number: 'INV-1', date: new Date() },
    ]);
    const svc = buildService(prisma);
    const res = await svc.arAging('book-1', '2025-02-15');
    expect(res.asOf).toBe('2025-02-15');
    expect(res.rows[0].invoices[0].daysOverdue).toBeGreaterThanOrEqual(45);
  });
});

describe('ReportsService.apAging', () => {
  function makePrisma() {
    return { supplierInvoice: { findMany: jest.fn() } };
  }
  function buildService(prisma: ReturnType<typeof makePrisma>) {
    const gl = {} as never;
    const dashboard = {} as never;
    const svc = new (require('./reports.service').ReportsService)(prisma as never, gl, dashboard);
    return svc;
  }
  function dueIn(days: number): Date {
    return new Date(Date.now() + days * 86_400_000);
  }

  it('groups open supplier bills by aging bucket', async () => {
    const prisma = makePrisma();
    prisma.supplierInvoice.findMany.mockResolvedValue([
      { id: 'b1', supplierId: 's1', supplier: { name: 'S1' }, dueDate: dueIn(-5), balance: 200, number: 'B-1', date: new Date() },
      { id: 'b2', supplierId: 's1', supplier: { name: 'S1' }, dueDate: dueIn(-75), balance: 300, number: 'B-2', date: new Date() },
    ]);
    const svc = buildService(prisma);
    const res = await svc.apAging('book-1');
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].buckets.d1_30).toBe(200);
    expect(res.rows[0].buckets.d61_90).toBe(300);
    expect(res.totals.total).toBe(500);
  });

  it('ignores paid or credit-balance supplier bills', async () => {
    const prisma = makePrisma();
    prisma.supplierInvoice.findMany.mockResolvedValue([
      { id: 'b1', supplierId: 's1', supplier: { name: 'S1' }, dueDate: dueIn(-5), balance: 0, number: 'B-1', date: new Date() },
    ]);
    const svc = buildService(prisma);
    const res = await svc.apAging('book-1');
    expect(res.rows).toHaveLength(0);
  });
});
