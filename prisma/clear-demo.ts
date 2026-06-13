import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🧹 Cleaning database: removing all demo / dummy data…\n");

  try {
    // Delete transactional and child tables first
    await prisma.sticker.deleteMany();
    console.log("✓ Deleted stickers");

    await prisma.productCopy.deleteMany();
    console.log("✓ Deleted product copies");

    await prisma.localMedia.deleteMany();
    await prisma.localOverride.deleteMany();
    await prisma.localOnboardingRecord.deleteMany();
    console.log("✓ Deleted local onboarding records, media, and overrides");

    await prisma.qcRecord.deleteMany();
    await prisma.consignmentItem.deleteMany();
    await prisma.consignment.deleteMany();
    console.log("✓ Deleted consignments, items, and QC records");

    await prisma.sellerAssignment.deleteMany();
    await prisma.sellerContract.deleteMany();
    await prisma.sellerBrand.deleteMany();
    await prisma.seller.deleteMany();
    console.log("✓ Deleted sellers, contracts, assignments, and brands mapping");

    await prisma.sampleSize.deleteMany();
    await prisma.screen.deleteMany();
    await prisma.locationNode.deleteMany();
    console.log("✓ Deleted location nodes, screens, and sample sizes");

    await prisma.branchBrand.deleteMany();
    await prisma.branchProgram.deleteMany();
    console.log("✓ Deleted branch brand and program linkages");

    await prisma.stickerTemplate.deleteMany();
    console.log("✓ Deleted sticker templates");

    await prisma.programCommonAttribute.deleteMany();
    await prisma.programDefinitionAttribute.deleteMany();
    await prisma.program.deleteMany();
    console.log("✓ Deleted programs and attribute definitions");

    await prisma.brandCategory.deleteMany();
    await prisma.productAttributeValue.deleteMany();
    await prisma.productMedia.deleteMany();
    await prisma.brandProduct.deleteMany();
    await prisma.brand.deleteMany();
    console.log("✓ Deleted brand products, SKUs, and brand records");



    await prisma.media.deleteMany();
    console.log("✓ Deleted uploaded media files");

    await prisma.auditLog.deleteMany();
    await prisma.changeRequest.deleteMany();
    await prisma.notification.deleteMany();
    console.log("✓ Deleted audit logs, change requests, and notifications");

    // Clean up users and roles, keeping only HO_ADMIN users
    const hoRole = await prisma.role.findUnique({ where: { code: "HO_ADMIN" } });
    if (hoRole) {
      const hoAdminUserRoles = await prisma.userRole.findMany({
        where: { roleId: hoRole.id, branchId: null },
        select: { userId: true },
      });
      const hoAdminUserIds = hoAdminUserRoles.map((ur) => ur.userId);

      // Delete user roles not belonging to global HO Admins
      await prisma.userRole.deleteMany({
        where: { NOT: { userId: { in: hoAdminUserIds } } },
      });

      // Delete users not belonging to global HO Admins
      await prisma.user.deleteMany({
        where: { NOT: { id: { in: hoAdminUserIds } } },
      });
    } else {
      await prisma.userRole.deleteMany();
      await prisma.user.deleteMany();
    }
    console.log("✓ Deleted branch users & roles (kept HO Admin)");

    // Delete all branches
    await prisma.branch.deleteMany();
    console.log("✓ Deleted all branches");

    console.log("\n✨ Database cleared successfully! Ready for a fresh configuration.");
  } catch (error) {
    console.error("❌ Error during database cleaning:", error);
    process.exit(1);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
