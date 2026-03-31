import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../plugins/errorHandler.js';
import crypto from 'node:crypto';

export async function createUser({ name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
    },
  });

  const tokens = generateTokens(user);

  // Store refresh token hash
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return { user, ...tokens };
}

export async function authenticateUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      passwordHash: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const { passwordHash, deletedAt, ...userData } = user;
  const tokens = generateTokens(userData);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return { user: userData, ...tokens };
}

export async function refreshTokens(currentRefreshToken) {
  if (!currentRefreshToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'No refresh token provided');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(currentRefreshToken);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      refreshToken: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }

  // Verify token matches stored token (rotation)
  if (user.refreshToken !== currentRefreshToken) {
    // Possible token reuse attack — invalidate all tokens
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });
    throw new AppError(401, 'UNAUTHORIZED', 'Token has been revoked');
  }

  const { refreshToken: _, deletedAt: __, ...userData } = user;
  const tokens = generateTokens(userData);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return { user: userData, ...tokens };
}

export async function logoutUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

export async function generateResetToken(email) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success (security: don't reveal if email exists)
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: tokenHash,
      resetTokenExpiry: expiry,
    },
  });

  return { token, userId: user.id };
}

export async function resetPassword({ token, newPassword }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'Reset token is invalid or has expired');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
      refreshToken: null, // Invalidate all sessions
    },
  });
}

function generateTokens(user) {
  const payload = { id: user.id, email: user.email, plan: user.plan };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken };
}
