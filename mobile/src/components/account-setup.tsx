import { signupErrorMessage } from '@/lib/signup-error';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, ScrollView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PasswordInput } from '@/components/password-input';
import { formatUSPhone, normalizeUSPhone } from '@/lib/us-phone';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { betaPolicies } from '@/lib/beta-policies';
import { supabase } from '@/lib/supabase';
import { createLogger, elapsed, maskEmail } from '@/lib/logger';

const authLog = createLogger('auth_ui');
const profileLog = createLogger('profile');

// Preserve partial input while normalizing month-first dates without guessing a year.
export function formatBirthdayInput(value: string): string {
  const separated = /^\s*(\d{1,2})[-/ .]+(\d{1,2})[-/ .]+(\d{0,4})\s*$/.exec(value);
  if (separated) return `${separated[1].padStart(2, '0')}-${separated[2].padStart(2, '0')}-${separated[3]}`;
  const partial = /^\s*(\d{1,2})[-/ .]+(\d{0,2})$/.exec(value);
  if (partial) return `${partial[1].padStart(2, '0')}-${partial[2]}`;
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('-');
}

export function parseBirthday(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return null;
  const [, m, d, y] = match;
  const date = new Date(`${y}-${m}-${d}T12:00:00Z`);
  return Number(y) >= 1 && date.getUTCFullYear() === Number(y) && date.getUTCMonth()+1 === Number(m) && date.getUTCDate() === Number(d) ? `${y}-${m}-${d}` : null;
}
function oldEnough(dob: string, minimumAge = 13) {
  const today = new Date();
  const [y,m,d] = dob.split('-').map(Number);
  const age = today.getFullYear()-y - (today.getMonth()+1<m || (today.getMonth()+1===m && today.getDate()<d) ? 1 : 0);
  return age >= minimumAge;
}
const input = stylesInput();
function stylesInput() { return { borderWidth: 1, borderColor: '#B9CDAA', borderRadius: 14, padding: 14, fontSize: 16, color: '#291D3B', backgroundColor: '#FFFFFF', minHeight: 48 }; }

