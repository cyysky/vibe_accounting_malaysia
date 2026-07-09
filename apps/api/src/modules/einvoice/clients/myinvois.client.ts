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
 *   - Reject a document (buyer-initiated).
 *   - Validate / search taxpayer TIN.
 *   - Retrieve recent documents.
 *   - Resolve QR code (Base64) -> taxpayer info.
 *
 * All MyInvois endpoints documented at https://sdk.myinvois.hasil.gov.my/einvoicingapi/.
 */
@Injectable()
export class MyInvoisClient {
  private readonly logger = new Logger(MyInvoisClient.name);
  private readonly cache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  private getTimeoutMs(): number {
    return Number(this.config.get<string>('EINVOICE_TIMEOUT_MS') ?? 30000);
  }

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

  async getSubmission(cfg: EinvoiceConfig, submissionUid: string, pageNo = 1, pageSize = 10): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    const q = new URLSearchParams({ pageNo: String(pageNo), pageSize: String(pageSize) });
    return this.request({
      method: 'GET',
      url: `${cfg.endpoints.base}/api/v1.0/documentsubmissions/${encodeURIComponent(submissionUid)}?${q.toString()}`,
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

  async rejectDocument(cfg: EinvoiceConfig, id: string, reason: string): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'PUT',
      url: cfg.endpoints.base + cfg.endpoints.cancelDocument.replace('{id}', encodeURIComponent(id)),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', reason }),
    });
  }

  async validateTaxpayerTIN(cfg: EinvoiceConfig, tin: string, idType: string, idValue: string): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    const q = new URLSearchParams({ tin, idType, idValue });
    return this.request({
      method: 'GET',
      url: `${cfg.endpoints.base}/api/v1.0/taxpayer/validate?${q.toString()}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async searchTaxpayerTIN(cfg: EinvoiceConfig, query: Record<string, unknown>): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
    return this.request({
      method: 'GET',
      url: `${cfg.endpoints.base}/api/v1.0/taxpayer/search?${q.toString()}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getTaxpayerQR(cfg: EinvoiceConfig, qrCodeBase64: string): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'GET',
      url: `${cfg.endpoints.base}/api/v1.0/taxpayer/qrcodeinfo`,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCode: qrCodeBase64 }),
    });
  }

  async submitDocuments(cfg: EinvoiceConfig, documents: Array<Record<string, unknown>>): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    return this.request({
      method: 'POST',
      url: cfg.endpoints.base + cfg.endpoints.submit,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });
  }

  async searchDocuments(cfg: EinvoiceConfig, query: Record<string, unknown>): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
    return this.request({
      method: 'GET',
      url: cfg.endpoints.base + cfg.endpoints.search + '?' + q.toString(),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getRecentDocuments(cfg: EinvoiceConfig, query: Record<string, unknown> = {}): Promise<unknown> {
    const token = await this.getAccessToken(cfg);
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
    return this.request({
      method: 'GET',
      url: cfg.endpoints.base + cfg.endpoints.getRecent + (q.toString() ? '?' + q.toString() : ''),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

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

  clearCache(): void {
    this.cache.clear();
  }
}
