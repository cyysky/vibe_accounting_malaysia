import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { GlService } from "../gl/gl.service";
import { DashboardService } from "../dashboard/dashboard.service";

interface AgingBucket {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
}

function emptyBuckets(): AgingBucket {
  return { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
    private readonly dashboard: DashboardService,
  ) {}

  async profitAndLoss(bookId: string) {
    const tb = await this.gl.trialBalance(bookId);
    const revenue = tb.filter((r) => r.account.type === "REVENUE").reduce((s, r) => s + (r.credit - r.debit), 0);
    const expenses = tb.filter((r) => r.account.type === "EXPENSE").reduce((s, r) => s + (r.debit - r.credit), 0);
    return { revenue, expenses, netIncome: revenue - expenses };
  }

  async balanceSheet(bookId: string) {
    const tb = await this.gl.trialBalance(bookId);
    const sum = (type: "ASSET" | "LIABILITY" | "EQUITY") =>
      tb
        .filter((r) => r.account.type === type)
        .reduce(
          (s, r) =>
            s +
            (type === "ASSET" ? r.debit - r.credit : r.credit - r.debit),
          0,
        );
    const assets = sum("ASSET");
    const liabilities = sum("LIABILITY");
    const equity = sum("EQUITY");
    return { assets, liabilities, equity, balanced: Math.abs(assets - (liabilities + equity)) < 0.01 };
  }

  async executiveSummary(bookId: string) {
    const [dash, pnl, bs] = await Promise.all([
      this.dashboard.summary(bookId),
      this.profitAndLoss(bookId),
      this.balanceSheet(bookId),
    ]);
    return { ...dash, pnl, bs };
  }

  /**
   * Accounts Receivable aging report. Groups open (balance > 0) customer
   * invoices by days past due, relative to today.
   */
  async arAging(bookId: string, asOf?: string) {
    const today = asOf ? new Date(asOf) : new Date();
    const invoices = await this.prisma.customerInvoice.findMany({
      where: { accountBookId: bookId, status: { in: ["ISSUED", "PARTIAL"] as never[] } },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
    });
    const byCustomer = new Map<string, { customerId: string; customerName: string; buckets: AgingBucket; invoices: Array<{ id: string; number: string; date: string; dueDate: string; balance: number; daysOverdue: number }> }>();
    for (const inv of invoices) {
      const balance = Number(inv.balance);
      if (balance <= 0) continue;
      const daysOverdue = Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const b = daysOverdue <= 0 ? "current" : daysOverdue <= 30 ? "d1_30" : daysOverdue <= 60 ? "d31_60" : daysOverdue <= 90 ? "d61_90" : "d90_plus";
      let row = byCustomer.get(inv.customerId);
      if (!row) {
        row = { customerId: inv.customerId, customerName: inv.customer.name, buckets: emptyBuckets(), invoices: [] };
        byCustomer.set(inv.customerId, row);
      }
      row.buckets[b] += balance;
      row.buckets.total += balance;
      row.invoices.push({ id: inv.id, number: inv.number, date: inv.date.toISOString().slice(0, 10), dueDate: inv.dueDate.toISOString().slice(0, 10), balance, daysOverdue });
    }
    const rows = Array.from(byCustomer.values()).sort((a, b) => b.buckets.total - a.buckets.total);
    const totals = emptyBuckets();
    for (const r of rows) {
      totals.current += r.buckets.current;
      totals.d1_30 += r.buckets.d1_30;
      totals.d31_60 += r.buckets.d31_60;
      totals.d61_90 += r.buckets.d61_90;
      totals.d90_plus += r.buckets.d90_plus;
      totals.total += r.buckets.total;
    }
    return { asOf: today.toISOString().slice(0, 10), rows, totals };
  }

  /**
   * Accounts Payable aging report. Symmetric to AR but for supplier bills.
   */
  async apAging(bookId: string, asOf?: string) {
    const today = asOf ? new Date(asOf) : new Date();
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { accountBookId: bookId, status: { in: ["ISSUED", "PARTIAL"] as never[] } },
      include: { supplier: true },
      orderBy: { dueDate: "asc" },
    });
    const bySupplier = new Map<string, { supplierId: string; supplierName: string; buckets: AgingBucket; invoices: Array<{ id: string; number: string; date: string; dueDate: string; balance: number; daysOverdue: number }> }>();
    for (const inv of invoices) {
      const balance = Number(inv.balance);
      if (balance <= 0) continue;
      const daysOverdue = Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const b = daysOverdue <= 0 ? "current" : daysOverdue <= 30 ? "d1_30" : daysOverdue <= 60 ? "d31_60" : daysOverdue <= 90 ? "d61_90" : "d90_plus";
      let row = bySupplier.get(inv.supplierId);
      if (!row) {
        row = { supplierId: inv.supplierId, supplierName: inv.supplier.name, buckets: emptyBuckets(), invoices: [] };
        bySupplier.set(inv.supplierId, row);
      }
      row.buckets[b] += balance;
      row.buckets.total += balance;
      row.invoices.push({ id: inv.id, number: inv.number, date: inv.date.toISOString().slice(0, 10), dueDate: inv.dueDate.toISOString().slice(0, 10), balance, daysOverdue });
    }
    const rows = Array.from(bySupplier.values()).sort((a, b) => b.buckets.total - a.buckets.total);
    const totals = emptyBuckets();
    for (const r of rows) {
      totals.current += r.buckets.current;
      totals.d1_30 += r.buckets.d1_30;
      totals.d31_60 += r.buckets.d31_60;
      totals.d61_90 += r.buckets.d61_90;
      totals.d90_plus += r.buckets.d90_plus;
      totals.total += r.buckets.total;
    }
    return { asOf: today.toISOString().slice(0, 10), rows, totals };
  }

  /**
   * Cash Flow statement.  Aggregates all activity against the configured
   * bank account codes for the period and reports operating / investing /
   * financing subtotals.  Falls back to a simple opening-vs-closing
   * calculation if no GL bank accounts are tagged.
   */
  async cashFlow(bookId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { accountBookId: bookId, status: 'POSTED' };
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) (where.date as Record<string, Date>).lte = new Date(to);
    }
    const journals = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'asc' },
    });
    let operating = 0;
    let investing = 0;
    let financing = 0;
    let periodInflows = 0;
    let periodOutflows = 0;
    for (const j of journals) {
      for (const l of j.lines) {
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        const type = l.account.type;
        const delta = debit - credit;
        if (type === 'REVENUE') operating += credit - debit;
        else if (type === 'EXPENSE') operating -= debit - credit;
        else if (type === 'ASSET' && l.account.code?.startsWith('1')) {
          investing += delta;
        } else if (type === 'LIABILITY') financing += delta;
        else if (type === 'EQUITY') financing += delta;
        if (delta > 0) periodInflows += delta;
        if (delta < 0) periodOutflows += -delta;
      }
    }
    const net = operating + investing + financing;
    return {
      from: from ?? null,
      to: to ?? null,
      operating,
      investing,
      financing,
      net,
      periodInflows,
      periodOutflows,
      journalCount: journals.length,
    };
  }

  /**
   * General Ledger listing for a date range. Returns per-account running
   * balances plus a per-account summary. Useful for the GL report page.
   */
  async generalLedger(bookId: string, from?: string, to?: string, account?: string) {
    const where: Record<string, unknown> = { accountBookId: bookId, status: "POSTED" };
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) (where.date as Record<string, Date>).lte = new Date(to);
    }
    if (account) {
      where.lines = { some: { account: { OR: [{ id: account }, { code: account }] } } };
    }
    const accounts = await this.prisma.account.findMany({
      where: { accountBookId: bookId },
      orderBy: { code: "asc" },
    });
    const journals = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: "asc" },
    });
    const lines: Array<{
      journalId: string;
      journalNumber: string;
      date: string;
      description: string;
      accountId: string;
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }> = [];
    const accountSummary = new Map<string, { accountId: string; accountCode: string; accountName: string; opening: number; debit: number; credit: number; closing: number }>();
    // Opening balances from journals BEFORE the filter window
    const opening: Array<{ accountId: string; debit: number; credit: number }> = [];
    if (from) {
      const prior = await this.prisma.journalEntry.findMany({
        where: { accountBookId: bookId, status: "POSTED", date: { lt: new Date(from) } },
        include: { lines: true },
      });
      for (const j of prior) for (const l of j.lines) opening.push({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit) });
    }
    for (const a of accounts) {
      const accOpening = opening.filter((o) => o.accountId === a.id).reduce((s, o) => s + (Number(o.debit) - Number(o.credit)), 0);
      accountSummary.set(a.id, { accountId: a.id, accountCode: a.code, accountName: a.name, opening: accOpening, debit: 0, credit: 0, closing: accOpening });
    }
    for (const j of journals) {
      for (const l of j.lines) {
        const summary = accountSummary.get(l.accountId);
        const running = summary ? summary.closing + (Number(l.debit) - Number(l.credit)) : 0;
        if (summary) {
          summary.debit += Number(l.debit);
          summary.credit += Number(l.credit);
          summary.closing = running;
        }
        lines.push({
          journalId: j.id,
          journalNumber: j.number,
          date: j.date.toISOString().slice(0, 10),
          description: l.description ?? j.description,
          accountId: l.accountId,
          accountCode: l.account.code,
          accountName: l.account.name,
          debit: Number(l.debit),
          credit: Number(l.credit),
          runningBalance: running,
        });
      }
    }
    return {
      from: from ?? null,
      to: to ?? null,
      lines,
      accounts: Array.from(accountSummary.values()).filter((a) => a.debit || a.credit || a.opening !== 0),
    };
  }
}
