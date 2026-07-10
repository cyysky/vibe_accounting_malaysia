import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EinvoiceEnvironment } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EinvoiceSettingsService } from './einvoice.config';
import { MyInvoisClient } from './clients/myinvois.client';
import { JsonSigner } from './signers/json-signer';
import { buildUblInvoice } from './mappers/invoice-v1.1.mapper';
import { CreateEinvoiceConfigDto, UpdateEinvoiceConfigDto } from './dto/config.dto';

@Injectable()
export class EinvoiceService {
  private readonly logger = new Logger(EinvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: EinvoiceSettingsService,
    private readonly client: MyInvoisClient,
    private readonly signer: JsonSigner,
    private readonly config: ConfigService,
  ) {}

  // --- Config CRUD ---------------------------------------------------------
  async listConfigs(bookId: string): Promise<Array<Record<string, unknown>>> {
    return (await this.prisma.einvoiceConfig.findMany({
      where: { accountBookId: bookId },
      orderBy: { environment: 'asc' },
    })) as unknown as Array<Record<string, unknown>>;
  }

  async upsertConfig(bookId: string, dto: CreateEinvoiceConfigDto): Promise<Record<string, unknown>> {
    return (await this.prisma.einvoiceConfig.upsert({
      where: { accountBookId_environment: { accountBookId: bookId, environment: dto.environment } },
      update: { ...dto },
      create: { ...dto, accountBookId: bookId },
    })) as unknown as Record<string, unknown>;
  }

