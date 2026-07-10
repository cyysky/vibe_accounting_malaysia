import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { StockMovementType } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateStockMovementDto {
  @ApiProperty() @IsString() itemId!: string;
  @ApiProperty({ enum: StockMovementType }) @IsEnum(StockMovementType) type!: StockMovementType;
  @ApiProperty({ description: "Positive for RECEIVE/ADJUST, negative for ISSUE/TRANSFER" })
  @IsNumber()
  @Min(-1_000_000)
  quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() unitCost?: number;
  @ApiProperty() @IsDateString() date!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
