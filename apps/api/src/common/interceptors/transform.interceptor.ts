import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Prisma } from '@prisma/client';

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function serializeApiValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value == null || typeof value !== 'object' || value instanceof Date) return value;
  if (seen.has(value)) return null;

  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => serializeApiValue(item, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = serializeApiValue(item, seen);
  }
  seen.delete(value);
  return result;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(_: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(map((data) => ({ data: serializeApiValue(data) as T })));
  }
}
