import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateFiscalYearDto {
  @ApiProperty({ example: 2026 }) @IsInt() @Min(1900) year!: number;
  @ApiProperty({ example: '2026-01-01' }) @IsDateString() startDate!: string;
  @ApiProperty({ example: '2026-12-31' }) @IsDateString() endDate!: string;
}

export class UpdateFiscalYearDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() closed?: boolean;
}
