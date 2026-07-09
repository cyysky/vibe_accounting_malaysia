import { Module } from '@nestjs/common';
import { ApController } from './ap.controller';
import { ApService } from './ap.service';
import { GlModule } from '../gl/gl.module';

@Module({
  imports: [GlModule],
  controllers: [ApController],
  providers: [ApService],
  exports: [ApService],
})
export class ApModule {}
