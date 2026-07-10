import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BankAccountsService } from "./bank-accounts.service";

describe("BankAccountsService", () => {
  function makePrisma() {
    return {
      bankAccount: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      account: { findUnique: jest.fn() },
    } as any;
  }

  it("rejects duplicate name within book", async () => {
    const prisma = makePrisma();
    prisma.bankAccount.findUnique.mockResolvedValue({ id: "b1", name: "Main" });
    const svc = new BankAccountsService(prisma);
    await expect(svc.create("B1", { name: "Main" } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unknown GL account code", async () => {
    const prisma = makePrisma();
    prisma.bankAccount.findUnique.mockResolvedValue(null);
    prisma.account.findUnique.mockResolvedValue(null);
    const svc = new BankAccountsService(prisma);
    await expect(svc.create("B1", { name: "Petty", glAccountCode: "9999" } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws when removing missing", async () => {
    const prisma = makePrisma();
    prisma.bankAccount.findUnique.mockResolvedValue(null);
    const svc = new BankAccountsService(prisma);
    await expect(svc.remove("x")).rejects.toBeInstanceOf(NotFoundException);
  });
});
