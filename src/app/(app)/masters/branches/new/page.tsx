import BranchFormClient from "@/components/branches/BranchFormClient";
import { requirePageRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageRole("HO_ADMIN");
  return (
    <BranchFormClient
      mode="create"
      initialValues={{ name: "", branchCode: "", status: "active" }}
      title="Create Branch"
      description="Create the HO branch master row. Keep it to the BRD core fields only."
      submitLabel="Create Branch"
      successRedirect="/masters/branches/[id]"
    />
  );
}