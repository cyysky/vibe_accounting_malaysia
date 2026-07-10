import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';
const makeSeq = () => ({ next: jest.fn().mockResolvedValue('TEST-00001') }) as any;


describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') } as unknown as JwtService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    service = new AuthService(prisma as never, jwt);
  });

  it('throws on unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@y.z', password: 'pw12345' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws on wrong password', async () => {
    const hash = await bcrypt.hash('right', 4);
    prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.c', name: 'A', role: 'OWNER', passwordHash: hash, accountBookId: 'ab', active: true });
    await expect(service.login({ email: 'a@b.c', password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns tokens on correct credentials', async () => {
    const hash = await bcrypt.hash('right', 4);
    prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.c', name: 'A', role: 'OWNER', passwordHash: hash, accountBookId: 'ab', active: true });
    const res = await service.login({ email: 'a@b.c', password: 'right' });
    expect(res.accessToken).toBe('signed-token');
    expect(res.refreshToken).toBe('signed-token');
    expect(res.user.email).toBe('a@b.c');
  });
});
