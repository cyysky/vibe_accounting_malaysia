import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EinvoiceEnvironment } from '@prisma/client';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEinvoiceConfigDto {
  @ApiProperty({ enum: EinvoiceEnvironment, default: EinvoiceEnvironment.SANDBOX })
  @IsEnum(EinvoiceEnvironment) environment!: EinvoiceEnvironment;
  @ApiProperty() @IsString() clientId!: string;
  @ApiProperty() @IsString() clientSecret!: string;
  @ApiProperty() @IsString() taxpayerTin!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxpayerBrn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxpayerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() certPath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() certPassphrase?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateEinvoiceConfigDto {
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientSecret?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxpayerTin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxpayerBrn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxpayerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() certPath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() certPassphrase?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class SubmitInvoiceDto {
  @ApiPropertyOptional({ default: '1.1' }) @IsOptional() @IsString() version?: string;
  @ApiPropertyOptional({ default: 'JSON' }) @IsOptional() @IsString() format?: string;
  @ApiPropertyOptional({ default: false, description: 'If true, only validate the UBL document and do not submit to MyInvois.' }) @IsOptional() @Type(() => Boolean) @IsBoolean() validateOnly?: boolean;
  @ApiPropertyOptional({ description: 'Delivery date (MyInvois InvoicePeriod StartDate).' }) @IsOptional() @Type(() => Date) @IsDate() deliveryDate?: Date;
  @ApiPropertyOptional({ description: 'MyInvois payment means code 01-10 (see PAYMENT_MODE_CODES).' }) @IsOptional() @IsString() paymentMeansCode?: string;
  @ApiPropertyOptional({ description: 'Supplier bank account number for PayeeFinancialAccount.' }) @IsOptional() @IsString() paymentAccountNo?: string;
  @ApiPropertyOptional({ description: 'FTT / withholding tax references to attach as AdditionalDocumentReference.', type: [Object] }) @IsOptional() additionalReferences?: Array<{ id: string; documentType?: string; documentDescription?: string }>;
}

export class CancelDocumentDto {
  @ApiProperty({ example: 'Customer requested cancellation' }) @IsString() reason!: string;
}

export class RejectDocumentDto {
  @ApiProperty({ example: 'Order cancelled by buyer' }) @IsString() reason!: string;
}

export class ValidateTinDto {
  @ApiProperty({ example: 'C20830570210' }) @IsString() tin!: string;
  @ApiProperty({ example: 'BRN', description: 'NRIC, BRN, PASSPORT, etc.' }) @IsString() idType!: string;
  @ApiProperty({ example: '202005123456' }) @IsString() idValue!: string;
}
