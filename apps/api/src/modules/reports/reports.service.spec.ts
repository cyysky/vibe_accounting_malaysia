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
