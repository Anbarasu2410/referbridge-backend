import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const otpService = {
  async sendPasswordResetOTP(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal if email exists or not
    if (!user) return { message: 'If this email exists, an OTP has been sent' };

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in refresh_tokens table reusing it as OTP store
    // Delete any existing OTP for this user first
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, token: { startsWith: 'OTP_' } },
    });

    await prisma.refreshToken.create({
      data: {
        token: `OTP_${otp}`,
        userId: user.id,
        expiresAt,
      },
    });

    // Send email
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'ReferBridge <onboarding@resend.dev>',
      to: email,
      subject: 'ReferBridge - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #6366F1;">ReferBridge</h2>
          <p>Your password reset OTP is:</p>
          <h1 style="color: #6366F1; font-size: 48px; letter-spacing: 8px;">${otp}</h1>
          <p>This OTP expires in <strong>10 minutes</strong>.</p>
          <p>If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    return { message: 'If this email exists, an OTP has been sent' };
  },

  async verifyOTPAndResetPassword(email: string, otp: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid OTP', 400);

    const otpRecord = await prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        token: `OTP_${otp}`,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) throw new AppError('Invalid or expired OTP', 400);

    // Hash new password
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and delete OTP
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.delete({ where: { id: otpRecord.id } }),
    ]);

    return { message: 'Password reset successfully' };
  },
};
