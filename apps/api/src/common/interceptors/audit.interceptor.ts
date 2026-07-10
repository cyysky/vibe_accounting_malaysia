import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Logs every successful state-changing API call to the audit log so
 * downstream consumers (compliance, security review) have a complete
 * trail. GET requests and login attempts are intentionally not logged
 * (login attempts land in a separate auth-event log).
 *
 * The interceptor runs after the controller has produced a response,
 * so any business errors have already been thrown by the time we
 * decide to record. We only log 2xx responses.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!WRITE_METHODS.has(req.method)) {
      return next.handle();
    }

    // Skip auth-related writes (login, refresh, user CRUD already done
    // explicitly via AuditLogService.record in those flows).
    const path = req.path || req.url || '';
    if (path.includes('/auth/login') || path.includes('/auth/refresh')) {
      return next.handle();
    }

    const accountBookId = (req as Request & { user?: { accountBookId?: string; id?: string } }).user?.accountBookId;
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    if (!accountBookId) {
      // Unauthenticated write attempt; the JwtAuthGuard should have
      // already rejected it, but defensively skip.
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (body) => {
          if (!body || typeof body !== 'object') return;
          const wrapped = body as { data?: { id?: string } };
          const entityId = wrapped.data?.id ?? 'unknown';
          const action = this.methodToAction(req.method);
          void this.audit.record({
            accountBookId,
            userId,
            entity: this.pathToEntity(path),
            entityId,
            action,
            message: `${req.method} ${path}`,
          });
        },
        error: (err) => {
          this.logger.debug(`Audit skipped for failed ${req.method} ${path}: ${err?.message ?? err}`);
        },
      }),
    );
  }

  private methodToAction(method: string): 'CREATE' | 'UPDATE' | 'DELETE' {
    if (method === 'POST') return 'CREATE';
    if (method === 'DELETE') return 'DELETE';
    return 'UPDATE';
  }

  private pathToEntity(path: string): string {
    // /api/ar/invoices/:id => ar-invoice
    const m = path.match(/\/api\/([^?\/]+)(?:\/([^?\/]+))?/);
    if (!m) return path;
    const module = m[1];
    const resource = m[2];
    if (!resource) return module;
    if (/^\[?[\w-]+\]?$/.test(resource) || resource.length > 16) {
      // Looks like an id segment
      return `${module}-${this.guessSingular(module)}`;
    }
    return `${module}-${resource.replace(/s$/, '')}`;
  }

  private guessSingular(module: string): string {
    const map: Record<string, string> = {
      ar: 'invoice',
      ap: 'invoice',
      gl: 'account',
      stock: 'item',
      'einvoice-configs': 'config',
      einvoice: 'submission',
      'credit-notes': 'credit-note',
      'debit-notes': 'debit-note',
      'bank-accounts': 'bank-account',
      'account-books': 'account-book',
      'fiscal-years': 'fiscal-year',
      'tax-codes': 'tax-code',
      payments: 'payment',
      sales: 'sales-order',
      purchase: 'purchase-order',
      recurring: 'recurring',
      users: 'user',
    };
    return map[module] ?? module;
  }
}
