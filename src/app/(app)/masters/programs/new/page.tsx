import ProgramFormClient from "@/components/programs/ProgramFormClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <ProgramFormClient
      mode="create"
      initialValues={{ name: "", code: "", status: "active" }}
      title="Create Program"
      description="Create the HO program master first. You can bind attributes from the dedicated Attributes page after save."
      submitLabel="Create Program"
      successRedirect="/masters/programs/[id]/attributes"
    />
  );
}