import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RecurringFrequency } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class CreateRecurringLineDto {
  @ApiPropertyOptional() @IsOptional() @IsString() itemId?: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiProperty() @IsNumber() unitPrice!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;
}

export class CreateRecurringDto {
  @ApiProperty() @IsString() customerId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: RecurringFrequency }) @IsEnum(RecurringFrequency) frequency!: RecurringFrequency;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional({ default: "MYR" }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
  @ApiProperty({ type: [CreateRecurringLineDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => CreateRecurringLineDto)
  lines!: CreateRecurringLineDto[];
}

export class UpdateRecurringDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: RecurringFrequency }) @IsOptional() @IsEnum(RecurringFrequency) frequency?: RecurringFrequency;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional({ type: [CreateRecurringLineDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateRecurringLineDto)
  lines?: CreateRecurringLineDto[];
}
