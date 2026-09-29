# SpeakFix AI

Voice-first maintenance reporting. Instead of filling out forms, users simply **speak** to Iris - an AI voice agent that asks smart follow-up questions, files a structured ticket, and later verifies with the reporter that the problem is *actually* fixed.

**Roles:** Reporter (reports by voice, tracks tickets, confirms/reopens fixes) · Maintenance (works a queue, submits resolution + evidence) · Admin (sees everything + insights dashboard).

## Tech stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS 4** + shadcn/ui
- **Prisma ORM** on **PostgreSQL** (Neon serverless)
- **Z.ai GLM** for the voice agent (chat) and speech-to-text
- Custom auth (bcrypt + DB sessions, HTTP-only cookies)

## Run locally

```bash
npm install
cp .env.example .env   # then fill in your credentials
npm run dev            # http://localhost:3000
```

## Deploy

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — step-by-step from zip to a live Vercel app, including how to create admin/maintenance users and clean demo data.
