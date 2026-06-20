/**
 * Integration + unit tests that run without a database, so CI stays fast and
 * infra-free. DB-backed endpoints are covered by the seed + manual/e2e runs.
 */
import { beforeAll, describe, expect, it } from 'vitest';

// Provide required config before any app module is imported.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://ttmip:ttmip@localhost:5432/ttmip';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

// Imported dynamically *after* env is set.
let request: typeof import('supertest').default;
let app: import('express').Express;

beforeAll(async () => {
  request = (await import('supertest')).default;
  const { createApp } = await import('../src/app.js');
  app = createApp();
});

describe('health', () => {
  it('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown API route returns a 404 error envelope', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects invalid registration payloads with 400', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('crypto utils', () => {
  it('hashes and verifies passwords', async () => {
    const { hashPassword, verifyPassword } = await import('../src/utils/password.js');
    const hash = await hashPassword('password123');
    expect(hash).not.toBe('password123');
    expect(await verifyPassword('password123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('signs and verifies access tokens', async () => {
    const { signAccessToken, verifyAccessToken } = await import('../src/utils/jwt.js');
    const token = signAccessToken({ sub: 'u1', email: 'a@b.c' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@b.c');
  });
});
