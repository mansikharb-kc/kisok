import { prisma, serialize } from "./src/lib/prisma";

async function main() {
  // Find branchId of KC Bangalore
  const branch = await prisma.branch.findFirst({
    where: { name: "KC Bangalore" }
  });
  if (!branch) {
    console.log("Branch not found");
    return;
  }
  const branchId = branch.id;
  console.log("KC Bangalore branch ID:", String(branchId));

  const execRows = await prisma.user.findMany({
    where: {
      status: "active",
      roles: {
        some: {
          role: { code: "OB_EXEC" },
          branchId,
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: { fullName: "asc" },
  });

  console.log("QUERY RESULT:", JSON.stringify(execRows, (key, val) => {
    return typeof val === "bigint" ? String(val) : val;
  }, 2));
}

main().catch(err => {
  console.error(err);
});
