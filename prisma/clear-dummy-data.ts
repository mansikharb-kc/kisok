import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🧹 Cleaning database: removing dummy data except categories and users…\n");

  try {
    // 1. Tickets & Events
    try {
      await prisma.ticketEvent.deleteMany();
      console.log("✓ Deleted ticket events");
    } catch (e: any) {
      console.log(`info: ticketEvent delete skipped - ${e.message}`);
    }

    try {
      await prisma.ticket.deleteMany();
      console.log("✓ Deleted tickets");
    } catch (e: any) {
      console.log(`info: ticket delete skipped - ${e.message}`);
    }

    // 2. Physical Copies & Stickers
    try {
      await prisma.sticker.deleteMany();
      console.log("✓ Deleted stickers");
    } catch (e: any) {
      console.log(`info: sticker delete skipped - ${e.message}`);
    }

    try {
      await prisma.productCopy.deleteMany();
      console.log("✓ Deleted product copies");
    } catch (e: any) {
      console.log(`info: productCopy delete skipped - ${e.message}`);
    }

    // 3. Onboarding Records & Overrides
    try {
      await prisma.localMedia.deleteMany();
      await prisma.localOverride.deleteMany();
      await prisma.localOnboardingRecord.deleteMany();
      console.log("✓ Deleted local onboarding records, media, and overrides");
    } catch (e: any) {
      console.log(`info: localOnboardingRecord delete skipped - ${e.message}`);
    }

    // 4. Consignments & QC
    try {
      await prisma.qcRecord.deleteMany();
      await prisma.consignmentItem.deleteMany();
      await prisma.consignment.deleteMany();
      console.log("✓ Deleted consignments, items, and QC records");
    } catch (e: any) {
      console.log(`info: consignment/QC delete skipped - ${e.message}`);
    }

    // 4b. Onboarding pipelines, flags & reminders (children of assignments)
    try {
      await prisma.flag.deleteMany();
      await prisma.reminder.deleteMany();
      await prisma.onboardingPipeline.deleteMany();
      console.log("✓ Deleted onboarding pipelines, flags, and reminders");
    } catch (e: any) {
      console.log(`info: pipeline/flag/reminder delete skipped - ${e.message}`);
    }

    // 5. Sellers & Assignments
    try {
      await prisma.sellerAssignment.deleteMany();
      await prisma.sellerContract.deleteMany();
      await prisma.sellerBrand.deleteMany();
      await prisma.seller.deleteMany();
      console.log("✓ Deleted sellers, contracts, assignments, and brands mapping");
    } catch (e: any) {
      console.log(`info: seller delete skipped - ${e.message}`);
    }

    // 6. Location Tree & Screens
    try {
      await prisma.screen.deleteMany();
      await prisma.locationNode.deleteMany();
      await prisma.sampleSize.deleteMany();
      console.log("✓ Deleted location nodes, screens, and sample sizes");
    } catch (e: any) {
      console.log(`info: locationNode delete skipped - ${e.message}`);
    }

    // 7. Branch link structures
    try {
      await prisma.branchBrand.deleteMany();
      await prisma.branchProgram.deleteMany();
      console.log("✓ Deleted branch brand and program linkages");
    } catch (e: any) {
      console.log(`info: branch linkages delete skipped - ${e.message}`);
    }

    // 8. Sticker Templates
    try {
      await prisma.stickerTemplate.deleteMany();
      console.log("✓ Deleted sticker templates");
    } catch (e: any) {
      console.log(`info: stickerTemplate delete skipped - ${e.message}`);
    }

    // 9. Programs
    try {
      await prisma.programCommonAttribute.deleteMany();
      await prisma.programDefinitionAttribute.deleteMany();
      await prisma.program.deleteMany();
      console.log("✓ Deleted programs and attribute definitions");
    } catch (e: any) {
      console.log(`info: program delete skipped - ${e.message}`);
    }

    // 10. Brand Products & SKUs
    try {
      await prisma.brandCategory.deleteMany();
      await prisma.productAttributeValue.deleteMany();
      await prisma.productMedia.deleteMany();
      await prisma.brandProduct.deleteMany();
      await prisma.brand.deleteMany();
      console.log("✓ Deleted brand products, SKUs, and brand records");
    } catch (e: any) {
      console.log(`info: brand/product delete skipped - ${e.message}`);
    }

    // 11. Media
    try {
      await prisma.media.deleteMany();
      console.log("✓ Deleted uploaded media files");
    } catch (e: any) {
      console.log(`info: media delete skipped - ${e.message}`);
    }

    // 12. Audit, Requests, Notifications
    try {
      await prisma.auditLog.deleteMany();
      await prisma.changeRequest.deleteMany();
      await prisma.notification.deleteMany();
      console.log("✓ Deleted audit logs, change requests, and notifications");
    } catch (e: any) {
      console.log(`info: logs delete skipped - ${e.message}`);
    }

    console.log("\n✨ Dummy data cleared successfully! Users, branch, categories, and attributes have been preserved.");
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
