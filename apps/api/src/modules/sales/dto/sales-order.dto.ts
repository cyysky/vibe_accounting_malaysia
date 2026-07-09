import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalesOrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSalesOrderDto {
  @ApiProperty() @IsString() customerId!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty({ default: 0 }) @IsNumber() total!: number;
  @ApiPropertyOptional({ enum: SalesOrderStatus }) @IsOptional() @IsEnum(SalesOrderStatus) status?: SalesOrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateSalesOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() total?: number;
  @ApiPropertyOptional({ enum: SalesOrderStatus }) @IsOptional() @IsEnum(SalesOrderStatus) status?: SalesOrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
