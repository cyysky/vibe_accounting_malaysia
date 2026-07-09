import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EinvoiceConfig, EinvoiceEndpoints } from '../einvoice.config';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * Thin MyInvois HTTP client.
 *
 * Responsibilities:
 *   - Acquire / cache OAuth2 client_credentials access tokens (60-min TTL per SDK).
 *   - Submit signed documents (single + batch).
 *   - Poll / search documents.
 *   - Cancel a document (status -> 4 = Cancelled).
 */
@Injectable()
export class MyInvoisClient {
  private readonly logger = new Logger(MyInvoisClient.name);
  private readonly cache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  private getTimeoutMs(): number {
    return Number(this.config.get<string>('EINVOICE_TIMEOUT_MS') ?? 30000);
  }

  /**
   * Fetch an OAuth2 access token (client_credentials grant). Cached per
   * environment for 60 minutes minus a 60-second safety window, matching
   * the SDK recommendation.
   */
  async getAccessToken(cfg: EinvoiceConfig): Promise<string> {
    const cached = this.cache.get(cfg.environment);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: 'InvoicingAPI',
    });

    const res = await this.request<TokenResponse>({
      method: 'POST',
      url: cfg.endpoints.base + cfg.endpoints.token,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const ttl = ((res as TokenResponse).expires_in ?? 3600) * 1000 - 60_000;
    this.cache.set(cfg.environment, {
      token: (res as TokenResponse).access_token,
      expiresAt: Date.now() + ttl,
    });
    return (res as TokenResponse).access_token;
  }

  async submitDocuments(cfg: EinvoiceConfig, documents: Array<Record<string, unknown>>): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'POST',
      url: cfg.endpoints.base + cfg.endpoints.submit,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documents }),
    });
  }

  async searchDocuments(cfg: EinvoiceConfig, query: Record<string, unknown>): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'GET',
      url: cfg.endpoints.base + cfg.endpoints.search + '?' + new URLSearchParams(query as Record<string, string>).toString(),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getDocument(cfg: EinvoiceConfig, id: string): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'GET',
      url: cfg.endpoints.base + cfg.endpoints.getDocument.replace('{id}', encodeURIComponent(id)),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async cancelDocument(cfg: EinvoiceConfig, id: string, reason: string): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'PUT',
      url: cfg.endpoints.base + cfg.endpoints.cancelDocument.replace('{id}', encodeURIComponent(id)),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', reason }),
    });
  }

  /**
   * Minimal HTTP request helper. Uses global fetch (Node 20) so we can
   * rely on the runtime's TLS handling.
   */
  private async request<T = unknown>(opts: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.getTimeoutMs());
    try {
      const res = await fetch(opts.url, {
        method: opts.method,
        headers: opts.headers,
        body: opts.body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`MyInvois ${opts.method} ${opts.url} -> ${res.status} ${text.slice(0, 200)}`);
        throw new Error(`MyInvois ${res.status}: ${text.slice(0, 500)}`);
      }
      return (text ? JSON.parse(text) : {}) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** For testing: clear token cache. */
  clearCache(): void {
    this.cache.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Endpoints = EinvoiceEndpoints;
