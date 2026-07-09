import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAccountBookDto, UpdateAccountBookDto } from './dto/account-book.dto';

@Injectable()
export class AccountBooksService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Array<Record<string, unknown>>> {
    return this.prisma.accountBook.findMany({ orderBy: { code: 'asc' } }) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async get(id: string): Promise<Record<string, unknown>> {
    const b = await this.prisma.accountBook.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`Account book ${id} not found`);
    return b as unknown as Record<string, unknown>;
  }

  async create(dto: CreateAccountBookDto): Promise<Record<string, unknown>> {
    const dup = await this.prisma.accountBook.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`Account book code ${dto.code} already exists`);
    return (await this.prisma.accountBook.create({
      data: { ...dto, active: dto.active ?? true },
    })) as unknown as Record<string, unknown>;
  }

  async update(id: string, dto: UpdateAccountBookDto): Promise<Record<string, unknown>> {
    await this.ensure(id);
    return (await this.prisma.accountBook.update({ where: { id }, data: dto })) as unknown as Record<string, unknown>;
  }

  async remove(id: string): Promise<void> {
    await this.ensure(id);
    await this.prisma.accountBook.delete({ where: { id } });
  }

  private async ensure(id: string): Promise<void> {
    const b = await this.prisma.accountBook.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`Account book ${id} not found`);
  }
}
