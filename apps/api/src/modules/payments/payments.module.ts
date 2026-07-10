import { Module } from "@nestjs/common";
import { GlModule } from "../gl/gl.module";
import { CustomerPaymentsController } from "./customer-payments.controller";
import { SupplierPaymentsController } from "./supplier-payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [GlModule],
  controllers: [CustomerPaymentsController, SupplierPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
