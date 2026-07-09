import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { CreateJournalDto } from './dto/journal.dto';

@Injectable()
export class GlService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Chart of accounts ---------------------------------------------------
  listAccounts(bookId?: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.account.findMany({
      where: bookId ? { accountBookId: bookId } : {},
      orderBy: { code: 'asc' },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async getAccount(id: string): Promise<Record<string, unknown>> {
    const a = await this.prisma.account.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Account ${id} not found`);
    return a as unknown as Record<string, unknown>;
  }

  async createAccount(bookId: string, dto: CreateAccountDto): Promise<Record<string, unknown>> {
    const existing = await this.prisma.account.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code: dto.code } },
    });
    if (existing) throw new BadRequestException(`Account code ${dto.code} already exists`);
    return (await this.prisma.account.create({
      data: {
        accountBookId: bookId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
        currency: dto.currency ?? 'MYR',
        taxCodeId: dto.taxCodeId,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<Record<string, unknown>> {
    await this.ensureAccount(id);
    return (await this.prisma.account.update({
      where: { id },
      data: dto,
    })) as unknown as Record<string, unknown>;
  }

  async deleteAccount(id: string): Promise<void> {
    await this.ensureAccount(id);
    await this.prisma.account.delete({ where: { id } });
  }

  private async ensureAccount(id: string): Promise<void> {
    const a = await this.prisma.account.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Account ${id} not found`);
  }

  // --- Journal entries -----------------------------------------------------
  async listJournals(bookId: string, page = 1, pageSize = 50): Promise<{
    data: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, pageSize));
    const take = Math.min(200, Math.max(1, pageSize));
    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: { accountBookId: bookId },
        include: { lines: { include: { account: true } } },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      this.prisma.journalEntry.count({ where: { accountBookId: bookId } }),
    ]);
    return { data: data as unknown as Array<Record<string, unknown>>, total, page, pageSize };
  }

  async createJournal(bookId: string, dto: CreateJournalDto): Promise<Record<string, unknown>> {
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(`Journal does not balance: debit ${totalDebit} vs credit ${totalCredit}`);
    }
    // Account IDs must belong to this book
    const accountIds = dto.lines.map((l) => l.accountId);
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, accountBookId: bookId },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more account ids do not belong to this account book');
    }
    // Number auto-generated: JV-####
    const count = await this.prisma.journalEntry.count({ where: { accountBookId: bookId } });
    const number = `JV-${String(count + 1).padStart(4, '0')}`;
    const created = await this.prisma.journalEntry.create({
      data: {
        accountBookId: bookId,
        number,
        date: new Date(dto.date),
        description: dto.description,
        reference: dto.reference,
        status: dto.status ?? 'POSTED',
        totalDebit,
        totalCredit,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
    return created as unknown as Record<string, unknown>;
  }

  // --- Trial balance -------------------------------------------------------
  async trialBalance(bookId: string): Promise<Array<{ account: Record<string, unknown>; debit: number; credit: number }>> {
    const accounts = await this.prisma.account.findMany({
      where: { accountBookId: bookId, active: true },
      orderBy: { code: 'asc' },
    });
    const journals = await this.prisma.journalEntry.findMany({
      where: { accountBookId: bookId, status: 'POSTED' },
      include: { lines: true },
    });
    const map = new Map<string, { debit: number; credit: number }>();
    for (const j of journals) {
      for (const line of j.lines) {
        const cur = map.get(line.accountId) ?? { debit: 0, credit: 0 };
        cur.debit += Number(line.debit);
        cur.credit += Number(line.credit);
        map.set(line.accountId, cur);
      }
    }
    return accounts
      .map((a) => ({ account: a as unknown as Record<string, unknown>, ...(map.get(a.id) ?? { debit: 0, credit: 0 }) }))
      .filter((r) => r.debit || r.credit);
  }
}
