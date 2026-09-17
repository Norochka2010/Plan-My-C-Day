import {readAccountProgress,writeAccountProgress,type AccountProgress} from './explore-account-progress';
import type {RealLifeChallenge} from './real-life-challenge-model';
export type ChallengeProgress={status:'started'|'tried'|'completed';startedAt:string;completedAt:string|null;reflection:string|null;xp:number};
const convert=(p:AccountProgress):ChallengeProgress=>({status:p.status,startedAt:p.started_at,completedAt:p.completed_at,reflection:p.reflection,xp:p.xp_awarded});
export async function readChallengeProgress(id:string):Promise<ChallengeProgress|null>{const [p]=await readAccountProgress(id);return p?convert(p):null;}
export async function updateChallengeProgress(card:RealLifeChallenge,action:'start'|'tried'|'complete',reflection?:string):Promise<ChallengeProgress>{return convert(await writeAccountProgress(card.content_id,action,reflection));}
export async function readChallengeTotals(){const rows=(await readAccountProgress()).filter(p=>p.content_type==='REAL_LIFE_CHALLENGE'&&p.status==='completed');return{completedChallenges:rows.length,xp:rows.reduce((n,p)=>n+p.xp_awarded,0)};}
