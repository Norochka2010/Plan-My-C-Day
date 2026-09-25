import { useEffect, useRef, useState } from 'react';
import { Button, Linking, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { PasswordInput } from '@/components/password-input';
import { supabase } from '@/lib/supabase';

// Uses the existing app scheme; add mobile://me to Supabase's redirect allowlist.
export function AccountRecovery() {
  const [open,setOpen]=useState(false);const [ready,setReady]=useState(false);
  const [kind,setKind]=useState<'recovery'|'signup'>('recovery');
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const handling=useRef(false);const recoveryUser=useRef<string|null>(null);
  useEffect(()=>{
    let active=true;
    async function receive(url:string){
      if(handling.current)return;
      const parsed=new URL(url);
      if(parsed.protocol!=='mobile:'||parsed.hostname!=='me')return;
      const params=new URLSearchParams(parsed.hash.slice(1));
      const type=params.get('type');
      if(type!=='recovery'&&type!=='signup')return;
      handling.current=true;setKind(type);setReady(false);setPassword('');setConfirm('');setOpen(true);setMessage('Checking your email link…');
      try{
        const access_token=params.get('access_token');const refresh_token=params.get('refresh_token');
        if(!access_token||!refresh_token)throw new Error('This link is incomplete. Request a new email.');
        const {data:verified,error:verificationError}=await supabase.auth.getUser(access_token);
        if(verificationError||!verified.user)throw new Error('This link has expired. Request a new reset email.');
        const {data:current,error:sessionError}=await supabase.auth.getSession();
        if(sessionError)throw new Error('Could not check your current sign-in. Please try again.');
        if(current.session&&current.session.user.id!==verified.user.id)throw new Error('This email link belongs to a different account. Your current sign-in has been kept.');
        const {error}=await supabase.auth.setSession({access_token,refresh_token});
        if(error)throw new Error('This email link could not be used. Request a new email.');
        if(active){recoveryUser.current=type==='recovery'?verified.user.id:null;setReady(type==='recovery');setMessage(type==='recovery'?'Choose a new password.':'Your email is confirmed. You are signed in.');}
      }catch(e){if(active)setMessage(e instanceof Error?e.message:'Could not open the reset link.');}
      finally{handling.current=false;}
    }
    Linking.getInitialURL().then(url=>{if(active&&url)void receive(url).catch(()=>{});});
    const listener=Linking.addEventListener('url',({url})=>{void receive(url).catch(()=>{});});
    return()=>{active=false;listener.remove();};
  },[]);
  async function save(){
    if(password.length<12||password!==confirm){setMessage('Use at least 12 characters and enter the same password twice.');return;}
    setBusy(true);
    try{
      const {data,error:readError}=await supabase.auth.getUser();
      if(readError||data.user?.id!==recoveryUser.current)throw new Error('Your sign-in changed. Request a new reset link.');
      const {error}=await supabase.auth.updateUser({password});if(error)throw error;
      setPassword('');setConfirm('');setReady(false);setMessage('Password updated. You are signed in.');
    }catch{setMessage('Could not update your password. Try a different password or request a new reset link.');}
    finally{setBusy(false);}
  }
  return <Modal visible={open} onRequestClose={()=>{if(!busy)setOpen(false);}} animationType="slide">
    <SafeAreaView style={styles.page}><View style={styles.form}>
      <ThemedText type="title">{kind==='recovery'?'Reset password':'Email confirmation'}</ThemedText><ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>
      {ready&&<><ThemedText>New password</ThemedText><PasswordInput accessibilityLabel="New password" value={password} onChangeText={setPassword} autoComplete="new-password" autoCapitalize="none" editable={!busy}/>
      <ThemedText>Confirm new password</ThemedText><PasswordInput accessibilityLabel="Confirm new password" value={confirm} onChangeText={setConfirm} autoCapitalize="none" editable={!busy}/>
      <Button title={busy?'Saving…':'Save new password'} disabled={busy} onPress={save}/></>}
      <Button title="Return to app" disabled={busy} onPress={()=>{setOpen(false);setPassword('');setConfirm('');setReady(false);recoveryUser.current=null;}}/>
    </View></SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#FFFCFA'},form:{padding:24,gap:18},input:{fontSize:16,borderWidth:1,borderColor:'#B9CDAA',borderRadius:14,padding:14,minHeight:48}});
