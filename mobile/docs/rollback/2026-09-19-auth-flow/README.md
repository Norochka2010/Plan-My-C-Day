# Account flow refresh — September 19, 2026

Added welcome, birthday, account creation, sign-in, verification/resend, reset request and reset-sent states. Kept password confirmation, show/hide controls, 13+ eligibility without an upper age limit, Supabase account metadata and https://mycday.com/auth/ redirects. Last name remains editable in profile details instead of being requested at signup. Resend requests have a 60-second local cooldown and submissions are guarded against duplicate taps. Recovery form scrolls with the keyboard and disables saving until passwords match and meet length requirements.

To undo this change only, copy the two .before snapshots to src/components/account-setup.tsx and src/components/account-recovery.tsx. These snapshots include the pre-existing mycday.com redirect changes. No database or email-template changes were made.

Validation: TypeScript and diff checks. Device testing is still required for signup, actual email delivery, link return, reset, and accessibility. No test emails were sent during development.
