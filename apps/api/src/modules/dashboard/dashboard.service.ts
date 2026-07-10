import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface DashboardSummary {
  cashPosition: number;
  arOutstanding: number;
  apOutstanding: number;
  revenueMtd: number;
  expenseMtd: number;
  inventoryValue: number;
  topCustomers: Array<{ customerId: string; name: string; balance: number }>;
  topItems: Array<{ itemId: string; name: string; onHand: number; reorderLevel: number }>;
  recentInvoices: Array<{ id: string; number: string; customerName: string; total: number; date: string; status: string }>;
  einvoicePending: number;
  einvoiceValid: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(bookId?: string): Promise<DashboardSummary> {
    if (!bookId) {
      return {
        cashPosition: 0,
        arOutstanding: 0,
        apOutstanding: 0,
        revenueMtd: 0,
        expenseMtd: 0,
        inventoryValue: 0,
        topCustomers: [],
        topItems: [],
        recentInvoices: [],
        einvoicePending: 0,
        einvoiceValid: 0,
      };
    }

    const [customers, suppliers, items, invoices, journals, einvoiceSubmissions] = await Promise.all([
      this.prisma.customer.findMany({ where: { accountBookId: bookId } }),
      this.prisma.supplier.findMany({ where: { accountBookId: bookId } }),
      this.prisma.item.findMany({ where: { accountBookId: bookId, active: true } }),
      this.prisma.customerInvoice.findMany({
        where: { accountBookId: bookId },
        include: { customer: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.journalEntry.findMany({
        where: { accountBookId: bookId, status: 'POSTED' },
        include: { lines: { include: { account: true } } },
      }),
      this.prisma.einvoiceSubmission.findMany({ where: { accountBookId: bookId } }),
    ]);

    const arOutstanding = customers.reduce((s, c) => s + Number(c.outstanding), 0);
    const apOutstanding = suppliers.reduce((s, s2) => s + Number(s2.outstanding), 0);
    const inventoryValue = items.reduce((s, i) => s + Number(i.onHand) * Number(i.cost), 0);

    // Cash = sum of 1000/1100 (cash & bank) lines from posted journals
    const cashAccountIds = new Set(
      (await this.prisma.account.findMany({ where: { accountBookId: bookId, code: { in: ['1000', '1100'] } } })).map((a) => a.id),
    );
    let cashPosition = 0;
    for (const j of journals) {
      for (const line of j.lines) {
        if (cashAccountIds.has(line.accountId)) cashPosition += Number(line.debit) - Number(line.credit);
      }
    }

    // MTD revenue / expense
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let revenueMtd = 0;
    let expenseMtd = 0;
    for (const j of journals) {
      if (j.date < firstOfMonth) continue;
      for (const line of j.lines) {
        if (line.account.type === 'REVENUE') revenueMtd += Number(line.credit) - Number(line.debit);
        if (line.account.type === 'EXPENSE') expenseMtd += Number(line.debit) - Number(line.credit);
      }
    }

    const topCustomers = [...customers]
      .sort((a, b) => Number(b.outstanding) - Number(a.outstanding))
      .slice(0, 5)
      .map((c) => ({ customerId: c.id, name: c.name, balance: Number(c.outstanding) }));

    const topItems = [...items]
      .filter((i) => Number(i.onHand) <= Number(i.reorderLevel))
      .slice(0, 5)
      .map((i) => ({ itemId: i.id, name: i.name, onHand: Number(i.onHand), reorderLevel: Number(i.reorderLevel) }));

    const recentInvoices = invoices.map((i) => ({
      id: i.id,
      number: i.number,
      customerName: i.customer?.name ?? '',
      total: Number(i.total),
      date: i.date.toISOString().slice(0, 10),
      status: i.status,
    }));

    const einvoicePending = einvoiceSubmissions.filter((s) => s.documentStatus === 1 || s.documentStatus == null).length;
    const einvoiceValid = einvoiceSubmissions.filter((s) => s.documentStatus === 2).length;

    return {
      cashPosition,
      arOutstanding,
      apOutstanding,
      revenueMtd,
      expenseMtd,
      inventoryValue,
      topCustomers,
      topItems,
      recentInvoices,
      einvoicePending,
      einvoiceValid,
    };
  }

  /**
   * Cross-entity search by a case-insensitive substring.  Returns the
   * first matches in customers, suppliers, items, customer invoices,
   * supplier invoices and journal entries so the global search box can
   * show live results.
   */
  async search(bookId: string, q: string, limit = 5) {
    if (!q || q.length < 2) {
      return { customers: [], suppliers: [], items: [], invoices: [], bills: [], journals: [] };
    }
    const contains = { contains: q, mode: 'insensitive' as const };
    const [customers, suppliers, items, invoices, bills, journals] = await Promise.all([
      this.prisma.customer.findMany({
        where: { accountBookId: bookId, OR: [{ name: contains }, { code: contains }] },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.findMany({
        where: { accountBookId: bookId, OR: [{ name: contains }, { code: contains }] },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.item.findMany({
        where: { accountBookId: bookId, OR: [{ name: contains }, { code: contains }] },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customerInvoice.findMany({
        where: { accountBookId: bookId, OR: [{ number: contains }, { notes: contains }] },
        take: limit,
        orderBy: { date: 'desc' },
        include: { customer: { select: { id: true, name: true } } },
      }),
      this.prisma.supplierInvoice.findMany({
        where: { accountBookId: bookId, OR: [{ number: contains }, { notes: contains }] },
        take: limit,
        orderBy: { date: 'desc' },
        include: { supplier: { select: { id: true, name: true } } },
      }),
      this.prisma.journalEntry.findMany({
        where: { accountBookId: bookId, OR: [{ number: contains }, { description: contains }] },
        take: limit,
        orderBy: { date: 'desc' },
      }),
    ]);
    return { customers, suppliers, items, invoices, bills, journals };
  }
}