  async updateConfig(id: string, dto: UpdateEinvoiceConfigDto): Promise<Record<string, unknown>> {
    const c = await this.prisma.einvoiceConfig.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Config ${id} not found`);
    return (await this.prisma.einvoiceConfig.update({ where: { id }, data: dto })) as unknown as Record<string, unknown>;
  }

  async deleteConfig(id: string): Promise<void> {
    await this.prisma.einvoiceConfig.delete({ where: { id } });
  }

  /**
   * Resolve the active config for a book.  Prefers the DB config; falls
   * back to env vars (EINVOICE_SANDBOX_* / EINVOICE_PROD_*).
   */
  private async resolveConfig(bookId: string, env: EinvoiceEnvironment): Promise<ReturnType<EinvoiceSettingsService['build']>> {
    const dbCfg = await this.prisma.einvoiceConfig.findUnique({
      where: { accountBookId_environment: { accountBookId: bookId, environment: env } },
    });
    if (dbCfg && dbCfg.active) {
      return {
        environment: dbCfg.environment,
        clientId: dbCfg.clientId,
        clientSecret: dbCfg.clientSecret,
        taxpayerTin: dbCfg.taxpayerTin,
        taxpayerBrn: dbCfg.taxpayerBrn ?? undefined,
        taxpayerName: dbCfg.taxpayerName ?? undefined,
        certPath: dbCfg.certPath ?? undefined,
        certPassphrase: dbCfg.certPassphrase ?? undefined,
        endpoints: this.settings.build(env).endpoints,
      };
    }
    const envCfg = this.settings.build(env);
    if (!envCfg.clientId) {
      throw new BadRequestException(
        `No active MyInvois config for environment ${env}. Configure one via POST /einvoice/configs or set EINVOICE_${env}_CLIENT_ID env vars.`,
      );
    }
    return envCfg;
  }

  // --- Submission -----------------------------------------------------------
  async submitInvoice(bookId: string, invoiceId: string, opts: { version?: string; format?: string }) {
    const invoice = await this.prisma.customerInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { include: { item: true, taxCode: true } }, customer: true },
    });
    if (!invoice || invoice.accountBookId !== bookId) {
      throw new NotFoundException(`Invoice ${invoiceId} not found in this account book`);
    }
    const cfg = await this.resolveConfig(bookId, EinvoiceEnvironment.SANDBOX);
    const taxCodes = new Map(
      (await this.prisma.taxCode.findMany({ where: { accountBookId: bookId } })).map((t) => [t.id, t]),
    );
    const book = await this.prisma.accountBook.findUnique({ where: { id: bookId } });
    const supplier = {
      tin: cfg.taxpayerTin,
      brn: cfg.taxpayerBrn ?? null,
      name: cfg.taxpayerName ?? book?.name ?? 'Demo Company Sdn Bhd',
      msic: book?.industryCode ?? undefined,
    };
    const v = (opts.version ?? '1.1') as '1.1' | '1.0';
    const ubl = buildUblInvoice({
      invoice,
      customer: invoice.customer,
      supplier,
      taxCodes,
      version: v,
      format: (opts.format ?? 'JSON') as 'JSON' | 'XML',
    });

    const payloadString = JSON.stringify(ubl);
    let signature: string;
    let digest: string;
    if (cfg.certPath && this.config.get<string>('DISABLE_SIGNING') !== '1') {
      const sig = await this.signer.signP12(payloadString, cfg.certPath, cfg.certPassphrase ?? '');
      signature = sig.signature;
      digest = sig.digest;
    } else {
      const sig = this.signer.placeholder(payloadString);
      signature = sig.signature;
      digest = sig.digest;
      this.logger.warn('Submitting with placeholder signature (DISABLE_SIGNING=1 or no cert). MyInvois will reject.');
    }

    // Track the submission in the DB BEFORE the network call so retries
    // can be traced.
    const submission = await this.prisma.einvoiceSubmission.create({
      data: {
        accountBookId: bookId,
        invoiceId,
        documentType: 'invoice',
        documentVersion: v,
        format: opts.format ?? 'JSON',
        environment: cfg.environment,
        payloadHash: digest,
        payload: payloadString,
        attempts: 1,
      },
    });

    let resBody: unknown;
    try {
      resBody = await this.client.submitDocuments(cfg, [
        {
          format: opts.format ?? 'JSON',
          document: Buffer.from(payloadString).toString('base64'),
          documentSignature: [{ signature, certificate: '', digest: { Algorithm: 'SHA-256', hashValue: digest } }],
        },
      ]);
    } catch (err) {
      await this.prisma.einvoiceSubmission.update({
        where: { id: submission.id },
        data: { errorMessage: (err as Error).message, completedAt: new Date() },
      });
      throw err;
    }

    const accepted = (resBody as { acceptedDocuments?: unknown[] })?.acceptedDocuments ?? [];
    const rejected = (resBody as { rejectedDocuments?: unknown[] })?.rejectedDocuments ?? [];
    const submissionUid = (accepted[0] as { submissionUid?: string })?.submissionUid;
    await this.prisma.einvoiceSubmission.update({
      where: { id: submission.id },
      data: {
        acceptedDocuments: accepted as never,
        rejectedDocuments: rejected as never,
        submissionUid,
        submittedAt: new Date(),
        completedAt: new Date(),
      },
    });
    if (invoice) {
      await this.prisma.customerInvoice.update({
        where: { id: invoiceId },
        data: { einvoiceStatus: rejected.length ? 'INVALID' : 'PENDING' },
      });
    }
    return { submissionId: submission.id, submissionUid, accepted, rejected };
  }

  async listSubmissions(bookId: string, invoiceId?: string) {
    return this.prisma.einvoiceSubmission.findMany({
      where: { accountBookId: bookId, ...(invoiceId ? { invoiceId } : {}) },
      orderBy: { submittedAt: 'desc' },
      include: { invoice: true },
    });
  }

  async getSubmission(bookId: string, id: string) {
    const s = await this.prisma.einvoiceSubmission.findFirst({
      where: { id, accountBookId: bookId },
      include: { invoice: true },
    });
    if (!s) throw new NotFoundException(`Submission ${id} not found`);
    return s;
  }

  async pollSubmission(bookId: string, id: string) {
    const s = await this.getSubmission(bookId, id);
    if (!s.submissionUid) {
      throw new BadRequestException('Submission has no submissionUid yet — submit first.');
    }
    const cfg = await this.resolveConfig(bookId, s.environment);
    const res = (await this.client.searchDocuments(cfg, {
      submissionUid: s.submissionUid,
      pageNo: '1',
      pageSize: '10',
    })) as { result?: Array<{ status?: number; longId?: string; uuid?: string }> };
    const doc = res.result?.[0];
    const statusMap: Record<number, string> = {
      1: 'SUBMITTED',
      2: 'VALID',
      3: 'INVALID',
      4: 'CANCELLED',
    };
    if (doc) {
      await this.prisma.einvoiceSubmission.update({
        where: { id },
        data: {
          documentStatus: doc.status,
          einvoiceUuid: doc.uuid,
          einvoiceLongId: doc.longId,
          completedAt: new Date(),
        } as never,
      });
      if (s.invoiceId) {
        await this.prisma.customerInvoice.update({
          where: { id: s.invoiceId },
          data: {
            einvoiceStatus: statusMap[doc.status ?? 0] as never,
            einvoiceUuid: doc.uuid,
            einvoiceLongId: doc.longId,
            einvoiceValidatedAt: doc.status === 2 ? new Date() : undefined,
          } as never,
        });
      }
    }
    return { status: doc?.status, statusName: statusMap[doc?.status ?? 0], document: doc };
  }

  async cancelDocument(bookId: string, submissionId: string, reason: string) {
    const s = await this.getSubmission(bookId, submissionId);
    if (!s.submissionUid) throw new BadRequestException('Submission has no submissionUid yet');
    const cfg = await this.resolveConfig(bookId, s.environment);
    const res = await this.client.cancelDocument(cfg, s.submissionUid, reason);
    await this.prisma.einvoiceSubmission.update({
      where: { id: submissionId },
      data: { documentStatus: 4, completedAt: new Date() } as never,
    });
    if (s.invoiceId) {
      await this.prisma.customerInvoice.update({
        where: { id: s.invoiceId },
        data: { einvoiceStatus: 'CANCELLED' } as never,
      });
    }
    return res;
  }

  /**
   * Buyer-initiated document rejection.  Uses the same PUT /state endpoint as
   * cancellation but with status=rejected per the SDK docs.
   */
  async rejectDocument(bookId: string, submissionId: string, reason: string) {
    const s = await this.getSubmission(bookId, submissionId);
    if (!s.submissionUid) throw new BadRequestException('Submission has no submissionUid yet');
    const cfg = await this.resolveConfig(bookId, s.environment);
    const res = await this.client.rejectDocument(cfg, s.submissionUid, reason);
    await this.prisma.einvoiceSubmission.update({
      where: { id: submissionId },
      data: { documentStatus: 3, completedAt: new Date() } as never,
    });
    if (s.invoiceId) {
      await this.prisma.customerInvoice.update({
        where: { id: s.invoiceId },
        data: { einvoiceStatus: 'INVALID' } as never,
      });
    }
    return res;
  }

  /**
   * Validate a buyer's TIN + identification combination via MyInvois.
   * Returns the raw MyInvois response.
   */
  async validateTin(bookId: string, env: EinvoiceEnvironment, tin: string, idType: string, idValue: string) {
    const cfg = await this.resolveConfig(bookId, env);
    return this.client.validateTaxpayerTIN(cfg, tin, idType, idValue);
  }

  /**
   * Fetch the most recent submissions from MyInvois (last 31 days).
   */
  async getRecentDocuments(bookId: string, env: EinvoiceEnvironment, pageNo = 1, pageSize = 20) {
    const cfg = await this.resolveConfig(bookId, env);
    return this.client.getRecentDocuments(cfg, { pageNo: String(pageNo), pageSize: String(pageSize) });
  }

  /**
   * Retrieve the full submission (including all individual documents) from MyInvois.
   */
  async getSubmissionDetails(bookId: string, submissionId: string) {
    const s = await this.getSubmission(bookId, submissionId);
    if (!s.submissionUid) throw new BadRequestException('Submission has no submissionUid yet');
    const cfg = await this.resolveConfig(bookId, s.environment);
    return this.client.getSubmission(cfg, s.submissionUid);
  }

  /**
   * Retrieve a single document (XML or JSON) from MyInvois by its UUID/longId.
   */
  async getDocument(bookId: string, submissionId: string) {
    const s = await this.getSubmission(bookId, submissionId);
    const id = s.invoice?.einvoiceLongId ?? s.invoice?.einvoiceUuid;
    if (!id) {
      throw new BadRequestException('Submission has no document UUID yet - poll status first.');
    }
    const cfg = await this.resolveConfig(bookId, s.environment);
    return this.client.getDocument(cfg, id);
  }
}