export function AccountSetup({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [open,setOpen]=useState(false);
  const [first,setFirst]=useState(''); const [last,setLast]=useState('');
  const [dob,setDob]=useState(''); const [lockedDob,setLockedDob]=useState(false);
  const [username,setUsername]=useState(''); const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const alive=useRef(true);
  useEffect(()=>{ alive.current=true; return ()=>{alive.current=false;}; },[]);
  useEffect(()=>{let active=true;
    Promise.all([supabase.from('users').select('first_name,last_name').eq('id',userId).single(),supabase.from('account_profiles').select('date_of_birth,username').eq('user_id',userId).maybeSingle()]).then(([user,profile])=>{
      if(!active)return;
      if(user.error||profile.error){profileLog.warn('profile_load_failed',{user_error:user.error,profile_error:profile.error,user_id:userId});setMessage('Profile setup is temporarily unavailable. You can keep using your account.');return;}
      profileLog.info('profile_loaded',{has_username:!!profile.data?.username,has_birthday:!!profile.data?.date_of_birth,has_profile_row:!!profile.data});
      setFirst(user.data.first_name||'');setLast(user.data.last_name||'');setUsername(profile.data?.username||'');
      const birthday=profile.data?.date_of_birth;
      if(birthday){const [y,m,d]=birthday.split('-');setDob(`${m}-${d}-${y}`);setLockedDob(true);}
      setReady(true);
    }).catch((error)=>{profileLog.error('profile_load_threw',{error});if(active)setMessage('Could not load profile setup. Please try again later.');});
    return()=>{active=false;};
  },[userId]);
  async function save(){
    const birthday=dob ? parseBirthday(dob) : null;
    if(!first.trim()){profileLog.info('profile_validation_failed',{reason:'first_name_missing'});setMessage('Enter your first name.');return;}
    if(!last.trim()){profileLog.info('profile_validation_failed',{reason:'last_name_missing'});setMessage('Enter your last name.');return;}
    if(dob&&(!birthday||!oldEnough(birthday))){profileLog.info('profile_validation_failed',{reason:birthday?'under_age':'dob_invalid'});setMessage('Enter a valid date of birth. Accounts are for ages 13 and older.');return;}
    setBusy(true);setMessage('');
    const started=Date.now();
    profileLog.info('profile_save_attempt',{has_username:!!username,username_length:username.length,sets_birthday:!!birthday&&!lockedDob});
    try{const {error}=await supabase.rpc('save_account_profile',{p_expected_user:userId,p_first_name:first,p_last_name:last,p_dob:birthday,p_username:username});
      if(error)throw error;
      profileLog.info('profile_save_ok',{duration_ms:elapsed(started)});
      if(alive.current){setMessage('Profile saved.');if(birthday)setLockedDob(true);onSaved();}
    }catch(e){profileLog.warn('profile_save_failed',{error:e,duration_ms:elapsed(started)});if(alive.current)setMessage(e instanceof Error?e.message:(e as {message?:string})?.message||'Could not save your profile.');}
    finally{if(alive.current)setBusy(false);}
  }
  return <View style={styles.form}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={({pressed})=>[styles.action,{backgroundColor:'#DCE9CF',opacity:pressed?0.7:1}]}><ThemedText style={[styles.actionText,{color:'#3E6342'}]}>{open?'My profile details −':'My profile details ›'}</ThemedText></Pressable>
    {open&&<><ThemedText>Your name and birthday are private. Your username will be visible on Community posts when you save it.</ThemedText>
      <ThemedText>First name</ThemedText><TextInput accessibilityLabel="First name" style={input} value={first} onChangeText={setFirst} maxLength={80} editable={ready&&!busy} autoComplete="given-name"/>
      <ThemedText>Last name · required · private</ThemedText><TextInput accessibilityLabel="Last name" style={input} value={last} onChangeText={setLast} maxLength={80} editable={ready&&!busy} autoComplete="family-name"/>
      <ThemedText>Date of birth (MM-DD-YYYY · private)</ThemedText><TextInput accessibilityLabel="Private date of birth" style={input} placeholder="MM-DD-YYYY" value={dob} onChangeText={(value)=>setDob(formatBirthdayInput(value))} editable={ready&&!busy&&!lockedDob} keyboardType="numbers-and-punctuation"/>
      <ThemedText>Username (optional)</ThemedText><TextInput accessibilityLabel="Username" style={input} value={username} onChangeText={setUsername} maxLength={24} editable={ready&&!busy} autoCapitalize="none" autoCorrect={false}/>
      <ThemedText>Your saved username appears on Community posts. Choose something other than your real name.</ThemedText>
      <Pressable accessibilityRole="button" accessibilityState={{disabled:!ready||busy}} disabled={!ready||busy} onPress={save} style={({pressed})=>[styles.action,styles.primary,{opacity:!ready||busy||pressed?0.6:1}]}><ThemedText style={[styles.actionText,{color:'#FFFFFF'}]}>{busy?'Saving…':'Save profile'}</ThemedText></Pressable>
      {!!message&&<ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>}</>}
  </View>;
}

type AuthStep = 'welcome' | 'signin' | 'age' | 'signup' | 'verify' | 'forgot' | 'sent' | 'existing';
const AUTH_RETURN = 'https://mycday.com/auth/';
export function AccountSignIn({ onStepChange }: { onStepChange?: (welcome: boolean) => void }) {
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [privacyAccepted,setPrivacyAccepted]=useState(false);
  const [usResident,setUsResident]=useState(false);
  const [parentApproved,setParentApproved]=useState(false);
  const [policy,setPolicy]=useState<'terms'|'privacy'|null>(null);
  function openPolicy(kind:'terms'|'privacy'){
    Keyboard.dismiss();setPolicy(kind);
  }
  const [step,setStep]=useState<AuthStep>('welcome');
  useEffect(()=>{onStepChange?.(step==='welcome');},[step,onStepChange]);
  useEffect(()=>{authLog.info('auth_screen_mounted',{policy_source:'bundled_beta'});return()=>authLog.info('auth_screen_unmounted');},[]);
  const [dob,setDob]=useState(''); const [first,setFirst]=useState('');
  const [last,setLast]=useState(''); const [phone,setPhone]=useState('');
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const [cooldown,setCooldown]=useState(0);
  const lock=useRef(false); const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(Math.max(0,cooldown-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  function go(next:AuthStep){authLog.info('auth_step_change',{from:step,to:next});Keyboard.dismiss();setMessage('');setStep(next);setPassword('');setConfirm('');}
  function validEmail(action:string){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){authLog.info('auth_validation_failed',{action,reason:'email_format',email_length:email.trim().length,has_whitespace:/\s/.test(email.trim())});setMessage('Enter a complete email address, like name@example.com.');return false;}return true;}
  // Validation failures are logged with a reason code only — never the values typed.
  function invalid(action:string,reason:string,text:string){authLog.info('auth_validation_failed',{action,reason});setMessage(text);}
  async function request(action:'signin'|'signup'|'reset'|'resend'){
    if(lock.current){authLog.info('auth_request_ignored',{action,reason:'in_flight'});return;}
    if(!validEmail(action))return;
    if((action==='reset'||action==='resend')&&cooldown){authLog.info('auth_request_ignored',{action,reason:'cooldown',cooldown_s:cooldown});return;}
    const birthday=parseBirthday(dob);
    if(action==='signup'){
      if(!termsAccepted||!privacyAccepted){invalid(action,'policies_not_accepted','Please review and acknowledge both the Terms of Service and Privacy Policy.');return;}
      if(!birthday||!oldEnough(birthday,13)){invalid(action,birthday?'under_13':'birthday_invalid','You must be 13 or older to join this beta.');return;}
      if(!usResident){invalid(action,'us_residency_not_confirmed','This beta is for US residents. Please confirm that you live in the United States.');return;}
      if(!oldEnough(birthday,18)&&!parentApproved){invalid(action,'parent_approval_missing','Ask your parent or guardian to review the Terms and Privacy Policy and approve your participation before joining.');return;}
      if(!first.trim()){invalid(action,'first_name_missing','Enter your first name.');return;}
      if(!last.trim()){invalid(action,'last_name_missing','Enter your last name.');return;}
      if(!/^[a-z][a-z0-9_]{2,23}$/.test(username)||/(admin|moderator|official|support)/.test(username)){invalid(action,'username_invalid','Choose a username of 3–24 characters: start with a letter, then use letters, numbers or underscores. Avoid staff names.');return;}
      if(phone.trim()&&!normalizeUSPhone(phone)){invalid(action,'phone_invalid','Enter a valid 10-digit US phone number, including the area code.');return;}
      if(password.length<12){invalid(action,'password_too_short','Use at least 12 characters. A memorable phrase works well.');return;}
      if(password!==confirm){invalid(action,'password_mismatch','Your passwords don’t match yet. Please check both fields.');return;}
    }
    if(action==='signin'&&!password){invalid(action,'password_missing','Enter your password.');return;}
    lock.current=true;setBusy(true);setMessage('');Keyboard.dismiss();
    let signupStage: 'username' | 'account' = 'username';
    const started=Date.now();
    const maskedEmail=maskEmail(email);
    authLog.info('auth_request_attempt',{action,email:maskedEmail,email_trimmed_changed:email!==email.trim(),email_has_uppercase:/[A-Z]/.test(email),has_phone:action==='signup'?!!phone.trim():undefined});
    try{
      if(action==='signup'){
        const {data:available,error:checkError}=await supabase.rpc('username_available',{p_username:username});
        if(checkError)throw checkError;
        authLog.info('username_check',{available:!!available,duration_ms:elapsed(started)});
        if(!available){setMessage('That username is unavailable. Please choose another.');return;}
      }
      signupStage = 'account';
      if(action==='reset'||action==='resend'){
        const {error}=action==='reset'
          ?await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:AUTH_RETURN})
          :await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:AUTH_RETURN}});
        if(error)throw error;
        authLog.info('auth_request_ok',{action,email:maskedEmail,duration_ms:elapsed(started)});
        if(alive.current){setCooldown(60);setStep(action==='reset'?'sent':'verify');setMessage(action==='resend'?'Another confirmation email has been requested.':'');}
      }else{
        const credentials={email:email.trim(),password};
        const {data,error}=action==='signup'
          ?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:AUTH_RETURN,data:{legal_acknowledgment:{policy_source:'bundled_beta',terms_version:betaPolicies.terms.version,privacy_version:betaPolicies.privacy.version,us_resident_confirmed:usResident,parent_permission_confirmed:birthday&&!oldEnough(birthday,18)?parentApproved:null,parent_permission_method:birthday&&!oldEnough(birthday,18)?'teen_self_confirmation':null,terms_accepted:true,privacy_acknowledged:true,acknowledged_at:new Date().toISOString()},username,first_name:first.trim(),last_name:last.trim(),phone_number:normalizeUSPhone(phone),date_of_birth:birthday}}})
          :await supabase.auth.signInWithPassword(credentials);
        if(error)throw error;
        const identities=data.user?.identities?.length;
        const outcome=action==='signup'&&!data.session&&identities===0?'existing_account_obscured':!data.session?'needs_email_confirmation':'signed_in';
        authLog.info('auth_request_ok',{action,email:maskedEmail,outcome,has_session:!!data.session,user_id:data.user?.id??null,identities_count:identities??null,email_confirmed:data.user?!!data.user.email_confirmed_at:null,expires_at:data.session?.expires_at??null,duration_ms:elapsed(started),mounted:alive.current});
        if(alive.current){
          setPassword('');setConfirm('');
          // Supabase can obscure a duplicate signup with an empty identities list.
          // Only interpret that signal for signup, never for a sign-in response.
          if(action==='signup'&&!data.session&&data.user?.identities?.length===0){setStep('existing');}
          else if(!data.session){setStep('verify');setCooldown(60);}
        }
      }
    }catch(error){
      const code=(error as {code?:string}).code;
      const status=(error as {status?:number}).status;
      // GoTrue answers 500 "Error sending confirmation email" when its SMTP relay (Resend) rejects the
      // message: a server-side delivery fault, not the user's details. Name it so dashboards can alert on it.
      const emailDeliveryFailed=status===500&&/sending (confirmation|recovery|magic link|invite|email change)? ?email/i.test((error as {message?:string}).message??'');
      const shown=action==='signup'&&(code==='user_already_exists'||code==='email_exists')?'existing_account':code==='email_not_confirmed'?'email_not_confirmed':code==='over_email_send_rate_limit'||code==='over_request_rate_limit'?'rate_limited':emailDeliveryFailed?'email_delivery_failed':'generic_failure';
      // Network failures surface as AuthRetryableFetchError / status 0 — distinguish them from bad credentials.
      authLog[shown==='email_delivery_failed'?'error':shown==='generic_failure'?'warn':'info']('auth_request_failed',{action,email:maskedEmail,error,code:code??null,status:status??null,ui_outcome:shown,duration_ms:elapsed(started),mounted:alive.current});
      if(!alive.current)return;
      if(action==='signup'&&(code==='user_already_exists'||code==='email_exists')){setPassword('');setConfirm('');setStep('existing');}
      else if(code==='email_not_confirmed'){setStep('verify');setMessage('Confirm your email before signing in.');}
      else if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit'){setCooldown(60);setMessage('Please wait a minute before trying again.');}
      else if(shown==='email_delivery_failed')setMessage('We couldn’t send the email just now. This is on our side, not yours — your details are fine. Please try again in a few minutes.');
      else setMessage(action==='signin'?'Could not sign in. Check your email and password, or use Forgot password. If you’re offline, reconnect and try again.':action==='signup'?signupErrorMessage(error,signupStage):'Could not send the email. Check your connection and try again shortly.');
    }finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const signupBirthday=parseBirthday(dob);
  const teen=!!signupBirthday&&oldEnough(signupBirthday,13)&&!oldEnough(signupBirthday,18);
  const button=(label:string,onPress:()=>void,secondary=false,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:busy||disabled}} disabled={busy||disabled} onPress={onPress} style={({pressed})=>[styles.action,secondary?styles.secondary:styles.primary,(busy||disabled)&&{opacity:0.5},pressed&&{opacity:0.75}]}><ThemedText style={[styles.actionText,{color:secondary?'#3E6342':'#FFFFFF'}]}>{label}</ThemedText></Pressable>;
  const emailField=<><ThemedText>Email</ThemedText><TextInput accessibilityLabel="Email" style={input} value={email} onChangeText={setEmail} autoComplete="email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!busy}/></>;
  const titles={welcome:'Welcome to Plan My C-Day',signin:'Welcome back',age:'When’s your birthday?',signup:'Make it yours',verify:'Check your email',forgot:'Forgot your password?',sent:'Check your email',existing:'Already have an account?'};
  return <View style={styles.form}>
    {step!=='welcome'&&button('‹ Back',()=>go(step==='signup'?'age':step==='age'||step==='signin'?'welcome':'signin'),true)}
    {(step==='verify'||step==='sent')&&<View style={{alignSelf:'center',padding:20,borderRadius:28,backgroundColor:'#EDF4E6'}}><ThemedText style={{fontSize:44,lineHeight:52}} accessible={false}>✉</ThemedText></View>}
    <ThemedText type={step==='verify'||step==='sent'?'title':'subtitle'} accessibilityRole="header">{titles[step]}</ThemedText>
    {step==='welcome'&&<><ThemedText>Make a plan, practice skills, and save your progress.</ThemedText>{button('Create account',()=>go('age'))}{button('I already have an account',()=>go('signin'),true)}</>}
    {step==='age'&&<><ThemedText>Step 1 of 2 · About you</ThemedText><ThemedText>This beta is for invited US residents ages 13 and older. If you are 13–17, you need a parent or guardian’s permission. Your birthday stays private.</ThemedText><ThemedText>Birthday · MM-DD-YYYY</ThemedText><TextInput style={input} accessibilityLabel="Birthday" placeholder="MM-DD-YYYY" keyboardType="numbers-and-punctuation" value={dob} onChangeText={v=>{setDob(formatBirthdayInput(v));setParentApproved(false);}}/>{button('Continue',()=>{const birthday=parseBirthday(dob);if(!birthday){setMessage('Enter a valid birthday using MM-DD-YYYY.');return;}if(!oldEnough(birthday,13)){setMessage('You must be 13 or older to join this beta.');return;}go('signup');})}</>}
    {(step==='signup'||step==='signin')&&<>
      {step==='signup'&&<><ThemedText>Step 2 of 2 · Your account</ThemedText><ThemedText>First name · private</ThemedText><TextInput style={input} accessibilityLabel="First name" autoComplete="given-name" maxLength={80} value={first} onChangeText={setFirst} editable={!busy}/>
      <ThemedText>Last name · required · private</ThemedText><TextInput style={input} accessibilityLabel="Last name, required" autoComplete="family-name" maxLength={80} value={last} onChangeText={setLast} editable={!busy}/>
      <ThemedText>Username · required · public</ThemedText><TextInput style={input} accessibilityLabel="Public username, required" autoCapitalize="none" autoCorrect={false} maxLength={24} value={username} onChangeText={value=>setUsername(value.toLowerCase())} editable={!busy}/><ThemedText>This name appears on your Community posts. Use 3–24 letters, numbers or underscores, starting with a letter. Avoid your real name.</ThemedText>
      <ThemedText>US phone number · optional · private</ThemedText><ThemedText>Provide a number if you would like us to contact you about a support request.</ThemedText><TextInput style={input} accessibilityLabel="US phone number, optional" autoComplete="tel" keyboardType="phone-pad" placeholder="(415) 555-0123" maxLength={30} value={phone} onChangeText={value=>setPhone(formatUSPhone(value))} editable={!busy}/>
      <ThemedText>US number · +1 added automatically. We’ll still use email to verify your account and reset your password.</ThemedText></>}
      {emailField}<ThemedText>Password{step==='signup'?' · at least 12 characters':''}</ThemedText><PasswordInput key={step} accessibilityLabel="Password" value={password} onChangeText={setPassword} autoComplete={step==='signup'?'new-password':'current-password'} editable={!busy}/>
      {step==='signup'&&<><ThemedText>Confirm password</ThemedText><PasswordInput accessibilityLabel="Confirm password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" editable={!busy}/></>}
      {step==='signup'&&<View style={styles.notice}>
        <ThemedText type="subtitle">Before you join</ThemedText>
        <Pressable accessibilityRole="link" onPress={()=>void openPolicy('terms')} style={{minHeight:48,justifyContent:'center'}}><ThemedText style={{textDecorationLine:'underline',color:'#3E6342'}}>Read Terms of Service ↗</ThemedText></Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:termsAccepted,disabled:busy}} disabled={busy} onPress={()=>setTermsAccepted(v=>!v)} style={{minHeight:48,justifyContent:'center'}}><ThemedText>{termsAccepted?'☑':'☐'} I have read and agree to the Terms of Service.</ThemedText></Pressable>
        <Pressable accessibilityRole="link" onPress={()=>void openPolicy('privacy')} style={{minHeight:48,justifyContent:'center'}}><ThemedText style={{textDecorationLine:'underline',color:'#3E6342'}}>Read Privacy Policy ↗</ThemedText></Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:privacyAccepted,disabled:busy}} disabled={busy} onPress={()=>setPrivacyAccepted(v=>!v)} style={{minHeight:48,justifyContent:'center'}}><ThemedText>{privacyAccepted?'☑':'☐'} I have read and acknowledge the Privacy Policy.</ThemedText></Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:usResident,disabled:busy}} disabled={busy} onPress={()=>setUsResident(v=>!v)} style={{minHeight:48,justifyContent:'center'}}><ThemedText>{usResident?'☑':'☐'} I live in the United States.</ThemedText></Pressable>
        {teen&&<Pressable accessibilityRole="checkbox" accessibilityState={{checked:parentApproved,disabled:busy}} disabled={busy} onPress={()=>setParentApproved(v=>!v)} style={{minHeight:48,justifyContent:'center'}}><ThemedText>{parentApproved?'☑':'☐'} My parent or guardian has reviewed the Terms and Privacy Policy with me and approved my participation.</ThemedText></Pressable>}
        <ThemedText>US Beta · Ages 13+ · Effective November 7, 2026.</ThemedText>
      </View>}
      {button(busy?'Please wait…':step==='signup'?'Create account':'Sign in',()=>void request(step==='signup'?'signup':'signin'),false,step==='signup'&&(!termsAccepted||!privacyAccepted||!usResident||(teen&&!parentApproved)))}
      {button(step==='signin'?'Forgot password?':'Already have an account? Sign in',()=>go(step==='signin'?'forgot':'signin'),true)}
    </>}
    {step==='existing'&&<>
      <View style={styles.notice}><ThemedText style={{fontWeight:'700'}}>{email.trim()}</ThemedText><ThemedText accessibilityLiveRegion="polite">An account with this email seems to already exist. Sign in to continue, or reset your password if you’ve forgotten it.</ThemedText></View>
      {button('Sign in',()=>go('signin'))}
      {button('Reset password',()=>go('forgot'),true)}
      {button('Use a different email',()=>go('signup'),true)}
    </>}
    {step==='forgot'&&<><ThemedText>Enter your account email. We’ll send a link to choose a new password.</ThemedText>{emailField}{button(busy?'Sending…':cooldown?`Try again in ${cooldown}s`:'Send reset link',()=>void request('reset'),false,cooldown>0)}</>}
    {(step==='verify'||step==='sent')&&<>
      <View style={styles.notice}><ThemedText style={{fontWeight:'700'}}>{email.trim()}</ThemedText><ThemedText>{step==='verify'?'Open your inbox and look for the confirmation email. Tap the link inside to verify your email address, then return to Plan My C-Day.':'If an account uses this email, a password-reset link will arrive. Open the latest email to choose your new password.'}</ThemedText></View>
      <ThemedText>No email yet? Check your spam or junk folder, or request another email below. Use the newest link.</ThemedText>
      {button(busy?'Sending…':cooldown?`Resend in ${cooldown}s`:'Resend email',()=>void request(step==='verify'?'resend':'reset'),false,cooldown>0)}
      {button('Use a different email',()=>go(step==='verify'?(parseBirthday(dob)?'signup':'age'):'forgot'),true)}
      {button('Return to sign in',()=>go('signin'),true)}
    </>}
    <Modal visible={policy!==null} animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>setPolicy(null)}>
      <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#FFFCF7'}} edges={['top','bottom','left','right']}>
        <View style={{padding:20,gap:12}}>
          <Pressable accessibilityRole="button" onPress={()=>setPolicy(null)} style={[styles.action,styles.secondary]}><ThemedText style={styles.actionText}>‹ Back to account creation</ThemedText></Pressable>
          <ThemedText type="subtitle">{policy?betaPolicies[policy].title:''}</ThemedText>
          <ThemedText>Beta Round 1 · Effective September 28, 2026.</ThemedText>
        </View>
        <ScrollView key={policy} contentContainerStyle={{padding:20,paddingTop:0,gap:12}}>
          {policy&&betaPolicies[policy].text.split('\n').filter(Boolean).map((line,index)=><ThemedText key={index} selectable accessibilityRole={line.startsWith('# ')?'header':undefined} style={line.startsWith('# ')?{fontWeight:'700',fontSize:20,lineHeight:28,marginTop:12}:undefined}>{line.replace(/^# /,'')}</ThemedText>)}
        </ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    {!!message&&<View style={styles.notice}><ThemedText accessibilityLiveRegion="polite">{message}</ThemedText></View>}
  </View>;
}
const styles=StyleSheet.create({form:{gap:14},action:{minHeight:50,borderRadius:16,padding:14,justifyContent:'center'},primary:{backgroundColor:'#3E6342'},secondary:{borderWidth:1,borderColor:'#B9CDAA'},actionText:{textAlign:'center',fontWeight:'700'},notice:{padding:16,borderRadius:16,backgroundColor:'#EDF4E6',gap:10}});
