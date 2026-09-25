import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, AppState, Modal, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { readAccountProgress, type AccountProgress } from '@/lib/explore-account-progress';
import { getExploreCatalog } from '@/lib/explore-content';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/theme';
const looks = [
  { name: 'Classic', source: require('@/assets/images/leaf.png') },
  { name: 'Celebrate', source: require('@/assets/images/simulations/leaf-party-v1.png') },
  { name: 'Adventure', source: require('@/assets/images/simulations/leaf-travel-v1.png') },
];
const colors = [
  { name: 'Lilac', bg: '#EEE7FA', ink: '#634581' },
  { name: 'Sage', bg: '#EAF3E3', ink: '#416139' },
  { name: 'Peach', bg: '#FCECDF', ink: '#89512E' },
  { name: 'Sky', bg: '#E8EFFB', ink: '#47658D' },
];
export function MePersonalSpace({ userId, firstName, revision }: { userId: string; firstName: string; revision: number }) {
  const [look, setLook] = useState(0), [color, setColor] = useState(0), [customize, setCustomize] = useState(false);
  const [draftLook,setDraftLook]=useState(0),[draftColor,setDraftColor]=useState(0);
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState('');
  const [rows, setRows] = useState<AccountProgress[] | null>(null), [titles, setTitles] = useState<Record<string,string>>({});
  const [username, setUsername] = useState(''), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const key = `me-look:v1:${userId}`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then(raw => {
      if (!active || !raw) return;
      const value = JSON.parse(raw);
      if (Number.isInteger(value.look) && looks[value.look]) setLook(value.look);
      if (Number.isInteger(value.color) && colors[value.color]) setColor(value.color);
    }).catch(() => { if (active) setSaveError('Your saved look could not load. You can choose it again.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);
  async function choose(nextLook: number, nextColor: number) {
    if (!ready || saving) return;
    setSaving(true); setSaveError('');
    try { await AsyncStorage.setItem(key, JSON.stringify({ look: nextLook, color: nextColor })); setLook(nextLook); setColor(nextColor); setCustomize(false); }
    catch { setSaveError('That look could not save. Please try again.'); }
    finally { setSaving(false); }
  }
  useFocusEffect(useCallback(() => {
    let active = true, generation = 0;
    async function refresh() {
      const request = ++generation;
      setFailed(false);
      try {
        const progress = await readAccountProgress();
        if (active && request === generation) setRows(progress.filter(row => row.status === 'completed'));
      } catch { if (active && request === generation) { setRows(null); setFailed(true); } }
    }
    void refresh();
    // Titles and username are optional; their absence must not hide saved awards.
    getExploreCatalog().then(items => { if (active) setTitles(Object.fromEntries(items.map(item => [item.content_id, item.title]))); }).catch(() => {});
    void Promise.resolve(supabase.from('account_profiles').select('username').eq('user_id', userId).maybeSingle()).then(({data}) => { if (active) setUsername(data?.username || ''); }).catch(() => {});
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; generation++; listener.remove(); };
  }, [userId, revision, retry]));
  const theme = colors[color];
  const recent = [...(rows ?? [])].sort((a,b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0,3);
  return <View style={s.stack}>
    <View style={[s.hero, {backgroundColor: theme.bg}]}>
      <View style={s.profileRow}>
        <Image source={looks[look].source} contentFit="contain" accessibilityLabel={`Leaf · ${looks[look].name}`} accessible style={s.profileLeaf}/>
        <View style={s.profileCopy}>
          <Text accessibilityRole="header" style={[s.title,{textAlign:'left',fontSize:26,lineHeight:33}]}>Hey, {firstName || 'you'}!</Text>
          {!!username && <Text style={[s.label,{color:theme.ink}]}>@{username}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{expanded:customize}} onPress={() => {setDraftLook(look);setDraftColor(color);setSaveError('');setCustomize(true);}} style={[s.button,{alignSelf:'flex-start',paddingHorizontal:14}]}><Text style={[s.buttonText,{color:theme.ink}]}>Edit avatar ✧</Text></Pressable>
        </View>
      </View>
      <Modal visible={customize} animationType="slide" onRequestClose={()=>{if(!saving)setCustomize(false);}}>
        <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#FFFCF7'}}><ScrollView contentContainerStyle={{padding:24,gap:20,width:'100%',maxWidth:640,alignSelf:'center'}}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={()=>setCustomize(false)} style={s.button}><Text style={s.buttonText}>Cancel</Text></Pressable>
        <Text accessibilityRole="header" style={s.title}>Make it yours</Text>
        <View style={[s.hero,{backgroundColor:colors[draftColor].bg}]}><Image source={looks[draftLook].source} contentFit="contain" accessibilityLabel={`Avatar preview: ${looks[draftLook].name}, ${colors[draftColor].name}`} accessible style={s.leaf}/></View>
        <Text style={s.center}>Choose your Leaf</Text>
        <View style={s.options}>{looks.map((item,index) => <Pressable key={item.name} disabled={!ready || saving} accessibilityRole="button" accessibilityState={{selected:draftLook===index,disabled:!ready||saving}} onPress={() => setDraftLook(index)} style={[s.option,draftLook===index && {borderColor:theme.ink}]}><Image source={item.source} contentFit="contain" style={{width:64,height:64}}/><Text style={s.label}>{item.name}{draftLook===index ? ' ✓' : ''}</Text></Pressable>)}</View>
        <Text style={s.center}>Pick your color</Text>
        <View style={s.options}>{colors.map((item,index) => <Pressable key={item.name} disabled={!ready || saving} accessibilityRole="button" accessibilityState={{selected:draftColor===index,disabled:!ready||saving}} onPress={() => setDraftColor(index)} style={[s.option,{backgroundColor:item.bg},draftColor===index && {borderColor:item.ink}]}><Text style={[s.label,{color:item.ink}]}>{item.name}{draftColor===index ? ' ✓' : ''}</Text></Pressable>)}</View>
        <Text style={s.caption}>Your look is saved for this account on this phone.</Text>
        {!!saveError && <Text accessibilityRole="alert" style={s.caption}>{saveError}</Text>}
        <Pressable accessibilityRole="button" disabled={!ready||saving} accessibilityState={{disabled:!ready||saving}} onPress={()=>void choose(draftLook,draftColor)} style={[s.button,{backgroundColor:'#426B43',opacity:!ready||saving?0.5:1}]}><Text style={[s.buttonText,{color:'#FFFFFF'}]}>{saving?'Saving…':'Save my avatar'}</Text></Pressable>
        </ScrollView></SafeAreaView></SafeAreaProvider></Modal>
      {!!saveError && <Text accessibilityLiveRegion="polite" style={s.caption}>{saveError}</Text>}
    </View>
    <View style={[s.card,{backgroundColor:'#FFF3D8'}]}>
      <Text accessibilityRole="header" style={s.heading}>Look what you’ve done ✦</Text>
      {failed ? <Pressable accessibilityRole="button" onPress={() => setRetry(v => v+1)} style={s.button}><Text style={s.buttonText}>Couldn’t load progress · Try again</Text></Pressable> : rows === null ? <ActivityIndicator accessibilityLabel="Loading accomplishments"/> : <>
        <View style={s.options}><View style={s.stat}><Text style={s.number}>★ {rows.reduce((n,row)=>n+row.xp_awarded,0)}</Text><Text style={s.label}>Explore XP</Text></View><View style={s.stat}><Text style={s.number}>{rows.length}</Text><Text style={s.label}>Activities completed</Text></View></View>
        <Text style={s.caption}>{rows.length ? 'Every step you’ve taken counts. Keep going at your pace.' : 'Your first little step is worth celebrating. Explore whenever you’re ready.'}</Text>
      </>}
    </View>
    <View style={[s.card,{backgroundColor:theme.bg}]}>
      <Text accessibilityRole="header" style={s.heading}>My proud moments ★</Text>
      {failed ? <Text style={s.caption}>Your moments will return when progress loads.</Text> : rows === null ? <Text style={s.caption}>Finding your moments…</Text> : recent.length ? recent.map(row => <View key={row.content_id} style={s.moment}><Text accessible={false} style={{fontSize:24,color:theme.ink}}>✦</Text><View style={{flex:1,gap:4}}><Text style={s.label}>{titles[row.content_id] || 'An Explore activity completed'}</Text><Text style={s.caption}>{row.completed_at ? new Date(row.completed_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ' · ' : ''}{row.xp_awarded} XP earned</Text></View></View>) : <Text style={s.caption}>A space for the things you try and finish. Your recent completions will appear here.</Text>}
    </View>
  </View>;
}
const s=StyleSheet.create({
  profileRow:{flexDirection:'row',alignItems:'center',gap:14},profileLeaf:{width:88,height:96},profileCopy:{flex:1,minWidth:0,gap:4},stack:{gap:12},hero:{borderRadius:22,padding:16,gap:8},eyebrow:{fontSize:16,fontWeight:'700',letterSpacing:2},leaf:{width:150,height:140,alignSelf:'center'},title:{fontFamily:Fonts.rounded,fontSize:30,lineHeight:38,fontWeight:'700',color:'#302040',textAlign:'center'},center:{fontSize:16,lineHeight:24,color:'#62556E',textAlign:'center'},button:{minHeight:48,padding:12,backgroundColor:'#FFFCF7',borderRadius:16,justifyContent:'center',alignItems:'center'},buttonText:{fontSize:16,lineHeight:24,fontWeight:'600',color:'#634581'},options:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},option:{borderWidth:2,borderColor:'transparent',borderRadius:16,padding:10,minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFCF7'},label:{fontSize:16,lineHeight:23,color:'#302040',fontWeight:'600'},caption:{fontSize:16,lineHeight:24,color:'#62556E'},card:{borderRadius:20,padding:16,gap:10},heading:{fontFamily:Fonts.rounded,fontSize:22,lineHeight:29,fontWeight:'700',color:'#302040'},stat:{flexGrow:1,flexBasis:120,padding:6,gap:3},number:{fontSize:28,fontWeight:'700',color:'#886014'},moment:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#FFFCF7',padding:10,borderRadius:14}
});
