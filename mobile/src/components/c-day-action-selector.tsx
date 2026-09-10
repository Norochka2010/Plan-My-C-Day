import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CDayAction, LibraryAction } from "@/lib/c-day-model";
export function CDayActionSelector({
  category,
  items,
  selected,
  busy,
  onAdd,
  onRemove,
  onConfigure,
}: {
  category: string;
  items: LibraryAction[];
  selected: CDayAction[];
  busy: boolean;
  onAdd: (item: LibraryAction) => void;
  onRemove: (action: CDayAction) => void;
  onConfigure: (action: CDayAction) => void;
}) {
  const visible = items.filter((item) => item.category === category);
  return (
    <View style={s.list}>
      <Text accessibilityLiveRegion="polite" style={s.count}>
        {selected.length} of 6 selected
      </Text>
      {selected.length >= 6 && (
        <Text style={s.body}>
          Your draft has six actions. Remove one to choose another.
        </Text>
      )}
      {!visible.length && (
        <Text style={s.body}>
          No actions are available in this category yet.
        </Text>
      )}
      {visible.map((item) => {
        const instance = selected.find((a) => a.action_library_id === item.id),
          disabled = busy || (!instance && selected.length >= 6);
        return (
          <View key={item.id} style={[s.card, !!instance && s.selected]}>
            <View style={s.headingRow}>
              <Text style={s.title}>{item.action_text}</Text>
              {!!instance && <Text accessibilityLabel="Selected" style={s.check}>✓</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${instance ? "Remove" : "Add"}: ${item.action_text}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              style={[s.button, !!instance && s.secondary, disabled && s.disabled]}
              onPress={() => (instance ? onRemove(instance) : onAdd(item))}
            >
              <Text style={[s.buttonText, !!instance && s.secondaryText, disabled && s.disabledText]}>
                {instance
                  ? "Remove from draft"
                  : item.id === "call_01"
                    ? "Choose and schedule"
                    : "Add to draft"}
              </Text>
            </Pressable>
            {!!instance && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                accessibilityState={{ disabled: busy }}
                style={[s.button, busy && s.disabled]}
                onPress={() => onConfigure(instance)}
              >
                <Text style={[s.buttonText, busy && s.disabledText]}>
                  {instance.scheduled_at
                    ? "Edit schedule or difficulty"
                    : "Schedule this action"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  headingRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  check: { color: "#FFFFFF", backgroundColor: "#705384", borderRadius: 14, width: 28, height: 28, textAlign: "center", lineHeight: 28, fontWeight: "700" },
  count: { alignSelf: "flex-start", backgroundColor: "#E9EFDF", color: "#405D35", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: "700" },
  secondary: { backgroundColor: "#EAF0F7" },
  secondaryText: { color: "#354F70" },
  disabledText: { color: "#676B61" },
  list: { gap: 12 },
  body: { fontSize: 15, lineHeight: 23, color: "#62556E" },
  title: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: "600", color: "#302040" },
  card: {
    padding: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: "#D5DDCF",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
  },
  selected: { backgroundColor: "#F3EDF7", borderColor: "#806493" },
  button: {
    padding: 14,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#426B43",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  disabled: { backgroundColor: "#EEEFEA" },
});
