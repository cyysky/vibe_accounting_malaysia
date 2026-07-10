import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class PaymentApplicationDto {
  @ApiProperty() @IsString() invoiceId!: string;
  @ApiProperty() @IsNumber() @Min(0.01) amount!: number;
}

export class CreateCustomerPaymentDto {
  @ApiProperty() @IsString() customerId!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty() @IsNumber() @Min(0.01) amount!: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method!: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [PaymentApplicationDto] })
  @IsArray() @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => PaymentApplicationDto)
  applications!: PaymentApplicationDto[];
}

export class CreateSupplierPaymentDto {
  @ApiProperty() @IsString() supplierId!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty() @IsNumber() @Min(0.01) amount!: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method!: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [PaymentApplicationDto] })
  @IsArray() @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => PaymentApplicationDto)
  applications!: PaymentApplicationDto[];
}
