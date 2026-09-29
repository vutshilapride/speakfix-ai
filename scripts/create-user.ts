/**
 * Creates (or updates) a user in the database with a properly hashed password.
 * Roles: USER | TECHNICIAN | ADMIN
 *
 * Examples:
 *   bun scripts/create-user.ts --name "Site Admin" --email admin@speakfix.ai --password 'Admin@Fix2026' --role ADMIN
 *   bun scripts/create-user.ts --name "Sipho Ndlovu" --email tech@speakfix.ai --password 'Tech@Fix2026' --role TECHNICIAN
 *
 * If the email already exists the user is UPDATED (name, role, password) —
 * so re-running the command with a new password is also how you reset one.
 *
 * Run: bun scripts/create-user.ts   (or: npx tsx scripts/create-user.ts)
 */
import { loadEnvOverride } from "./load-env";
loadEnvOverride();
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const ROLES = ["USER", "TECHNICIAN", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

/** Same hashing as the app (src/lib/auth.ts): scrypt, "salt:hash" hex format. */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(`--${flag}`);
    if (i === -1) return undefined;
    const v = args[i + 1];
    if (!v || v.startsWith("--")) return undefined;
    return v;
  };
  return {
    name: get("name"),
    email: get("email"),
    password: get("password"),
    role: (get("role") ?? "USER").toUpperCase(),
    language: get("language") ?? "English",
  };
}

async function main() {
  const { name, email, password, role, language } = parseArgs();

  if (!name || !email || !password) {
    console.error(
      [
        "Usage:",
        '  bun scripts/create-user.ts --name "Full Name" --email you@example.com --password Secret123 --role ADMIN',
        "",
        "Options:",
        "  --role       USER (default) | TECHNICIAN | ADMIN",
        '  --language   preferred language, default "English"',
      ].join("\n")
    );
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`✗ Invalid email: ${email}`);
    process.exit(1);
  }
  if (!(ROLES as readonly string[]).includes(role)) {
    console.error(`✗ Invalid role "${role}". Use one of: ${ROLES.join(" | ")}`);
    process.exit(1);
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    console.error("✗ Password must be at least 8 characters and contain at least one letter and one number.");
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      const updated = await db.user.update({
        where: { email },
        data: { name, passwordHash: hashPassword(password), role, preferredLanguage: language },
      });
      console.log(`✓ Updated existing user ${updated.email} → role ${updated.role} (password reset).`);
    } else {
      const created = await db.user.create({
        data: { name, email, passwordHash: hashPassword(password), role, preferredLanguage: language },
      });
      console.log(`✓ Created user ${created.email} (name "${created.name}", role ${created.role}).`);
    }
    console.log("They can log in immediately — the role takes effect on their next login.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
