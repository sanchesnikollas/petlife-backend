import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.js';
import {
  createUser,
  authenticateUser,
  refreshTokens,
  logoutUser,
  generateResetToken,
  resetPassword,
} from '../services/auth.js';
import { sendResetEmail } from '../utils/email.js';
import { AppError } from '../plugins/errorHandler.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export default async function authRoutes(fastify) {
  // POST /auth/register
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const { user, accessToken, refreshToken } = await createUser(parsed.data);

    reply.setCookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return reply.status(201).send({
      data: {
        accessToken,
        refreshToken,
        user,
      },
    });
  });

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const { user, accessToken, refreshToken } = await authenticateUser(parsed.data);

    reply.setCookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return reply.status(200).send({
      data: {
        accessToken,
        refreshToken,
        user,
      },
    });
  });

  // POST /auth/refresh
  fastify.post('/auth/refresh', async (request, reply) => {
    // Accept refresh token from body OR cookie
    const currentToken = request.body?.refreshToken || request.cookies?.refreshToken;

    const { user, accessToken, refreshToken } = await refreshTokens(currentToken);

    reply.setCookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return reply.status(200).send({
      data: {
        accessToken,
        refreshToken,
        user,
      },
    });
  });

  // DELETE /auth/logout
  fastify.delete('/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyAccessToken } = await import('../utils/jwt.js');
        const decoded = verifyAccessToken(authHeader.slice(7));
        await logoutUser(decoded.id);
      } catch {
        // Ignore — token may already be expired
      }
    }

    reply.clearCookie('refreshToken', { path: '/' });

    return reply.status(200).send({
      data: { message: 'Logged out successfully' },
    });
  });

  // POST /auth/forgot
  fastify.post('/auth/forgot', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const result = await generateResetToken(parsed.data.email);

    if (result) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset?token=${result.token}`;

      try {
        await sendResetEmail({ to: parsed.data.email, resetUrl });
      } catch (err) {
        // Log but don't fail — user doesn't need to know
        console.error('Failed to send reset email:', err);
      }
    }

    // Always return 200 for security (don't reveal if email exists)
    return reply.status(200).send({
      data: { message: 'If an account with that email exists, a reset link has been sent.' },
    });
  });

  // POST /auth/reset
  fastify.post('/auth/reset', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    await resetPassword(parsed.data);

    return reply.status(200).send({
      data: { message: 'Password has been reset successfully.' },
    });
  });
}
