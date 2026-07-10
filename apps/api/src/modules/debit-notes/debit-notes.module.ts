import { Module } from "@nestjs/common";
import { GlModule } from "../gl/gl.module";
import { DebitNotesController } from "./debit-notes.controller";
import { DebitNotesService } from "./debit-notes.service";

@Module({
  imports: [GlModule],
  controllers: [DebitNotesController],
  providers: [DebitNotesService],
  exports: [DebitNotesService],
})
export class DebitNotesModule {}
