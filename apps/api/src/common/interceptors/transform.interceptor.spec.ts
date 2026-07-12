import { Prisma } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor, serializeApiValue } from './transform.interceptor';

describe('serializeApiValue', () => {
  it('converts Prisma decimals throughout nested API payloads', () => {
    const date = new Date('2026-07-12T00:00:00Z');
    const result = serializeApiValue({
      total: new Prisma.Decimal('123.45'),
      date,
      lines: [{ debit: new Prisma.Decimal('10'), credit: new Prisma.Decimal('0') }],
    });

    expect(result).toEqual({ total: 123.45, date, lines: [{ debit: 10, credit: 0 }] });
  });

  it('handles repeated references without corrupting sibling values', () => {
    const shared = { amount: new Prisma.Decimal('7.5') };
    expect(serializeApiValue({ first: shared, second: shared })).toEqual({
      first: { amount: 7.5 },
      second: { amount: 7.5 },
    });
  });

  it('breaks true circular references safely', () => {
    const value: Record<string, unknown> = { amount: new Prisma.Decimal('1') };
    value.self = value;
    expect(serializeApiValue(value)).toEqual({ amount: 1, self: null });
  });
});

describe('TransformInterceptor', () => {
  it('wraps normalized values in the API envelope', async () => {
    const interceptor = new TransformInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept({} as never, { handle: () => of({ total: new Prisma.Decimal('9.9') }) }),
    );
    expect(result).toEqual({ data: { total: 9.9 } });
  });
});
