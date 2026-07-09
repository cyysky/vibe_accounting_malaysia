import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JournalStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateJournalLineDto {
  @ApiProperty() @IsString() accountId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty({ default: 0 }) @IsNumber() debit!: number;
  @ApiProperty({ default: 0 }) @IsNumber() credit!: number;
}

export class CreateJournalDto {
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional({ enum: JournalStatus }) @IsOptional() @IsEnum(JournalStatus) status?: JournalStatus;
  @ApiProperty({ type: [CreateJournalLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
