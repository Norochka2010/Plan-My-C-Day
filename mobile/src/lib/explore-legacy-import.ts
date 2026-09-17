import AsyncStorage from '@react-native-async-storage/async-storage';
import {exploreAccountId,writeAccountProgress} from './explore-account-progress';
type Legacy={content_id:string;content_type:string;status:string;saved:boolean;xp:number;started_at:string|null;completed_at:string|null;reflection:string|null};
const ownerKey='explore-legacy-import:v1:owner';
async function records():Promise<Legacy[]>{const keys=(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith('quick-learn:v1:')||k.startsWith('real-life-challenge:v1:')||k==='myth-or-fact:completion:v1'||k==='practice:completion:v1');const rows:Legacy[]=[];
 const add=(id:string,p:any,type:string)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!p||typeof p!=='object')throw Error('Some old progress needs review. It has not been deleted.');
  const status=type==='QUICK_LEARN'?(p.complete?'completed':'started'):type==='REAL_LIFE_CHALLENGE'?p.status:'completed';const xp=status==='completed'?(p.xp??0):0;
  if(!['started','tried','completed'].includes(status)||!Number.isSafeInteger(xp)||xp<0)throw Error('Some old progress needs review. It has not been deleted.');
  if(type==='QUICK_LEARN'&&!p.complete&&!p.saved)return;
  rows.push({content_id:id,content_type:type,status,saved:p.saved===true,xp,started_at:p.startedAt??p.completedAt??null,completed_at:p.completedAt??null,reflection:p.reflection??null});};
 for(const [key,raw]of await AsyncStorage.multiGet(keys)){if(!raw)continue;const p=JSON.parse(raw);if(key.startsWith('quick-learn:v1:'))add(key.slice('quick-learn:v1:'.length),p,'QUICK_LEARN');else if(key.startsWith('real-life-challenge:v1:'))add(key.slice('real-life-challenge:v1:'.length),p,'REAL_LIFE_CHALLENGE');else for(const [id,value]of Object.entries(p))add(id,value,key.startsWith('practice:')?'PRACTICE_A_SKILL':'MYTH_OR_FACT');}return rows;
}
export async function legacyImportStatus(){const user=await exploreAccountId();const owner=await AsyncStorage.getItem(ownerKey);if(owner&&owner!==user)return{count:0,done:true};const done=await AsyncStorage.getItem(`explore-legacy-import:v1:done:${user}`)==='true';return{count:done?0:(await records()).length,done};}
let queue:Promise<unknown>=Promise.resolve();
export function importLegacyExplore(){const account=exploreAccountId();const run=queue.then(async()=>{const user=await account;if(await exploreAccountId()!==user)throw Error('Account changed. Reopen ME.');const owner=await AsyncStorage.getItem(ownerKey);if(owner&&owner!==user)throw Error('This phone’s earlier progress is linked to another account.');const rows=await records();await AsyncStorage.setItem(ownerKey,user);
 for(const row of rows)await writeAccountProgress(row.content_id,'import',undefined,row,user);
 if(await exploreAccountId()!==user)throw Error('Account changed. Reopen ME to check import.');await AsyncStorage.setItem(`explore-legacy-import:v1:done:${user}`,'true');return rows.length;});queue=run.catch(()=>undefined);return run;}
