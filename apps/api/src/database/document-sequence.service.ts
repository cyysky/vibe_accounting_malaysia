import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Atomic document number generator.
 *
 * Uses a Postgres advisory transaction lock keyed on a stable hash of
 * (bookId, prefix) plus an atomic increment on a counter row, so
 * concurrent allocations within a transaction cannot collide. The lock
 * is released automatically when the transaction commits.
 *
 * On first use of a (bookId, prefix) the counter row is seeded with
 * one above the highest existing number for that prefix across the
 * known document tables. This keeps us safe when migrating from the
 * old count()+1 implementation or when the DB is pre-seeded.
 */
@Injectable()
export class DocumentSequenceService {
  /** Maps the document-number prefix to the source tables that hold
   *  such numbers. Each table contributes (PascalCase name, camelCase
   *  number column). The first match wins. */
  private static readonly PREFIX_SOURCES: Array<{
    prefix: string;
    sources: Array<{ table: string; column: string }>;
  }> = [
    {
      prefix: 'INV',
      sources: [
        { table: 'CustomerInvoice', column: 'number' },
        { table: 'SalesOrder', column: 'number' },
      ],
    },
    {
      prefix: 'SINV',
      sources: [
        { table: 'SupplierInvoice', column: 'number' },
        { table: 'PurchaseOrder', column: 'number' },
      ],
    },
    {
      prefix: 'PO',
      sources: [
        { table: 'PurchaseOrder', column: 'number' },
        { table: 'SupplierInvoice', column: 'number' },
      ],
    },
    {
      prefix: 'SO',
      sources: [
        { table: 'SalesOrder', column: 'number' },
        { table: 'CustomerInvoice', column: 'number' },
      ],
    },
    { prefix: 'CN', sources: [{ table: 'CreditNote', column: 'number' }] },
    { prefix: 'DN', sources: [{ table: 'DebitNote', column: 'number' }] },
    { prefix: 'JV', sources: [{ table: 'JournalEntry', column: 'number' }] },
    { prefix: 'RCP', sources: [{ table: 'CustomerPayment', column: 'number' }] },
    { prefix: 'PAY', sources: [{ table: 'SupplierPayment', column: 'number' }] },
    { prefix: 'REC', sources: [{ table: 'RecurringInvoice', column: 'number' }] },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Allocate the next number for a (bookId, prefix) pair.
   * Returns a zero-padded 5-digit string like INV-00001, JV-00001, etc.
   * `pad` is 5 by default; pass 4 for JV/PO styles.
   */
  async next(bookId: string, prefix: string, pad = 5): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = this.hashKey(bookId, prefix);
      // Single-arg pg_advisory_xact_lock takes a bigint; we pass a
      // decimal string and cast in SQL so Prisma can serialize it
      // without precision loss.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

      const existing = await tx.documentSequence.findUnique({
        where: { accountBookId_prefix: { accountBookId: bookId, prefix } },
        select: { nextValue: true },
      });
      if (existing) {
        const updated = await tx.documentSequence.update({
          where: { accountBookId_prefix: { accountBookId: bookId, prefix } },
          data: { nextValue: { increment: 1 } },
          select: { nextValue: true },
        });
        return `${prefix}-${String(updated.nextValue).padStart(pad, '0')}`;
      }

      // First use of this prefix in this book: seed the counter from
      // the highest existing number across the known tables.
      const seed = await this.seedValue(tx, bookId, prefix);
      await tx.documentSequence.create({
        data: { accountBookId: bookId, prefix, nextValue: seed },
      });
      return `${prefix}-${String(seed).padStart(pad, '0')}`;
    });
  }

  private async seedValue(
    tx: Prisma.TransactionClient,
    bookId: string,
    prefix: string,
  ): Promise<number> {
    const sources =
      DocumentSequenceService.PREFIX_SOURCES.find((p) => p.prefix === prefix)
        ?.sources ?? [];
    let max = 0;
    for (const { table, column } of sources) {
      // PascalCase identifiers must be double-quoted in Postgres.
      const rows = await tx.$queryRawUnsafe<Array<{ n: number | null }>>(
        `SELECT MAX(
           CASE
             WHEN "${column}" ~ '^${prefix}-[0-9]+$'
             THEN CAST(SUBSTRING("${column}" FROM '${prefix}-([0-9]+)$') AS INTEGER)
             ELSE NULL
           END
         ) AS n
         FROM "${table}" WHERE "accountBookId" = $1`,
        bookId,
      );
      const n = rows[0]?.n ?? 0;
      if (n && n > max) max = n;
    }
    return max + 1;
  }

  private hashKey(bookId: string, prefix: string): string {
    // FNV-1a 32-bit, exposed as an unsigned decimal string. The
    // advisory lock just needs a number unique per (bookId, prefix).
    let h = 2166136261;
    const s = bookId + '|' + prefix;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString();
  }
}
