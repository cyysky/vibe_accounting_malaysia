import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CreditNoteStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class CreateCreditNoteLineDto {
  @ApiPropertyOptional() @IsOptional() @IsString() itemId?: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiProperty() @IsNumber() unitPrice!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() discount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;
}

export class CreateCreditNoteDto {
  @ApiProperty() @IsString() customerId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() invoiceId?: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty() @IsString() reason!: string;
  @ApiPropertyOptional({ default: "MYR" }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: CreditNoteStatus }) @IsOptional() @IsEnum(CreditNoteStatus) status?: CreditNoteStatus;
  @ApiProperty({ type: [CreateCreditNoteLineDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => CreateCreditNoteLineDto)
  lines!: CreateCreditNoteLineDto[];
}

export class UpdateCreditNoteDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: CreditNoteStatus }) @IsOptional() @IsEnum(CreditNoteStatus) status?: CreditNoteStatus;
}
