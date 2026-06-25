import { prisma } from "@/lib/prisma";

export async function updateAssignmentOnboardingStatus(assignmentId: bigint, tx?: any) {
  const db = tx || prisma;

  // Retrieve assignment with its seller brands, pipelines, and flags
  const assignment = await db.sellerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      seller: {
        include: {
          sellerBrands: true,
        },
      },
      pipelines: {
        include: {
          flags: true,
        },
      },
    },
  });

  if (!assignment) return;

  const sellerBrands = assignment.seller.sellerBrands;
  const pipelines = assignment.pipelines;

  // 1. Check for unresolved flags
  const hasUnresolvedFlags = pipelines.some((p: any) =>
    p.flags.some((f: any) => !f.isResolved)
  );

  if (hasUnresolvedFlags) {
    await db.sellerAssignment.update({
      where: { id: assignmentId },
      data: { onboardingStatus: "on_hold" },
    });
    return;
  }

  // 2. Check if all seller brands' pipelines are CLOSED
  const hasBrands = sellerBrands.length > 0;
  const allBrandsClosed =
    hasBrands &&
    sellerBrands.every((sb: any) => {
      const p = pipelines.find((pipe: any) => pipe.brandId === sb.brandId);
      return p && p.status === "CLOSED";
    });

  if (allBrandsClosed) {
    if (assignment.onboardingStatus !== "onboarded") {
      await db.sellerAssignment.update({
        where: { id: assignmentId },
        data: { onboardingStatus: "onboarded" },
      });

      const contract = await db.sellerContract.findFirst({
        where: {
          sellerId: assignment.sellerId,
          programId: assignment.programId,
        },
      });

      if (contract && contract.contractStart && contract.fitoutPeriod) {
        const fitoutPeriodDays = parseInt(contract.fitoutPeriod.replace(/\D/g, ""), 10);
        if (fitoutPeriodDays > 0) {
          const start = new Date(contract.contractStart);
          const fitoutEnd = new Date(start);
          fitoutEnd.setDate(start.getDate() - 1);

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          fitoutEnd.setHours(0, 0, 0, 0);

          if (today > fitoutEnd) {
            const todayDb = new Date(today);
            let newEnd = null;
            if (contract.collaborationTenure) {
              const tenureDays = parseInt(contract.collaborationTenure.replace(/\D/g, ""), 10);
              if (!isNaN(tenureDays) && tenureDays > 0) {
                newEnd = new Date(todayDb);
                newEnd.setDate(todayDb.getDate() + tenureDays - 1);
              }
            }

            await db.sellerContract.update({
              where: { id: contract.id },
              data: {
                contractStart: todayDb,
                contractEnd: newEnd,
                remarks: (contract.remarks ? contract.remarks + "\n" : "") + `Collaboration start shifted to ${todayDb.toISOString().slice(0, 10)} due to extended fitout.`,
              },
            });
          }
        }
      }
    }
    return;
  }

  // 3. Check if onboarding has been initiated
  const isAnyInitiated = pipelines.some((p: any) => p.status !== "INITIATION");

  if (isAnyInitiated) {
    await db.sellerAssignment.update({
      where: { id: assignmentId },
      data: { onboardingStatus: "in_progress" },
    });
    return;
  }

  // 4. Default: Yet to start
  await db.sellerAssignment.update({
    where: { id: assignmentId },
    data: { onboardingStatus: "yet_to_start" },
  });
}
