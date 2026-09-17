# Account setup rollout — September 14, 2026

## Implemented first stage
- Existing Supabase project, auth account IDs and session key retained. No password reset, logout, account replacement or content/progress migration is performed by deployment.
- Separate sign-in and new-account flows. New accounts enter a private DOB first; client and database enforce age 13+. No maximum age. First name required, last name optional. Signup UI asks for 12+ character password; hosted Auth password policy still needs verification (UI is not the security boundary).
- Additive account_profiles table, owner-only reads; guarded save_account_profile RPC uses auth.uid and expected account ID. DOB cannot be edited once saved through this feature. Existing accounts can omit DOB and skip profile setup. New auth INSERTs require DOB and first name, including any future admin-created accounts; existing auth UPDATEs are unaffected.
- Username reservation private, case-insensitive unique, 3–24 lowercase ASCII letters/numbers/underscores, begins with letter; staff-like names rejected. Not used for roles or authorization. No public username exposure yet: Community still uses “Community member.” Public moderation/naming policy remains a separate rollout.
- Phone collection and parent links deferred. No phone verification or parent access implied.
- Native secure storage adapter retains default Supabase storage key, uses verified chunks and a committed manifest, and removes legacy storage only after replacement. Missing native module retains the existing AsyncStorage path so the currently installed tester continues working. Never require biometrics for session reads. A native rebuild is necessary to activate SecureStore.
- Sign-out is device-local. Password recovery request and in-app new-password UI use existing mobile://me scheme. Different-account reset links do not replace an existing signed-in account. Recovery never logs tokens.

## Changes
src/components/account-setup.tsx; src/components/account-recovery.tsx; src/lib/session-storage.ts; src/lib/supabase.ts; src/app/me.tsx; src/app/_layout.tsx; package.json/package-lock.json; app.json; supabase/migrations/20260914170000_account_profiles.sql.

## Applied and validated
Migration dry-run showed only 20260914170000_account_profiles.sql; linked push succeeded. Existing auth rows were not updated. Local database tests cover legacy-account preservation, under-13/missing/invalid DOB rejection, adults over25 accepted, owner isolation, forged user ID/direct writes rejected, username collision/staff-name rejection and immutable DOB. Storage tests cover old-build fallback, failed transfer retaining session, large session chunk transfer, refresh, logout and stale legacy token suppression. TypeScript and iOS export passed. Device acceptance remains pending.

## Nora — safe test order
1. Keep the existing app installed. Reload it. Open ME: confirm the same email, saved plans and Explore progress. Do not sign out just to test the migration.
2. Open My profile details; confirm it is optional. Close it and keep testing. If desired, save private first/last name and a reserved username. Only save an accurate DOB; corrections require authorized support.
3. Rebuild/install over the existing app with the same bundle identifier (do not delete the app first) to activate native SecureStore. Relaunch twice and confirm the same account/data.
4. Use a separate test account/device for new signup: invalid date, under13, exactly13, over25, email confirmation and normal sign-in. No live test account or verification email was created/sent by the agent.
5. Verify reset delivery and return-to-app link with that test account; update password, then test re-login. Finally, test a normal local sign-out/re-login on Nora’s account only when her password/recovery are confirmed working.

## Required hosted configuration / production blockers
- Verify email confirmation enabled, custom SMTP delivery and sender, password policy (12+), leaked-password protection where available, rate limits/CAPTCHA, session settings and auth logs. These settings were not changed or verified by this code migration.
- Supabase Auth redirect allowlist must include exactly mobile://me for development password recovery; retain any existing valid redirects. Verify email templates use ConfirmationURL so recovery returns with the recovery token fragment. Production should use an owned universal/app link; shared custom schemes are development-only.
- New password UI is implemented but recovery end-to-end is NOT yet verified. Do not rely on it until hosted redirects/delivery and device tests pass.
- Moderator MFA enrollment/recovery and server-side assurance enforcement are still outstanding. No moderator privileges changed in this stage.
- Public username moderation/visibility policy and parent invitation, consent, scoped permissions and unlink behavior remain separate stages. No parent access or public identity expansion has been activated.
- Exact DOB handling, retention/deletion, privacy/terms and age policy need final product/legal review before public launch. DOB is copied from signup metadata into owner-only account_profiles; signup metadata is self-editable and never used for authorization or subsequent age decisions.
- Existing minimum-length passwords remain usable for sign-in; never force Nora to reset as part of rollout.
