import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import type { AuthResponse, AuthUser, LoginRequest, Role } from '@account/shared';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  accountBookId?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountBookId: user.accountBookId ?? undefined,
    };
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountBookId: user.accountBookId ?? undefined,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken, user: authUser };
  }

  async profile(userId: string): Promise<AuthUser> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      accountBookId: u.accountBookId ?? undefined,
    };
  }
}
