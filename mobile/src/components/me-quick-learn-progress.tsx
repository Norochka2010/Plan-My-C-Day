import {importLegacyExplore,legacyImportStatus} from '@/lib/explore-legacy-import';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { readExploreProgress, type ExploreProgressSummary } from '@/lib/explore-progress';

export function MeQuickLearnProgress() {
  const [totals, setTotals] = useState<ExploreProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [legacyCount,setLegacyCount]=useState(0),[importing,setImporting]=useState(false),[importMessage,setImportMessage]=useState('');
  const generation = useRef(0), focused = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      const [value,legacy] = await Promise.all([readExploreProgress(),legacyImportStatus()]);
      if (focused.current && generation.current === request) setLegacyCount(legacy.count);
      if (focused.current && generation.current === request) setTotals(value);
    } catch {
      if (focused.current && generation.current === request) setFailed(true);
    } finally {
      if (focused.current && generation.current === request) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true; void refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { focused.current = false; generation.current++; listener.remove(); };
  }, [refresh]));
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.heading}>Your Explore progress</Text>
    <Text style={s.note}>Saved to your account · Separate from your Plan XP</Text>
    {legacyCount>0 && <View style={s.row}>
      <Text style={s.body}>{legacyCount} earlier activity records are still on this phone. Import them to include them in your account totals.</Text>
      <Pressable accessibilityRole="button" disabled={importing} style={s.button} onPress={()=>Alert.alert('Import earlier Explore progress?', 'Only import if this phone’s earlier progress belongs to your signed-in account. The original phone records will be kept as a backup.', [{text:'Not now',style:'cancel'},{text:'Import my progress',onPress:()=>{setImporting(true);setImportMessage('');void importLegacyExplore().then(()=>{setImportMessage('Your earlier progress is saved to your account.');void refresh();}).catch(()=>setImportMessage('Import could not finish. Your phone records are safe. Check your connection and retry; already imported awards will not duplicate.')).finally(()=>setImporting(false));}}])}><Text style={s.body}>{importing?'Importing…':'Import my earlier progress'}</Text></Pressable>
    </View>}
    {!!importMessage&&<Text accessibilityLiveRegion="polite" style={s.body}>{importMessage}</Text>}
    {loading ? <ActivityIndicator accessibilityLabel="Loading Explore progress" /> : failed ? <>
      <Text style={s.body}>Your Explore total couldn’t load. Your saved awards haven’t been changed.</Text>
      <Pressable accessibilityRole="button" style={s.button} onPress={() => void refresh()}><Text style={s.body}>Try again</Text></Pressable>
    </> : totals && <View accessibilityLiveRegion="polite">
      <Text style={s.xp}>✦ {totals.xp} XP</Text>
      <Pressable accessibilityRole="button" accessibilityState={{expanded}} style={s.button} onPress={()=>setExpanded(v=>!v)}>
        <Text style={s.body}>{expanded ? 'Hide category details −' : 'View category details +'}</Text>
      </Pressable>
      {expanded && totals.categories.map(category => <View key={category.title} style={s.row}><Text style={s.body}>{category.title}</Text><Text style={s.note}>{category.xp === null ? 'XP tracking not yet available' : `${category.xp} XP · ${category.completed} completed`}</Text></View>)}
    </View>}
  </View>;
}
const s = StyleSheet.create({
  row: { marginTop: 12, gap: 2 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E1E5DA', borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  heading: { fontSize: 21, fontWeight: '700', color: '#294B36' },
  xp: { fontSize: 24, fontWeight: '700', color: '#355D3C', marginBottom: 6 },
  body: { fontSize: 16, lineHeight: 23, color: '#344B3B' },
  note: { fontSize: 14, lineHeight: 21, color: '#536651' },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EAF0F7', borderRadius: 14, padding: 12 },
});
