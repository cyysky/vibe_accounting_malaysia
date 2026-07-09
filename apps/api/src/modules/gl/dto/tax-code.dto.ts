import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTaxCodeDto {
  @ApiProperty({ example: 'SVAT-12' }) @IsString() code!: string;
  @ApiProperty({ example: 'Sales Tax 12%' }) @IsString() name!: string;
  @ApiProperty({ example: 0.12 }) @IsNumber() rate!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateTaxCodeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
