import { Injectable } from '@nestjs/common';
import { GlService } from '../gl/gl.service';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly gl: GlService,
    private readonly dashboard: DashboardService,
  ) {}

  profitAndLoss() {
    const tb = this.gl.trialBalance();
    const revenue = tb.filter((r) => r.account.type === 'REVENUE').reduce((s, r) => s + (r.credit - r.debit), 0);
    const expenses = tb.filter((r) => r.account.type === 'EXPENSE').reduce((s, r) => s + (r.debit - r.credit), 0);
    return { revenue, expenses, netIncome: revenue - expenses };
  }

  balanceSheet() {
    const tb = this.gl.trialBalance();
    const sum = (type: 'ASSET' | 'LIABILITY' | 'EQUITY') =>
      tb
        .filter((r) => r.account.type === type)
        .reduce(
          (s, r) =>
            s +
            (type === 'ASSET' ? r.debit - r.credit : r.credit - r.debit),
          0,
        );
    const assets = sum('ASSET');
    const liabilities = sum('LIABILITY');
    const equity = sum('EQUITY');
    return { assets, liabilities, equity, balanced: Math.abs(assets - (liabilities + equity)) < 0.01 };
  }

  executiveSummary() {
    return {
      ...this.dashboard.summary(),
      pnl: this.profitAndLoss(),
      bs: this.balanceSheet(),
    };
  }
}
