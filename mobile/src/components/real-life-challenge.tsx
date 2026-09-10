import { ExploreActionButton as Action } from '@/components/explore-action-button';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { getExploreContent, type ExploreSummary } from '@/lib/explore-content';
import { parseRealLifeChallenge, matchesChallengeRelation, type RealLifeChallenge as Challenge } from '@/lib/real-life-challenge-model';
import { readChallengeProgress, updateChallengeProgress, type ChallengeProgress } from '@/lib/real-life-challenge-progress';
export function RealLifeChallenge({contentId,onClose,onOpen,publishedOnly=false,backLabel='‹ Back to Explore'}:{contentId:string;onClose:()=>void;onOpen:(item:ExploreSummary)=>void;publishedOnly?:boolean;backLabel?:string}) {
  const [card,setCard]=useState<Challenge|null>(null),[progress,setProgress]=useState<ChallengeProgress|null>(null);
  const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[message,setMessage]=useState('');
  const [related,setRelated]=useState<ExploreSummary[]>([]),[relatedFailed,setRelatedFailed]=useState(false);
  const lock=useRef(false),generation=useRef(0);
  useEffect(()=>{
    const request=++generation.current;let active=true;
    setLoading(true);setFailed(false);setReady(false);setCard(null);setProgress(null);setRelated([]);setRelatedFailed(false);setMessage('');
    getExploreContent(contentId,{publishedOnly}).then(row=>{if(active)setCard(parseRealLifeChallenge(row))}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setLoading(false)});
    readChallengeProgress(contentId).then(p=>{if(active){setProgress(p);setReady(true)}}).catch(()=>{if(active)setMessage('Your saved progress couldn’t load. Please retry before continuing.')});
    return()=>{active=false;if(generation.current===request)generation.current++};
  },[contentId,publishedOnly,retry]);
  useEffect(()=>{
    let active=true;if(!card || progress?.status!=='completed')return;
    Promise.all(card.related.map(async link=>{const row=await getExploreContent(link.uuid,{publishedOnly});return row && matchesChallengeRelation(row,link)?row:null})).then(items=>{if(active){setRelated(items.filter((x):x is NonNullable<typeof x>=>x!==null));setRelatedFailed(items.some(x=>!x))}}).catch(()=>{if(active)setRelatedFailed(true)});
    return()=>{active=false};
  },[card,progress?.status,publishedOnly]);
  async function save(action:'start'|'tried'|'complete',reflection?:string) {
    if(!card || !ready || lock.current)return;
    lock.current=true;setBusy(true);setMessage('');const request=generation.current;
    try {const p=await updateChallengeProgress(card,action,reflection);if(generation.current===request)setProgress(p)}
    catch {if(generation.current===request)setMessage('That didn’t save. Please try again. Your challenge can wait.')}
    finally {lock.current=false;if(generation.current===request)setBusy(false)}
  }
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Action variant="navigation" label={backLabel} onPress={onClose} disabled={busy}/>
    <Text style={s.title} accessibilityRole="header">Real-Life Challenge</Text>
    {loading?<Text style={s.body}>Loading challenge…</Text>:failed?<><Text style={s.body}>This challenge couldn’t load.</Text><Action label="Try again" onPress={()=>setRetry(v=>v+1)}/></>:!card?<Text style={s.body}>This challenge isn’t available right now.</Text>:<>
      <Text style={s.small}>{card.domain} · {card.skill} · {card.difficulty}</Text>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{card.title}</Text><Text style={s.body}>{card.instruction}</Text></View>
      <View style={s.card}><Text style={s.heading}>How to Try It</Text>{card.steps.map((step,i)=><View key={i} style={s.step}><Text style={s.body}>{i+1}.</Text><Text style={[s.body,{flex:1}]}>{step}</Text></View>)}</View>
      <View style={[s.card,s.green]}><Text style={s.heading}>Safety / Completion Note</Text><Text style={s.body}>{card.safety_note}</Text></View>
      <Text style={s.small}>This challenge is optional. You can return whenever you’re ready.</Text>
      {!ready?<Action label="Retry progress" onPress={()=>setRetry(v=>v+1)} disabled={busy}/>:!progress?<Action label={busy?'Saving…':"I'll Try This"} onPress={()=>void save('start')} disabled={busy}/>:progress.status==='started'?<><Text style={s.body}>Come back after you’ve tried the skill.</Text><Action label={busy?'Saving…':'I tried it'} onPress={()=>void save('tried')} disabled={busy}/></>:progress.status==='tried'?<View style={s.card}><Text accessibilityRole="header" style={s.heading}>How did it go?</Text>{card.reflection_options.map(option=><Action variant="choice" key={option} label={option} onPress={()=>void save('complete',option)} disabled={busy}/>)}{busy&&<Text style={s.body}>Saving your reflection…</Text>}</View>:<View style={[s.card,s.green]} accessibilityLiveRegion="polite"><Text style={s.heading}>{card.completion_message}</Text><Text style={s.body}>Completed ✓</Text><Text style={s.body}>{progress.reflection}</Text><Text style={s.small}>{progress.xp} XP recorded · Awarded once</Text></View>}
      {progress?.status==='completed'&&<>{related.map(item=><Action variant="navigation" key={item.content_id} label={`${item.content_type==='QUICK_LEARN'?'Quick Learn':'Practice a Skill'}: ${item.title}`} onPress={()=>onOpen(item)} disabled={busy}/>)}{relatedFailed&&<Text style={s.small}>Related learning isn’t available right now. Your completion is saved.</Text>}</>}
      <Text style={s.body}>Source: {card.source_basis}</Text>
      {card.source_url&&/^https?:\/\//i.test(card.source_url)&&<Action variant="navigation" label="Read the source ↗" onPress={()=>{Linking.openURL(card.source_url!).catch(()=>setMessage('The source link couldn’t open. Please try again.'))}} disabled={busy}/>}
      <Text style={s.small}>Challenge progress and XP are saved on this device.</Text>
    </>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#FFFCF7'},content:{padding:24,paddingBottom:40,gap:18,width:'100%',maxWidth:640,alignSelf:'center'},
  title:{fontFamily:Fonts.rounded,fontSize:30,lineHeight:38,fontWeight:'600',color:'#34472F'},heading:{fontFamily:Fonts.rounded,fontSize:20,lineHeight:28,fontWeight:'600',color:'#34472F'},
  body:{fontSize:16,lineHeight:26,color:'#53604B'},small:{fontSize:13,lineHeight:20,color:'#66715F'},
  card:{backgroundColor:'#FFF3DC',borderColor:'#EBD4A5',borderWidth:1,borderRadius:22,padding:20,gap:12},green:{backgroundColor:'#EDF5E7',borderColor:'#C5DDB5'},
  step:{flexDirection:'row',gap:10},button:{backgroundColor:'#E8F0DF',borderRadius:14,minHeight:48,padding:14,alignItems:'center',justifyContent:'center'},label:{fontSize:16,fontWeight:'600',color:'#365037'},
});
