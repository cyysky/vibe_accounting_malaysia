import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApService } from './ap.service';
import type { Paginated, Supplier, SupplierInvoice } from '@account/shared';

@ApiTags('ap')
@Controller('ap')
export class ApController {
  constructor(private readonly svc: ApService) {}

  @Get('suppliers')
  suppliers(): Supplier[] {
    return this.svc.listSuppliers();
  }

  @Get('suppliers/:id')
  supplier(@Param('id') id: string): Supplier {
    return this.svc.getSupplier(id);
  }

  @Get('invoices')
  invoices(): Paginated<SupplierInvoice> {
    return this.svc.listInvoices();
  }
}
