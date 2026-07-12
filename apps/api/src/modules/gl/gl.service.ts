import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Account, type AccountType, type JournalStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { DocumentSequenceService } from "../../database/document-sequence.service";
import { CreateAccountDto } from "./dto/account.dto";
import { UpdateAccountDto } from "./dto/account.dto";
import { CreateJournalDto } from "./dto/journal.dto";
import { CreateTaxCodeDto } from "./dto/tax-code.dto";
import { UpdateTaxCodeDto } from "./dto/tax-code.dto";

@Injectable()
export class GlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seq: DocumentSequenceService,
  ) {}

  // --- Chart of accounts ----------------------------------------------------
  listAccounts(bookId: string, includeInactive = false): Promise<Array<Record<string, unknown>>> {
    return this.prisma.account.findMany({
      where: { accountBookId: bookId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { code: "asc" },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async getAccount(id: string): Promise<Account> {
    const a = await this.prisma.account.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Account ${id} not found`);
    return a;
  }

  async createAccount(bookId: string, dto: CreateAccountDto): Promise<Record<string, unknown>> {
    return (await this.prisma.account.create({
      data: {
        accountBookId: bookId,
        code: dto.code,
        name: dto.name,
        type: dto.type as AccountType,
        parentId: dto.parentId ?? null,
        currency: dto.currency ?? "MYR",
        taxCodeId: dto.taxCodeId ?? null,
        active: dto.active ?? true,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<Record<string, unknown>> {
    await this.ensureAccount(id);
    const data: Record<string, unknown> = { ...dto };
    return (await this.prisma.account.update({ where: { id }, data })) as unknown as Record<string, unknown>;
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
  /**
   * Returns the most recent journal entries first (createdAt desc with
   * date desc as a tie-breaker). This matches user expectations and
   * keeps recent activity on the first page.
   */
  async listJournals(
    bookId: string,
    page = 1,
    pageSize = 50,
  ): Promise<{
    data: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(200, Math.max(1, pageSize));
    const skip = (safePage - 1) * safeSize;
    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: { accountBookId: bookId },
        include: { lines: { include: { account: true } } },
        orderBy: [{ createdAt: "desc" }, { date: "desc" }, { number: "desc" }],
        skip,
        take: safeSize,
      }),
      this.prisma.journalEntry.count({ where: { accountBookId: bookId } }),
    ]);
    return { data: data as unknown as Array<Record<string, unknown>>, total, page: safePage, pageSize: safeSize };
  }

  async createJournal(bookId: string, dto: CreateJournalDto): Promise<Record<string, unknown>> {
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(`Journal does not balance: debit ${totalDebit} vs credit ${totalCredit}`);
    }
    if (dto.lines.length < 2) {
      throw new BadRequestException('Journal needs at least 2 lines');
    }
    // Resolve the fiscal year for the entry date and ensure it isn't closed.
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { accountBookId: bookId, startDate: { lte: new Date(dto.date) }, endDate: { gte: new Date(dto.date) } },
    });
    if (!fy) {
      throw new BadRequestException(`No fiscal year configured for date ${dto.date}`);
    }
    if (fy.closed) {
      throw new BadRequestException(`Fiscal year ${fy.year} is closed`);
    }
    const number = await this.seq.next(bookId, "JV", 4);
    return (await this.prisma.journalEntry.create({
      data: {
        accountBookId: bookId,
        number,
        fiscalYearId: fy.id,
        date: new Date(dto.date),
        description: dto.description,
        reference: dto.reference ?? null,
        status: (dto.status as JournalStatus) ?? "POSTED",
        totalDebit: new Prisma.Decimal(totalDebit),
        totalCredit: new Prisma.Decimal(totalCredit),
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description ?? null,
            debit: new Prisma.Decimal(l.debit ?? 0),
            credit: new Prisma.Decimal(l.credit ?? 0),
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    })) as unknown as Record<string, unknown>;
  }

  async getJournal(id: string): Promise<Record<string, unknown>> {
    const j = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } } },
    });
    if (!j) throw new NotFoundException(`Journal ${id} not found`);
    return j as unknown as Record<string, unknown>;
  }

  /**
   * Reverse a posted journal by flipping every line's debit & credit and
   * setting the journal's status to REVERSED.  The reversal entry keeps
   * the same fiscal year and date so the trial balance still balances.
   */
  async reverseJournal(bookId: string, id: string, reason?: string) {
    const j = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!j || j.accountBookId !== bookId) {
      throw new NotFoundException(`Journal ${id} not found in this account book`);
    }
    if (j.status === 'REVERSED') {
      throw new BadRequestException(`Journal ${id} is already reversed`);
    }
    if (j.status !== 'POSTED') {
      throw new BadRequestException(`Only POSTED journals can be reversed (status = ${j.status})`);
    }
    return this.prisma.$transaction(async (tx) => {
      const seq = await this.seq.next(bookId, 'JV');
      const reversed = await tx.journalEntry.create({
        data: {
          accountBookId: bookId,
          number: seq,
          date: j.date,
          description: 'REVERSAL of ' + j.number + (reason ? ' - ' + reason : ''),
          reference: j.reference ?? undefined,
          status: 'POSTED',
          totalDebit: j.totalCredit ?? 0,
          totalCredit: j.totalDebit ?? 0,
          lines: {
            create: j.lines.map((l) => ({
              accountId: l.accountId,
              description: l.description ?? undefined,
              debit: new Prisma.Decimal(l.credit),   // flip
              credit: new Prisma.Decimal(l.debit),    // flip
              lineNo: (l as any).lineNo ?? 0,
            })),
          },
        },
        include: { lines: true },
      });
      await tx.journalEntry.update({
        where: { id: j.id },
        data: { status: 'REVERSED' },
      });
      return reversed;
    });
  }

  // --- Tax codes -----------------------------------------------------------
  listTaxCodes(bookId: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.taxCode.findMany({
      where: { accountBookId: bookId },
      orderBy: { code: "asc" },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async getTaxCode(id: string): Promise<Record<string, unknown>> {
    const tc = await this.prisma.taxCode.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException(`Tax code ${id} not found`);
    return tc as unknown as Record<string, unknown>;
  }

  async createTaxCode(bookId: string, dto: CreateTaxCodeDto): Promise<Record<string, unknown>> {
    const existing = await this.prisma.taxCode.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException(`Tax code ${dto.code} already exists in this account book`);
    }
    return (await this.prisma.taxCode.create({
      data: {
        accountBookId: bookId,
        code: dto.code,
        name: dto.name,
        rate: new Prisma.Decimal(dto.rate),
        taxTypeCode: dto.taxTypeCode ?? "01",
        description: dto.description ?? null,
        active: dto.active ?? true,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateTaxCode(id: string, dto: UpdateTaxCodeDto): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = { ...dto };
    if (dto.rate !== undefined) data.rate = new Prisma.Decimal(dto.rate);
    return (await this.prisma.taxCode.update({ where: { id }, data })) as unknown as Record<string, unknown>;
  }

  async deleteTaxCode(id: string): Promise<void> {
    await this.prisma.taxCode.delete({ where: { id } });
  }

  // --- Fiscal years --------------------------------------------------------
  listFiscalYears(bookId: string) {
    return this.prisma.fiscalYear.findMany({
      where: { accountBookId: bookId },
      orderBy: { year: "desc" },
    });
  }
  async getFiscalYear(id: string) {
    const fy = await this.prisma.fiscalYear.findUnique({ where: { id } });
    if (!fy) throw new NotFoundException(`Fiscal year ${id} not found`);
    return fy;
  }

  async createFiscalYear(
    bookId: string,
    dto: { year: number; startDate: string; endDate: string },
  ): Promise<Record<string, unknown>> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (!(end.getTime() > start.getTime())) {
      throw new BadRequestException(`endDate ${dto.endDate} must be after startDate ${dto.startDate}`);
    }
    return (await this.prisma.fiscalYear.create({
      data: {
        accountBookId: bookId,
        year: dto.year,
        startDate: start,
        endDate: end,
        closed: false,
      },
    })) as unknown as Record<string, unknown>;
  }
  async updateFiscalYear(
    id: string,
    dto: { year?: number; startDate?: string; endDate?: string; closed?: boolean },
  ): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return (await this.prisma.fiscalYear.update({ where: { id }, data })) as unknown as Record<string, unknown>;
  }
  async closeFiscalYear(id: string): Promise<Record<string, unknown>> {
    return (await this.prisma.fiscalYear.update({
      where: { id },
      data: { closed: true },
    })) as unknown as Record<string, unknown>;
  }
  async reopenFiscalYear(id: string): Promise<Record<string, unknown>> {
    return (await this.prisma.fiscalYear.update({
      where: { id },
      data: { closed: false },
    })) as unknown as Record<string, unknown>;
  }
  async deleteFiscalYear(id: string): Promise<void> {
    await this.prisma.fiscalYear.delete({ where: { id } });
  }

  // --- Trial balance / GL rollup ------------------------------------------
  /**
   * Returns the running GL balance per account, ordered by account code.
   * Used by the Balance Sheet, P&L and General Ledger reports.
   */
  async trialBalance(
    bookId: string,
    asOf?: Date,
  ): Promise<Array<{ account: Account; debit: number; credit: number; balance: number }>> {
    const where: Prisma.JournalLineWhereInput = {
      journal: {
        accountBookId: bookId,
        status: "POSTED" as JournalStatus,
        ...(asOf ? { date: { lte: asOf } } : {}),
      },
    };
    const grouped = await this.prisma.journalLine.groupBy({
      by: ["accountId"],
      where,
      _sum: { debit: true, credit: true },
    });
    const accounts = await this.prisma.account.findMany({ where: { accountBookId: bookId } });
    const byId = new Map<string, Account>(accounts.map((a) => [a.id, a] as const));
    const rows: Array<{ account: Account; debit: number; credit: number; balance: number }> = [];
    for (const g of grouped) {
      const account = byId.get(g.accountId);
      if (!account) continue;
      const debit = Number(g._sum.debit ?? 0);
      const credit = Number(g._sum.credit ?? 0);
      const balance = this.normalBalanceSide(account.type) === "debit" ? debit - credit : credit - debit;
      rows.push({ account, debit, credit, balance });
    }
    return rows.sort((a, b) => a.account.code.localeCompare(b.account.code));
  }

  /** Alias for the trialBalance, used by older callers. */
  accountBalances(
    bookId: string,
    asOf?: Date,
  ): Promise<Array<{ account: Account; debit: number; credit: number; balance: number }>> {
    return this.trialBalance(bookId, asOf);
  }

  private normalBalanceSide(type: AccountType): "debit" | "credit" {
    return type === "ASSET" || type === "EXPENSE" ? "debit" : "credit";
  }
}
