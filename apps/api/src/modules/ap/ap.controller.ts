import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApService } from './ap.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { CreateSupplierInvoiceDto, UpdateSupplierInvoiceDto } from './dto/supplier-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('ap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ap')
export class ApController {
  constructor(private readonly svc: ApService) {}

  @Get('suppliers')
  suppliers(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listSuppliers(user.accountBookId);
  }

  @Get('suppliers/:id')
  supplier(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getSupplier(id);
  }

  @Post('suppliers')
  createSupplier(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createSupplier(user.accountBookId, dto);
  }

  @Put('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto): Promise<Record<string, unknown>> {
    return this.svc.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@Param('id') id: string): Promise<void> {
    return this.svc.deleteSupplier(id);
  }

  @Get('invoices')
  invoices(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listInvoices(user.accountBookId, Number(page ?? 1), Number(pageSize ?? 50), supplierId, status);
  }

  @Get('invoices/:id')
  invoice(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getInvoice(id);
  }

  @Post('invoices')
  createInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierInvoiceDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createInvoice(user.accountBookId, dto);
  }

  @Put('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() dto: UpdateSupplierInvoiceDto): Promise<Record<string, unknown>> {
    return this.svc.updateInvoice(id, dto);
  }

  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string): Promise<void> {
    return this.svc.deleteInvoice(id);
  }
}
