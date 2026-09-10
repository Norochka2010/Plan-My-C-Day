import { useLocalSearchParams } from "expo-router";
import { CDayPlanner } from "@/components/c-day-planner";

export default function PlanScreen() {
  const params = useLocalSearchParams<{
    eventId?: string;
    actionId?: string;
    entry?: string;
    view?: string;
  }>();
  return (
    <CDayPlanner
      entryEventId={
        typeof params.eventId === "string" ? params.eventId : undefined
      }
      entryActionId={
        typeof params.actionId === "string" ? params.actionId : undefined
      }
      entryView={params.view === "history" ? "history" : undefined}
      entryKey={typeof params.entry === "string" ? params.entry : undefined}
    />
  );
}
