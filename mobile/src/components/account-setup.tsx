import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PasswordInput } from '@/components/password-input';
import { supabase } from '@/lib/supabase';

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
function oldEnough(dob: string) {
  const today = new Date();
  const [y,m,d] = dob.split('-').map(Number);
  const age = today.getFullYear()-y - (today.getMonth()+1<m || (today.getMonth()+1===m && today.getDate()<d) ? 1 : 0);
  return age >= 13;
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
      if(user.error||profile.error){setMessage('Profile setup is temporarily unavailable. You can keep using your account.');return;}
      setFirst(user.data.first_name||'');setLast(user.data.last_name||'');setUsername(profile.data?.username||'');
      const birthday=profile.data?.date_of_birth;
      if(birthday){const [y,m,d]=birthday.split('-');setDob(`${m}-${d}-${y}`);setLockedDob(true);}
      setReady(true);
    }).catch(()=>{if(active)setMessage('Could not load profile setup. Please try again later.');});
    return()=>{active=false;};
  },[userId]);
  async function save(){
    const birthday=dob ? parseBirthday(dob) : null;
    if(!first.trim()){setMessage('Enter your first name.');return;}
    if(dob&&(!birthday||!oldEnough(birthday))){setMessage('Enter a valid date of birth. Accounts are for ages 13 and older.');return;}
    setBusy(true);setMessage('');
    try{const {error}=await supabase.rpc('save_account_profile',{p_expected_user:userId,p_first_name:first,p_last_name:last,p_dob:birthday,p_username:username});
      if(error)throw error;
      if(alive.current){setMessage('Profile saved.');if(birthday)setLockedDob(true);onSaved();}
    }catch(e){if(alive.current)setMessage(e instanceof Error?e.message:(e as {message?:string})?.message||'Could not save your profile.');}
    finally{if(alive.current)setBusy(false);}
  }
  return <View style={styles.form}>
    <Button title={open?'Close profile details':'My profile details'} onPress={()=>setOpen(!open)}/>
    {open&&<><ThemedText>These details are private. Existing accounts can finish setup later.</ThemedText>
      <ThemedText>First name</ThemedText><TextInput accessibilityLabel="First name" style={input} value={first} onChangeText={setFirst} maxLength={80} editable={ready&&!busy} autoComplete="given-name"/>
      <ThemedText>Last name (optional)</ThemedText><TextInput accessibilityLabel="Last name" style={input} value={last} onChangeText={setLast} maxLength={80} editable={ready&&!busy} autoComplete="family-name"/>
      <ThemedText>Date of birth (MM-DD-YYYY · private)</ThemedText><TextInput accessibilityLabel="Private date of birth" style={input} placeholder="MM-DD-YYYY" value={dob} onChangeText={(value)=>setDob(formatBirthdayInput(value))} editable={ready&&!busy&&!lockedDob} keyboardType="numbers-and-punctuation"/>
      <ThemedText>Username (optional)</ThemedText><TextInput accessibilityLabel="Username" style={input} value={username} onChangeText={setUsername} maxLength={24} editable={ready&&!busy} autoCapitalize="none" autoCorrect={false}/>
      <ThemedText>Reserve a username for future public use. Choose something other than your real name. Community currently shows “Community member.”</ThemedText>
      <Button title={busy?'Saving…':'Save profile'} disabled={!ready||busy} onPress={save}/>
      {!!message&&<ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>}</>}
  </View>;
}

