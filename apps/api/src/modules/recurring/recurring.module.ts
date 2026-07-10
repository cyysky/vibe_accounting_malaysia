import { Module } from "@nestjs/common";
import { ArModule } from "../ar/ar.module";
import { RecurringController } from "./recurring.controller";
import { RecurringService } from "./recurring.service";

@Module({
  imports: [ArModule],
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
