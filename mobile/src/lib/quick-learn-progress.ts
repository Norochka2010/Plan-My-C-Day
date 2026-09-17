import {readAccountProgress,writeAccountProgress,exploreAccountId} from './explore-account-progress';
export type QuickLearnProgress={saved:boolean;complete:boolean;xp:number;completedAt:string|null};
export const emptyQuickLearnProgress=():QuickLearnProgress=>({saved:false,complete:false,xp:0,completedAt:null});
const convert=(p:Awaited<ReturnType<typeof writeAccountProgress>>):QuickLearnProgress=>({saved:p.saved,complete:p.status==='completed',xp:p.xp_awarded,completedAt:p.completed_at});
export async function readQuickLearnProgress(id:string):Promise<QuickLearnProgress>{const [p]=await readAccountProgress(id);return p?convert(p):emptyQuickLearnProgress();}
let queue:Promise<unknown>=Promise.resolve();
export function updateQuickLearnProgress(id:string,kind:'saved'|'complete',_xp:number):Promise<QuickLearnProgress>{const owner=exploreAccountId();const run=queue.then(async()=>{const user=await owner;const p=await readQuickLearnProgress(id);return convert(await writeAccountProgress(id,kind==='complete'?'complete':p.saved?'unsave':'save',undefined,undefined,user));});queue=run.catch(()=>undefined);return run;}
export async function readQuickLearnTotals(){const rows=(await readAccountProgress()).filter(p=>p.content_type==='QUICK_LEARN'&&p.status==='completed');return{completedLessons:rows.length,xp:rows.reduce((n,p)=>n+p.xp_awarded,0)};}
