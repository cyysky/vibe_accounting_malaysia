import { Module } from '@nestjs/common';
import { GlController } from './gl.controller';
import { GlService } from './gl.service';
import { PostingService } from './posting.service';

@Module({
  controllers: [GlController],
  providers: [GlService, PostingService],
  exports: [GlService, PostingService],
})
export class GlModule {}
