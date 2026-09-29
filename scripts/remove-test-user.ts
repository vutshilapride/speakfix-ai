import { loadEnvOverride } from "./load-env";
loadEnvOverride();
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.user.deleteMany({ where: { email: "confirm-test@example.com" } });
  console.log(`Deleted ${r.count} test user(s). Remaining users:`);
  const users = await db.user.findMany({ select: { email: true, role: true }, orderBy: { email: "asc" } });
  users.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
}
main().catch(console.error).finally(() => db.$disconnect());
