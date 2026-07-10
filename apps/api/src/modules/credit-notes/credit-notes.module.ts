import { Module } from "@nestjs/common";
import { GlModule } from "../gl/gl.module";
import { CreditNotesController } from "./credit-notes.controller";
import { CreditNotesService } from "./credit-notes.service";

@Module({
  imports: [GlModule],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
