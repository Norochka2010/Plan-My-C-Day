import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './themed-text';
import { supabase } from '@/lib/supabase';

export function DeleteAccount({userId,onDeleted}:{userId:string;onDeleted:()=>void}) {
  const [open,setOpen]=useState(false);
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const lock=useRef(false);
  async function remove(){
    if(lock.current||confirmation!=='DELETE')return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const {error}=await supabase.rpc('delete_own_account',{p_expected_user:userId});
      if(error)throw error;
    }catch{
      setMessage('Your account could not be deleted. Please check your connection and try again. If this continues, contact info@mycday.com.');
      lock.current=false;setBusy(false);return;
    }
    // Deletion has succeeded; a local cleanup failure must not invite another deletion.
    await AsyncStorage.removeItem(`me-look:v1:${userId}`).catch(()=>{});
    await supabase.auth.signOut({scope:'local'}).catch(()=>{});
    onDeleted();
  }
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{padding:16,minHeight:50,borderRadius:14,borderWidth:1,borderColor:'#A33B35',opacity:disabled?0.5:1}}><ThemedText style={{color:'#A33B35',textAlign:'center',fontWeight:'700'}}>{label}</ThemedText></Pressable>;
  return <View style={{gap:14,marginTop:20}}>
    {!open?<Pressable accessibilityRole="button" onPress={()=>setOpen(true)} style={({pressed})=>({minHeight:48,justifyContent:'center',alignItems:'center',opacity:pressed?0.6:1})}><ThemedText style={{color:'#8C4943',fontSize:14}}>Delete account</ThemedText></Pressable>:<>
      <ThemedText type="subtitle">Delete your account?</ThemedText>
      <ThemedText>This permanently deletes your account, profile, saved plans, reflections, learning progress, and recipes you shared. This cannot be undone.</ThemedText>
      <ThemedText>Events already added to your phone’s calendar will remain. You can remove them in your calendar.</ThemedText>
      <ThemedText>Type DELETE to confirm.</ThemedText>
      <TextInput accessibilityLabel="Type DELETE to confirm account deletion" value={confirmation} onChangeText={setConfirmation} editable={!busy} autoCapitalize="characters" autoCorrect={false} style={{borderWidth:1,borderColor:'#A33B35',borderRadius:14,padding:14,minHeight:48,color:'#291D3B'}}/>
      {button(busy?'Deleting…':'Permanently delete my account',()=>void remove(),busy||confirmation!=='DELETE')}
      {button('Keep my account',()=>{setOpen(false);setConfirmation('');setMessage('');},busy)}
      {!!message&&<ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>}
    </>}
  </View>;
}
