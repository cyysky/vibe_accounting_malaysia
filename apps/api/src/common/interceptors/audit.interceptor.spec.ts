import { AuditInterceptor } from "./audit.interceptor";
import { of, throwError } from "rxjs";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { lastValueFrom } from "rxjs";

interface AuditRecord {
  entity: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  message?: string;
  accountBookId?: string;
  userId?: string;
}

function makeAudit() {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function makeCtx(method: string, path: string, user: Record<string, unknown> | undefined, body: unknown = { data: { id: "x1" } }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, path, url: path, user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeNext(value: unknown = { data: { id: "abc-123" } }): CallHandler {
  return { handle: () => of(value) };
}

describe("AuditInterceptor", () => {
  it("records CREATE for POST /api/ar/credit-notes", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("POST", "/api/ar/credit-notes", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext()));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE", entity: "ar-credit-note", entityId: "abc-123", accountBookId: "B1", userId: "u1" }));
  });

  it("records UPDATE for PUT /api/ar/credit-notes/:id", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("PUT", "/api/ar/credit-notes/cn-9", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext()));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE", entity: "ar-credit-note" }));
  });

  it("records DELETE for DELETE /api/ap/debit-notes/:id", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("DELETE", "/api/ap/debit-notes/dn-1", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext()));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE", entity: "ap-debit-note" }));
  });

  it("does not record for GET requests", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("GET", "/api/ar/credit-notes", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext()));
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("skips login / refresh paths entirely", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("POST", "/api/auth/login", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext()));
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("does not record if the user has no accountBookId", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("POST", "/api/ar/credit-notes", { id: "u1" });
    await lastValueFrom(ic.intercept(ctx, makeNext()));
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("does not record on error responses", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("POST", "/api/ar/credit-notes", { id: "u1", accountBookId: "B1" });
    const next: CallHandler = { handle: () => throwError(() => new Error("boom")) };
    await expect(lastValueFrom(ic.intercept(ctx, next))).rejects.toThrow("boom");
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("derives entity from payments module path", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("POST", "/api/ar/payments", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext({ data: { id: "p1" } })));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE", entity: "ar-payment" }));
  });

  it("uses fallback entityId when response has no data.id", async () => {
    const audit = makeAudit();
    const ic = new AuditInterceptor(audit as never);
    const ctx = makeCtx("POST", "/api/ar/credit-notes", { id: "u1", accountBookId: "B1" });
    await lastValueFrom(ic.intercept(ctx, makeNext({})));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entityId: "unknown" }));
  });
});
