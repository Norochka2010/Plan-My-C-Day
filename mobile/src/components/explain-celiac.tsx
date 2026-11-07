import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { canCopyMessage, copyMessage } from '@/lib/message-clipboard';
import { Fonts } from '@/constants/theme';
import content from '@/content/explain-celiac.json';

type Message = typeof content.messages[number];
export function ExplainCeliac({ onClose, backLabel = '‹ Back to Trusted Resources' }: { onClose: () => void; backLabel?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let active = true, changed = false;
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (active) { setUserId(session?.user.id ?? null); setAuthReady(true); }
    });
    supabase.auth.getSession().then(({data}) => {
      if (active && !changed) { setUserId(data.session?.user.id ?? null); setAuthReady(true); }
    }).catch(() => { if (active && !changed) setAuthReady(true); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const [selected, setSelected] = useState<Message | null>(null);
  return <SafeAreaView style={styles.screen}>
    {selected ? <MessageEditor key={`${selected.id}:${userId}:${authReady}`} userId={userId} authReady={authReady} item={selected} onBack={() => setSelected(null)} /> :
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.back}><Text style={styles.link}>{backLabel}</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Help me explain</Text>
      <Text style={styles.body}>Your words, with a little help. Pick a message, make it sound like you, then copy and paste it into your chat.</Text>
      {content.messages.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => setSelected(item)} style={styles.card}>
        <Text style={styles.heading}>{item.title} ›</Text>
        <Text style={styles.body}>{item.description}</Text>
      </Pressable>)}
      <Text style={styles.note}>Written for Plan My C-Day using the trusted resources linked with each health-related message. Adapt these starting points to your care team’s guidance.</Text>
    </ScrollView>}
  </SafeAreaView>;
}
function MessageEditor({ item, onBack, userId, authReady }: { item: Message; onBack: () => void; userId: string | null; authReady: boolean }) {
  const [message, setMessage] = useState(item.message);
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(item.message);
  const storageKey = userId ? `explain-message:v1:${userId}:${item.id}` : null;
  useEffect(() => {
    let active = true;
    if (!authReady) return;
    if (!storageKey) { setReady(true); return; }
    AsyncStorage.getItem(storageKey).then(value => {
      if (active) { const text = value ?? item.message; setMessage(text); setSaved(text); setReady(true); }
    }).catch(() => { if (active) setStatus('Your saved version couldn’t load. Reopen this message to try again.'); });
    return () => { active = false; };
  }, [storageKey, authReady, item.message]);
  async function saveVersion(restore = false) {
    if (!storageKey || !ready || saving) return;
    setSaving(true); setStatus('');
    const next = restore ? item.message : message;
    try {
      if (restore) await AsyncStorage.removeItem(storageKey);
      else await AsyncStorage.setItem(storageKey, next);
      setMessage(next); setSaved(next);
      setStatus(restore ? 'Original app draft restored.' : 'Your version is saved on this device.');
    } catch { setStatus('Couldn’t save that change. Please try again.'); }
    finally { setSaving(false); }
  }
  function restoreOriginal() {
    Alert.alert('Restore original draft?', 'This replaces your edits and removes your saved version for this message.', [
      {text:'Keep my version',style:'cancel'},
      {text:'Restore original',onPress:() => { if (storageKey) void saveVersion(true); else {setMessage(item.message);setSaved(item.message);setStatus('Original app draft restored.');} }},
    ]);
  }
  function leave() {
    if (message === saved) { onBack(); return; }
    Alert.alert('Leave without saving?', 'Your latest edits haven’t been saved.', [
      {text:'Keep editing',style:'cancel'}, {text:'Leave',onPress:onBack},
    ]);
  }
  async function copy() {
    setCopying(true); setStatus('');
    try { const copied = await copyMessage(message); setStatus(copied ? 'Copied! Paste it into your chat when you’re ready.' : 'Couldn’t copy. Touch and hold the message to select and copy it.'); }
    catch { setStatus('Couldn’t copy. Touch and hold the message to select and copy it.'); }
    finally { setCopying(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={leave} style={styles.back}><Text style={styles.link}>‹ All messages</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>{item.title}</Text>
    <Text style={styles.body}>Edit anything below to make it yours. Only the message is copied.</Text>
    <TextInput accessibilityLabel="Message to edit and copy" editable={ready && !saving} multiline scrollEnabled={false} value={message} onChangeText={value => {setMessage(value); setStatus('');}} style={styles.editor} textAlignVertical="top" />
    {!ready && <Text style={styles.note}>Loading your version…</Text>}
    {userId ? <Pressable accessibilityRole="button" disabled={!ready || saving || !message.trim() || message === saved} accessibilityState={{disabled:!ready || saving || !message.trim() || message === saved}} onPress={() => void saveVersion()} style={[styles.button, (!ready || saving || !message.trim() || message === saved) && {opacity:0.5}]}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save my version'}</Text></Pressable> : <Text style={styles.note}>Sign in to save your own version on this device.</Text>}
    <Pressable accessibilityRole="button" disabled={!ready || saving} onPress={restoreOriginal} style={styles.back}><Text style={styles.link}>Restore original app draft</Text></Pressable>
    {canCopyMessage ? <Pressable accessibilityRole="button" accessibilityState={{disabled: !message.trim() || copying}} disabled={!message.trim() || copying} onPress={copy} style={[styles.button, (!message.trim() || copying) && {opacity:0.5}]}><Text style={styles.buttonText}>{copying ? 'Copying…' : 'Copy message'}</Text></Pressable> : <Text style={styles.body}>To copy: touch and hold the message, choose Select All, then Copy.</Text>}
    {!!status && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>}
    <Text style={styles.note}>Saved versions are private to your account on this device. They don’t sync to other devices. Nothing is sent to anyone.</Text>
    {item.sources.length > 0 && <View style={styles.sources}>
      <Text accessibilityRole="header" style={styles.heading}>Behind the message</Text>
      <Text style={styles.note}>Adapted from these resources; not a quotation or an endorsement by their authors.</Text>
      {content.sources.filter(source => item.sources.includes(source.id)).map(source => <Pressable key={source.id} accessibilityRole="link" onPress={() => Linking.openURL(source.url).catch(() => Alert.alert('Link unavailable', 'Please try again when you’re connected.'))} style={styles.back}><Text style={styles.link}>{source.title} ↗</Text></Pressable>)}
    </View>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#FFFCF7'},
  content:{padding:24,paddingBottom:40,gap:18,width:'100%',maxWidth:640,alignSelf:'center'},
  back:{minHeight:48,justifyContent:'center'},
  title:{fontFamily:Fonts.rounded,fontSize:28,lineHeight:36,fontWeight:'700',color:'#302040'},
  heading:{fontFamily:Fonts.rounded,fontSize:19,lineHeight:27,fontWeight:'600',color:'#302040'},
  body:{fontSize:16,lineHeight:25,color:'#62556E'},
  note:{fontSize:14,lineHeight:22,color:'#62556E'},
  link:{fontSize:16,lineHeight:24,fontWeight:'600',color:'#63497B'},
  card:{padding:18,borderRadius:20,gap:8,backgroundColor:'#EFEDF9',borderWidth:1,borderColor:'#CEC8E8'},
  editor:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#B4C9A7',borderRadius:18,padding:18,fontSize:17,lineHeight:27,color:'#302040',minHeight:200},
  button:{backgroundColor:'#3D6242',borderRadius:16,minHeight:52,justifyContent:'center',alignItems:'center',padding:14},
  buttonText:{color:'#FFFFFF',fontSize:17,fontWeight:'700'},
  sources:{borderTopWidth:1,borderColor:'#D9D4DD',paddingTop:20,gap:8,marginTop:10},
});
