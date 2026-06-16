import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function loadEnv() {
  const raw = readFileSync(".env", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const prisma = new PrismaClient();

async function main() {
  const email = "admin@kc.local";
  const password = "Admin@123";

  try {
    console.log("Searching user...");
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: email }
        ]
      },
      include: { roles: { include: { role: true } } },
    });
    console.log("User found:", user);

    if (!user) {
      console.log("User not found!");
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log("Password valid:", valid);
  } catch (error) {
    console.error("Error executing login logic:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
