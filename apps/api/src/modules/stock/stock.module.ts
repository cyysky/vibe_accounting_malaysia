import { Module } from "@nestjs/common";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";
import { StockMovementsService } from "./stock-movements.service";
import { StockMovementsController } from "./stock-movements.controller";

@Module({
  controllers: [StockController, StockMovementsController],
  providers: [StockService, StockMovementsService],
  exports: [StockService, StockMovementsService],
})
export class StockModule {}
