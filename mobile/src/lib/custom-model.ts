import type { LibraryAction } from './c-day-model';
export const builderQuestions = [
 {id:'day',question:'What kind of day is it?',multiple:false,choices:[['Friends','friends'],['School','school'],['Travel','travel'],['Sports','sports'],['Celebration','celebration'],['Overnight','overnight'],['Something else','other']]},
 {id:'food',question:'What will food be like?',multiple:false,choices:[['Restaurant','restaurant'],['Someone else is cooking','host_cooking'],['Food will be provided','food_provided'],['Bringing my own','bring_own'],['I’m not sure','uncertain_food_context']]},
 {id:'support',question:'Who can help if you need it?',multiple:true,choices:[['Friends','support_friend'],['Family','support_family'],['Teacher/coach','support_teacher'],['Host','support_host'],['Staff','support_staff'],['Mostly me','mostly_me']]},
 {id:'familiarity',question:'How familiar does this feel?',multiple:false,choices:[['I’ve done this before','familiar'],['Kind of new','new_context'],['Totally new','new_context_total']]},
 {id:'ready',question:'What would make you feel more ready?',multiple:true,choices:[['Knowing what food is there','food_information'],['Having a backup','backup'],['Knowing what to say','communication'],['Asking ahead','ask_ahead'],['Planning with someone','collaborate'],['Not sure yet','not_sure']]},
] as const;
export type BuilderAnswers = Record<string,string[]>;
export function contextTags(answers:BuilderAnswers):string[] {
 return [...new Set(builderQuestions.flatMap(q=>(answers[q.id]??[]).filter(v=>q.choices.some(c=>c[1]===v))))];
}
export function suggestActions(items:LibraryAction[],answers:BuilderAnswers):LibraryAction[] {
 const tags=new Set(contextTags(answers));
 const score=(a:LibraryAction)=>(a.context_tags??[]).filter(t=>tags.has(t)).length;
 const sorted=[...items].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
 // First pass broadens category coverage; second fills to eight. No selection is automatic.
 const result:LibraryAction[]=[], categories=new Set<string>();
 for(const a of sorted) if(!categories.has(a.category)&&result.length<8){result.push(a);categories.add(a.category);}
 for(const a of sorted) if(result.length<8&&!result.some(r=>r.id===a.id))result.push(a);
 return result;
}
export type PlanTemplate={id:string;title:string;context_tags:string[];source_event_id:string|null};
export function matchingTemplates(templates:PlanTemplate[],title:string,tags:string[]):PlanTemplate[]{
 const normalize=(v:string)=>v.trim().toLocaleLowerCase();
 return templates.filter(t=>normalize(t.title)===normalize(title)||t.context_tags.some(x=>tags.includes(x))).slice(0,3);
}
