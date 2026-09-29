/**
 * Removes the built-in demo accounts from the database so the deployed app
 * starts clean. Add your own admin / maintenance users manually afterwards
 * (see DEPLOYMENT.md).
 *
 * Deletes ONLY these three demo users (their sessions are wiped too):
 *   admin@speakfix.ai, tech@speakfix.ai, demo@speakfix.ai
 * Tickets they filed/handled are NOT deleted — they become anonymous and
 * unassigned (schema uses onDelete: SetNull).
 *
 * Options:
 *   bun scripts/cleanup-demo-data.ts                → delete demo users
 *   bun scripts/cleanup-demo-data.ts --dry-run      → show what would happen
 *   bun scripts/cleanup-demo-data.ts --with-tickets → ALSO delete ALL tickets
 *                                                    + audit entries (fresh start)
 */
import { loadEnvOverride } from "./load-env";
loadEnvOverride();
import { PrismaClient } from "@prisma/client";

const DEMO_EMAILS = ["admin@speakfix.ai", "tech@speakfix.ai", "demo@speakfix.ai"];

const dryRun = process.argv.includes("--dry-run");
const withTickets = process.argv.includes("--with-tickets");

const db = new PrismaClient();

async function main() {
  const demoUsers = await db.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { email: true, name: true, role: true, id: true },
  });
  const ticketCount = await db.ticket.count();
  const auditCount = await db.auditEntry.count();

  console.log("=== Demo data cleanup ===");
  console.log(`Demo users found: ${demoUsers.length}`);
  demoUsers.forEach((u) => console.log(`  - ${u.email} (${u.role}, ${u.name})`));
  console.log(`Tickets in database: ${ticketCount}`);
  console.log(`Audit entries: ${auditCount}`);
  if (withTickets) console.log("--with-tickets: ALL tickets + audit entries will be deleted too");
  if (dryRun) {
    console.log("\n[dry-run] No changes made. Re-run without --dry-run to apply.");
    return;
  }

  // 1) Delete demo user accounts (sessions + reset tokens cascade automatically)
  const deleted = await db.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
  console.log(`\nDeleted ${deleted.count} demo user(s).`);

  // 2) Optional: purge all tickets for a fresh start
  if (withTickets) {
    await db.auditEntry.deleteMany({});
    const t = await db.ticket.deleteMany({});
    console.log(`Deleted ${t.count} ticket(s) and all audit entries.`);
  }

  // 3) Verify
  const remaining = await db.user.findMany({
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  });
  console.log("\nRemaining users:");
  remaining.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
  console.log(`Tickets remaining: ${await db.ticket.count()}`);
  console.log("\nDone — the database is ready for your own users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
