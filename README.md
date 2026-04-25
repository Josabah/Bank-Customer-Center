# Bank Customer Center

Bank Customer Center is a voice-first customer support prototype for an Ethiopian bank. It demonstrates how a browser-based call experience can combine Amharic speech, AI assistance, customer authentication, and core banking data lookups in a single Next.js application.

## Problem

Bank call centers often handle repetitive questions such as balance checks, recent transaction requests, and product/service guidance. These interactions can be slow when every caller must wait for a human agent, and they become harder to scale when callers prefer local-language voice support.

This project explores a practical solution: an AI-assisted call-center front desk that can speak with customers, verify identity, answer low-risk account questions, and hand off sensitive or unsupported requests to a human agent.

## Solution

The app provides an end-to-end call simulation:

1. A customer starts a call from the browser.
2. The assistant greets the customer and asks for their name.
3. Browser microphone audio is recorded and sent to Groq Whisper for transcription.
4. The backend matches the transcript against known customers in Supabase.
5. The assistant asks for a PIN and verifies it against a salted SHA-256 hash.
6. After authentication, the assistant can return account balance and recent transaction data.
7. General banking questions are enriched with a Supabase-managed knowledge base and answered by Groq Llama.
8. The assistant speaks responses aloud using Amharic Edge TTS.
9. Call sessions and messages are persisted for auditability and future review.

## Core Functionality

- Amharic voice call UI with start, record, stop, and end-call controls
- Speech-to-text using Groq Whisper Large v3
- AI response generation using Groq Llama 3.3 70B
- Text-to-speech using `edge-tts-universal` and `am-ET-MekdesNeural`
- Customer identification from spoken name transcripts
- PIN verification with failed-attempt tracking and temporary lockout
- Authenticated account balance lookup
- Authenticated recent transaction lookup
- Knowledge-base search before AI answer generation
- Supabase-backed call sessions, message history, customers, accounts, transactions, and knowledge-base entries
- Server-only Supabase service-role access through API routes

## Architecture

The browser owns the call experience and media capture. All privileged actions run through Next.js API routes, which validate input, call external AI services, or query Supabase from the server.

```text
Browser call UI
  -> /api/transcribe -> Groq Whisper
  -> /api/auth/* -> Supabase customers + PIN factors
  -> /api/accounts/* -> Supabase accounts
  -> /api/transactions/* -> Supabase transactions
  -> /api/knowledge-base/search -> Supabase knowledge base
  -> /api/chat -> Groq Llama
  -> /api/tts -> Edge TTS audio
```

Supabase row level security is enabled on all application tables. The current prototype uses service-role-only policies and keeps the service-role key on the server.

## Tech Stack

- [Next.js 16](https://nextjs.org) App Router
- React 19
- TypeScript
- Supabase Postgres and REST API
- Groq Whisper and Llama APIs
- Edge TTS via `edge-tts-universal`
- Tailwind CSS
- shadcn/ui components
- pnpm

## Codebase Structure

```text
app/
  api/
    accounts/summary/route.ts        Authenticated account balance endpoint
    auth/identify/route.ts           Customer lookup from spoken transcript
    auth/verify-pin/route.ts         PIN verification endpoint
    calls/start/route.ts             Starts a persisted call session
    calls/message/route.ts           Persists call messages
    calls/end/route.ts               Ends a call session
    chat/route.ts                    Groq Llama completion endpoint
    knowledge-base/search/route.ts   Knowledge-base search endpoint
    transactions/recent/route.ts     Authenticated recent transaction endpoint
    transcribe/route.ts              Groq Whisper transcription endpoint
    tts/route.ts                     Edge TTS audio endpoint
  page.tsx                           Main browser call-center experience
  layout.tsx                         Root layout
  globals.css                        App styles

components/
  ui/                                shadcn/ui primitives
  theme-provider.tsx                 Theme provider

hooks/
  use-mobile.ts                      Responsive helper hook
  use-toast.ts                       Toast helper hook

lib/
  server/
    accounts.ts                      Account and transaction business logic
    auth.ts                          Customer identification and PIN verification
    calls.ts                         Call session and message persistence
    env.ts                           Required server environment validation
    errors.ts                        HTTP-safe application errors
    http.ts                          Request parsing and JSON response helpers
    knowledge-base.ts                Knowledge-base matching logic
    pin.ts                           PIN hashing and verification helpers
    schemas.ts                       API request validation schemas
    types.ts                         Shared server data types
  supabase/
    rest.ts                          Server-side Supabase REST client
  utils.ts                           Shared UI utilities

supabase/
  migrations/
    0001_mvp_backend.sql             Initial schema, RLS, policies, and seed data
    0002_fix_mvp_backend_advisors.sql Advisor/security follow-up migration

public/                              Static assets
styles/                              Additional global styles
```

## Data Model

The Supabase schema contains:

- `customers`: customer identity records used for name matching
- `customer_auth_factors`: salted PIN hashes, failed attempt counts, and lockout timestamps
- `accounts`: customer bank accounts and balances
- `transactions`: account transaction history
- `call_sessions`: call lifecycle, authentication state, and handoff status
- `call_messages`: transcript-style message history for each call
- `knowledge_base_entries`: active support content used to ground AI responses

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
GROQ_API_KEY=your-groq-api-key
```

Security notes:

- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.
- Do not commit `.env.local`.
- Only `NEXT_PUBLIC_*` values are safe to expose to browser code.

## Local Development

Install dependencies:

```bash
pnpm install
```

Apply database migrations:

```bash
supabase db push
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Browser microphone permission is required for the voice flow.

## Demo Scenario

The seed data includes a demo customer for local testing:

- Name: `Aymen`
- PIN: `1234`
- Balance: `5,200 birr`
- Recent transaction: `200 birr sent`

Suggested test flow:

1. Click `Start Amharic Call`.
2. Say `Aymen` when the assistant asks for your name.
3. Say `1234` when prompted for the PIN.
4. Ask for your balance.
5. Ask for your recent transaction.
6. Ask a general banking question to exercise the knowledge-base and AI response path.

## API Reference

- `POST /api/calls/start` creates a call session and returns the opening prompt.
- `POST /api/calls/message` stores a user or assistant message for a call.
- `POST /api/calls/end` marks a call session as ended.
- `POST /api/auth/identify` matches a spoken transcript to a known customer.
- `POST /api/auth/verify-pin` verifies a spoken PIN for the identified customer.
- `GET /api/accounts/summary?callSessionId=...` returns account summary data for an authenticated call.
- `GET /api/transactions/recent?callSessionId=...` returns the latest transaction for an authenticated call.
- `POST /api/knowledge-base/search` returns the best active knowledge-base match.
- `POST /api/transcribe` transcribes uploaded audio with Groq Whisper.
- `POST /api/chat` generates a concise banking assistant response with Groq Llama.
- `POST /api/tts` returns synthesized speech audio.

## Available Scripts

```bash
pnpm dev      # Start the Next.js development server
pnpm lint     # Run ESLint
pnpm build    # Build for production
pnpm start    # Start the production server
```

## Current Scope

This is an MVP prototype, not a production banking system. It demonstrates the core flow and integration pattern, but production use would require stronger identity verification, full audit controls, encrypted secrets management, rate limiting, monitoring, formal handoff workflows, and bank-approved policy/content governance.

## v0

This repository is linked to a [v0](https://v0.app) project.

[Continue working on v0](https://v0.app/chat/projects/prj_zk04HaFS5TRsMroxSYg94131poGl)

<a href="https://v0.app/chat/api/kiro/clone/Josabah/Bank-Customer-Center" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
