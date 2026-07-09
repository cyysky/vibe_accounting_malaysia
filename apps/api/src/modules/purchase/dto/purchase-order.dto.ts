import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseOrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePurchaseOrderDto {
  @ApiProperty() @IsString() supplierId!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty({ default: 0 }) @IsNumber() total!: number;
  @ApiPropertyOptional({ enum: PurchaseOrderStatus }) @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() total?: number;
  @ApiPropertyOptional({ enum: PurchaseOrderStatus }) @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
