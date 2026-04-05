# Supabase Auth Setup (safe incremental)

This project now supports **optional Supabase auth**. If Supabase config is empty, the app keeps local-only behavior.

## What was automated already

- Added optional auth layer and login/register gate.
- Added email verification enforcement before game access.
- Added role model (`admin`, `player`) from database profile.
- Isolated local saves per account in this browser.
- Added server-side save snapshot in `public.profiles.save_data` for authenticated account recovery.
- Kept backwards compatibility: if user-scoped save does not exist, legacy save is copied once.

## 1) Create Supabase project (manual)

1. Create project in Supabase dashboard.
2. In `Authentication > Providers`, enable Email provider.
3. In `Authentication > URL Configuration`, set:
   - Site URL: your game URL (or local URL during testing).
   - Redirect URLs: include your local and production URLs.
4. In `Authentication > Email Templates`, keep confirmation email enabled.

## 2) Run SQL setup (manual)

1. Open SQL Editor in Supabase.
2. Run script from `scripts/supabase_setup.sql`.
3. Verify table `public.profiles` exists.
4. The script also creates a trigger so every new auth user gets a `public.profiles` row automatically.
5. The same script backfills missing profile rows for users that already existed before the trigger.

## 3) Configure project file (manual)

Edit `js/supabase-config.js` and set:

- `url`: Supabase project URL
- `anonKey`: Supabase anon key
- `requireEmailConfirmation`: `false` for current closed-beta production mode without SMTP, `true` once SMTP is configured
- `allowSignup`: `false` for current admin-created closed beta, `true` only when self-service signup is ready

Example:

```js
window.GL_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY',
  requireEmailConfirmation: false,
  allowSignup: false
};
```

## 4) First admin assignment (manual)

1. Register and verify admin email.
2. Login once so profile row is created.
3. In SQL editor run:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@yourdomain.com';
```

## 5) Closed beta recommendations

- Current recommended production mode:
  - `allowSignup: false`
  - `requireEmailConfirmation: false`
  - Create invited users manually from Supabase dashboard or SQL
- When custom SMTP is configured later, switch back to:
  - `allowSignup: true`
  - `requireEmailConfirmation: true`

## 6) Smoke test checklist

1. Login with admin-created account -> app opens.
2. Confirm profile row exists with role `player` or `admin`.
3. Promote one user to `admin` and re-login -> role reflects in profile panel.
4. Login with second account -> confirms separate local save key.
5. After SMTP is configured, re-enable signup and email confirmation and repeat the mail flow test.

## 7) Rollback plan

If any issue appears, set empty values in `js/supabase-config.js`:

```js
window.GL_SUPABASE_CONFIG = {
  url: '',
  anonKey: '',
  requireEmailConfirmation: true,
  allowSignup: true
};
```

App returns to local-only mode.
