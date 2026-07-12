import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EinvoiceEnvironment, Prisma } from '@prisma/client';
import { EinvoiceService } from './einvoice.service';
import { EinvoiceSettingsService } from './einvoice.config';
import { MyInvoisClient } from './clients/myinvois.client';
import { JsonSigner } from './signers/json-signer';

const D = (v: number | string) => new Prisma.Decimal(v);

type EinvoiceConfigRecord = {
  id: string;
  accountBookId: string;
  environment: EinvoiceEnvironment;
  clientId: string;
  clientSecret: string;
  taxpayerTin: string;
  taxpayerBrn: string | null;
  taxpayerName: string | null;
  certPath: string | null;
  certPassphrase: string | null;
  active: boolean;
};

function makePrisma() {
  const einvoiceConfigFindUnique = jest.fn();
  const einvoiceConfigFindMany = jest.fn();
  const einvoiceConfigUpsert = jest.fn();
  const einvoiceConfigUpdate = jest.fn();
  const einvoiceConfigDelete = jest.fn();
  const einvoiceConfigCreate = jest.fn();
  const einvoiceSubmissionCreate = jest.fn();
  const einvoiceSubmissionUpdate = jest.fn();
  const einvoiceSubmissionFindFirst = jest.fn();
  const einvoiceSubmissionFindMany = jest.fn();
  const einvoiceSubmissionFindUnique = jest.fn();
  const einvoiceSubmissionUpdateArgs: unknown[] = [];
  einvoiceSubmissionUpdate.mockImplementation((args) => {
    einvoiceSubmissionUpdateArgs.push(args);
    return Promise.resolve({ id: args.where.id, ...(args.data ?? {}) });
  });
  const customerInvoiceFindUnique = jest.fn();
  const customerInvoiceUpdate = jest.fn();
  const taxCodeFindMany = jest.fn();
  const accountBookFindUnique = jest.fn();

  return {
    einvoiceConfig: {
      findUnique: einvoiceConfigFindUnique,
      findMany: einvoiceConfigFindMany,
      upsert: einvoiceConfigUpsert,
      update: einvoiceConfigUpdate,
      delete: einvoiceConfigDelete,
      create: einvoiceConfigCreate,
    },
    einvoiceSubmission: {
      create: einvoiceSubmissionCreate,
      update: einvoiceSubmissionUpdate,
      findFirst: einvoiceSubmissionFindFirst,
      findMany: einvoiceSubmissionFindMany,
      findUnique: einvoiceSubmissionFindUnique,
    },
    customerInvoice: {
      findUnique: customerInvoiceFindUnique,
      update: customerInvoiceUpdate,
    },
    taxCode: { findMany: taxCodeFindMany },
    accountBook: { findUnique: accountBookFindUnique },
    _internal: { einvoiceSubmissionUpdateArgs },
  };
}

function makeSettings(env = EinvoiceEnvironment.SANDBOX): EinvoiceSettingsService {
  return { build: (_e?: EinvoiceEnvironment) => ({
    environment: env,
    clientId: 'env-client',
    clientSecret: 'env-secret',
    taxpayerTin: 'IG000',
    taxpayerBrn: undefined,
    taxpayerName: undefined,
    certPath: undefined,
    certPassphrase: undefined,
    endpoints: { base: 'https://preprod', token: '/t', submit: '/s', search: '/q', getDocument: '/d', cancelDocument: '/c', getRecent: '/r' },
  }) } as unknown as EinvoiceSettingsService;
}

function makeClient() {
  return {
    submitDocuments: jest.fn(),
    searchDocuments: jest.fn(),
    cancelDocument: jest.fn(),
    rejectDocument: jest.fn(),
    getRecentDocuments: jest.fn(),
    getSubmission: jest.fn(),
    getDocument: jest.fn(),
    validateTaxpayerTIN: jest.fn(),
  } as unknown as MyInvoisClient & {
    submitDocuments: jest.Mock;
    searchDocuments: jest.Mock;
    cancelDocument: jest.Mock;
    rejectDocument: jest.Mock;
  };
}

