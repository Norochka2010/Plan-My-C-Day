import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { readHomeInspiration, type InspirationDisplay } from '@/lib/home-inspiration-data';
/** One quiet message in the existing HOME For You slot. No navigation or rewards. */
export function HomeInspiration() {
  const [message,setMessage]=useState<InspirationDisplay|null>(null);
  useEffect(()=>{
    if(!message)return;
    const timer=setTimeout(()=>setMessage(null),Math.max(0,message.validUntil-Date.now()));
    return()=>clearTimeout(timer);
  },[message]);
  useFocusEffect(useCallback(()=>{
    let active=true,generation=0;
    async function refresh(clear=false) {
      const request=++generation;if(clear)setMessage(null);
      try {
        const {data,error}=await supabase.auth.getSession();if(error)throw error;
        const next=await readHomeInspiration(data.session?.user.id??null);
        if(active&&request===generation)setMessage(next);
      } catch { if(active&&request===generation)setMessage(null); }
    }
    void refresh(true);
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{void refresh(true)});
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh(true)});
    const timer=setInterval(()=>{void refresh()},30000);
    return()=>{active=false;generation++;subscription.unsubscribe();listener.remove();clearInterval(timer)};
  },[]));
  if(!message)return null;
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.heading}>For You</Text>
    <View style={s.card}>
      <View style={s.badge}><Text style={s.icon}>✦</Text></View>
      <Text style={s.message}>{message.message.message_text}</Text>
    </View>
  </View>;
}
const s=StyleSheet.create({
  section:{gap:10},heading:{fontSize:14,fontWeight:'700',color:'#35204E',textTransform:'uppercase',letterSpacing:0.7},
  card:{borderWidth:1.5,borderColor:'#D5C0E3',borderRadius:18,backgroundColor:'#FFFDFA',padding:18,flexDirection:'row',alignItems:'center',gap:14,minHeight:110},
  badge:{width:48,height:48,borderRadius:16,backgroundColor:'#EAF0FA',alignItems:'center',justifyContent:'center'},icon:{fontSize:29,color:'#5D4277'},
  message:{flex:1,color:'#241638',fontSize:16,lineHeight:24,fontWeight:'500'},
});
