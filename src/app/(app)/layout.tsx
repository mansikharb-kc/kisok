import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { navForRoles, ROLE_LABELS, RoleCode } from "@/lib/rbac";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const nav = navForRoles(session.roles);
  const roleLabels = session.roles.map((r) => ROLE_LABELS[r.code as RoleCode] ?? r.code);

  return (
    <div className="flex min-h-screen">
      <Sidebar nav={nav} user={{ name: session.name, roleLabels }} />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
