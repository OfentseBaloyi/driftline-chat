# Driftline — a private chat app for you and your friends

A working chat web app with:
- Email/password login (only invited people you tell about it can use it)
- Private 1-on-1 conversations — nobody can read chats they're not part of (enforced at the database level, not just hidden in the UI)
- Real-time messages — no refreshing needed
- Photo and video sharing in chats
- Profile pictures

Backend: Supabase (Postgres + Auth + Storage + Realtime) — already set up and connected.

## Running it locally (to test on your computer)

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. In this folder, run:
   ```
   npm install
   npm run dev
   ```
3. Open the link it gives you (usually `http://localhost:5173`).

## Getting your friends onto it

Right now, it only runs on your computer. To make it a real link anyone can open:

1. **Deploy it for free** using [Vercel](https://vercel.com) or [Netlify](https://netlify.com):
   - Push this folder to a GitHub repo
   - Connect the repo on Vercel/Netlify — it auto-detects Vite and builds it
   - You'll get a live URL like `driftline-yourname.vercel.app`
2. Share that URL with your friends. Each person creates their own account (email + password).
3. To start a chat with a friend, tap **+** and search their display name (they need to have signed up first).

## How privacy works

Every conversation has a list of participants stored in the database. Row Level Security rules (set directly in Postgres) mean the database itself refuses to return messages to anyone who isn't a listed participant — this isn't just hidden by the app, it's enforced no matter how someone tries to access the data.

## If you later want it on the App Store / Play Store

This same backend (Supabase) can power a React Native version that wraps into real iOS/Android apps. The database, accounts, and privacy rules would all carry over — only the frontend would need rebuilding in React Native. Ask me when you're ready for that step, and I'll build it and walk you through submitting to both stores.

## Notes

- New users must confirm their email before their first sign-in (standard Supabase behavior) unless email confirmation is turned off in the Supabase dashboard.
- Group chats aren't wired up in the UI yet — the database already supports them (`is_group` on conversations), so this can be added next if you want it.
