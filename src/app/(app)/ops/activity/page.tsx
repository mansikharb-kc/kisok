import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import ActivityClient from "./ActivityClient";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isExec = hasRole(session.roles, "OB_EXEC");
  const isLead = hasRole(session.roles, "ONB_LEAD");
  if (!isExec && !isLead) redirect("/dashboard");

  const roleEntry =
    session.roles.find((r) => r.code === "OB_EXEC" && r.branchId) ??
    session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // Fetch all reminders
  const reminders = await prisma.reminder.findMany({
    where: {
      pipeline: {
        assignment: {
          seller: {
            branchId,
          },
        },
      },
      // If OB_EXEC, only show their own reminders
      userId: isExec ? BigInt(session.uid) : undefined,
    },
    include: {
      pipeline: {
        include: {
          assignment: {
            include: {
              seller: true,
              program: true,
              exec: {
                select: {
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          brand: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      dateToRevisit: "asc",
    },
  });

  const serializedReminders = serialize(reminders) as any[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity &amp; Reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and manage revisit schedule reminders for onboarding sellers.
        </p>
      </div>
      <ActivityClient initialReminders={serializedReminders} isLead={isLead} />
    </div>
  );
}
