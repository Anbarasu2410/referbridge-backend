import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError, ConflictError, UnauthorizedError } from '../../utils/AppError';
import type { RegisterInput, LoginInput } from './auth.schema';

const SALT_ROUNDS = 12;

function generateAccessToken(payload: { id: string; email: string; role: UserRole }) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any,
  });
}

function generateRefreshToken(payload: { id: string }) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  });
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user + profile in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          passwordHash,
          role: input.role,
        },
      });

      if (input.role === UserRole.CANDIDATE) {
        await tx.candidate.create({
          data: { userId: newUser.id, fullName: input.fullName },
        });
      } else if (input.role === UserRole.EMPLOYEE || input.role === UserRole.RECRUITER) {
        // Find or create company
        const companyName = (input as any).companyName?.trim() || `${input.fullName}'s Company`;
        let company = await tx.company.findFirst({
          where: { name: { equals: companyName, mode: 'insensitive' } },
        });
        if (!company) {
          company = await tx.company.create({ data: { name: companyName } });
        }

        if (input.role === UserRole.EMPLOYEE) {
          await tx.employee.create({
            data: {
              userId: newUser.id,
              fullName: input.fullName,
              companyId: company.id,
              designation: 'Employee',
            },
          });
        } else {
          await tx.recruiter.create({
            data: {
              userId: newUser.id,
              fullName: input.fullName,
              companyId: company.id,
              designation: 'Recruiter',
            },
          });
        }
      }

      return newUser;
    });

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({ id: user.id });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.isActive) {
      // Same error for both cases — don't reveal if email exists
      throw UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw UnauthorizedError('Invalid email or password');
    }

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({ id: user.id });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  },

  async refreshTokens(token: string) {
    let decoded: { id: string };

    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
    } catch {
      throw UnauthorizedError('Invalid or expired refresh token');
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw UnauthorizedError('Refresh token expired, please login again');
    }

    // Rotate refresh token (security best practice)
    await prisma.refreshToken.delete({ where: { token } });

    const newAccessToken = generateAccessToken({
      id: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });

    const newRefreshToken = generateRefreshToken({ id: storedToken.user.id });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  },
};
