# DB357 Central Hub

Private access desk for [db357.com](https://db357.com). There is no public signup. A Super Admin creates every account. The hub launches five desks and shows a card only when that account’s flag is on.

| Desk | Address | Flag |
| --- | --- | --- |
| Land pawn / mortgage | https://168.db357.com | `can_access_land` |
| Domain checker DM-CK | https://db357.com/dmck | `can_access_dmck` |
| Digital coupon / agent network | https://app.db357.com | `can_access_coupon` |
| Personal loan book | https://loan.db357.com | `can_access_loan` |
| Car aircon shop | https://air.db357.com | `can_access_aircon` |

## Session boundary

On `db357.com` the Supabase SSR cookies are set as:

`Domain=.db357.com; Secure; HttpOnly; SameSite=Lax`

HttpOnly is deliberate. Page scripts cannot read the session. Auth runs on the server. Those four attributes are set when the host is `db357.com` or a subdomain. An http host outside that name, including localhost, omits `Domain` and `Secure` so the browser can store the cookie. `Secure` is also set when the request itself is https.

A launch link is a normal top-level navigation. The browser will send the hub cookie to `168.db357.com`, `app.db357.com`, `loan.db357.com`, `air.db357.com`, and `db357.com` because of `Domain=.db357.com`.

That cookie is a session **only when the destination app uses this same Supabase project** (same project URL, same JWT secret, same `@supabase/ssr` cookie names). If Land, DM-CK, Coupon, Loan, or Aircon are separate Supabase projects, they cannot validate the hub cookie. This hub does not invent a shared token, query-string handoff, or second login to paper over that. Copy `lib/appGuard.ts` only into desks that share this project, and set `NEXT_PUBLIC_HUB_ORIGIN=https://db357.com` on those desks.

## Run locally

```bash
npm install
npm run dev
```

Leave the Supabase variables empty. The UI then uses the local mock desk in `.data/` (gitignored), including a sample Super Admin, a locked account, partial permission flags, a pending account, and an authenticator account.

| Email | Password | Notes |
| --- | --- | --- |
| `aurelia.voss@db357.com` | `Aurelia#Vault10` | Super Admin, all five desks |
| `marcus.chen@db357.com` | `Marcus#Ledger10` | Staff, Land and Loan only |
| `nia.okonkwo@db357.com` | `Nia#Coupon10` | Agent, DM-CK and Coupon |
| `elena.marche@db357.com` | `Elena#Factor10` | Admin, authenticator on, Loan and Aircon. Not a Super Admin |
| `held.account@db357.com` | `Held#Account10` | Locked for 30 minutes from process seed |
| `iris.vale@db357.com` | `Iris#Window10` | Aircon only. Five bad passwords lock it |
| `julian.park@db357.com` | `Julian#Pending10` | Pending, cannot sign in |
| `clara.stein@db357.com` | `Clara#Quiet10` | Active, no desks |

These passwords work only in the mock desk. They are not production credentials.

Live mode starts when all three variables are set. Do not commit them.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Apply `supabase/migrations/hub_security.sql` in the Supabase SQL editor before the first live sign-in. The service role is used only on the server: lockout counters, audit inserts, and provisioning. Authenticated clients cannot write those. Users can read their own profile and permissions. A Super Admin can read the directory. Triggers reject forged updates to role, status, lockout, MFA, and the audit log.

Password reset mail uses `resetPasswordForEmail` with redirect `https://db357.com/reset-password`.

Five failed passwords lock the account for 30 minutes. The sign-in page shows the remaining time. Passwords need 10 characters, upper and lower case, a number, and a symbol.

`/admin/security` is Super Admin only. Other active roles are audited and sent to `/access-denied`. `lib/appGuard.ts` is the server check a sibling desk copies: session, status `active`, and that desk’s boolean.
