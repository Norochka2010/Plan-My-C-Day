import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { newId } from '@/lib/c-day-model';
import { LeafCharacter } from './leaf-character';
import { Fonts } from '@/constants/theme';
import { acknowledgements, checks, communityRpc, disclaimer, efforts, readCommunity, reasons, recipeCategories, recipeIssue, statusLabel, uses, type ListMode, type Recipe } from '@/lib/community-model';

function Button({label,onPress,disabled=false,secondary=false,accessibilityLabel}:{accessibilityLabel?:string;label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
 return <Pressable accessibilityLabel={accessibilityLabel??label} accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={()=>{Keyboard.dismiss();onPress();}}
 style={({pressed})=>[s.button,secondary&&s.secondary,disabled&&s.disabled,pressed&&!disabled&&{opacity:.75}]}>
 <Text style={[s.buttonText,secondary&&s.secondaryText,disabled&&s.disabledText]}>{label}</Text></Pressable>;
}
function Field({label,value,onChange,max=100,multiline=false,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;max?:number;multiline?:boolean;disabled?:boolean}) {
 return <View style={s.gap}><Text style={s.body}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={max}
 editable={!disabled} multiline={multiline} style={[s.input,multiline&&{minHeight:90,textAlignVertical:'top'}]} placeholderTextColor="#82768B" /></View>;
}
function Chips({values,selected,onSelect,busy}:{values:string[];selected:string[];onSelect:(v:string)=>void;busy:boolean}) {
 return <View style={s.chips}>{values.map(v=><Pressable key={v} accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(v),disabled:busy}}
 disabled={busy} onPress={()=>onSelect(v)} style={[s.chip,selected.includes(v)&&s.selected]}><Text style={s.body}>{selected.includes(v)?'✓ ':''}{v}</Text></Pressable>)}</View>;
}
export function CommunityRecipes() {
 const [userId,setUserId]=useState<string|null>(null),[ready,setReady]=useState(false);
 const router=useRouter();
 useEffect(()=>{
 let active=true,changed=false;
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{changed=true;if(active){setUserId(session?.user.id??null);setReady(true);}});
 supabase.auth.getSession().then(({data})=>{if(active&&!changed){setUserId(data.session?.user.id??null);setReady(true);}}).catch(()=>{if(active)setReady(true);});
 return()=>{active=false;subscription.unsubscribe();};
 },[]);
 if(!ready)return <SafeAreaView style={s.screen}><ActivityIndicator accessibilityLabel="Loading Community" /></SafeAreaView>;
 if(!userId)return <SafeAreaView style={s.screen}><View style={s.content}><LeafCharacter size={90}/><Text style={s.title}>Community</Text><Text style={s.body}>Sign in to browse and share community recipes.</Text><Button label="Go to Me to sign in" onPress={()=>router.push('/me')}/></View></SafeAreaView>;
 return <Community key={userId} />;
}
function Community() {
 const [page,setPage]=useState<'home'|'list'|'detail'|'edit'|'report'>('home');
 const [mode,setMode]=useState<ListMode>('browse'),[list,setList]=useState<Recipe[]>([]),[more,setMore]=useState(false);
 const [recipe,setRecipe]=useState<Recipe|null>(null),[step,setStep]=useState(0),[ack,setAck]=useState([false,false,false]);
 const [moderator,setModerator]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [reason,setReason]=useState(''),[note,setNote]=useState('');
 const lock=useRef(false),alive=useRef(true),scroll=useRef<ScrollView>(null),generation=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[page,step]);
 useFocusEffect(useCallback(()=>{
 let active=true;
 const check=()=>readCommunity<{moderator:boolean}>('role').then(x=>{if(active)setModerator(x.moderator);}).catch(()=>{if(active)setModerator(false);});
 void check();const sub=AppState.addEventListener('change',v=>{if(v==='active')void check();});
 return()=>{active=false;sub.remove();};
 },[]));
 async function run(fn:()=>Promise<void>) {
 if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
 try{await fn();}catch(e){if(alive.current){setError(e instanceof Error?e.message:'Could not save. Please try again.');scroll.current?.scrollTo({y:0,animated:false});}}
 finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function loadList(target:ListMode,append=false) {
 const token=++generation.current;
 const rows=await readCommunity<Recipe[]>(target,undefined,append?list.length:0);
 if(!alive.current||token!==generation.current)return;
 setList(append?[...list,...rows.filter(r=>!list.some(x=>x.id===r.id))]:rows);setMore(rows.length===30);setMode(target);setPage('list');
 }
 async function open(id:string) {
 const value=await readCommunity<Recipe>('detail',id);
 if(!alive.current)return;
 setRecipe(value);setReason('');setNote('');setPage('detail');
 }
 function newRecipe() {
 setRecipe({id:newId(),title:'',category:'',effort_level:'',ingredients:[{ingredient_text:'',amount_text:''}],steps:[''],double_check_tags:[],use_case_tags:[],friend_tip:'',status:'draft',revision:0,is_author:true,saved:false,helpful:false});
 setStep(0);setAck([false,false,false]);setPage('edit');setError('');setNotice('');
 }
 async function saveDraft() {
 if(!recipe)throw Error('Open a draft first.');
 const value=await communityRpc<Recipe>('community_save_draft',{p_id:recipe.id,p_data:recipe,p_revision:recipe.revision});
 if(alive.current)setRecipe(value);return value;
 }
 function edit(v:Partial<Recipe>){setRecipe(r=>r?{...r,...v}:r);setAck([false,false,false]);setNotice('');}
 function toggle(field:'double_check_tags'|'use_case_tags',v:string) {
 if(!recipe)return;let values=recipe[field].includes(v)?recipe[field].filter(x=>x!==v):[...recipe[field],v];
 if(field==='double_check_tags'){if(v==='Nothing special'&&values.includes(v))values=[v];else values=values.filter(x=>x!=='Nothing special');}
 edit({[field]:values});
 }
 function move<T>(values:T[],i:number,delta:number):T[]{const copy=[...values];[copy[i],copy[i+delta]]=[copy[i+delta],copy[i]];return copy;}
 function back() {
 if(page==='edit'){
 Alert.alert('Save your draft?', 'Save your changes so you can return later.',[
 {text:'Keep editing',style:'cancel'},
 {text:'Leave without saving',style:'destructive',onPress:()=>{setPage('home');setRecipe(null);}},
 {text:'Save and leave',onPress:()=>void run(async()=>{await saveDraft();if(alive.current){setPage('home');setNotice('Draft saved in My Recipes.');}})},
 ]);return;}
 if(page==='report'){setPage('detail');return;}
 setPage('home');setError('');setNotice('');
 }
 async function interact(action:string,enabled=true) {
 if(!recipe)return;
 await communityRpc('community_interact',{p_id:recipe.id,p_action:action,p_enabled:enabled,p_reason:reason,p_note:note});
 if(!alive.current)return;
 if(action==='hide'||action==='report'){await loadList('browse');if(alive.current)setNotice(action==='report'?'Report sent for review. This recipe is now hidden for you.':'Recipe hidden for you.');}
 else await open(recipe.id);
 }
 async function moderate(action:string) {
 if(!recipe)return;
 await communityRpc('community_moderate',{p_id:recipe.id,p_action:action,p_reason:reason,p_note:note});
 if(!alive.current)return;await loadList('queue');if(alive.current)setNotice('Moderation decision saved.');
 }
 const listTitle={browse:'Recipes',mine:'My Recipes',saved:'Saved Recipes',queue:'Moderator review'}[mode];
 return <SafeAreaView edges={['top','left','right']} style={s.screen}><ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
 {page!=='home'&&<Button label="‹ Back" onPress={back} disabled={busy} secondary/>}
 {!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
 {!!notice&&<Text accessibilityLiveRegion="polite" style={s.info}>{notice}</Text>}
 {busy&&<View style={s.row}><ActivityIndicator/><Text accessibilityLiveRegion="polite" style={s.body}>Please wait…</Text></View>}
 {page==='home'&&<>
 <View style={s.row}><View style={{flex:1}}><Text style={s.title}>Community</Text><Text style={s.body}>Real ideas and experiences shared by the My C-Day community.</Text></View><LeafCharacter size={76}/></View>
 <Text style={s.small}>Community posts are shared by members, not medical experts. Always check current ingredient labels, brands, preparation methods, and cross-contact considerations for yourself.</Text>
 <View style={s.card}><Text style={s.heading}>Recipes</Text><Text style={s.body}>Browse ideas or share a recipe for review.</Text><Button label="Browse recipes" disabled={busy} onPress={()=>void run(()=>loadList('browse'))}/><Button secondary label="Create a recipe" disabled={busy} onPress={newRecipe}/></View>
 <View style={s.card}><Text style={s.heading}>My Community</Text><Button secondary label="My Recipes" disabled={busy} onPress={()=>void run(()=>loadList('mine'))}/><Button secondary label="Saved Recipes" disabled={busy} onPress={()=>void run(()=>loadList('saved'))}/></View>
 <View style={s.card}><Text style={s.heading}>Community Topics</Text><Text style={s.small}>Coming soon</Text></View>
 {moderator&&<Button secondary label="Moderator review queue" disabled={busy} onPress={()=>void run(()=>loadList('queue'))}/>}
 </>}
 {page==='list'&&<>
 <Text style={s.title}>{listTitle}</Text>
 <Button secondary label="Refresh" disabled={busy} onPress={()=>void run(()=>loadList(mode))}/>
 {mode==='mine'&&<Button label="Create a recipe" disabled={busy} onPress={newRecipe}/>}
 {!list.length&&!busy&&<Text style={s.body}>{mode==='queue'?'No recipes need review here.':mode==='saved'?'Recipes you save will appear here.':mode==='mine'?'Start a recipe and save a draft to return to it later.':'No published recipes yet. Shared recipes appear after moderator review.'}</Text>}
 {list.map(r=><Pressable key={r.id} accessibilityRole="button" disabled={busy} onPress={()=>void run(()=>open(r.id))} style={s.card}>
 <Text style={s.badge}>COMMUNITY SHARED</Text><Text style={s.heading}>{r.title||'Untitled draft'}</Text><Text style={s.small}>Community member</Text>
 <Text style={s.body}>{[r.category,r.effort_level].filter(Boolean).join(' · ')}</Text>
 <Text style={s.small}>{statusLabel(r.status)}{mode==='queue'&&r.review_required?' · Review requested':''}</Text><Text style={s.link}>Open recipe ›</Text>
 </Pressable>)}
 {more&&<Button secondary label="Load more" disabled={busy} onPress={()=>void run(()=>loadList(mode,true))}/>}
 </>}
 {page==='detail'&&recipe&&<>
 <Text style={s.badge}>COMMUNITY SHARED</Text><Text style={s.title}>{recipe.title||'Untitled draft'}</Text><Text style={s.small}>Community member · {statusLabel(recipe.status)}</Text>
 <Text style={s.info}>{disclaimer}</Text>
 <Text style={s.body}>{[recipe.category,recipe.effort_level].filter(Boolean).join(' · ')}</Text>
 <Text style={s.heading}>Ingredients</Text>{recipe.ingredients.map((i,n)=><Text key={n} style={s.body}>• {i.amount_text} {i.ingredient_text}</Text>)}
 {!!recipe.double_check_tags.length&&<><Text style={s.heading}>Things to double-check</Text><Text style={s.body}>{recipe.double_check_tags.join(' · ')}</Text></>}
 <Text style={s.heading}>How to make it</Text>{recipe.steps.map((v,n)=><Text key={n} style={s.body}>{n+1}. {v}</Text>)}
 {!!recipe.friend_tip&&<><Text style={s.heading}>A tip from the member</Text><Text style={s.body}>{recipe.friend_tip}</Text></>}
 {!!recipe.use_case_tags.length&&<Text style={s.body}>{recipe.use_case_tags.join(' · ')}</Text>}
 {recipe.is_author&&recipe.status==='draft'&&<Button label="Continue draft" disabled={busy} onPress={()=>{setStep(0);setAck([false,false,false]);setPage('edit');}}/>}
 {recipe.is_author&&recipe.status!=='draft'&&<Text style={s.small}>Submitted recipes are read-only. Publication review is not medical verification.</Text>}
 {recipe.status==='published'&&<>
 <Button label={recipe.saved?'Saved ✓ · Unsave':'Save recipe'} disabled={busy} onPress={()=>void run(()=>interact('save',!recipe.saved))}/>
 <Button secondary label={recipe.helpful?'Helpful ✓ · Undo':'Helpful'} disabled={busy} onPress={()=>void run(()=>interact('helpful',!recipe.helpful))}/>
 <Button secondary label="Hide" disabled={busy} onPress={()=>void run(()=>interact('hide'))}/>
 <Button secondary label="Report" disabled={busy} onPress={()=>{setReason('');setNote('');setPage('report');}}/>
 </>}
 {moderator&&recipe.status!=='draft'&&<View style={s.card}>
 <Text style={s.heading}>Moderator review</Text><Text style={s.small}>Approval is for Community publication, not medical or nutrition verification.</Text>
 <Text style={s.body}>Automated prescreen: {recipe.prescreen_status==='not_connected'?'Not connected — human review required':recipe.prescreen_status}</Text>
 <Text style={s.small}>Review ingredient/context claims, treatment claims, personal/contact details, harassment, inappropriate content, advertising, and off-platform invitations.</Text>
 <Text style={s.small}>Acknowledgements: {recipe.acknowledgements?.filter(Boolean).length??0}/3 · {recipe.acknowledgement_version||'Not recorded'}</Text>
 {acknowledgements.map((a,i)=><Text key={a} style={s.small}>{recipe.acknowledgements?.[i]?'✓':'○'} {a}</Text>)}
 {!!recipe.prescreen_flags?.length&&<Text style={s.body}>Prescreen flags: {JSON.stringify(recipe.prescreen_flags)}</Text>}
 <Text style={s.heading}>Reports</Text>{!recipe.reports?.length&&<Text style={s.small}>No reports.</Text>}
 {recipe.reports?.map((r,i)=><View key={i} style={s.infoCard}><Text style={s.body}>{r.reason} · {r.status}</Text><Text style={s.small}>{r.note}</Text></View>)}
 <Field label="Decision reason (required except approval)" value={reason} onChange={setReason} disabled={busy}/>
 <Field label="Internal decision note (optional)" value={note} onChange={setNote} max={1000} multiline disabled={busy}/>
 {recipe.status==='pending_review'&&<Button label="Approve for publication" disabled={busy} onPress={()=>void run(()=>moderate('approve'))}/>}
 {recipe.status!=='hidden'&&<Button secondary label="Hide globally" disabled={busy||!reason.trim()} onPress={()=>void run(()=>moderate('hide'))}/>}
 {recipe.status!=='removed'&&<Button secondary label="Remove" disabled={busy||!reason.trim()} onPress={()=>void run(()=>moderate('remove'))}/>}
 {['hidden','removed','flagged'].includes(recipe.status)&&<Button secondary label={recipe.published_at?'Restore publication':'Return to review'} disabled={busy||!reason.trim()} onPress={()=>void run(()=>moderate('restore'))}/>}
 {recipe.review_required&&recipe.status==='published'&&<Button secondary label="Resolve reports · Keep published" disabled={busy||!reason.trim()} onPress={()=>void run(()=>moderate('resolve_reports'))}/>}
 <Text style={s.heading}>Decision history</Text>{recipe.audit?.map((a,i)=><Text key={i} style={s.small}>{a.action} · {a.reason} · {new Date(a.created_at).toLocaleString()}{a.note?`\n${a.note}`:''}</Text>)}
 </View>}
 </>}
 {page==='edit'&&recipe&&<>
 <Text style={s.small}>Create recipe · Step {step+1} of 4</Text>
 <Text style={s.title}>{['What are you making?','Add ingredients','How do you make it?','Before you share'][step]}</Text>
 {step===0&&<>
 <Field label="Recipe name" value={recipe.title} onChange={v=>edit({title:v})} disabled={busy}/>
 <Text style={s.heading}>Category</Text><Chips values={recipeCategories} selected={[recipe.category]} busy={busy} onSelect={v=>edit({category:v})}/>
 <Text style={s.heading}>Effort</Text><Chips values={efforts} selected={[recipe.effort_level]} busy={busy} onSelect={v=>edit({effort_level:v})}/>
 <View style={s.infoCard}><Text style={s.small}>Recipes use a simple placeholder for now. Photo sharing is coming later.</Text></View>
 </>}
 {step===1&&<>
 {recipe.ingredients.map((item,i)=><View key={i} style={s.card}>
 <Field label={`Ingredient ${i+1}`} value={item.ingredient_text} max={200} disabled={busy} onChange={v=>edit({ingredients:recipe.ingredients.map((x,n)=>n===i?{...x,ingredient_text:v}:x)})}/>
 <Field label="Amount" value={item.amount_text} max={80} disabled={busy} onChange={v=>edit({ingredients:recipe.ingredients.map((x,n)=>n===i?{...x,amount_text:v}:x)})}/>
 <View style={s.row}><Button secondary label="↑" accessibilityLabel="Move up" disabled={busy||i===0} onPress={()=>edit({ingredients:move(recipe.ingredients,i,-1)})}/><Button secondary label="↓" accessibilityLabel="Move down" disabled={busy||i===recipe.ingredients.length-1} onPress={()=>edit({ingredients:move(recipe.ingredients,i,1)})}/><Button secondary label="Remove" disabled={busy} onPress={()=>edit({ingredients:recipe.ingredients.filter((_,n)=>n!==i)})}/></View>
 </View>)}
 <Button secondary label="+ Add ingredient" disabled={busy||recipe.ingredients.length>=30} onPress={()=>edit({ingredients:[...recipe.ingredients,{ingredient_text:'',amount_text:''}]})}/>
 <Text style={s.heading}>Anything people should double-check?</Text><Chips values={checks} selected={recipe.double_check_tags} busy={busy} onSelect={v=>toggle('double_check_tags',v)}/>
 </>}
 {step===2&&<>
 {recipe.steps.map((value,i)=><View key={i} style={s.card}><Field label={`Step ${i+1}`} value={value} max={600} multiline disabled={busy} onChange={v=>edit({steps:recipe.steps.map((x,n)=>n===i?v:x)})}/>
 <View style={s.row}><Button secondary label="↑" accessibilityLabel="Move up" disabled={busy||i===0} onPress={()=>edit({steps:move(recipe.steps,i,-1)})}/><Button secondary label="↓" accessibilityLabel="Move down" disabled={busy||i===recipe.steps.length-1} onPress={()=>edit({steps:move(recipe.steps,i,1)})}/><Button secondary label="Remove" disabled={busy} onPress={()=>edit({steps:recipe.steps.filter((_,n)=>n!==i)})}/></View></View>)}
 <Button secondary label="+ Add step" disabled={busy||recipe.steps.length>=30} onPress={()=>edit({steps:[...recipe.steps,'']})}/>
 <Field label="Anything else you'd tell a friend? (optional)" value={recipe.friend_tip} max={600} multiline disabled={busy} onChange={v=>edit({friend_tip:v})}/>
 <Text style={s.heading}>When might you make it? (optional)</Text><Chips values={uses} selected={recipe.use_case_tags} busy={busy} onSelect={v=>toggle('use_case_tags',v)}/>
 </>}
 {step===3&&<>
 <Text style={s.info}>Recipes here are shared by members of the My C-Day community. They are not reviewed or approved by a doctor, dietitian, or My C-Day unless specifically stated.</Text>
 <Text style={s.heading}>{recipe.title}</Text><Text style={s.body}>{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</Text>
 {acknowledgements.map((v,i)=><Pressable key={v} accessibilityRole="checkbox" accessibilityState={{checked:ack[i],disabled:busy}} disabled={busy} onPress={()=>setAck(x=>x.map((a,n)=>n===i?!a:a))} style={[s.card,ack[i]&&s.selected]}><Text style={s.body}>{ack[i]?'☑':'☐'} {v}</Text></Pressable>)}
 <Button label="SUBMIT FOR REVIEW" disabled={busy||!ack.every(Boolean)} onPress={()=>void run(async()=>{
 const issue=recipeIssue(recipe);if(issue)throw Error(issue);
 const saved=await saveDraft();const submitted=await communityRpc<Recipe>('community_submit',{p_id:saved.id,p_revision:saved.revision,p_ack:ack});
 if(alive.current){setRecipe(submitted);setPage('detail');setNotice('Submitted for review. Your recipe is not public yet.');}
 })}/>
 </>}
 {step>0&&<Button secondary label="Previous step" disabled={busy} onPress={()=>setStep(v=>v-1)}/>}
 {step<3&&<Button label="Save & continue" disabled={busy} onPress={()=>void run(async()=>{const issue=recipeIssue(recipe,step);if(issue)throw Error(issue);await saveDraft();if(alive.current)setStep(v=>v+1);})}/>}
 <Button secondary label="Save draft & leave" disabled={busy} onPress={()=>void run(async()=>{await saveDraft();if(alive.current){setPage('home');setNotice('Draft saved in My Recipes.');}})}/>
 <Text style={s.small}>Keep names, contact details, school, location and social handles out of your recipe. Drafts save when you tap a save button.</Text>
 </>}
 {page==='report'&&recipe&&<><Text style={s.title}>Report recipe</Text><Text style={s.body}>Your identity will not be shared with the recipe author. Reporting also hides this recipe for you.</Text>
 <Chips values={reasons} selected={[reason]} onSelect={setReason} busy={busy}/><Field label="Additional information (optional)" value={note} onChange={setNote} max={500} multiline disabled={busy}/>
 <Button label="Send report" disabled={busy||!reason} onPress={()=>void run(()=>interact('report'))}/></>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#FFFCF7'},content:{padding:20,paddingBottom:36,gap:16,width:'100%',maxWidth:620,alignSelf:'center'},
 title:{fontFamily:Fonts.rounded,fontSize:28,lineHeight:36,fontWeight:'600',color:'#302040'},heading:{fontFamily:Fonts.rounded,fontSize:19,lineHeight:27,fontWeight:'600',color:'#302040'},
 body:{fontSize:16,lineHeight:24,color:'#62556E'},small:{fontSize:14,lineHeight:21,color:'#716579'},badge:{fontSize:14,lineHeight:21,fontWeight:'700',color:'#63497B',letterSpacing:1},
 card:{padding:16,gap:12,backgroundColor:'#FFFFFF',borderColor:'#DFE5D7',borderWidth:1,borderRadius:20},infoCard:{padding:14,gap:8,backgroundColor:'#F0EDF5',borderRadius:16},
 info:{padding:14,backgroundColor:'#EDF3E6',borderRadius:14,color:'#405D35',fontSize:14,lineHeight:22},error:{padding:14,backgroundColor:'#FFF0E3',borderRadius:14,color:'#75452D',fontSize:15,lineHeight:23},
 row:{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},gap:{gap:8},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{padding:12,minHeight:48,backgroundColor:'#F1EAF5',borderWidth:1,borderColor:'#E1D6E9',borderRadius:14},selected:{borderColor:'#806493',backgroundColor:'#EBE0F2'},
 input:{minHeight:50,borderColor:'#CBDABB',borderWidth:1,borderRadius:14,padding:12,backgroundColor:'#FFFFFF',color:'#302040',fontSize:16},
 button:{minHeight:48,padding:14,backgroundColor:'#426B43',borderRadius:14,justifyContent:'center'},buttonText:{fontSize:16,lineHeight:22,fontWeight:'600',color:'#FFFFFF',textAlign:'center'},secondary:{backgroundColor:'#EAF0F7'},secondaryText:{color:'#354F70'},disabled:{backgroundColor:'#E6E3DE'},disabledText:{color:'#68645F'},link:{color:'#426B43',fontSize:15,fontWeight:'600'},
});
