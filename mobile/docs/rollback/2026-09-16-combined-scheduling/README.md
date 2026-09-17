# Combined action scheduling trial — September 16, 2026

Requested: combine time, difficulty and calendar in one screen; choose calendar once per plan. Keep the research-based minimum of two actions.

## Changes
- Draft action setup now shows date/time, difficulty and calendar together.
- Save & next action opens the next unfinished action in stable draft order.
- Last action saves and returns to My Plan with review/rating expanded.
- First setup asks Yes / Keep in app only. Subsequent unscheduled actions inherit that choice; each action can override it.
- Device calendar preference is stored per account and event in AsyncStorage under c-day-calendar-choice:v1:<userId>:<eventId>. It is local to the phone, not synced to another device. Existing scheduled actions retain their own calendar setting.
- In-app save still precedes optional calendar work. The two-action minimum, XP rules, and reflection requirements are unchanged.
- Finalized-plan rescheduling retains its existing workflow.

## Rollback
The adjacent c-day-planner.tsx.before is the exact file before this trial, including all earlier changes. Restore it to src/components/c-day-planner.tsx to undo only this trial if no subsequent changes have been made. If further edits exist, compare with the snapshot and reverse only the combined scheduling changes; do not overwrite newer work. No database migration is involved. Local preference keys can remain unused after rollback.

## Validation
TypeScript check passed. Phone acceptance testing remains: first calendar choice, inheritance on next action, per-action override, final review, reopening a draft, save failure/retry, calendar denial, and rescheduling an existing finalized plan.
