import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAccountBookDto {
  @ApiProperty({ example: 'MAIN' }) @IsString() code!: string;
  @ApiProperty({ example: 'Main Operations Sdn Bhd' }) @IsString() name!: string;
  @ApiPropertyOptional({ default: 'MYR' }) @IsOptional() @IsString() baseCurrency?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() fiscalYearStartMonth?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() tin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industryCode?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAccountBookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() baseCurrency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() fiscalYearStartMonth?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() tin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
