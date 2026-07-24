# Blueboard

A multi-university task and deadline tracker for college blocks (cohorts). Instead of manually inputting deadlines, a Beadle (class representative) pastes a Canvas Calendar (.ics) link, and the app automatically parses and distributes tasks to everyone in the block.

## Tech Stack

- **Frontend:** React + TanStack Start + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS + Edge Functions)
- **Deployment:** Vercel (frontend) + Supabase Cloud (backend)

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
src/              → React frontend
supabase/
  migrations/     → SQL schema, triggers, RLS policies
  functions/      → Supabase Edge Functions (Deno)
```
