import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { HttpError } from '../../utils/httpError.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

interface PublicUser {
  id: string;
  email: string;
  name: string;
}

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const toPublic = (u: { id: string; email: string; name: string }): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
});

const issueTokens = (user: PublicUser): AuthResult => ({
  user,
  accessToken: signAccessToken({ sub: user.id, email: user.email }),
  refreshToken: signRefreshToken(user.id),
});

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw HttpError.conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    },
  });

  return issueTokens(toPublic(user));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Constant-ish behavior: verify even when user missing to avoid leaking existence.
  const ok = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !ok) throw HttpError.unauthorized('Invalid email or password');

  return issueTokens(toPublic(user));
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  const { sub } = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user) throw HttpError.unauthorized('User no longer exists');

  return { accessToken: signAccessToken({ sub: user.id, email: user.email }) };
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.notFound('User not found');
  return toPublic(user);
}
