import { Global, Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PrismaService, SeedService],
  exports: [PrismaService],
})
export class DatabaseModule {}
