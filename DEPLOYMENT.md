# SpeakFix AI — Deployment Guide

From the downloaded zip to a live app on Vercel. Follow the steps in order.

**Time needed:** ~30–40 minutes (most of it is account setup the first time).

---

## What you need before starting

| Account | Where | Why |
|---|---|---|
| GitHub | [github.com](https://github.com) | Hosts the code; Vercel deploys from it |
| Vercel | [vercel.com](https://vercel.com) | Hosts the app (free Hobby plan is enough) |
| Neon (already yours) | [neon.tech](https://neon.tech) | Your PostgreSQL database — already set up, credentials are inside this zip's `.env` |
| Z.ai API key | [z.ai](https://z.ai) | Powers the Iris voice agent + voice transcription. **Without it:** sign up, log in, and tickets still work, but the AI chat/voice features will show an error |

> **Node.js 20 or newer** is required on your machine for local commands — download the LTS from [nodejs.org](https://nodejs.org).

---

## Step 1 — Unzip the project

1. Unzip `speakfix-ai-project.zip` (e.g. to `Desktop/speakfix-ai`).
2. Open a terminal **inside that folder**:
   - **Windows:** open the folder in File Explorer → click the address bar → type `cmd` → Enter
   - **Mac:** right-click the folder → Services → New Terminal at Folder

You should see `package.json` when you run `dir` (Windows) or `ls` (Mac/Linux).

---

## Step 2 — Put the code on GitHub

1. Go to [github.com/new](https://github.com/new):
   - Repository name: `speakfix-ai`
   - Visibility: **Private** (recommended)
   - Do **not** add a README or .gitignore (they're already in the project)
   - Click **Create repository**
2. Back in your terminal, run these commands one by one:

```bash
git init
git add .
git commit -m "SpeakFix AI - voice-first maintenance reporting"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/speakfix-ai.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. GitHub shows these exact commands on the repo page after creation — you can copy them from there too.

> The `.env` file is **not** uploaded (it's in `.gitignore`) — that's intentional and safe.

---

## Step 3 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign Up / Log In with GitHub** (this connects the two accounts).
2. Click **Add New → Project**.
3. Find `speakfix-ai` in the list → click **Import**.
4. On the configuration page, Vercel auto-detects **Next.js** — leave Build Command, Output Directory, and Install Command untouched.
5. Open **Environment Variables** and add these three:

| Name | Value |
|---|---|
| `DATABASE_URL` | Copy from your `.env` file (the `postgresql://...pooler...` line) |
| `DIRECT_DATABASE_URL` | Copy from your `.env` file (the `postgresql://...` line without `pooler`) |
| `ZAI_API_KEY` | Your Z.ai API key |

> Tip: open the `.env` file from the unzipped folder in Notepad/TextEdit and copy each value exactly, quotes not included.

6. Click **Deploy** and wait ~2–3 minutes.
7. When it finishes, Vercel gives you a live URL like `https://speakfix-ai.vercel.app` — that's your app! 🎉

---

## Step 4 — Verify everything works

Open your live URL and check:

- [ ] Landing page loads with the hero and chat mockup
- [ ] Click **Sign Up** → it goes to the signup page → fill the form (confirm password must match) → account is created and you land in the app
- [ ] Log out → **Log In** with the same email/password → you land in the app
- [ ] In the app, talk to Iris (voice agent) — she should reply (this confirms `ZAI_API_KEY` works)
- [ ] Create a ticket by voice or text → it appears under **My Tickets**

If something fails, see **Troubleshooting** at the bottom.

---

## Step 5 — Your Admin & Technician accounts

Your database **already includes** an admin and a technician account (created with properly hashed passwords):

| Email | Name | Role | What they see in the app |
|---|---|---|---|
| `admin@speakfix.ai` | Admin User | `ADMIN` | Report a problem, My Tickets, Maintenance Queue, **All Tickets**, **Insights** |
| `tech@speakfix.ai` | Sipho Ndlovu | `TECHNICIAN` | Report a problem, My Tickets, **Maintenance Queue** |

The default passwords were shared with you when the zip was delivered — **change them after your first login** (see below). Because your Neon database is shared between local dev and the live app, these accounts work on your deployed site immediately.

**Change a password** — from the project folder, re-run the create command with a new password (this updates the existing account, it doesn't duplicate it):

```bash
npx tsx scripts/create-user.ts --name "Admin User" --email admin@speakfix.ai --password 'YourNewPassword1' --role ADMIN
```

**Add more admins / technicians** — same command with a new email:

```bash
# another maintenance technician
npx tsx scripts/create-user.ts --name "Thandi Mkhize" --email thandi@speakfix.ai --password 'TheirPassword1' --role TECHNICIAN

# another admin
npx tsx scripts/create-user.ts --name "Ops Manager" --email ops@speakfix.ai --password 'TheirPassword1' --role ADMIN
```

> Alternative without the terminal: sign up normally through the app (gets the `USER` role), then promote them in the Neon **SQL Editor**:
>
> ```sql
> UPDATE "User" SET role = 'ADMIN' WHERE email = 'person@example.com';
> UPDATE "User" SET role = 'TECHNICIAN' WHERE email = 'person2@example.com';
> ```
>
> That person logs out and back in for the new role to take effect.

**To see all current users** — Neon SQL Editor:

```sql
SELECT email, name, role FROM "User" ORDER BY email;
```

---

## Step 6 — (Optional) Clean the leftover test data

The database still contains test users and demo tickets from development. For a completely fresh start:

**Remove the test user accounts** (Neon SQL Editor):

```sql
DELETE FROM "User" WHERE email IN ('customer@test.com', 'lerato@example.com', 'thabo@example.com');
```

**Delete ALL tickets and history** (fresh slate — cannot be undone): from the project folder on your computer run:

```bash
npm install
npx tsx scripts/cleanup-demo-data.ts --with-tickets
```

(That deletes every ticket + audit entry. Sign-ups and users are untouched.)

**Just list users** anytime:

```bash
npx tsx scripts/list-users.ts
```

---

## How the pieces fit together

```
GitHub (code) ──> Vercel (runs the app) ──> Neon (database)
                        └──> Z.ai API (Iris voice agent + transcription)
```

- Vercel rebuilds + redeploys automatically every time you `git push`
- Your Neon database is shared by local dev AND the live app — data you create locally shows up live (and vice versa)
- Environment variables live in Vercel → Project → Settings → Environment Variables

---

## The verified-resolution workflow (report → assign → fix → confirm)

Every ticket moves through a controlled lifecycle, and **every step is recorded in an immutable audit trail** visible in the ticket's History:

1. **Customer reports** a problem (voice or text, via Iris) → ticket is created
2. **Admin assigns** a technician (open ticket → **pick a technician from the dropdown → press Assign**) — nothing happens on selection alone, so an accidental tap can't reassign a job
3. **Technician starts work** → status becomes IN PROGRESS
4. **Technician records the resolution** — what was fixed, test/result, notes and **evidence** (photo / checklist / replacement part / note / voice note) → *Submit for verification*
5. **Customer confirms** ("Confirm repair — it's working") → RESOLVED, or says **Still broken** → the ticket is REOPENED and the technician does the work again

**Evidence can now be a real file, not just a description.** For **photo**, **replacement part** and **voice note** evidence:

- Pressing **Add** (or **Choose file**) opens your device's file picker — pick a photo (JPG/PNG/WebP, or a PDF for part invoices) or an audio clip, up to **8 MB**. Big photos are shrunk in the browser before uploading so they're fast on mobile data
- The picked file shows a preview with its name and size; the label is optional (it defaults to the file name) and can be edited before attaching
- Attached files appear as **thumbnail chips** in the evidence list — click one to open the full file in a new tab. Only the ticket's reporter, the assigned technician and admins can open an evidence file
- Files are stored **inside your Neon database** (no external bucket to set up) and are linked to the ticket when the resolution is submitted
- **Checklist** and **note** evidence stay text-only — type a short description and press **Add**

**Adding evidence** works at two points:

- **While filling in the resolution form** — evidence items are listed as drafts (with a count in the label) and are saved together with the resolution when you press *Submit for verification*
- **After submitting** — while the ticket is *awaiting the reporter's confirmation*, the assigned technician still sees an **Add evidence** box in the ticket's Resolution section. Anything added there is **saved to the ticket immediately** (with its own audit entry) — handy when you realise you forgot to attach something
- Pressing **Add** on a text-only type with an empty description shows a clear "Type a short description first" hint (in the user's language), and the evidence row is properly stacked on phones so the fields are easy to use

---

## Multilingual — 5 fully-working languages + Iris learns the rest

Each user picks a **preferred language** at sign-up (or later in Profile). Everything they see follows it — instantly:

- The whole app interface (tabs, dashboards, tickets, forms) is translated, and **Iris the voice agent chats in that language** — greeting, questions, confirmations (title/description are captured in the user's language; category & priority stay as system codes so filters keep working)
- **Voice output (text-to-speech) and speech recognition** use the matching language voice/dialect
- Changing the language in Profile switches the interface live — no reload needed

**Selectable languages: English, Afrikaans, French, Portuguese, Swahili.** These are the languages where the whole pipeline genuinely works — accurate AI conversation **and** a browser speech voice.

### Iris learns the other South African languages from your users

The remaining languages (isiZulu, isiXhosa, Xitsonga, Sesotho, Setswana, Sepedi, siSwati, Tshivenda, isiNdebele) are **not selectable** yet — the AI model garbles them and no mainstream browser ships voices for them. Instead, **Iris learns them one phrase at a time**:

- After a ticket is filed, Iris asks: *"Would you like to chat with me for a bit, or report another problem?"* — the user can enter **free talk** (a friendly, Jarvis-style conversation)
- In free talk, Iris asks to be **taught phrases** in the user's home language ("Molo means hello", "nyhontso yi leha = the tap is leaking")
- Taught phrases are stored in the **`LearnedPhrase`** table (shared across all users — the community's notebook) and injected into Iris's prompts, so she gradually speaks more of each language
- Iris never forgets her purpose in free talk: mention anything broken and she offers to file a ticket, switching straight back into reporting mode
- Everything she's learned is visible in the **language notebook** panel during free talk

---

## Troubleshooting

| Problem | Likely cause & fix |
|---|---|
| Deploy fails on Vercel | Open the build log (Deployments → click the failed run). Most common: a missing env var name typo |
| "Log In" returns an error / spins forever | `DATABASE_URL` missing or wrong in Vercel env vars — re-copy it from `.env` |
| Signup works but login fails with wrong password | Same as above, or you're testing a password you typo'd — use Neon SQL: `SELECT email FROM "User";` to confirm the account exists |
| Attaching an evidence file fails, or `EvidenceFile` errors appear | Your database predates the evidence-file feature — from the project folder run `npx prisma db push` to create the missing table (safe, no data loss) |
| Iris the voice agent doesn't reply / transcription fails | `ZAI_API_KEY` missing or invalid in Vercel env vars |
| Everything worked yesterday, broken today | Neon free tier pauses inactive databases after ~a while — open the Neon dashboard and it wakes up. Or check Vercel → Deployments → Runtime Logs |
| Need to see server errors | Vercel → your project → Deployments (latest) → **Runtime Logs** (or **Building/Execution Logs** for build errors) |
| Changed env vars but nothing happened | Environment variable changes need a **redeploy**: Deployments → latest → ⋯ → Redeploy |

---

## Quick reference — files in this zip

| Path | What it is |
|---|---|
| `src/` | The application (landing page, auth pages, app dashboard, voice agent, API routes) |
| `prisma/schema.prisma` | Database schema (User, Ticket, Session, AuditEntry, LearnedPhrase, EvidenceFile) |
| `.env` | Your Neon credentials — **keep private**, needed for Vercel setup |
| `.env.example` | Template documenting every env var |
| `scripts/` | DB utilities: `create-user.ts` (add users / reset passwords), `list-users.ts`, `cleanup-demo-data.ts` |
| `public/hero-character.png` | Landing page illustration |
