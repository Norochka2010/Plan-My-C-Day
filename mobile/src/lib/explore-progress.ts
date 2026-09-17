import {readAccountProgress} from './explore-account-progress';
export type ExploreProgressSummary={xp:number;categories:{title:string;xp:number|null;completed:number|null}[]};
/** One account-owned ledger supplies ME totals. Reading never issues awards. */
export async function readExploreProgress():Promise<ExploreProgressSummary>{
 const rows=(await readAccountProgress()).filter(p=>p.status==='completed');
 const categories=[['Quick Learn','QUICK_LEARN'],['Myth or Fact?','MYTH_OR_FACT'],['Practice a Skill','PRACTICE_A_SKILL'],['Real-Life Challenges','REAL_LIFE_CHALLENGE']].map(([title,type])=>{const entries=rows.filter(p=>p.content_type===type);return{title,xp:entries.reduce((n,p)=>n+p.xp_awarded,0),completed:entries.length};});
 return{xp:categories.reduce((n,c)=>n+c.xp,0),categories:[...categories,{title:'From the Experts',xp:null,completed:null}]};
}
