import { Module } from "@nestjs/common";
import { GlController } from "./gl.controller";
import { GlService } from "./gl.service";
import { PostingService } from "./posting.service";
import { PaymentPostingService } from "./posting-payments";

@Module({
  controllers: [GlController],
  providers: [GlService, PostingService, PaymentPostingService],
  exports: [GlService, PostingService, PaymentPostingService],
})
export class GlModule {}
