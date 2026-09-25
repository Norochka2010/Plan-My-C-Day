import type { ActionHistory } from './c-day-progress';

const rank = { easy: 1, moderate: 2, hard: 3 };
/** Compare recorded ratings for completed actions on distinct, dated C-Days. */
export function actionGrowth(group: ActionHistory) {
  const occasions = group.occasions.filter(({ event, action }) =>
    action.completion_status === 'done' && action.difficulty != null &&
    action.difficulty in rank && Number.isFinite(Date.parse(event.event_start_at))
  ).sort((a, b) => Date.parse(a.event.event_start_at) - Date.parse(b.event.event_start_at));
  const first = occasions[0];
  const latest = occasions[occasions.length - 1];
  const comparable = !!first && !!latest && first.event.id !== latest.event.id &&
    Date.parse(first.event.event_start_at) < Date.parse(latest.event.event_start_at);
  const change = comparable ? rank[first.action.difficulty!] - rank[latest.action.difficulty!] : 0;
  return { first, latest, comparable, change, completed: occasions.length,
    label: !comparable ? 'A step worth noticing' : change > 0 ? 'Feeling easier' : change < 0 ? 'Showing up for a challenge' : 'Building experience' };
}
