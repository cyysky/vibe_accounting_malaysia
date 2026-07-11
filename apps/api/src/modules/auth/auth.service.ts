import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
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
    return this.toAuthUser(u);
  }

  async listUsers(): Promise<AuthUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map((u) => this.toAuthUser(u));
  }

  async getUser(id: string): Promise<AuthUser> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return this.toAuthUser(u);
  }

  async createUser(input: { email: string; name: string; password: string; role: Role; accountBookId?: string }): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictException('A user with that email already exists');
    const passwordHash = await bcrypt.hash(input.password, 10);
    const u = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        role: input.role,
        accountBookId: input.accountBookId || null,
      },
    });
    return this.toAuthUser(u);
  }

  async updateUser(id: string, dto: { name?: string; role?: Role; active?: boolean }): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    const u = await this.prisma.user.update({ where: { id }, data });
    return this.toAuthUser(u);
  }

  async deleteUser(currentUserId: string, id: string): Promise<{ ok: true }> {
    if (id === currentUserId) throw new BadRequestException('You cannot delete your own account');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  private toAuthUser(u: {
    id: string;
    email: string;
    name: string;
    role: Role;
    accountBookId: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date | null;
  }): AuthUser {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      accountBookId: u.accountBookId ?? undefined,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    } as AuthUser;
  }
}
