import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { parseFriendlyTime, parseFriendlyDate } from "@/lib/c-day-input";
import { useEffect, useState, useRef } from "react";
import {
  Modal,
  Keyboard,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editable?: boolean;
};
const displayDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(5, 7)}-${value.slice(8)}-${value.slice(0, 4)}`
    : "";
export function PlanDateField({
  label,
  value,
  onChange,
  editable = true,
}: Props) {
  const focused = useRef(false);
  const [text, setText] = useState(displayDate(value)),
    [open, setOpen] = useState(false),
    [month, setMonth] = useState(new Date());
  useEffect(() => {
    if (value && !focused.current) setText(displayDate(value));
  }, [value]);
  function show() {
    Keyboard.dismiss();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date();
    setMonth(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    setOpen(true);
  }
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = new Date(year, m, 1).getDay(),
    days = new Date(year, m + 1, 0).getDate();
  return (
    <View style={s.gap}>
      <Text style={s.label}>{label} (MM-DD-YYYY)</Text>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={`${label} MM-DD-YYYY`}
          editable={editable}
          style={[s.input, { flex: 1 }]}
          value={text}
          placeholder="09-18-2026"
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          placeholderTextColor="#82768B"
          maxLength={10}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            const parsed = parseFriendlyDate(text);
            if (parsed) setText(parsed.display);
          }}
          onChangeText={(v) => {
            setText(v);
            onChange(parseFriendlyDate(v)?.value ?? "");
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open calendar for ${label}`}
          disabled={!editable}
          onPress={show}
          style={s.button}
        >
          <Text style={s.label}>Calendar</Text>
        </Pressable>
      </View>
      <Modal
        transparent
        visible={open}
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}>
        <View style={s.overlay}>
          <ScrollView
            style={{ width: "100%", maxWidth: 380 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            <View accessibilityViewIsModal style={s.calendar}>
              <View style={s.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  style={s.button}
                  onPress={() => setMonth(new Date(year, m - 1, 1))}
                >
                  <Text>‹</Text>
                </Pressable>
                <Text style={[s.label, { flex: 1, textAlign: "center" }]}>
                  {month.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  style={s.button}
                  onPress={() => setMonth(new Date(year, m + 1, 1))}
                >
                  <Text>›</Text>
                </Pressable>
              </View>
              <View style={s.grid}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <View key={d} style={s.cell}>
                    <Text>{d}</Text>
                  </View>
                ))}
                {Array.from({ length: first }, (_, i) => (
                  <View key={`blank${i}`} style={s.cell} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                  return (
                    <Pressable
                      key={iso}
                      accessibilityRole="button"
                      accessibilityLabel={`${displayDate(iso)}${iso === todayIso ? ", Today" : ""}`}
                      accessibilityState={{ selected: value === iso }}
                      style={[s.cell, value === iso && s.selected, iso === todayIso && s.today]}
                      onPress={() => {
                        setText(displayDate(iso));
                        onChange(iso);
                        setOpen(false);
                      }}
                    >
                      <Text style={s.label}>{i + 1}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.hint}>Purple outline: today · Green fill: selected date</Text>
              <Pressable accessibilityRole="button" style={s.button} onPress={() => setMonth(new Date())}>
                <Text style={s.label}>Show today</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.button}
                onPress={() => setOpen(false)}
              >
                <Text style={s.label}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
        </SafeAreaView></SafeAreaProvider>
      </Modal>
    </View>
  );
}
function parts(value: string) {
  const h = Number(value.slice(0, 2));
  return {
    text: value
      ? `${h % 12 || 12}:${value.slice(3)} ${h >= 12 ? "pm" : "am"}`
      : "",
    period: h >= 12 ? "PM" : "AM",
  };
}
export function PlanTimeField({ label, value, onChange, editable = true }: Props) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(6), [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState("AM");
  const [typing, setTyping] = useState(false), [text, setText] = useState("");
  function show() {
    Keyboard.dismiss();
    const parsed = parseFriendlyTime(parts(value).text);
    const h = parsed ? Number(parsed.value.slice(0, 2)) : 6;
    setHour(h % 12 || 12);
    setMinute(parsed ? Number(parsed.value.slice(3, 5)) : 0);
    setPeriod(h >= 12 ? "PM" : "AM");
    setText(parts(value).text); setTyping(false); setOpen(true);
  }
  const draft = typing ? parseFriendlyTime(text, period) : parseFriendlyTime(`${hour}:${String(minute).padStart(2,"0")}`, period);
  function choice(label: string, selected: boolean, onPress: () => void) {
    return <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label}
      accessibilityState={{ checked: selected }} onPress={onPress}
      style={[s.timeChoice, selected && s.selected]}>
      <Text style={s.label}>{label}</Text>
    </Pressable>;
  }
  return <View style={s.gap}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${parts(value).text || "Choose time"}`}
      accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={show} style={[s.input,s.row]}>
      <Text style={[s.label,{flex:1}]}>{parts(value).text || "Choose time"}</Text>
      <Text style={s.label}>▾</Text>
    </Pressable>
    <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
      <SafeAreaProvider><SafeAreaView style={{flex:1}}><View style={s.overlay}>
        <ScrollView style={{width:"100%",maxWidth:380}} contentContainerStyle={{flexGrow:1,justifyContent:"center"}}
          keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View accessibilityViewIsModal style={s.calendar}>
            <Text accessibilityRole="header" style={[s.label,{fontSize:22,fontWeight:"700"}]}>{label}</Text>
            {typing ? <>
              <Text style={s.hint}>Type 630 or 6:30, with AM or PM.</Text>
              <TextInput accessibilityLabel="Type exact time" value={text} onChangeText={v=>{setText(v);const parsed=parseFriendlyTime(v,period);if(parsed)setPeriod(parsed.period);}}
                style={s.input} placeholder="6:30 am" autoCapitalize="none" autoCorrect={false}
                returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            </> : <>
              <Text style={s.label}>Hour</Text>
              <View style={s.timeGrid}>{Array.from({length:12},(_,i)=>i+1).map(h=>choice(String(h),hour===h,()=>setHour(h)))}</View>
              <Text style={s.label}>Minutes</Text>
              <View style={s.timeGrid}>{[0,15,30,45].map(m=>choice(String(m).padStart(2,"0"),minute===m,()=>setMinute(m)))}</View>
              {![0,15,30,45].includes(minute)&&<Text style={s.hint}>Keeping your saved minute ({minute}) until you choose another.</Text>}
            </>}
            <View style={s.timeGrid}>{["AM","PM"].map(p=>choice(p,period===p,()=>{
              setPeriod(p);
              if(typing) setText(text.replace(/\s*(am|pm)$/i,""));
            }))}</View>
            <Text accessibilityLiveRegion="polite" style={[s.label,{fontWeight:"700"}]}>{draft ? draft.display : "Enter a valid time to continue."}</Text>
            <Pressable accessibilityRole="button" style={s.button} onPress={()=>{
              if(!typing) setText(draft?.display ?? "");
              else if(draft) { const h=Number(draft.value.slice(0,2)); setHour(h%12||12); setMinute(Number(draft.value.slice(3,5))); setPeriod(h>=12?"PM":"AM"); }
              Keyboard.dismiss(); setTyping(!typing);
            }}><Text style={s.label}>{typing ? "Use time buttons" : "Type an exact time"}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{disabled:!draft}} disabled={!draft}
              style={[s.button,{backgroundColor:draft?"#426B43":"#E6E3DE"}]} onPress={()=>{
                if(draft){onChange(draft.value);Keyboard.dismiss();setOpen(false);}
              }}><Text style={[s.label,{color:draft?"#FFFFFF":"#68645F",textAlign:"center",fontWeight:"700"}]}>Use this time</Text></Pressable>
            <Pressable accessibilityRole="button" style={s.button} onPress={()=>{Keyboard.dismiss();setOpen(false);}}><Text style={s.label}>Cancel</Text></Pressable>
          </View>
        </ScrollView>
      </View></SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  today: { borderWidth: 2, borderColor: "#806493" },
  hint: { fontSize: 13, lineHeight: 20, color: "#62556E" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChoice: { minWidth: 48, minHeight: 48, flexGrow: 1, flexBasis: "20%", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 12, backgroundColor: "#F0EAF5" },
  gap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 16, lineHeight: 22, color: "#354C29" },
  input: {
    borderWidth: 1,
    borderColor: "#C5DDB5",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#302040",
    backgroundColor: "#FFF",
    minHeight: 50,
  },
  button: {
    padding: 12,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#E1EED7",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 16,
  },
  calendar: {
    width: "100%",
    maxWidth: 380,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFCF7",
    gap: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.2857%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  selected: {
    backgroundColor: "#C5DDB5",
    borderWidth: 1,
    borderColor: "#557A40",
  },
});
