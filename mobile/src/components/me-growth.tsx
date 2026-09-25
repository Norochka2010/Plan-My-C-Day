import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ExploreGrowthCard } from './explore-growth-card';
import { ThemedText } from './themed-text';
import { getExploreCatalog, type ExploreSummary } from '@/lib/explore-content';
export function MeGrowth({onExpand,onViewHistory,initiallyExpanded=false}:{onExpand:()=>void;onViewHistory:()=>void;initiallyExpanded?:boolean}) {
 const router=useRouter();
 const [catalog,setCatalog]=useState<ExploreSummary[]>([]);
 const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{
  let active=true;setLoading(true);setFailed(false);
  getExploreCatalog().then(items=>{if(active)setCatalog(items);}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[retry]));
 return <View style={{gap:10}}>
 {failed&&<Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)} style={{padding:14}}><ThemedText>Try loading your growth again</ThemedText></Pressable>}
 <ExploreGrowthCard onViewHistory={onViewHistory} initiallyExpanded={initiallyExpanded} catalog={catalog} catalogLoading={loading} catalogFailed={failed} refreshKey={String(retry)} onExpand={onExpand} onOpen={item=>router.push({pathname:'/explore',params:{supportContentId:item.content_id,supportEntry:String(Date.now()),returnTo:'me'}})}/>
 </View>;
}
