import { ExploreActionButton as Action } from '@/components/explore-action-button';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { getExploreContent, type ExploreSummary } from '@/lib/explore-content';
import { parseScenario, scenarioResponse, type Scenario } from '@/lib/practice-model';
import { completePractice, readPracticeProgress, type Progress } from '@/lib/practice-progress';
/** Shared screen; scenario content and branch feedback are fetched by content UUID. */
export function PracticeScenario({contentId,catalog,onClose,onOpen,publishedOnly=false}:{publishedOnly?:boolean;contentId:string;catalog:ExploreSummary[];onClose:()=>void;onOpen:(item:ExploreSummary)=>void}) {
  const [preview,setPreview]=useState(false);
  const [scenario,setScenario]=useState<Scenario|null>(null);
  const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const [selected,setSelected]=useState<string|null>(null),[submitted,setSubmitted]=useState(false);
  const [progress,setProgress]=useState<Progress>({}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const lock=useRef(false);
  useEffect(()=>{
    let active=true;
    setPreview(false);setScenario(null);setLoading(true);setFailed(false);setSelected(null);setSubmitted(false);setReady(false);setMessage('');
    getExploreContent(contentId,{publishedOnly}).then(row=>{if(active){setScenario(parseScenario(row));setPreview(__DEV__ && row?.development_preview === true);}}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
    readPracticeProgress().then(value=>{if(active){setProgress(value);setReady(true);}}).catch(()=>{if(active)setMessage('Your progress could not load. Please retry before completing.');});
    return ()=>{active=false;};
  },[contentId,retry,publishedOnly]);
  async function complete(){
    if(!scenario||!submitted||!ready||lock.current||progress[contentId])return;
    lock.current=true;setBusy(true);setMessage('');
    try{const p=await completePractice(contentId,scenario.xp);setProgress(p);setMessage(`Practice completed. ${p[contentId].xp} XP for taking part.`);}
    catch{setMessage('Completion did not save. Please try again.');}finally{lock.current=false;setBusy(false);}
  }
  const response=scenario&&selected&&submitted?scenarioResponse(scenario,selected):null;
  const items=catalog.filter(c=>c.content_type==='PRACTICE_A_SKILL'),index=items.findIndex(c=>c.content_id===contentId),next=index<0?undefined:items[index+1];
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Action variant="navigation" label="‹ Back to Explore" onPress={onClose} disabled={busy}/>
    <Text style={s.small}>PRACTICE A SKILL</Text>
    {preview&&<View style={s.card}><Text accessibilityRole="header" style={s.heading}>Development preview · Expert review required</Text><Text style={s.body}>This scenario is awaiting review and is hidden in release builds.</Text><Text style={s.small}>Preview uses the imported batch snapshot.</Text></View>}
    {loading?<Text style={s.body}>Loading scenario…</Text>:failed?<><Text style={s.body}>This scenario couldn’t load.</Text><Action label="Try again" onPress={()=>setRetry(v=>v+1)}/></>:!scenario?<Text style={s.body}>This scenario isn’t ready yet. Choose another activity.</Text>:<>
      <Text accessibilityRole="header" style={s.title}>{scenario.title}</Text>
      <Text style={s.small}>{[scenario.category,scenario.domain,scenario.skill,scenario.difficulty].filter(Boolean).join(' · ')}</Text>
      {!!scenario.setting&&<Text style={s.heading}>{scenario.setting}</Text>}
      <Text style={s.body}>{scenario.setup}</Text>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{scenario.prompt}</Text>
        <Text style={s.body}>{scenario.interaction_type==='KNOWLEDGE'?'Choose the option best supported by the evidence.':scenario.interaction_type==='CHOICE'?'More than one option can work. Choose what fits you.':'There is no correct answer. Choose what feels closest today.'}</Text>
      </View>
      {scenario.choices.map(c=><Pressable key={c.id} accessibilityRole="radio" accessibilityState={{checked:selected===c.id,disabled:submitted}} disabled={submitted} onPress={()=>setSelected(c.id)} style={[s.button,selected===c.id&&s.selected]}><Text style={s.label}>{selected===c.id?'✓ ':''}{c.label}</Text></Pressable>)}
      {!submitted&&<Action label={scenario.interaction_type==='REFLECTION'?'Reflect on my response':'Explore my choice'} disabled={!selected} onPress={()=>setSubmitted(true)}/>}
      {response&&<>
        <View style={[s.card,s.green]} accessibilityLiveRegion="polite"><Text style={s.heading}>{response.heading}</Text><Text style={s.body}>{response.text}</Text>{!!response.safety&&<Text style={s.body}>{response.safety}</Text>}{!!response.preferred&&<Text style={s.body}>Preferred choice: {response.preferred}</Text>}</View>
        {!!scenario.teaching_point&&<View style={s.card}><Text style={s.heading}>Takeaway</Text><Text style={s.body}>{scenario.teaching_point}</Text></View>}
        <Text style={s.body}>Source: {scenario.source_name||'Not provided'}</Text>
        {!!scenario.source_url&&/^https?:\/\//i.test(scenario.source_url)&&<Action variant="navigation" label="Read the source ↗" onPress={()=>{Linking.openURL(scenario.source_url!).catch(()=>setMessage('The source link could not open. Please try again.'));}}/>}
        <Text style={s.small}>{scenario.expert_reviewed?'Expert reviewed':'No expert review recorded'}{scenario.medical_review_required&&!scenario.expert_reviewed?' · Medical review required':''}</Text>
        {scenario.related_content.map(id=>{const item=catalog.find(c=>c.content_id===id);return item?<Action variant="navigation" key={id} label={`Related: ${item.title}`} onPress={()=>onOpen(item)} disabled={busy}/>:<Text key={id} style={s.small}>Related activity isn’t available yet.</Text>;})}
        <Action label={progress[contentId]?`Completed ✓ · ${progress[contentId].xp} XP`:busy?'Saving…':`Mark Complete · ${scenario.xp} XP`} onPress={complete} disabled={busy||!ready||!!progress[contentId]}/>
      </>}
      {!!message&&<Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
      {!ready&&<Action label="Retry progress" onPress={()=>setRetry(v=>v+1)}/>}
      <Text style={s.small}>Practice XP in your account: {ready?Object.values(progress).reduce((sum,e)=>sum+e.xp,0):'…'}. XP is for completion, regardless of your response. Each scenario earns XP once. Your response is not saved.</Text>
      <Action variant="navigation" label={next?'Next scenario':'Back to Explore'} onPress={()=>next?onOpen(next):onClose()} disabled={busy}/>
    </>}
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#FFFCF7'},content:{padding:24,paddingBottom:40,width:'100%',maxWidth:640,alignSelf:'center',gap:18},
 title:{color:'#241638',fontFamily:Fonts.rounded,fontSize:32,lineHeight:40,fontWeight:'600'},heading:{color:'#302040',fontFamily:Fonts.rounded,fontSize:20,lineHeight:29,fontWeight:'600'},
 body:{color:'#62556E',fontSize:16,lineHeight:26},small:{color:'#716579',fontSize:14,lineHeight:21},
 card:{backgroundColor:'#EFEDF9',borderColor:'#CEC8E8',borderWidth:1,borderRadius:22,padding:20,gap:12},green:{backgroundColor:'#EDF5E7',borderColor:'#C5DDB5'},
 button:{backgroundColor:'#EEE4F4',borderColor:'#EEE4F4',borderWidth:2,borderRadius:14,minHeight:48,padding:14,justifyContent:'center'},selected:{borderColor:'#63497B'},label:{color:'#432B58',fontSize:16,fontWeight:'600'},
});
