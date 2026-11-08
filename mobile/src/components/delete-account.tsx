import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './themed-text';
import { markIntentionalSignOut, supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth_delete');

export function DeleteAccount({userId,onDeleted}:{userId:string;onDeleted:()=>void}) {
  const [open,setOpen]=useState(false);
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const lock=useRef(false);
  async function remove(){
    if(lock.current||confirmation!=='DELETE')return;
    lock.current=true;setBusy(true);setMessage('');
    log.info('account_delete_attempt',{user_id:userId});
    try{
      const {error}=await supabase.rpc('delete_own_account',{p_expected_user:userId});
      if(error)throw error;
      log.info('account_delete_ok',{user_id:userId});
    }catch(error){
      log.error('account_delete_failed',{user_id:userId,error});
      setMessage('Your account could not be deleted. Please check your connection and try again. If this continues, contact support@mycday.com.');
      lock.current=false;setBusy(false);return;
    }
    // Deletion has succeeded; a local cleanup failure must not invite another deletion.
    await AsyncStorage.multiRemove([`me-look:v1:${userId}`, `leaf-collection:v1:${userId}`]).catch(error=>log.warn('account_delete_local_cleanup_failed',{error}));
    await AsyncStorage.getAllKeys().then(keys => AsyncStorage.multiRemove(keys.filter(key => key.startsWith(`explain-message:v1:${userId}:`)))).catch(error=>log.warn('account_delete_local_cleanup_failed',{error,scope:'explain_messages'}));
    markIntentionalSignOut('account_deleted');
    await supabase.auth.signOut({scope:'local'}).catch(error=>log.warn('account_delete_sign_out_failed',{error}));
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
