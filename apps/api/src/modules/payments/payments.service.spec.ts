import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

const makeSeq = () => ({ next: jest.fn().mockResolvedValue("PAY-00001") }) as any;
const makePosting = () => ({
  postCustomerPayment: jest.fn().mockResolvedValue(undefined),
  postSupplierPayment: jest.fn().mockResolvedValue(undefined),
}) as any;

describe("PaymentsService (customer)", () => {
  function makePrisma() {
    const txMock = {
      customerPayment: { create: jest.fn() },
      customerInvoice: { findUnique: jest.fn(), update: jest.fn() },
      customer: { update: jest.fn() },
    };
    const tx = jest.fn(async (cb) => cb(txMock));
    return {
      customer: { findUnique: jest.fn(), update: jest.fn() },
      customerInvoice: { findUnique: jest.fn(), update: jest.fn() },
      customerPayment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: tx,
      _txMock: txMock,
    } as any;
  }

  it("rejects missing customerId", async () => {
    const prisma = makePrisma();
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createCustomerPayment("B1", { customerId: "", date: "2025-01-01", amount: 100, method: "BANK", applications: [] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when customer belongs to another book", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "OTHER" });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createCustomerPayment("B1", { customerId: "c1", date: "2025-01-01", amount: 100, method: "BANK", applications: [] } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects when applications do not sum to amount", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B1" });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createCustomerPayment("B1", {
        customerId: "c1",
        date: "2025-01-01",
        amount: 100,
        method: "BANK",
        applications: [{ invoiceId: "i1", amount: 60 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects application exceeding invoice outstanding", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B1" });
    prisma.customerInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "B1", number: "INV-1", total: 100, paid: 0 });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createCustomerPayment("B1", {
        customerId: "c1",
        date: "2025-01-01",
        amount: 150,
        method: "BANK",
        applications: [{ invoiceId: "i1", amount: 150 }],
      } as never),
    ).rejects.toThrow(/exceeds invoice/);
  });

  it("rejects duplicate invoiceId in the same customer payment", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B1" });
    prisma.customerInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "B1", number: "INV-1", total: 200, paid: 0 });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createCustomerPayment("B1", {
        customerId: "c1",
        date: "2025-01-01",
        amount: 120,
        method: "BANK",
        applications: [{ invoiceId: "i1", amount: 60 }, { invoiceId: "i1", amount: 60 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

    it("creates a customer payment and applies it (partial -> PARTIAL)", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B1" });
    prisma.customerInvoice.findUnique
      .mockResolvedValueOnce({ id: "i1", accountBookId: "B1", number: "INV-1", total: 200, paid: 0 });
    prisma._txMock.customerPayment.create.mockResolvedValue({ id: "p1", number: "RCP-00001" });
    prisma._txMock.customerInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "B1", total: 200, paid: 0, status: "ISSUED" });
    prisma.customerPayment.findUnique.mockResolvedValue({ id: "p1" });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await svc.createCustomerPayment("B1", {
      customerId: "c1",
      date: "2025-01-01",
      amount: 80,
      method: "BANK",
      applications: [{ invoiceId: "i1", amount: 80 }],
    } as never);
    expect(prisma._txMock.customerPayment.create).toHaveBeenCalled();
    expect(prisma._txMock.customerInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "i1" },
        data: expect.objectContaining({ paid: expect.anything(), status: "PARTIAL" }),
      }),
    );
    expect(prisma._txMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { outstanding: { decrement: expect.anything() } } }),
    );
  });

});


