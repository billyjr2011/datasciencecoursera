import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

/**
 * Prisma client singleton. In dev, reuse the instance across hot reloads to
 * avoid exhausting the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
