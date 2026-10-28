<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All data access goes through server functions in `src/lib/finance.functions.ts` using the admin client; tables have RLS on with no policies. Why: no sign-in yet, so the browser must never read financial tables directly.
- Money postings (receipt + transaction + account movement + audit log) happen only inside Postgres functions (`post_receipt`, `reverse_receipt`). Why: atomic posting and idempotency-key duplicate protection.
- Posted transactions, movements and audit logs are immutable (DB triggers); corrections are reversal entries. Why: traceable financial history.
- Balances and project totals come from DB views (`account_balances`, `project_financials`); never store calculated totals. Why: dashboard and reports must match the records.
- Amounts are whole FCFA stored as bigint; pure money rules live in `src/lib/money.ts` with tests next to it.
