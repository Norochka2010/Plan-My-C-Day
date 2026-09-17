/** Event applicability is product metadata; it does not change Meyer source actions. */
export const cDayEventConfig = {
  dinner_with_friends: {
    label: "Eating Out / Dinner With Friends", enabled: true, sourceBasis: "Meyer_2021",
    heading: "Dinner With Friends", defaultTitle: "Dinner With Friends",
    titlePrompt: "C-Day name", dateTimePrompt: null,
    venuePrompt: "Place or restaurant (optional)",
  },
  school_event: {
    label: "School Trip / School Event", enabled: true, sourceBasis: "Meyer_2021",
    heading: "School Trip / School Event", defaultTitle: "School Trip / School Event",
    titlePrompt: "Trip / event name", dateTimePrompt: "When is the meal or food activity you are planning for?",
    venuePrompt: "School/event location (optional)",
  },
  travel: {
    label: "Travel / Family Vacation", enabled: true, sourceBasis: "Meyer_2021",
    heading: "Travel / Family Vacation", defaultTitle: "Travel / Family Vacation",
    titlePrompt: "Trip / vacation moment", dateTimePrompt: "When is the meal or food activity you are planning for?",
    venuePrompt: "Place / destination (optional)",
  },
  party: {
    label: "Party / Social Event", enabled: true, sourceBasis: "My_C-Day_2.0_extension",
    heading: "Party / Social Event", defaultTitle: "Party / Social Event",
    titlePrompt: "Party / event name", dateTimePrompt: "When is the event?",
    venuePrompt: "Place (optional)",
  },
  friends_house: {
    label: "Friend’s House / Sleepover", enabled: true, sourceBasis: "My_C-Day_2.0_extension",
    heading: "Friend’s House / Sleepover", defaultTitle: "Friend’s House / Sleepover",
    titlePrompt: "Visit / sleepover name", dateTimePrompt: "When does the visit or food moment start?",
    venuePrompt: "Friend’s house / place (optional)",
  },
  sports: {
    label: "Sports / Team Event", enabled: true, sourceBasis: "My_C-Day_2.0_extension",
    heading: "Sports / Team Event", defaultTitle: "Sports / Team Event",
    titlePrompt: "Practice / game / team event", dateTimePrompt: "When is the event or team food activity?",
    venuePrompt: "Field / venue (optional)",
  },
  custom: {
    label: "Create My Own C-Day", enabled: true, sourceBasis: "My_C-Day_2.0_extension",
    heading: "Create My Own C-Day", defaultTitle: "",
    titlePrompt: "What are you planning for?", dateTimePrompt: "When is it happening?",
    venuePrompt: "Place (optional)", customTitleRequired: true, showAllApprovedActions: true,
  },
} as const;
export type CDayEventType = keyof typeof cDayEventConfig;
export const eventTypes = (Object.keys(cDayEventConfig) as CDayEventType[])
  .map(id => [id, cDayEventConfig[id].label] as const);
/** Future optional metadata only: absent tags must never exclude an approved action. */
export type ActionApplicability = { event_tags?: readonly CDayEventType[] };
