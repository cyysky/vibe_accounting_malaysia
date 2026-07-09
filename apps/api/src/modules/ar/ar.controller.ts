import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArService } from './ar.service';
import type { Customer, CustomerInvoice, Paginated } from '@account/shared';

@ApiTags('ar')
@Controller('ar')
export class ArController {
  constructor(private readonly svc: ArService) {}

  @Get('customers')
  customers(): Customer[] {
    return this.svc.listCustomers();
  }

  @Get('customers/:id')
  customer(@Param('id') id: string): Customer {
    return this.svc.getCustomer(id);
  }

  @Get('invoices')
  invoices(): Paginated<CustomerInvoice> {
    return this.svc.listInvoices();
  }
}
