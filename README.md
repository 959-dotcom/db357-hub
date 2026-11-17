# DB357 Central Hub

Private access desk for [db357.com](https://db357.com). There is no public signup. A Super Admin creates every account. The hub launches five desks and shows a card only when that account’s flag is on.

| Desk | Address | Flag |
| --- | --- | --- |
| Land pawn / mortgage | https://168.db357.com | `can_access_land` |
| Domain checker DM-CK | https://spinlytics-db357.vercel.app | `can_access_dmck` |
| Digital coupon / agent network | https://app.db357.com | `can_access_coupon` |
| Personal loan book | https://loan.db357.com | `can_access_loan` |
| Car aircon shop | https://air.db357.com | `can_access_aircon` |

## Session boundary

On `db357.com` the Supabase SSR cookies are set as:

`Domain=.db357.com; Secure; HttpOnly; SameSite=Lax`

HttpOnly is deliberate. Page scripts cannot read the session. Auth runs on the server. Those four attributes are set when the host is `db357.com` or a subdomain. An http host outside that name, including localhost, omits `Domain` and `Secure` so the browser can store the cookie. `Secure` is also set when the request itself is https.

A launch link is a normal top-level navigation. The browser will send the hub cookie to `168.db357.com`, `app.db357.com`, `loan.db357.com`, `air.db357.com`, and `db357.com` because of `Domain=.db357.com`.

That cookie is a session **only when the destination app uses this same Supabase project** (same project URL, same JWT secret, same `@supabase/ssr` cookie names). Land uses its own Supabase project, so the hub cookie does not sign anyone in there.

Land Desk is one handoff. Open on the Land card, and the Land entry in the app switcher, goes to `/auth/land-handoff`. That route runs only for a signed-in active account with `can_access_land`, then posts a 60-second HMAC token to `https://168.db357.com/auth/hub`. Land checks the signature and opens its own session when an auth user with that email already exists. It does not create an account, copy rows, or change the Land password. If no Land user has that email, Land stops and says so.

DM-CK is a separate handoff. Open on the DM-CK card, and the DM-CK entry in the app switcher, goes to `/auth/dmck-handoff`. That route runs only for a signed-in active account with `can_access_dmck`, then posts a 60-second HMAC token to DM-CK `/auth/hub`. DM-CK checks the signature and opens its own session when a user with that email already exists. It does not create an account, copy rows, or change the DM-CK password. If no DM-CK user has that email, DM-CK stops and says so.

Set the same `LAND_HANDOFF_SECRET` (at least 32 characters) on the hub and on Land. Land also needs its own `SUPABASE_SERVICE_ROLE_KEY` for `https://fahkknzinragbeizymny.supabase.co`. No extra Supabase redirect URL is required. Set a different `DMCK_HANDOFF_SECRET` (at least 32 characters) on the hub and on DM-CK. Do not reuse the Land secret. Leave `DMCK_DESK_URL` unset. The token then posts to `https://spinlytics-db357.vercel.app/auth/hub`, which is the DM-CK app. `https://db357.com/dmck` is still this hub, so it cannot accept that token. Coupon, Loan, and Aircon still have no shared token. Copy `lib/appGuard.ts` only into desks that share this project, and set `NEXT_PUBLIC_HUB_ORIGIN=https://db357.com` on those desks.

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

Live mode starts when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are both set. If either is missing, the local mock desk stays in use. Do not commit either value.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` stays on the server. It is required for lockout counters, audit inserts, and creating accounts. Those writes are skipped rather than sent with the signed-in user's key. Paste `supabase/migrations/hub_security.sql` into the Supabase SQL editor before the first live sign-in. This repo cannot apply that file. Authenticated clients cannot write lockout, permissions, or the audit log. Users can read their own profile and permissions. A Super Admin can read the directory. Triggers reject forged updates to role, status, lockout, MFA, and the audit log.

Password reset mail uses `resetPasswordForEmail` with redirect `https://www.db357.com/reset-password`.

Five failed passwords lock the account for 30 minutes. The sign-in page shows the remaining time. Passwords need 10 characters, upper and lower case, a number, and a symbol.

`/admin/security` is Super Admin only. Other active roles are audited and sent to `/access-denied`. `lib/appGuard.ts` is the server check a sibling desk copies: session, status `active`, and that desk’s boolean.
