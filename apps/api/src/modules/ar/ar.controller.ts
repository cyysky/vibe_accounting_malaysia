import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArService } from './ar.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { CreateCustomerInvoiceDto, UpdateCustomerInvoiceDto } from './dto/customer-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('ar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ar')
export class ArController {
  constructor(private readonly svc: ArService) {}

  @Get('customers')
  customers(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listCustomers(user.accountBookId);
  }

  @Get('customers/:id')
  customer(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getCustomer(id);
  }

  @Post('customers')
  createCustomer(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createCustomer(user.accountBookId, dto);
  }

  @Put('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto): Promise<Record<string, unknown>> {
    return this.svc.updateCustomer(id, dto);
  }

  @Delete('customers/:id')
  deleteCustomer(@Param('id') id: string): Promise<void> {
    return this.svc.deleteCustomer(id);
  }

  @Get('invoices')
  invoices(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listInvoices(user.accountBookId, Number(page ?? 1), Number(pageSize ?? 50), customerId, status);
  }

  @Get('invoices/:id')
  invoice(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getInvoice(id);
  }
  @Post('invoices')
  createInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerInvoiceDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createInvoice(user.accountBookId, dto);
  }

  @Put('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() dto: UpdateCustomerInvoiceDto): Promise<Record<string, unknown>> {
    return this.svc.updateInvoice(id, dto);
  }

  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string): Promise<void> {
    return this.svc.deleteInvoice(id);
  }

  @Post('sales-orders/:id/convert-to-invoice')
  convert(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.convertSalesOrder(user.accountBookId, id);
  }
}
