import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== CURRENT SELLER ASSIGNMENTS ===");
  const assignments = await prisma.sellerAssignment.findMany({
    include: {
      seller: { select: { name: true } },
      program: { select: { name: true } },
      exec: { select: { fullName: true } },
    }
  });
  for (const a of assignments) {
    console.log(`Seller: ${a.seller.name}, Program: ${a.program?.name ?? "N/A"}, Exec: ${a.exec.fullName}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
