import { Router } from 'express';
import { z } from 'zod';
import { CertType, type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

const DAY = 86_400_000;
const statusLabel: Record<string, string> = {
  ACTIVE: 'Active',
  EXPIRING: 'Expiring',
  EXPIRED: 'Expired',
  NONE: 'No Cert',
};
const typeLabel: Record<CertType, string> = {
  FSC: 'FSC',
  PEFC: 'PEFC',
  BOTH: 'Both',
  NONE: 'None',
};

/** FSC / PEFC certification tracking per concession. */
export const certificatesRouter = Router();

const query = z.object({
  type: z.nativeEnum(CertType).optional(),
  expiring: z.coerce.boolean().optional(),
});

certificatesRouter.get(
  '/',
  validate({ query }),
  asyncHandler(async (req, res) => {
    const { type, expiring } = req.query as unknown as z.infer<typeof query>;
    const where: Prisma.CertificateWhereInput = {
      ...(type ? { type } : {}),
      ...(expiring ? { status: 'EXPIRING' } : {}),
    };

    const certs = await prisma.certificate.findMany({
      where,
      include: { company: true },
      orderBy: { expiresAt: 'asc' },
    });

    const now = Date.now();
    const data = certs.map((c) => ({
      id: c.code,
      name: c.company.name,
      type: typeLabel[c.type],
      issue: c.issuedAt.toISOString().slice(0, 10),
      expiry: c.expiresAt.toISOString().slice(0, 10),
      daysLeft: Math.round((c.expiresAt.getTime() - now) / DAY),
      status: statusLabel[c.status],
    }));
    res.json({ data });
  }),
);
