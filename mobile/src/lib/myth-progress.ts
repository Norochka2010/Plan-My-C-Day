import {readAccountProgress,writeAccountProgress} from './explore-account-progress';
export type Progress=Record<string,{xp:number;completedAt:string}>;
export async function readMythProgress():Promise<Progress>{return Object.fromEntries((await readAccountProgress()).filter(p=>p.content_type==='MYTH_OR_FACT'&&p.status==='completed').map(p=>[p.content_id,{xp:p.xp_awarded,completedAt:p.completed_at!}]));}
export async function completeMyth(contentId:string,_xp:number):Promise<Progress>{await writeAccountProgress(contentId,'complete');return readMythProgress();}
