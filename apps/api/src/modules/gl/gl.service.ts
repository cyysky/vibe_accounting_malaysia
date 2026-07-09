import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';
import type {
  Account,
  CreateJournalDto,
  JournalEntry,
  Paginated,
  PaginationQuery,
} from '@account/shared';

@Injectable()
export class GlService {
  constructor(private readonly store: DataStore) {}

  // --- Chart of accounts ---
  listAccounts(): Account[] {
    return this.store.accounts;
  }

  getAccount(id: string): Account {
    const a = this.store.accounts.find((x) => x.id === id);
    if (!a) throw new NotFoundException(`Account ${id} not found`);
    return a;
  }

  // --- Journal entries ---
  listJournals(q: PaginationQuery): Paginated<JournalEntry> {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(q.pageSize ?? 50)));
    const sorted = [...this.store.journals].sort((a, b) =>
      (q.sortDir ?? 'desc') === 'asc'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date),
    );
    const start = (page - 1) * pageSize;
    return {
      data: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  }

  createJournal(dto: CreateJournalDto): JournalEntry {
    return this.store.createJournal(dto);
  }

  // --- Trial balance ---
  trialBalance(): Array<{ account: Account; debit: number; credit: number }> {
    return this.store.accounts
      .map((a) => {
        let debit = 0;
        let credit = 0;
        for (const j of this.store.journals) {
          if (j.status !== 'POSTED') continue;
          for (const line of j.lines) {
            if (line.accountId !== a.id) continue;
            debit += line.debit;
            credit += line.credit;
          }
        }
        return { account: a, debit, credit };
      })
      .filter((r) => r.debit || r.credit);
  }
}
