import { Global, Module } from '@nestjs/common';
import { DataStore } from './data-store.service';

/**
 * In-memory data store seeded with sample data. Acts as a stand-in for the
 * eventual Prisma / SQL Server persistence layer. All business modules inject
 * `DataStore` directly so swapping it for a real ORM only requires touching
 * one file.
 */
@Global()
@Module({
  providers: [DataStore],
  exports: [DataStore],
})
export class DataStoreModule {}
