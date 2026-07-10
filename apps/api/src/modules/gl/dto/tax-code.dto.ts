import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

/**
 * MyInvois tax type codes (UBL 2.1, see sdk.myinvois.hasil.gov.my/codes/tax-types/).
 *   01 = Sales Tax
 *   02 = Service Tax
 *   03 = Tourism Tax
 *   04 = High-Value Goods Tax
 *   05 = Sales Tax on Low Value Goods
 *   06 = Not Applicable / exempt
 *   E  = Exempt (legacy)
 */
const TAX_TYPE_CODES = ['01', '02', '03', '04', '05', '06', 'E'] as const;

export class CreateTaxCodeDto {
  @ApiProperty({ example: 'SVAT-12' }) @IsString() code!: string;
  @ApiProperty({ example: 'Sales Tax 12%' }) @IsString() name!: string;
  @ApiProperty({ example: 0.12 }) @IsNumber() rate!: number;
  @ApiPropertyOptional({
    description: 'MyInvois tax type code. Defaults to 01 (Sales Tax).',
    enum: TAX_TYPE_CODES,
  })
  @IsOptional()
  @IsIn(TAX_TYPE_CODES as unknown as string[])
  taxTypeCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateTaxCodeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rate?: number;
  @ApiPropertyOptional({ enum: TAX_TYPE_CODES })
  @IsOptional()
  @IsIn(TAX_TYPE_CODES as unknown as string[])
  taxTypeCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
