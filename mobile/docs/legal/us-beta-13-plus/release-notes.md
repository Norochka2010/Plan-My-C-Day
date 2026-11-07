# US beta ages 13+ — policy rollout

Policy version: `2026-11-07-us-beta-13-plus`. Effective date: November 7, 2026.

The operator remains Nora Im. Teen testers confirm parent/guardian approval themselves; there is no parent sign-in or independent verification. New registration confirms US residency. Existing accounts are not automatically deleted or reclassified by this update.

## Implemented

- Bundled Terms and Privacy Policy updated; adult-only originals preserved in the archive.
- Registration minimum age 13; ages 13–17 require the parent-permission confirmation.
- Registration displays the bundled version and records its identifier, acknowledgments, US residency confirmation, and teen confirmation in account metadata. These are user statements, not independently verified evidence.
- Message drafts, clipboard behavior, Leaf accessories, teen visibility, and rights-request information described.
- Local account deletion also attempts to clear Leaf collection preferences.

## Before the next external testing session

- Matching Terms and Privacy Policy published at https://mycday.com/terms/ and https://mycday.com/privacy/ (website commit `e8b169a`); live pages verified against the bundled policy text.
- Distribute a new app build with the updated registration flow. Existing TestFlight builds still contain the previous flow.
- Notify existing testers of the policy changes; this change does not implement a renewed-agreement screen for existing accounts.
- Limit invitations to US residents age 13 or older. The residency checkbox is not location verification.
- Have qualified US counsel review teen participation and applicable state privacy/health-data obligations before broader rollout. This edit is not a legal compliance determination; a self-confirmation does not replace any additional consent required by applicable law.

## Verification

`node scripts/test-beta-registration.cjs` checks under-13 rejection, 13th/18th birthday boundaries, teen-only permission, US/terms/privacy gating and submitted acknowledgment metadata using mocked registration (no accounts or emails created). TypeScript check passed.

Reference: FTC COPPA guidance, https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions . COPPA addresses children under 13; teen permission here is the chosen beta participation rule, not a claim that this checkbox satisfies every law.
