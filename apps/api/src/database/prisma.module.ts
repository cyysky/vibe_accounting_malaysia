import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DocumentSequenceService } from './document-sequence.service';

@Global()
@Module({
  providers: [PrismaService, DocumentSequenceService],
  exports: [PrismaService, DocumentSequenceService],
})
export class PrismaModule {}
