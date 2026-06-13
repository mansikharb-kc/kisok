import BranchFormClient from "@/components/branches/BranchFormClient";

export const dynamic = "force-dynamic";

export default function Page() {
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