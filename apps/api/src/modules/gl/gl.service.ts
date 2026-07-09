import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { CreateJournalDto } from './dto/journal.dto';
import { CreateTaxCodeDto, UpdateTaxCodeDto } from './dto/tax-code.dto';
import { CreateFiscalYearDto, UpdateFiscalYearDto } from './dto/fiscal-year.dto';

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
    // Determine fiscal year for the journal date
    const journalDate = new Date(dto.date);
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        accountBookId: bookId,
        startDate: { lte: journalDate },
        endDate: { gte: journalDate },
      },
    });
    if (!fiscalYear) {
      throw new BadRequestException(
        `No fiscal year configured for date ${dto.date}. Create one via POST /gl/fiscal-years.`,
      );
    }
    if (fiscalYear.closed) {
      throw new BadRequestException(`Fiscal year ${fiscalYear.year} is closed`);
    }
    // Number auto-generated: JV-####
    const count = await this.prisma.journalEntry.count({ where: { accountBookId: bookId } });
    const number = `JV-${String(count + 1).padStart(4, '0')}`;
    const created = await this.prisma.journalEntry.create({
      data: {
        accountBookId: bookId,
        number,
        fiscalYearId: fiscalYear.id,
        date: journalDate,
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

  // --- Tax codes -----------------------------------------------------------
  listTaxCodes(bookId: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.taxCode.findMany({
      where: { accountBookId: bookId },
      orderBy: { code: 'asc' },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async createTaxCode(bookId: string, dto: CreateTaxCodeDto): Promise<Record<string, unknown>> {
    const dup = await this.prisma.taxCode.findUnique({
      where: { accountBookId_code: { accountBookId: bookId, code: dto.code } },
    });
    if (dup) throw new BadRequestException(`Tax code ${dto.code} already exists`);
    return (await this.prisma.taxCode.create({
      data: {
        accountBookId: bookId,
        code: dto.code,
        name: dto.name,
        rate: new Prisma.Decimal(dto.rate),
        description: dto.description,
        active: dto.active ?? true,
      },
    })) as unknown as Record<string, unknown>;
  }

  async updateTaxCode(id: string, dto: UpdateTaxCodeDto): Promise<Record<string, unknown>> {
    const tc = await this.prisma.taxCode.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException(`Tax code ${id} not found`);
    const data: Record<string, unknown> = { ...dto };
    if (dto.rate !== undefined) data.rate = new Prisma.Decimal(dto.rate);
    return (await this.prisma.taxCode.update({ where: { id }, data })) as unknown as Record<string, unknown>;
  }

  async deleteTaxCode(id: string): Promise<void> {
    const tc = await this.prisma.taxCode.findUnique({ where: { id }, include: { customerInvoiceLines: true, supplierInvoiceLines: true } });
    if (!tc) throw new NotFoundException(`Tax code ${id} not found`);
    if (tc.customerInvoiceLines.length || tc.supplierInvoiceLines.length) {
      throw new BadRequestException('Tax code is in use by invoice lines');
    }
    await this.prisma.taxCode.delete({ where: { id } });
  }

  // --- Fiscal years --------------------------------------------------------
  listFiscalYears(bookId: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.fiscalYear.findMany({
      where: { accountBookId: bookId },
      orderBy: { year: 'desc' },
    }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async createFiscalYear(bookId: string, dto: CreateFiscalYearDto): Promise<Record<string, unknown>> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }
    const dup = await this.prisma.fiscalYear.findUnique({
      where: { accountBookId_year: { accountBookId: bookId, year: dto.year } },
    });
    if (dup) throw new BadRequestException(`Fiscal year ${dto.year} already exists`);
    return (await this.prisma.fiscalYear.create({
      data: { accountBookId: bookId, year: dto.year, startDate: start, endDate: end },
    })) as unknown as Record<string, unknown>;
  }

  async updateFiscalYear(id: string, dto: UpdateFiscalYearDto): Promise<Record<string, unknown>> {
    const fy = await this.prisma.fiscalYear.findUnique({ where: { id } });
    if (!fy) throw new NotFoundException(`Fiscal year ${id} not found`);
    if (fy.closed && dto.closed === false) {
      // Allow re-opening only if no journals after current end date
    }
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return (await this.prisma.fiscalYear.update({ where: { id }, data })) as unknown as Record<string, unknown>;
  }

  async deleteFiscalYear(id: string): Promise<void> {
    const fy = await this.prisma.fiscalYear.findUnique({ where: { id }, include: { journals: true } });
    if (!fy) throw new NotFoundException(`Fiscal year ${id} not found`);
    if (fy.journals.length) {
      throw new BadRequestException('Cannot delete fiscal year with journals');
    }
    await this.prisma.fiscalYear.delete({ where: { id } });
  }
}
