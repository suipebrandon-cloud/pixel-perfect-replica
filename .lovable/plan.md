# FirmAnt Financial Management System — MVP build plan

We follow the spec's recommended order and build one phase at a time, checking each phase before starting the next. This first round covers phases 1–2 plus the money core, so you get a working app quickly. Each later phase becomes its own follow-up.

## Platform notes (differences from the spec)
- The app uses this project's built-in React + TypeScript + Tailwind + shadcn setup. Routing uses TanStack (fixed on this platform), not a separate Vite SPA.
- Lovable Cloud is the database (managed PostgreSQL), so no external accounts are needed.
- Hosting is Lovable publishing, not Vercel. As the spec says, we will not publish until sign-in exists. Tables are designed now so roles (manager/approver/clerk) can be added later.
- Recharts, React Hook Form and Zod are used as specified. Currency is FCFA (XAF) with no decimals.

## Look and feel
- FirmAnt crimson #8B0000, black, white, light gray. A serious, ledger-like style: dense tables, figures in a monospace font, crimson only for main actions and highlights.
- Left sidebar that collapses to icons, a top bar with a date-range filter, and a mobile layout.

## Round 1 (this build)
1. **Setup**: turn on Lovable Cloud, branding, layout, shared pieces (data table, FCFA amount display, date display, status badge, confirm dialog, forms).
2. **Core records**: Clients, Projects (code, client, contract value, dates, status), Accounts (Cash, MTN MoMo, Orange Money already set up, each with an opening balance), Categories (the 10 expense categories already set up), Staff, Payees. Records already used in transactions can be deactivated but not deleted.
3. **Money core**: client receipts and account movements, with readable references (FA/FIN/TID26-0001), protection against double posting, and corrections by reversal. Account balances are calculated, never typed in.
4. **Basic dashboard**: account balances and total received in the selected date range.

## Later rounds (one per follow-up)
- Round 2: project budgets, confirm-and-lock, amendments, budget vs actual.
- Round 3: work progress approval and earned revenue (capped at contract value), client advances.
- Round 4: expense requests, approve/reject, installment payments, outstanding obligations, attachments.
- Round 5: transfers, staff obligations and payments, payables, asset register.
- Round 6: full transaction register, audit-trail viewer, complete dashboard with click-through.
- Round 7: all reports, CSV export, acceptance test run, backups check, then sign-in and access control before going live.

## Technical details
- Tables follow the spec's list in section 4, with foreign keys, CHECK (amount > 0), unique references and indexes. Each round adds only its own tables through migrations.
- Posting (receipt plus account movement plus transaction plus audit log) runs inside a single Postgres function, so it all succeeds or all fails. An idempotency key on each post blocks duplicates.
- Posted rows cannot be changed (a trigger blocks updates and deletes on posted financial rows). Corrections create a reversal row linked to the original.
- Balances and totals come from database views (account_balances, project_financials), and the dashboard and reports use those same views so their figures always match.
- References come from a per-year sequence function.
- Before sign-in exists, the tables are reachable only from server functions using the admin client. The browser never reads tables directly, so nothing is exposed to anonymous visitors.
- Vitest tests cover the money rules: balance formula, outstanding contract balance, reversal behaviour, and later the full acceptance-test scenario (1,000,000 received, 855,000 costs, 145,000 remaining, earned revenue 0 until work is approved).
