import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExploreActionButton as Action } from './explore-action-button';
import { Fonts } from '@/constants/theme';
import type { RLCAdventure } from '@/lib/rlc-adventure-model';
/** Only the current node is kept in memory. No scored answers or stored choice history. */
export function RLCAdventureFlow({adventure,busy,onStart,onFinish,onAdvance,replay=false}:{adventure:RLCAdventure;busy:boolean;onStart:()=>Promise<boolean>;onFinish:()=>Promise<boolean>;onAdvance:()=>void;replay?:boolean}){
 const [nodeId,setNodeId]=useState(adventure.start_node_id),[working,setWorking]=useState(false);
 const lock=useRef(false);const node=adventure.nodes.find(n=>n.id===nodeId)!;
 function next(id:string){setNodeId(id);onAdvance();}
 async function start(){if(node.type!=='opening'||lock.current||busy)return;lock.current=true;setWorking(true);try{if(replay||await onStart())next(node.next_node_id);}finally{lock.current=false;setWorking(false);}}
 async function finish(){if(lock.current||busy)return;lock.current=true;setWorking(true);try{await onFinish();}finally{lock.current=false;setWorking(false);}}
 return <View style={s.wrap}>
 {adventure.development_preview&&<Text style={s.small}>Development preview · New adventure content requires expert review</Text>}
 {node.type==='opening'&&<Text style={s.small}>You can complete this challenge on screen, then reflect. Choices are not scored.</Text>}
 <View style={s.card}>
 <Text accessibilityRole="header" style={s.heading}>{node.type==='opening'?'Your situation':node.type==='consequence'?'Here’s what happens next…':node.type==='ending'?'Your adventure':node.text}</Text>
 {node.type!=='decision'&&<Text style={s.body}>{node.text}</Text>}
 {node.type==='decision'&&node.choices.map(choice=><Action key={choice.id} variant="choice" label={choice.text} disabled={busy||working} onPress={()=>next(choice.next_node_id)}/>)}
 {node.type==='opening'&&<Action label={working?'Starting…':'Start Challenge'} disabled={busy||working} onPress={()=>void start()}/>}
 {node.type==='consequence'&&<Action label="Continue" disabled={busy||working} onPress={()=>next(node.next_node_id)}/>}
 {node.type==='ending'&&<>
 <Text style={s.heading}>Skills practiced</Text><Text style={s.body}>{node.skill_tags.join(' • ')}</Text>
 <Text style={s.small}>These describe the skills in this adventure, not a score.</Text>
 <Action label={working?'Saving…':replay?'Back to your completion':'How did it go?'} disabled={busy||working} onPress={()=>void finish()}/>
 </>}
 </View>
 </View>;
}
const s=StyleSheet.create({wrap:{gap:14},card:{gap:16,padding:20,borderWidth:1,borderColor:'#DDD0B9',borderRadius:22,backgroundColor:'#FFF5E5'},heading:{fontFamily:Fonts.rounded,fontSize:20,lineHeight:28,color:'#34472F',fontWeight:'600'},body:{fontSize:16,lineHeight:26,color:'#53604B'},small:{fontSize:13,lineHeight:20,color:'#66715F'}});
