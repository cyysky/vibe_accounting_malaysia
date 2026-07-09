import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@account/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const payload: ApiError =
      exception instanceof HttpException
        ? { statusCode: status, message: this.extractMessage(exception), error: exception.name }
        : { statusCode: 500, message: 'Internal server error' };

    if (status >= 500) this.logger.error(`${req.method} ${req.url}`, exception as Error);
    res.status(status).json(payload);
  }

  private extractMessage(exception: HttpException): string {
    const r = exception.getResponse();
    if (typeof r === 'string') return r;
    if (typeof r === 'object' && r && 'message' in r) {
      const m = (r as { message: unknown }).message;
      return Array.isArray(m) ? m.join('; ') : String(m);
    }
    return exception.message;
  }
}
