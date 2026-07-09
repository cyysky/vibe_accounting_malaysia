import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: '1010' }) @IsString() code!: string;
  @ApiProperty({ example: 'Petty Cash' }) @IsString() name!: string;
  @ApiProperty({ enum: AccountType }) @IsEnum(AccountType) type!: AccountType;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional({ default: 'MYR' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: AccountType }) @IsOptional() @IsEnum(AccountType) type?: AccountType;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
