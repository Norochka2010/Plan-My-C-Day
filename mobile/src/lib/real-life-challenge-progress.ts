import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealLifeChallenge } from './real-life-challenge-model';
export type ChallengeProgress = { status: 'started' | 'tried' | 'completed'; startedAt: string; completedAt: string | null; reflection: string | null; xp: number };
const key=(id:string)=>`real-life-challenge:v1:${id}`;
export async function readChallengeProgress(id:string):Promise<ChallengeProgress|null> {
  const raw=await AsyncStorage.getItem(key(id));if(!raw)return null;
  const p=JSON.parse(raw);
  if(!p || !['started','tried','completed'].includes(p.status) || typeof p.startedAt!=='string' || !Number.isSafeInteger(p.xp) || p.xp<0 || (p.status==='completed' ? typeof p.reflection!=='string' || !p.reflection || typeof p.completedAt!=='string' : p.reflection!==null || p.completedAt!==null || p.xp!==0)) throw Error('Invalid challenge progress');
  return p;
}
let queue:Promise<unknown>=Promise.resolve();
export function updateChallengeProgress(card:RealLifeChallenge, action:'start'|'tried'|'complete', reflection?:string):Promise<ChallengeProgress> {
  const operation=queue.then(async()=>{
    const previous=await readChallengeProgress(card.content_id);
    if(previous?.status==='completed')return previous;
    let next:ChallengeProgress;
    if(action==='start') {
      if(previous)return previous;
      next={status:'started',startedAt:new Date().toISOString(),completedAt:null,reflection:null,xp:0};
    } else {
      if(!previous)throw Error('Start the challenge first');
      next={...previous};
      if(action==='tried')next.status='tried';
      else {
        if(previous.status!=='tried' || !reflection || !card.reflection_options.includes(reflection) || !Number.isSafeInteger(card.xp) || card.xp<0)throw Error('Invalid challenge reflection');
        next={...previous,status:'completed',completedAt:new Date().toISOString(),reflection,xp:card.xp};
      }
    }
    await AsyncStorage.setItem(key(card.content_id),JSON.stringify(next));return next;
  });queue=operation.catch(()=>undefined);return operation;
}

/** Read existing completed awards for ME without changing progress or issuing XP. */
export async function readChallengeTotals(): Promise<{ completedChallenges: number; xp: number }> {
  await queue;
  const prefix = 'real-life-challenge:v1:';
  const keys = [...new Set(await AsyncStorage.getAllKeys())]
    .filter(k => k.startsWith(prefix) && k.length > prefix.length);
  const entries = await Promise.all(keys.map(k => readChallengeProgress(k.slice(prefix.length))));
  return entries.reduce((total, entry) => ({
    completedChallenges: total.completedChallenges + (entry?.status === 'completed' ? 1 : 0),
    xp: total.xp + (entry?.status === 'completed' ? entry.xp : 0),
  }), { completedChallenges: 0, xp: 0 });
}
