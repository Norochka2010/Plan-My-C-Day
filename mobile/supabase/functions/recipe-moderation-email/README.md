# Recipe moderation notifications

New transitions into pending_review enqueue one notification per recipe revision. A database schedule calls the fixed-recipient worker each minute. Failed deliveries retry after five minutes. Sent messages are recorded; provider idempotency covers repeated delivery requests within the provider window. Recipient: support@mycday.com. Emails contain recipe content and recipe ID, not private account information. Review/approval remains in the authenticated app.

Deployment requires backend secrets RESEND_API_KEY and MODERATION_EMAIL_FROM (an authorized sender on a Resend-verified domain). Configure these in the Supabase Edge Functions secrets dashboard, never in mobile environment variables. Until configured, the worker returns 503 and queued notifications remain unsent. No existing recipes were backfilled and no test emails sent.

Approve & publish changes status to published through the existing moderator-only RPC. Published recipes are returned by Community Discover. Assign moderator access only to a user-approved account.

## Recipe report notifications (September 24, 2026)
New report inserts enqueue one email per report ID in the existing private queue. Unresolved older reports were backfilled. Emails contain recipe title and record IDs only; report text and reporter identity remain in the authenticated moderator view. Resolved reports are skipped before sending. The existing minute schedule and retry lease apply. One previously missed report notification was accepted by Resend after deployment; inbox receipt requires recipient confirmation.
