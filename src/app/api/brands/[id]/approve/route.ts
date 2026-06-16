import { ok, fail, handler } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const POST = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole('HO_ADMIN');
  const id = BigInt(ctx.params.id);
  const brand = await prisma.brand.update({
    where: { id },
    data: { approvalStatus: 'approved', status: 'active' },
  }).catch(() => null);
  if (!brand) return fail('Brand not found', 404);
  await writeAudit({
    actorUserId: session.uid,
    action: 'brand.approve',
    entityType: 'Brand',
    entityId: brand.id,
    after: { approvalStatus: brand.approvalStatus, status: brand.status },
  });
  return ok({ brand });
});
