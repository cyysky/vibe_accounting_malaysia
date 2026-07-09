import { Module } from '@nestjs/common';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';
import { GlModule } from '../gl/gl.module';

@Module({
  imports: [GlModule],
  controllers: [ArController],
  providers: [ArService],
  exports: [ArService],
})
export class ArModule {}
