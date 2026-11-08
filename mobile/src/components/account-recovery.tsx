import { useEffect, useRef, useState } from 'react';
import { Button, Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { PasswordInput } from '@/components/password-input';
import { supabase } from '@/lib/supabase';
import { createLogger, elapsed } from '@/lib/logger';

const log = createLogger('auth_link');

// Describes an incoming link without any token values: which params exist, not what they hold.
function describeLink(url:string){
  try{
    const parsed=new URL(url);
    const hash=new URLSearchParams(parsed.hash.slice(1));const query=parsed.searchParams;
    return {scheme:parsed.protocol.replace(':',''),host:parsed.hostname,path:parsed.pathname,
      hash_keys:Array.from(hash.keys()),query_keys:Array.from(query.keys()),
      type:hash.get('type')??query.get('type'),
      error:hash.get('error')??query.get('error'),error_code:hash.get('error_code')??query.get('error_code'),
      error_description:hash.get('error_description')??query.get('error_description')};
  }catch(error){return {unparseable:true,length:url.length,error};}
}

// Uses the existing app scheme; add mobile://me to Supabase's redirect allowlist.
export function AccountRecovery() {
  const [open,setOpen]=useState(false);const [ready,setReady]=useState(false);
  const [kind,setKind]=useState<'recovery'|'signup'>('recovery');
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const handling=useRef(false);const recoveryUser=useRef<string|null>(null);
  useEffect(()=>{
    let active=true;
    async function receive(url:string,source:'initial'|'event'){
      const link=describeLink(url);
      if(handling.current){log.warn('auth_link_ignored',{reason:'already_handling',source,...link});return;}
      const parsed=new URL(url);
      if(parsed.protocol!=='mobile:'||parsed.hostname!=='me'){
        // Not every incoming URL is an auth link; only flag ones that look like they were meant to be.
        const looksAuth=/token|type=|error|code=/.test(url);
        log[looksAuth?'warn':'info']('auth_link_ignored',{reason:'not_mobile_me',looks_like_auth_link:looksAuth,source,...link});
        return;
      }
      log.info('auth_link_received',{source,...link});
      const params=new URLSearchParams(parsed.hash.slice(1));
      const type=params.get('type');
      if(params.has('error')||params.has('error_code')){log.warn('auth_link_error_param',{source,...link});setKind('recovery');setReady(false);setOpen(true);setMessage('This email link can’t be used. Return to sign in, tap Forgot password, and request a new email.');return;}
      if(type!=='recovery'&&type!=='signup'){
        // e.g. PKCE ?code=…, token_hash, magiclink or email_change links land here and are dropped.
        log.warn('auth_link_ignored',{reason:'unsupported_type',source,...link});
        return;
      }
      handling.current=true;setKind(type);setReady(false);setPassword('');setConfirm('');setOpen(true);setMessage('Checking your email link…');
      const started=Date.now();
      let stage='read_tokens';
      try{
        const access_token=params.get('access_token');const refresh_token=params.get('refresh_token');
        if(!access_token||!refresh_token)throw new Error('This link is incomplete. Request a new email.');
        stage='verify_user';
        const {data:verified,error:verificationError}=await supabase.auth.getUser(access_token);
        if(verificationError||!verified.user){log.warn('auth_link_verify_failed',{type,error:verificationError,has_user:!!verified?.user});throw new Error('This link has expired. Request a new reset email.');}
        log.info('auth_link_verified',{type,link_user_id:verified.user.id,email_confirmed:!!verified.user.email_confirmed_at});
        stage='check_current_session';
        const {data:current,error:sessionError}=await supabase.auth.getSession();
        if(sessionError){log.warn('auth_link_current_session_failed',{type,error:sessionError});throw new Error('Could not check your current sign-in. Please try again.');}
        if(current.session&&current.session.user.id!==verified.user.id){log.warn('auth_link_user_mismatch',{type,link_user_id:verified.user.id,current_user_id:current.session.user.id});throw new Error('This email link belongs to a different account. Your current sign-in has been kept.');}
        stage='set_session';
        const {error}=await supabase.auth.setSession({access_token,refresh_token});
        if(error){log.warn('auth_link_set_session_failed',{type,error});throw new Error('This email link could not be used. Request a new email.');}
        log.info('auth_link_applied',{type,user_id:verified.user.id,had_session:!!current.session,duration_ms:elapsed(started),mounted:active});
        if(active){recoveryUser.current=type==='recovery'?verified.user.id:null;setReady(type==='recovery');setMessage(type==='recovery'?'Choose a new password.':'Your email is confirmed. You are signed in.');}
      }catch(e){log.warn('auth_link_failed',{type,stage,error:e,duration_ms:elapsed(started)});if(active)setMessage(e instanceof Error?e.message:'Could not open the reset link.');}
      finally{handling.current=false;}
    }
    Linking.getInitialURL().then(url=>{log.info('initial_url_checked',{has_url:!!url});if(active&&url)void receive(url,'initial').catch(error=>log.error('auth_link_handler_threw',{source:'initial',error}));}).catch(error=>log.error('initial_url_failed',{error}));
    const listener=Linking.addEventListener('url',({url})=>{void receive(url,'event').catch(error=>log.error('auth_link_handler_threw',{source:'event',error}));});
    return()=>{active=false;listener.remove();};
  },[]);
  async function save(){
    if(saving.current)return;
    if(password.length<12||password!==confirm){log.info('password_reset_validation_failed',{reason:password.length<12?'too_short':'mismatch'});setMessage('Use at least 12 characters and enter the same password twice.');return;}
    saving.current=true;setBusy(true);
    const started=Date.now();
    log.info('password_reset_save_attempt',{recovery_user_id:recoveryUser.current});
    try{
      const {data,error:readError}=await supabase.auth.getUser();
      if(readError||data.user?.id!==recoveryUser.current){log.warn('password_reset_user_changed',{error:readError,current_user_id:data.user?.id??null,recovery_user_id:recoveryUser.current});throw new Error('Your sign-in changed. Request a new reset link.');}
      const {error}=await supabase.auth.updateUser({password});if(error)throw error;
      log.info('password_reset_save_ok',{duration_ms:elapsed(started)});
      setPassword('');setConfirm('');setReady(false);setMessage('Password updated. You are signed in.');
    }catch(error){log.warn('password_reset_save_failed',{error,duration_ms:elapsed(started)});setMessage('Could not update your password. Try a different password or request a new reset link.');}
    finally{saving.current=false;setBusy(false);}
  }
  return <Modal visible={open} onRequestClose={()=>{if(!busy)setOpen(false);}} animationType="slide">
    <SafeAreaProvider><SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <ThemedText type="title">{kind==='recovery'?'Reset password':'Email confirmation'}</ThemedText><ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>
      {ready&&<><ThemedText>New password · at least 12 characters</ThemedText><PasswordInput accessibilityLabel="New password" value={password} onChangeText={setPassword} autoComplete="new-password" autoCapitalize="none" editable={!busy}/>
      <ThemedText>Confirm new password</ThemedText><PasswordInput accessibilityLabel="Confirm new password" value={confirm} onChangeText={setConfirm} autoCapitalize="none" editable={!busy}/>
      <Button title={busy?'Saving…':'Save new password'} disabled={busy||password.length<12||password!==confirm} onPress={save}/></>}
      <Button title="Return to app" disabled={busy} onPress={()=>{setOpen(false);setPassword('');setConfirm('');setReady(false);recoveryUser.current=null;}}/>
    </ScrollView></SafeAreaView></SafeAreaProvider>
  </Modal>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#FFFCFA'},form:{padding:24,gap:18},input:{fontSize:16,borderWidth:1,borderColor:'#B9CDAA',borderRadius:14,padding:14,minHeight:48}});