function makeSigner(placeholder = true) {
  return {
    signP12: jest.fn(),
    placeholder: jest.fn((payload: string) => ({ signature: "PL-SIG", digest: Buffer.from(payload).toString("base64").slice(0, 32) })),
  } as unknown as JsonSigner & { signP12: jest.Mock; placeholder: jest.Mock };
}

function buildService(prisma: ReturnType<typeof makePrisma>, opts: { client?: ReturnType<typeof makeClient>; signer?: ReturnType<typeof makeSigner>; disableSigning?: boolean; settings?: EinvoiceSettingsService } = {}) {
  const cfg = { get: (k: string) => (k === "DISABLE_SIGNING" && opts.disableSigning ? "1" : undefined) } as unknown as ConfigService;
  const settings = opts.settings ?? makeSettings();
  const client = opts.client ?? makeClient();
  const signer = opts.signer ?? makeSigner();
  const svc = new EinvoiceService(prisma as never, settings, client as never, signer as never, cfg);
  return { svc, client, signer, settings };
}

const baseInvoice = (over = {}) => ({
  id: "inv-1",
  accountBookId: "book-1",
  customerId: "cust-1",
  number: "INV-0001",
  date: new Date("2025-01-15T00:00:00Z"),
  dueDate: new Date("2025-02-15T00:00:00Z"),
  currency: "MYR",
  exchangeRate: D(1),
  subtotal: D(100),
  taxTotal: D(8),
  total: D(108),
  paid: D(0),
  balance: D(108),
  status: "ISSUED",
  notes: null,
  einvoiceStatus: "NOT_SUBMITTED",
  einvoiceUuid: null,
  einvoiceLongId: null,
  einvoiceQR: null,
  einvoiceValidatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [{ description: "Widget", quantity: 2, unitPrice: 50, discount: 0, taxAmount: 8, lineNo: 1, taxCodeId: "t1", taxCode: null, item: null }],
  customer: { id: "cust-1", accountBookId: "book-1", code: "C001", name: "Acme", email: "ap@acme.test", phone: null, taxId: "C123", brn: null, addressLine1: null, addressLine2: null, city: "KL", state: "Selangor", postalCode: "50000", country: "MY", currency: "MYR", creditLimit: D(0), outstanding: D(0), active: true, createdAt: new Date(), updatedAt: new Date() },
  ...over,
});

