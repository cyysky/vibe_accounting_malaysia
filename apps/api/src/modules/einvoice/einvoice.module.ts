import { Module } from '@nestjs/common';
import { EinvoiceController } from './einvoice.controller';
import { EinvoiceService } from './einvoice.service';
import { EinvoiceSettingsService } from './einvoice.config';
import { MyInvoisClient } from './clients/myinvois.client';
import { JsonSigner } from './signers/json-signer';

@Module({
  controllers: [EinvoiceController],
  providers: [EinvoiceService, EinvoiceSettingsService, MyInvoisClient, JsonSigner],
  exports: [EinvoiceService],
})
export class EinvoiceModule {}