describe("PaymentsService (supplier)", () => {
  function makePrisma() {
    const txMock = {
      supplierPayment: { create: jest.fn() },
      supplierInvoice: { findUnique: jest.fn(), update: jest.fn() },
      supplier: { update: jest.fn() },
    };
    const tx = jest.fn(async (cb) => cb(txMock));
    return {
      supplier: { findUnique: jest.fn(), update: jest.fn() },
      supplierInvoice: { findUnique: jest.fn(), update: jest.fn() },
      supplierPayment: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn() },
      $transaction: tx,
      _txMock: txMock,
    } as any;
  }

  it("rejects missing supplierId", async () => {
    const prisma = makePrisma();
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createSupplierPayment("B1", { supplierId: "", date: "2025-01-01", amount: 100, method: "BANK", applications: [] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when supplier belongs to another book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "OTHER" });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createSupplierPayment("B1", { supplierId: "s1", date: "2025-01-01", amount: 100, method: "BANK", applications: [] } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects when applications do not sum to amount", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createSupplierPayment("B1", {
        supplierId: "s1",
        date: "2025-01-01",
        amount: 200,
        method: "BANK",
        applications: [{ invoiceId: "i1", amount: 100 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects bill application in the wrong book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.supplierInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "OTHER", number: "BIL-1", total: 100, paid: 0 });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createSupplierPayment("B1", {
        supplierId: "s1",
        date: "2025-01-01",
        amount: 50,
        method: "BANK",
        applications: [{ invoiceId: "i1", amount: 50 }],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects duplicate bill id in the same supplier payment", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.supplierInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "B1", number: "BIL-1", total: 200, paid: 0 });
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(
      svc.createSupplierPayment("B1", {
        supplierId: "s1",
        date: "2025-01-01",
        amount: 100,
        method: "BANK",
        applications: [{ invoiceId: "i1", amount: 50 }, { invoiceId: "i1", amount: 50 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

    it("creates a supplier payment and posts GL (best-effort)", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.supplierInvoice.findUnique
      .mockResolvedValueOnce({ id: "i1", accountBookId: "B1", number: "BIL-1", total: 100, paid: 0 })
      .mockResolvedValueOnce({ id: "i1", accountBookId: "B1", total: 100, paid: 0, status: "ISSUED" });
    prisma._txMock.supplierPayment.create.mockResolvedValue({ id: "p1", number: "PAY-00001" });
    prisma.supplierPayment.findUnique.mockResolvedValue({ id: "p1" });
    const posting = makePosting();
    const svc = new PaymentsService(prisma, makeSeq(), posting);
    await svc.createSupplierPayment("B1", {
      supplierId: "s1",
      date: "2025-01-01",
      amount: 100,
      method: "EFT",
      applications: [{ invoiceId: "i1", amount: 100 }],
    } as never);
    expect(prisma._txMock.supplierPayment.create).toHaveBeenCalled();
    expect(posting.postSupplierPayment).toHaveBeenCalledWith("p1");
  });

  it("does not throw if GL posting fails (logs warning)", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.supplierInvoice.findUnique.mockResolvedValueOnce({ id: "i1", accountBookId: "B1", number: "BIL-1", total: 50, paid: 0 });
    prisma._txMock.supplierPayment.create.mockResolvedValue({ id: "p1", number: "PAY-00001" });
    prisma._txMock.supplierInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "B1", total: 50, paid: 0, status: "ISSUED" });
    prisma.supplierPayment.findUnique.mockResolvedValue({ id: "p1" });
    const posting = { postSupplierPayment: jest.fn().mockRejectedValue(new Error("GL down")) } as any;
    const svc = new PaymentsService(prisma, makeSeq(), posting);
    await expect(
      svc.createSupplierPayment("B1", {
        supplierId: "s1",
        date: "2025-01-01",
        amount: 50,
        method: "CASH",
        applications: [{ invoiceId: "i1", amount: 50 }],
      } as never),
    ).resolves.toBeDefined();
  });

  it("listSupplierPaymentsByBill filters by billId via applications.some", async () => {
    const prisma = makePrisma();
    prisma.supplierPayment.findMany.mockResolvedValue([{ id: "p2", number: "PAY-00002", applications: [{ invoiceId: "b1", amount: 50 }] }]);
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    const res = await svc.listSupplierPaymentsByBill("b1");
    expect(res[0].number).toBe("PAY-00002");
    expect(prisma.supplierPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { applications: { some: { invoiceId: "b1" } } } }),
    );
  });


  it("getSupplierPayment(id) returns the payment with applications", async () => {
    const prisma = makePrisma();
    const full = { id: "p2", number: "PAY-1", applications: [{ id: "a1", invoiceId: "b1", amount: 50 }] };
    prisma.supplierPayment.findUnique.mockResolvedValue(full);
    const svc = new PaymentsService(prisma, makeSeq(), makePosting());
    await expect(svc.getSupplierPayment("p2")).resolves.toEqual(full);
  });

});