export function AccountSignIn() {
  const [mode,setMode]=useState<'signin'|'age'|'signup'>('signin');
  const [dob,setDob]=useState('');const [first,setFirst]=useState('');const [last,setLast]=useState('');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function submit(){
    if(!email.trim()||!password){setMessage('Enter your email and password.');return;}
    const birthday=parseBirthday(dob);
    if(mode==='signup'&&(!birthday||!oldEnough(birthday)||!first.trim())){setMessage('Enter your first name and a valid date of birth. You must be 13 or older.');return;}
    if(mode==='signup'&&password.length<12){setMessage('Choose a password with at least 12 characters. A memorable phrase works well.');return;}
    if(mode==='signup'&&password!==confirm){setMessage('Passwords must match. Enter the same password twice.');return;}
    setBusy(true);setMessage('');
    try{
      const credentials={email:email.trim(),password};
      const {data,error}=mode==='signup'?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:'https://plan-my-c-day-auth.noraimsf.chatgpt.site/',data:{first_name:first.trim(),last_name:last.trim(),date_of_birth:birthday}}}):await supabase.auth.signInWithPassword(credentials);
      if(error)throw error;
      setPassword('');setConfirm('');
      if(!data.session)setMessage('Check your email to confirm your account, then return here and sign in.');
    }catch{setMessage(mode==='signup'?'Could not create your account. Check your details and connection, or try signing in if you already have an account.':'Could not sign in. Check your email and password, or try again when connected.');}
    finally{setBusy(false);}
  }
  async function resetPassword(){
    if(!email.trim()){setMessage('Enter your email above first.');return;}
    setBusy(true);
    try{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:'https://plan-my-c-day-auth.noraimsf.chatgpt.site/'});
      if(error)throw error;
      setMessage('If an account uses that email, a reset link will arrive. Open it on this phone.');
    }catch{setMessage('Could not request a reset email. Check your connection and try again shortly.');}
    finally{setBusy(false);}
  }
  return <View style={styles.form}>
    <ThemedText type="subtitle">{mode==='signin'?'Welcome back':mode==='age'?'Let’s start with your age':'Create your account'}</ThemedText>
    {mode==='age'?<>
      <ThemedText>Plan My C-Day is for ages 13 and older. Your birthday stays private.</ThemedText>
      <ThemedText>Date of birth (MM-DD-YYYY)</ThemedText><TextInput accessibilityLabel="Date of birth" style={input} value={dob} onChangeText={(value)=>setDob(formatBirthdayInput(value))} placeholder="MM-DD-YYYY" keyboardType="numbers-and-punctuation"/>
      <Button title="Continue" onPress={()=>{const birthday=parseBirthday(dob);if(!birthday){setMessage('Enter a valid date using MM-DD-YYYY.');return;}if(!oldEnough(birthday)){setMessage('You need to be 13 or older to create an account.');return;}setMessage('');setMode('signup');}}/>
    </>:<>
      {mode==='signup'&&<><ThemedText>First name (private)</ThemedText><TextInput accessibilityLabel="First name" style={input} value={first} onChangeText={setFirst} maxLength={80} autoComplete="given-name" editable={!busy}/>
      <ThemedText>Last name (optional · private)</ThemedText><TextInput accessibilityLabel="Last name" style={input} value={last} onChangeText={setLast} maxLength={80} autoComplete="family-name" editable={!busy}/></>}
      <ThemedText>Email</ThemedText><TextInput accessibilityLabel="Email" style={input} value={email} onChangeText={setEmail} autoComplete="email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!busy}/>
      <ThemedText>Password{mode==='signup'?' · at least 12 characters':''}</ThemedText><PasswordInput key={mode} accessibilityLabel="Password" value={password} onChangeText={setPassword} autoComplete={mode==='signup'?'new-password':'current-password'} autoCapitalize="none" autoCorrect={false} editable={!busy}/>
      {mode==='signup'&&<><ThemedText>Confirm password</ThemedText><PasswordInput accessibilityLabel="Confirm password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" editable={!busy}/></>}
      <Button title={busy?'Please wait…':mode==='signup'?'Create account':'Sign in'} disabled={busy} onPress={submit}/>
    </>}
    {mode==='signin'&&<Button title="Forgot password?" disabled={busy} onPress={resetPassword}/>}
    <Button title={mode==='signin'?'Create a new account':'Back to sign in'} disabled={busy} onPress={()=>{setMode(mode==='signin'?'age':'signin');setPassword('');setConfirm('');setMessage('');}}/>
    {!!message&&<ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>}
  </View>;
}
const styles=StyleSheet.create({form:{gap:14}});
