/**
 * Lists all users (email, role, name) with their ticket counts.
 * Run: bun scripts/list-users.ts
 */
import { loadEnvOverride } from "./load-env";
loadEnvOverride();
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { tickets: true, assignedTickets: true } },
    },
    orderBy: { email: "asc" },
  });
  console.table(
    users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      reported: u._count.tickets,
      assigned: u._count.assignedTickets,
      created: u.createdAt.toISOString().slice(0, 10),
    }))
  );
  console.log(`Total: ${users.length} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
