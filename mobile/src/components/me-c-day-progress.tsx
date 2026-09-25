import { BackButton } from './back-button';
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, AppState, PanResponder, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getCompletedCDayHistory, summarizeCDayHistory, type HistoricalCDay, type ActionHistory } from "@/lib/c-day-progress";
import { actionGrowth } from "@/lib/c-day-growth";
import { formatCardMoment, newId } from "@/lib/c-day-model";

function Comparison({ group }: { group: ActionHistory }) {
  const growth = actionGrowth(group);
  if (!growth.comparable) return <Text style={s.body}>Complete this action on another C-Day to see how your ratings change.</Text>;
  return <View style={s.comparison}>
    {[{ label: 'THEN', occasion: growth.first }, { label: 'LATEST', occasion: growth.latest }].map(({ label, occasion }) => <View style={s.compareTile} key={label}>
      <Text style={s.eyebrow}>{label}</Text>
      <Text style={s.rating}>{occasion.action.difficulty}</Text>
      <Text style={s.small}>{occasion.event.title}</Text>
      <Text style={s.small}>{formatCardMoment(occasion.event.event_start_at, occasion.event.event_timezone)}</Text>
    </View>)}
  </View>;
}
export function MeCDayProgress({ userId }: { userId: string }) {
  const router = useRouter();
  const [records, setRecords] = useState<HistoricalCDay[]>([]),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const generation = useRef(0),
    focused = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setFailed(false);
    try {
      const rows = await getCompletedCDayHistory(userId);
      if (focused.current && generation.current === request) setRecords(rows);
    } catch {
      if (focused.current && generation.current === request) setFailed(true);
    } finally {
      if (focused.current && generation.current === request) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
      return () => {
        focused.current = false;
        generation.current++;
        listener.remove();
      };
    }, [refresh]),
  );
  const summary = summarizeCDayHistory(records, userId);
  const highlights = summary.actions.filter(group => group.occasions.some(o => o.action.completion_status === 'done'))
    .sort((a, b) => {
      const x = actionGrowth(a), y = actionGrowth(b);
      return Number(y.change > 0) - Number(x.change > 0) || Number(y.comparable) - Number(x.comparable) ||
        Date.parse(y.latest?.event.event_start_at || '1970-01-01') - Date.parse(x.latest?.event.event_start_at || '1970-01-01');
    }).slice(0, 3);
  const currentIndex = highlights.length ? highlightIndex % highlights.length : 0;
  const moveHighlight = (direction: number) => setHighlightIndex((value) => (value + direction + highlights.length) % Math.max(1, highlights.length));
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => highlights.length > 1 && Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 40) moveHighlight(g.dx < 0 ? 1 : -1); },
  });
  const active = summary.actions.find(group => group.actionLibraryId === selected);
  return <View style={s.section}>
    <Text style={s.eyebrow}>YOUR C-DAY JOURNEY</Text>
    <Text accessibilityRole="header" style={s.heading}>Small steps. Real moments.</Text>
    <Text style={s.body}>Look at what you’ve tried—and what’s starting to feel easier.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Loading your journey" />}
    {failed && <View><Text style={s.body}>Couldn’t refresh your journey.{records.length ? ' Showing your last loaded moments.' : ''}</Text><Pressable accessibilityRole="button" style={s.button} onPress={() => void refresh()}><Text style={s.link}>Try again</Text></Pressable></View>}
    {!loading && !failed && !summary.completedCDays && <View style={s.highlight}><Text style={s.subheading}>Your first chapter starts here 🌱</Text><Text style={s.body}>After a C-Day, save a reflection. Your moments will start showing up here, at your pace.</Text></View>}
    {!!summary.completedCDays && <>
      <View style={s.tiles}>{[[summary.completedCDays, 'C-Days'], [summary.doneActions, 'Actions done'], [summary.earnedXP, 'Action XP']].map(([value, label]) => <View key={label} style={s.tile}><Text style={s.number}>{value}</Text><Text style={s.small}>{label}</Text></View>)}</View>
      <Text style={s.small}>From completed C-Days with saved reflections · Only you can see this.</Text>
      {!!highlights.length && <View style={{gap:10}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text accessibilityLiveRegion="polite" style={s.small}>Moment {currentIndex + 1} of {highlights.length}</Text>
        {highlights.length > 1 && <View style={{flexDirection:'row',gap:8}}>{[-1,1].map(direction=><Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Previous highlight' : 'Next highlight'} onPress={()=>moveHighlight(direction)} style={[s.button,{minWidth:44,alignItems:'center'}]}><Text style={s.link}>{direction < 0 ? '‹' : '›'}</Text></Pressable>)}</View>}
      </View>
      <View {...swipe.panHandlers}>
      {highlights.slice(currentIndex,currentIndex+1).map(group => <Pressable key={group.actionLibraryId} accessibilityRole="button" accessibilityLabel={`See moments for ${group.title}`} style={s.highlight} onPress={() => {setSelected(group.actionLibraryId); setHistory(true);}}>
        <Text style={s.eyebrow}>{actionGrowth(group).change > 0 ? '✦ ' : '🌱 '}{actionGrowth(group).label}</Text>
        <Text style={s.subheading}>{group.title}</Text>
        <Comparison group={group} />
        <Text style={s.link}>See your moments →</Text>
      </Pressable>)}
      </View></View>}
      {!highlights.length && <Text style={s.body}>You made time to reflect. Actions you mark done will appear in your highlights.</Text>}
      <Text style={s.small}>Your saved ratings, at different moments. Some days feel harder, and that’s okay too.</Text>
      <Pressable accessibilityRole="button" style={s.button} onPress={() => {setSelected(null); setHistory(true);}}><Text style={s.link}>All actions & moments →</Text></Pressable>
    </>}
    <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push({pathname:'/plan',params:{view:'history',entry:newId()}})}><Text style={s.link}>Past C-Days →</Text></Pressable>
    <Modal visible={history} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {if(selected)setSelected(null); else setHistory(false);}}>
      <SafeAreaProvider><SafeAreaView style={s.screen}>
        <View style={s.header}><BackButton label={selected ? '‹ All actions' : '‹ Back to Me'} onPress={() => {if(selected)setSelected(null); else setHistory(false);}}/><Text accessibilityRole="header" style={s.heading}>{active ? 'Your moments' : 'Your action collection'}</Text></View>
        {active ? <FlatList key={active.actionLibraryId} contentContainerStyle={s.list} data={active.occasions} keyExtractor={item => item.action.id}
          ListHeaderComponent={<View style={s.gap}><Text style={s.subheading}>{active.title}</Text><Comparison group={active}/><Text style={s.small}>Newest first · Your original wording and ratings for each C-Day.</Text></View>}
          renderItem={({item:{event,action}}) => <View style={s.highlight}>
            <Text style={s.subheading}>{event.title}</Text><Text style={s.small}>{formatCardMoment(event.event_start_at,event.event_timezone)}</Text>
            <Text style={s.body}>{action.action_text_snapshot}</Text><Text style={s.rating}>{action.difficulty ? `Rated ${action.difficulty}` : 'No rating saved'}</Text>
            <Text style={s.small}>{action.completion_status === 'done' ? '✓ Done' : action.completion_status === 'not_needed' ? 'Not needed' : 'Planned · no outcome recorded'}</Text>
            <Pressable accessibilityRole="button" style={s.button} onPress={() => {setHistory(false); router.push({pathname:'/plan',params:{eventId:event.id,entry:newId()}});}}><Text style={s.link}>Open this C-Day →</Text></Pressable>
          </View>}/>
        : <FlatList key="collection" contentContainerStyle={s.list} data={summary.actions} keyExtractor={item => item.actionLibraryId}
          ListEmptyComponent={<Text style={s.body}>No actions saved yet.</Text>}
          renderItem={({item}) => <Pressable accessibilityRole="button" style={s.highlight} onPress={() => setSelected(item.actionLibraryId)}><Text style={s.subheading}>{item.title}</Text><Text style={s.small}>{item.occasions.length} saved {item.occasions.length === 1 ? 'moment' : 'moments'} · {item.occasions.filter(o=>o.action.completion_status==='done').length} done</Text><Text style={s.link}>See moments →</Text></Pressable>}/>}</SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  section: { gap:14, backgroundColor:'#F0EDF5', borderRadius:24, padding:18 },
  heading:{color:'#302040',fontSize:23,lineHeight:30,fontWeight:'700'},
  subheading:{color:'#35204E',fontSize:17,lineHeight:25,fontWeight:'600'},
  eyebrow:{color:'#426B43',fontSize:12,lineHeight:18,fontWeight:'700',letterSpacing:0.6},
  body:{color:'#62556E',fontSize:15,lineHeight:23},
  small:{color:'#62556E',fontSize:13,lineHeight:20},
  tiles:{flexDirection:'row',flexWrap:'wrap',gap:8},
  tile:{flexGrow:1,flexBasis:80,padding:12,borderRadius:16,backgroundColor:'#E3EDD9',gap:4},
  number:{color:'#36552F',fontSize:26,fontWeight:'700'},
  highlight:{backgroundColor:'#FFFCF7',borderRadius:18,padding:16,gap:12},
  comparison:{flexDirection:'row',flexWrap:'wrap',gap:8},
  compareTile:{flex:1,minWidth:105,padding:10,gap:4,borderRadius:12,backgroundColor:'#EDF5E7'},
  rating:{color:'#36552F',fontSize:16,lineHeight:23,fontWeight:'600',textTransform:'capitalize'},
  button:{minHeight:48,justifyContent:'center',padding:12,borderRadius:14,backgroundColor:'#E5DDF0'},
  link:{color:'#5D4277',fontSize:15,fontWeight:'600',lineHeight:22},
  screen:{flex:1,backgroundColor:'#FFFCF7'},
  header:{padding:20,gap:16},list:{padding:20,paddingTop:0,gap:12},gap:{gap:14,marginBottom:12},
});
