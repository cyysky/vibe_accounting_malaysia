import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ApService } from "./ap.service";

const makeSeq = () => ({ next: jest.fn().mockResolvedValue("SINV-00001") }) as any;
const makePosting = () => ({ postSupplierInvoice: jest.fn().mockResolvedValue(undefined) }) as any;

describe("ApService (supplier)", () => {
  function makePrisma() {
    return {
      supplier: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      supplierInvoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      taxCode: { findUnique: jest.fn() },
    } as any;
  }

  it("rejects creating a supplier with duplicate code in the same book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1", code: "S001" });
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createSupplier("B1", { code: "S001", name: "Dup", country: "MY", currency: "MYR" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a supplier with provided details", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue(null);
    prisma.supplier.create.mockResolvedValue({ id: "s1", code: "S001", name: "Acme" });
    const svc = new ApService(prisma, makeSeq(), makePosting());
    const result = await svc.createSupplier("B1", { code: "S001", name: "Acme", country: "MY", currency: "MYR" } as never);
    expect(result).toMatchObject({ code: "S001" });
  });

  it("update throws when supplier missing", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue(null);
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await expect(svc.updateSupplier("missing", { name: "x" } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("delete throws when supplier missing", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue(null);
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await expect(svc.deleteSupplier("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ApService (supplier invoices)", () => {
  function makePrisma() {
    return {
      supplier: { findUnique: jest.fn(), update: jest.fn() },
      supplierInvoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      taxCode: { findUnique: jest.fn() },
    } as any;
  }

  it("rejects bill when supplier belongs to another book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B2" });
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createInvoice("B1", {
        supplierId: "s1", date: "2025-01-01", dueDate: "2025-02-01", lines: [{ description: "x", quantity: 1, unitPrice: 10 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a bill with totals and increments supplier outstanding", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.taxCode.findUnique.mockResolvedValue({ id: "t1", rate: 0.06 });
    prisma.supplierInvoice.create.mockResolvedValue({ id: "i1", number: "SINV-00001", total: 106 });
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await svc.createInvoice("B1", {
      supplierId: "s1", date: "2025-01-01", dueDate: "2025-02-01",
      lines: [{ description: "Goods", quantity: 1, unitPrice: 100, taxCodeId: "t1" }],
    } as never);
    expect(prisma.supplierInvoice.create).toHaveBeenCalled();
    expect(prisma.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" }, data: { outstanding: { increment: 106 } } }),
    );
  });

  it("creates a bill with zero tax when no tax code provided", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.supplierInvoice.create.mockResolvedValue({ id: "i1", total: 50 });
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await svc.createInvoice("B1", {
      supplierId: "s1", date: "2025-01-01", dueDate: "2025-02-01",
      lines: [{ description: "Goods", quantity: 1, unitPrice: 50 }],
    } as never);
    const args = prisma.supplierInvoice.create.mock.calls[0][0];
    expect(Number(args.data.total)).toBe(50);
    expect(Number(args.data.taxTotal)).toBe(0);
  });

  it("delete bill throws NotFound when missing", async () => {
    const prisma = makePrisma();
    prisma.supplierInvoice.findUnique.mockResolvedValue(null);
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await expect(svc.deleteInvoice("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("delete bill decrements supplier outstanding", async () => {
    const prisma = makePrisma();
    prisma.supplierInvoice.findUnique.mockResolvedValue({ id: "i1", supplierId: "s1", total: 200, lines: [] });
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await svc.deleteInvoice("i1");
    expect(prisma.supplierInvoice.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
    expect(prisma.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" }, data: { outstanding: { decrement: 200 } } }),
    );
  });

  it("getInvoice throws NotFound when missing", async () => {
    const prisma = makePrisma();
    prisma.supplierInvoice.findUnique.mockResolvedValue(null);
    const svc = new ApService(prisma, makeSeq(), makePosting());
    await expect(svc.getInvoice("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("listInvoices maps supplierName and tax alias", async () => {
    const prisma = makePrisma();
    prisma.supplierInvoice.findMany.mockResolvedValue([
      { id: "i1", number: "SINV-00001", total: 100, taxTotal: 6, supplier: { name: "Acme" }, lines: [] },
    ]);
    prisma.supplierInvoice.count.mockResolvedValue(1);
    const svc = new ApService(prisma, makeSeq(), makePosting());
    const res = await svc.listInvoices("B1");
    expect(res.data[0]).toMatchObject({ supplierName: "Acme", tax: 6 });
    expect(res.total).toBe(1);
  });
});
