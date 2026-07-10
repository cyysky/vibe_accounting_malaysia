import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateBankAccountDto, UpdateBankAccountDto } from "./dto/bank-account.dto";

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  list(bookId: string) {
    return this.prisma.bankAccount.findMany({
      where: { accountBookId: bookId },
      orderBy: { name: "asc" },
    });
  }

  async get(id: string) {
    const a = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Bank account ${id} not found`);
    return a;
  }

  async create(bookId: string, dto: CreateBankAccountDto) {
    const dup = await this.prisma.bankAccount.findUnique({
      where: { accountBookId_name: { accountBookId: bookId, name: dto.name } },
    });
    if (dup) throw new BadRequestException(`Bank account "${dto.name}" already exists`);
    if (dto.glAccountCode) {
      const gl = await this.prisma.account.findUnique({
        where: { accountBookId_code: { accountBookId: bookId, code: dto.glAccountCode } },
      });
      if (!gl) throw new BadRequestException(`GL account ${dto.glAccountCode} not found`);
    }
    return this.prisma.bankAccount.create({
      data: {
        accountBookId: bookId,
        name: dto.name,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        glAccountCode: dto.glAccountCode ?? "1100",
        currency: dto.currency ?? "MYR",
        openingBalance: new Prisma.Decimal(dto.openingBalance ?? 0),
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    await this.ensure(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.openingBalance !== undefined) data.openingBalance = new Prisma.Decimal(dto.openingBalance);
    return this.prisma.bankAccount.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.bankAccount.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const a = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Bank account ${id} not found`);
  }
}
