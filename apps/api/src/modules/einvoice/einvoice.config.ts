import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EinvoiceEnvironment } from '@prisma/client';

export interface EinvoiceEndpoints {
  base: string;
  token: string;
  submit: string;
  search: string;
  getDocument: string;
  cancelDocument: string;
  getRecent: string;
}

export interface EinvoiceConfig {
  environment: EinvoiceEnvironment;
  clientId: string;
  clientSecret: string;
  taxpayerTin: string;
  taxpayerBrn?: string;
  taxpayerName?: string;
  certPath?: string;
  certPassphrase?: string;
  endpoints: EinvoiceEndpoints;
  // OAuth2 access token + expiry cache
  cachedToken?: string;
  cachedExpiresAt?: number;
}

/**
 * MyInvois API endpoint URLs (per LHDNM SDK).
 * - SANDBOX: preprod-api.myinvois.hasil.gov.my
 * - PROD:    api.myinvois.hasil.gov.my
 */
const SANDBOX: EinvoiceEndpoints = {
  base: 'https://preprod-api.myinvois.hasil.gov.my',
  token: '/connect/token',
  submit: '/api/v1.0/documentsubmissions',
  search: '/api/v1.0/documents/search',
  getDocument: '/api/v1.0/documents/{id}/details',
  cancelDocument: '/api/v1.0/documents/{id}/state',
  getRecent: '/api/v1.0/documents/recent',
};

const PRODUCTION: EinvoiceEndpoints = {
  base: 'https://api.myinvois.hasil.gov.my',
  token: '/connect/token',
  submit: '/api/v1.0/documentsubmissions',
  search: '/api/v1.0/documents/search',
  getDocument: '/api/v1.0/documents/{id}/details',
  cancelDocument: '/api/v1.0/documents/{id}/state',
  getRecent: '/api/v1.0/documents/recent',
};

@Injectable()
export class EinvoiceSettingsService {
  constructor(private readonly config: ConfigService) {}

  build(env: EinvoiceEnvironment = EinvoiceEnvironment.SANDBOX): EinvoiceConfig {
    const isProd = env === EinvoiceEnvironment.PRODUCTION;
    const prefix = isProd ? 'EINVOICE_PROD' : 'EINVOICE_SANDBOX';
    return {
      environment: env,
      clientId: this.config.get<string>(`${prefix}_CLIENT_ID`) ?? '',
      clientSecret: this.config.get<string>(`${prefix}_CLIENT_SECRET`) ?? '',
      taxpayerTin: this.config.get<string>(`${prefix}_TIN`) ?? this.config.get<string>('EINVOICE_TIN') ?? '',
      taxpayerBrn: this.config.get<string>(`${prefix}_BRN`),
      taxpayerName: this.config.get<string>(`${prefix}_NAME`),
      certPath: this.config.get<string>(`${prefix}_CERT_PATH`),
      certPassphrase: this.config.get<string>(`${prefix}_CERT_PASSPHRASE`),
      endpoints: isProd ? PRODUCTION : SANDBOX,
    };
  }
}
