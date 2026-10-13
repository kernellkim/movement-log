# Movement.log — Project Instructions for Claude Code

## Project summary
Movement.log is a PT (personal training) member management web app, built solo for
the Wanted AI Championship 2026 hackathon (submission deadline: Sept 20, 2026).
Two user roles: **trainer** (manages members, runs assessments, generates/edits
routines, checks off sessions) and **member** (fills out a PAR-Q-style
questionnaire, reviews past sessions and body composition).

Full product spec and running implementation log live in Notion (single source of
truth for decisions): page ID `3cc42b8c3bc181bba32ae02c9858e178`.

## Tech stack
- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS
- UI components: shadcn/ui (base-ui) — Button uses `nativeButton={false} render={<Link .../>}`
  when it needs to act as a link, not `<Button><Link>...</Link></Button>` (causes an
  accessibility console warning).
- Supabase (Postgres + RLS + Auth) — project ref `kkwlfrmrtatfmozewzxa`, Singapore region
- Claude API (`@anthropic-ai/sdk`) for AI features:
  - Risk classification, assessment recommendation, routine generation, InBody photo value extraction (vision) → `claude-sonnet-5`
- Deployed on Vercel, team `iigniim`

## Hard rules — do not violate
1. **AI never makes a final medical/exercise decision.** Every AI-generated
   recommendation (risk level, assessment picks, routine) is a *draft* the trainer
   must review/confirm before it's persisted as final. Don't remove or weaken this
   confirm step.
2. Routine edits during a session ("운동 추가/수정") only mutate **local client
   state**. They become permanent only when the trainer presses "수업 완료", which
   creates a brand-new `routines` row (archiving the old one) — never mutate an
   existing `routine_items` row that a past `session_log_item` snapshot depends on.
3. Don't reintroduce name-based heuristics for exercise behavior (e.g. checking if
   a name contains "플랭크"). Use the `unit_type` / `equipment` columns instead.
4. When checking GitHub sync state, use `git fetch origin && git reset --hard origin/main`,
   not plain `git pull` (local edits can otherwise mask what's actually on remote).
5. **Always commit and push to origin/main after making code changes.**
   This project auto-deploys to Vercel from GitHub — uncommitted or
   unpushed local changes never reach production, no matter how correct
   they are locally. After finishing any edit (even a one-line fix), run
   git add / commit with a clear message / push, unless the user
   explicitly says not to for that specific change.
6. **All popups/dialogs use the shared design — never `window.confirm` / `alert` / `prompt`.**
   - Confirmation popups: `components/ui/confirm-dialog.tsx` (`ConfirmDialog`).
   - Any other popup (info, error, result, link display): `components/ui/modal.tsx` (`Modal`).
   - Fixed design: title `text-lg font-semibold`; body as a bullet list via `ModalList`;
     emphasis (irreversible/warning) via `ModalDanger`; footer as `ModalActions`
     (equal 2-column buttons, cancel + confirm); width `max-w-lg`; backdrop `black/70`.
   - Do not hand-roll new `<dialog>` markup or change these styles per-popup; extend the
     shared components if something is missing.
7. **Keep the codebase and the Notion spec consistent, always.**
   - Terminology: the member-side feature is **"개인 운동"** (never "자율 운동"). Use the same
     wording in UI text, code comments, README and Notion.
   - Any user-visible behavior, schema, API, or rule change must be reflected in the Notion
     page (3.1 features, 3.2 decisions, 3.4 schema history, 5 dev log) in the same task,
     and the Notion text must match what the code and DB actually do (verify against the DB
     for table/column facts instead of relying on memory).
   - When something is removed (feature, table, column), remove it from the Notion text too.

## Known patterns / gotchas
- Next.js 16 renamed `middleware.ts` → `proxy.ts`.
- `params` and `searchParams` in App Router pages are `Promise`s — always `await` them.
- `/auth/*` paths must stay excluded from auth-redirect logic in `proxy.ts`, or
  invite-link flows break.
- Admin-only Supabase operations (inviting users, `auth.admin.*`) go through
  `lib/supabase/admin.ts` (service role key, server-only, RLS bypassed intentionally).
- Resend SMTP is connected but **not domain-verified** — it can currently only send
  to the trainer's own address. Don't rely on invite emails for testing; create test
  members directly via Supabase Dashboard → Authentication → Users → Add user
  (check "Auto Confirm User"), then manually link the row in `members`.