describe("EinvoiceService", () => {
  describe("config CRUD", () => {
    it("listConfigs filters by bookId", async () => {
      const prisma = makePrisma();
      prisma.einvoiceConfig.findMany.mockResolvedValue([{ id: "c1" }]);
      const { svc } = buildService(prisma);
      const out = await svc.listConfigs("book-1");
      expect(out).toEqual([{ id: "c1" }]);
      expect(prisma.einvoiceConfig.findMany).toHaveBeenCalledWith({ where: { accountBookId: "book-1" }, orderBy: { environment: "asc" } });
    });

    it("upsertConfig creates or updates by (bookId, env)", async () => {
      const prisma = makePrisma();
      prisma.einvoiceConfig.upsert.mockResolvedValue({ id: "c1" });
      const { svc } = buildService(prisma);
      const out = await svc.upsertConfig("book-1", {
        environment: EinvoiceEnvironment.SANDBOX,
        clientId: "x", clientSecret: "y", taxpayerTin: "IG123", active: true,
      } as never);
      expect(out).toEqual({ id: "c1" });
      expect(prisma.einvoiceConfig.upsert).toHaveBeenCalledTimes(1);
    });

    it("updateConfig throws NotFound when missing", async () => {
      const prisma = makePrisma();
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const { svc } = buildService(prisma);
      await expect(svc.updateConfig("nope", { clientId: "x" } as never)).rejects.toThrow(NotFoundException);
      expect(prisma.einvoiceConfig.update).not.toHaveBeenCalled();
    });

    it("deleteConfig removes the row", async () => {
      const prisma = makePrisma();
      const { svc } = buildService(prisma);
      await svc.deleteConfig("c1");
      expect(prisma.einvoiceConfig.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });
  });

  describe("validateInvoice", () => {
    it("returns valid result for a clean invoice", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue(baseInvoice());
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo", industryCode: null });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const { svc } = buildService(prisma);
      const result = await svc.validateInvoice("book-1", "inv-1", { version: "1.1", format: "JSON" } as never);
      expect(result.valid).toBe(true);
    });

    it("throws NotFound when invoice not in book", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue({ ...baseInvoice(), accountBookId: "other" });
      const { svc } = buildService(prisma);
      await expect(svc.validateInvoice("book-1", "inv-1", {})).rejects.toThrow(NotFoundException);
    });
  });

  describe("submitInvoice", () => {
    it("validateOnly short-circuits without talking to MyInvois", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue(baseInvoice());
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo", industryCode: null });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const { svc, client } = buildService(prisma);
      const out = await svc.submitInvoice("book-1", "inv-1", { validateOnly: true } as never);
      expect(out.submissionId).toBeNull();
      expect(out.validation?.valid).toBe(true);
      expect((client.submitDocuments as jest.Mock)).not.toHaveBeenCalled();
      expect(prisma.einvoiceSubmission.create).not.toHaveBeenCalled();
    });

    it("uses placeholder signature when DISABLE_SIGNING=1 and falls back to env config", async () => {
      const prisma = makePrisma();
      const inv = baseInvoice();
      prisma.customerInvoice.findUnique.mockResolvedValue(inv);
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo", industryCode: null });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null); // no DB config -> env fallback
      prisma.einvoiceSubmission.create.mockResolvedValue({ id: "sub-1" });
      const client = makeClient();
      (client.submitDocuments as jest.Mock).mockResolvedValue({
        acceptedDocuments: [{ submissionUid: "uid-1", uuid: "u-1", longId: "L-1" }],
        rejectedDocuments: [],
      });
      const signer = makeSigner();
      const { svc } = buildService(prisma, { client, signer, disableSigning: true });
      const out = await svc.submitInvoice("book-1", "inv-1", {});
      expect(out.submissionUid).toBe("uid-1");
      expect(signer.placeholder).toHaveBeenCalled();
      expect(signer.signP12).not.toHaveBeenCalled();
      expect(prisma.customerInvoice.update).toHaveBeenCalledWith({ where: { id: "inv-1" }, data: { einvoiceStatus: "PENDING" } });
    });

    it("prefers active DB config over env vars", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue(baseInvoice());
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo", industryCode: null });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue({
        id: "c1", accountBookId: "book-1", environment: EinvoiceEnvironment.SANDBOX,
        clientId: "db-client", clientSecret: "db-secret", taxpayerTin: "DB-IG",
        taxpayerBrn: "DB-BRN", taxpayerName: "DB Co", certPath: null, certPassphrase: null, active: true,
      } as EinvoiceConfigRecord);
      prisma.einvoiceSubmission.create.mockResolvedValue({ id: "sub-1" });
      const client = makeClient();
      (client.submitDocuments as jest.Mock).mockResolvedValue({ acceptedDocuments: [{ submissionUid: "u-2" }], rejectedDocuments: [] });
      const { svc } = buildService(prisma, { client, disableSigning: true });
      await svc.submitInvoice("book-1", "inv-1", {});
      const cfg = (client.submitDocuments as jest.Mock).mock.calls[0][0];
      expect(cfg.clientId).toBe("db-client");
      expect(cfg.taxpayerTin).toBe("DB-IG");
    });

    it("marks submission with error message when MyInvois throws", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue(baseInvoice());
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo", industryCode: null });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      prisma.einvoiceSubmission.create.mockResolvedValue({ id: "sub-1" });
      const client = makeClient();
      (client.submitDocuments as jest.Mock).mockRejectedValue(new Error("MyInvois 503"));
      const { svc } = buildService(prisma, { client, disableSigning: true });
      await expect(svc.submitInvoice("book-1", "inv-1", {})).rejects.toThrow("MyInvois 503");
      const updateArgs = prisma._internal.einvoiceSubmissionUpdateArgs;
      expect(updateArgs[0]).toMatchObject({ where: { id: "sub-1" }, data: { errorMessage: "MyInvois 503", completedAt: expect.any(Date) } });
    });

    it("marks einvoiceStatus INVALID when any documents are rejected", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue(baseInvoice());
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo", industryCode: null });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      prisma.einvoiceSubmission.create.mockResolvedValue({ id: "sub-1" });
      const client = makeClient();
      (client.submitDocuments as jest.Mock).mockResolvedValue({
        acceptedDocuments: [],
        rejectedDocuments: [{ error: { code: "X", message: "bad" } }],
      });
      const { svc } = buildService(prisma, { client, disableSigning: true });
      await svc.submitInvoice("book-1", "inv-1", {});
      const updates = prisma.customerInvoice.update.mock.calls;
      const last = updates[updates.length - 1][0];
      expect(last.data.einvoiceStatus).toBe("INVALID");
    });
  });

  describe("pollSubmission", () => {
    it("maps MyInvois status 2 to VALID and updates invoice", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({
        id: "sub-1", accountBookId: "book-1", submissionUid: "uid-1",
        environment: EinvoiceEnvironment.SANDBOX, invoiceId: "inv-1",
        invoice: { id: "inv-1" },
      });
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const client = makeClient();
      (client.searchDocuments as jest.Mock).mockResolvedValue({ result: [{ status: 2, longId: "L-1", uuid: "U-1" }] });
      const { svc } = buildService(prisma, { client });
      const out = await svc.pollSubmission("book-1", "sub-1");
      expect(out.statusName).toBe("VALID");
      expect(prisma.customerInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({ einvoiceStatus: "VALID", einvoiceUuid: "U-1", einvoiceLongId: "L-1", einvoiceValidatedAt: expect.any(Date) }),
      });
    });

    it("throws BadRequest when submission has no submissionUid", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({ id: "sub-1", accountBookId: "book-1", submissionUid: null, environment: EinvoiceEnvironment.SANDBOX, invoiceId: "inv-1", invoice: null });
      const { svc } = buildService(prisma);
      await expect(svc.pollSubmission("book-1", "sub-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("cancelDocument / rejectDocument", () => {
    it("cancelDocument calls MyInvois and marks invoice CANCELLED", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({
        id: "sub-1", accountBookId: "book-1", submissionUid: "uid-1",
        environment: EinvoiceEnvironment.SANDBOX, invoiceId: "inv-1",
        invoice: { id: "inv-1" },
      });
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const client = makeClient();
      (client.cancelDocument as jest.Mock).mockResolvedValue({ ok: true });
      const { svc } = buildService(prisma, { client });
      await svc.cancelDocument("book-1", "sub-1", "duplicate");
      expect(client.cancelDocument).toHaveBeenCalledWith(expect.anything(), "uid-1", "duplicate");
      expect(prisma.customerInvoice.update).toHaveBeenCalledWith({ where: { id: "inv-1" }, data: { einvoiceStatus: "CANCELLED" } });
    });

    it("rejectDocument marks invoice INVALID", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({
        id: "sub-1", accountBookId: "book-1", submissionUid: "uid-1",
        environment: EinvoiceEnvironment.SANDBOX, invoiceId: "inv-1",
        invoice: { id: "inv-1" },
      });
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const client = makeClient();
      (client.rejectDocument as jest.Mock).mockResolvedValue({ ok: true });
      const { svc } = buildService(prisma, { client });
      await svc.rejectDocument("book-1", "sub-1", "buyer-rejected");
      expect(client.rejectDocument).toHaveBeenCalledWith(expect.anything(), "uid-1", "buyer-rejected");
      const updateArgs = prisma.customerInvoice.update.mock.calls;
      expect(updateArgs[updateArgs.length - 1][0].data.einvoiceStatus).toBe("INVALID");
    });
  });

  describe("getDocument / getSubmissionDetails", () => {
    it("getDocument throws when invoice has no UUID yet", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({
        id: "sub-1", accountBookId: "book-1", submissionUid: "uid-1",
        environment: EinvoiceEnvironment.SANDBOX, invoiceId: "inv-1",
        invoice: { id: "inv-1", einvoiceLongId: null, einvoiceUuid: null },
      });
      const { svc } = buildService(prisma);
      await expect(svc.getDocument("book-1", "sub-1")).rejects.toThrow(BadRequestException);
    });

    it("getDocument uses longId when available, falling back to uuid", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({
        id: "sub-1", accountBookId: "book-1", submissionUid: "uid-1",
        environment: EinvoiceEnvironment.SANDBOX, invoiceId: "inv-1",
        invoice: { id: "inv-1", einvoiceLongId: "LONG-ID", einvoiceUuid: "UUID-X" },
      });
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const client = makeClient();
      (client.getDocument as jest.Mock).mockResolvedValue("<xml/>");
      const { svc } = buildService(prisma, { client });
      const out = await svc.getDocument("book-1", "sub-1");
      expect(out).toBe("<xml/>");
      expect((client.getDocument as jest.Mock).mock.calls[0][1]).toBe("LONG-ID");
    });
  });

  describe("validateTin / getRecentDocuments", () => {
    it("validateTin proxies to client with resolved config", async () => {
      const prisma = makePrisma();
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const client = makeClient();
      (client.validateTaxpayerTIN as jest.Mock).mockResolvedValue({ valid: true });
      const { svc } = buildService(prisma, { client });
      const out = await svc.validateTin("book-1", EinvoiceEnvironment.SANDBOX, "IG123", "BRN", "BRNVAL");
      expect(out).toEqual({ valid: true });
      expect((client.validateTaxpayerTIN as jest.Mock).mock.calls[0]).toEqual([expect.anything(), "IG123", "BRN", "BRNVAL"]);
    });

    it("getRecentDocuments forwards pageNo/pageSize as strings", async () => {
      const prisma = makePrisma();
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const client = makeClient();
      (client.getRecentDocuments as jest.Mock).mockResolvedValue({ result: [] });
      const { svc } = buildService(prisma, { client });
      await svc.getRecentDocuments("book-1", EinvoiceEnvironment.SANDBOX, 2, 50);
      expect((client.getRecentDocuments as jest.Mock).mock.calls[0][1]).toEqual({ pageNo: "2", pageSize: "50" });
    });
  });

  describe("config resolution edge cases", () => {
    it("throws BadRequest when no DB config and no env credentials", async () => {
      const prisma = makePrisma();
      prisma.customerInvoice.findUnique.mockResolvedValue(baseInvoice());
      prisma.accountBook.findUnique.mockResolvedValue({ id: "book-1", name: "Demo" });
      prisma.taxCode.findMany.mockResolvedValue([]);
      prisma.einvoiceConfig.findUnique.mockResolvedValue(null);
      const settings = { build: () => ({ environment: EinvoiceEnvironment.SANDBOX, clientId: "", clientSecret: "", taxpayerTin: "", endpoints: { base: "x" } }) } as unknown as EinvoiceSettingsService;
      const { svc } = buildService(prisma, { settings, disableSigning: true });
      await expect(svc.submitInvoice("book-1", "inv-1", {})).rejects.toThrow(BadRequestException);
    });
  });

  describe("submission queries", () => {
    it("listSubmissions filters by bookId and optionally by invoiceId", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findMany.mockResolvedValue([{ id: "s1" }]);
      const { svc } = buildService(prisma);
      await expect(svc.listSubmissions("book-1")).resolves.toEqual([{ id: "s1" }]);
      expect(prisma.einvoiceSubmission.findMany).toHaveBeenCalledWith({ where: { accountBookId: "book-1" }, orderBy: { submittedAt: "desc" }, include: { invoice: true } });
      await svc.listSubmissions("book-1", "inv-1");
      expect(prisma.einvoiceSubmission.findMany).toHaveBeenLastCalledWith({ where: { accountBookId: "book-1", invoiceId: "inv-1" }, orderBy: { submittedAt: "desc" }, include: { invoice: true } });
    });

    it("getSubmission returns the submission or throws NotFound", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({ id: "s1" });
      const { svc } = buildService(prisma);
      await expect(svc.getSubmission("book-1", "s1")).resolves.toEqual({ id: "s1" });
      prisma.einvoiceSubmission.findFirst.mockResolvedValue(null);
      await expect(svc.getSubmission("book-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("getSubmissionDetails requires the underlying submission UUID", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({ id: "s1" });
      const { svc } = buildService(prisma);
      await expect(svc.getSubmissionDetails("book-1", "s1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("getSubmissionDetails uses submissionUid when present", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({ id: "s1", submissionUid: "uid-1" });
      const settings = makeSettings();
      const client = makeClient();
      (client.getSubmission as jest.Mock).mockResolvedValue({ status: 2 });
      const { svc } = buildService(prisma, { client, settings });
      await expect(svc.getSubmissionDetails("book-1", "s1")).resolves.toEqual({ status: 2 });
      expect(client.getSubmission).toHaveBeenCalled();
    });

    it("getRecentDocuments defaults to pageNo=1 pageSize=20", async () => {
      const prisma = makePrisma();
      const client = makeClient();
      (client.getRecentDocuments as jest.Mock).mockResolvedValue({ result: [] });
      const { svc } = buildService(prisma, { client });
      await svc.getRecentDocuments("book-1", EinvoiceEnvironment.SANDBOX);
      expect(client.getRecentDocuments).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pageNo: "1", pageSize: "20" }));
    });

    it("getRecentDocuments honours explicit pagination", async () => {
      const prisma = makePrisma();
      const client = makeClient();
      (client.getRecentDocuments as jest.Mock).mockResolvedValue({ result: [] });
      const { svc } = buildService(prisma, { client });
      await svc.getRecentDocuments("book-1", EinvoiceEnvironment.PRODUCTION, 3, 50);
      expect(client.getRecentDocuments).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pageNo: "3", pageSize: "50" }));
    });
  });

  describe("pollSubmission", () => {
    it("persists updated documentStatus and refreshes the invoice record", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({ id: "s1", submissionUid: "uid-1", invoiceId: "inv-1", documentStatus: 1 });
      const client = makeClient();
      (client.searchDocuments as jest.Mock).mockResolvedValue({ result: [{ status: 2, uuid: "u-1", longId: "l-1" }] });
      prisma.einvoiceSubmission.update.mockResolvedValue({});
      prisma.customerInvoice.update.mockResolvedValue({});
      const { svc } = buildService(prisma, { client });
      await svc.pollSubmission("book-1", "s1");
      expect(prisma.einvoiceSubmission.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s1" }, data: expect.objectContaining({ documentStatus: 2 }) }));
      expect(prisma.customerInvoice.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inv-1" }, data: expect.objectContaining({ einvoiceStatus: "VALID" }) }));
    });

    it("propagates MyInvois errors verbatim so callers can react", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue({ id: "s1", submissionUid: "uid-1", invoiceId: "inv-1", documentStatus: 1 });
      const client = makeClient();
      (client.searchDocuments as jest.Mock).mockRejectedValue(new Error("503 Service Unavailable"));
      const { svc } = buildService(prisma, { client });
      await expect(svc.pollSubmission("book-1", "s1")).rejects.toThrow(/503/);
      expect(prisma.einvoiceSubmission.update).not.toHaveBeenCalled();
    });

    it("throws NotFound when the submission is missing", async () => {
      const prisma = makePrisma();
      prisma.einvoiceSubmission.findFirst.mockResolvedValue(null);
      const { svc } = buildService(prisma);
      await expect(svc.pollSubmission("book-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
