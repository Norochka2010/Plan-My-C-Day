export type AdventureChoice={id:string;text:string;next_node_id:string};
export type AdventureNode={id:string;text:string} & (
 {type:'opening'|'consequence';next_node_id:string} |
 {type:'decision';choices:AdventureChoice[]} |
 {type:'ending';skill_tags:string[]}
);
export type RLCAdventure={content_id:string;challenge_id:string;adventure_version:string;review_status:'approved'|'needs_review'|'hidden';development_preview:boolean;start_node_id:string;nodes:AdventureNode[]};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
/** Validate all paths, including unreachable content, before presenting an authored adventure. */
export function parseRLCAdventure(value:unknown,contentId:string,challengeId:string):RLCAdventure|null {
 const row=object(value),graph=object(row.graph);
 if(row.content_id!==contentId||row.challenge_id!==challengeId||!text(row.adventure_version)||row.active!==true||row.branching_enabled!==true||!['approved','needs_review','hidden'].includes(String(row.review_status))||graph.format!=='rlc_branching_v1'||!text(graph.start_node_id)||!Array.isArray(graph.nodes)||graph.nodes.length<3||graph.nodes.length>100)return null;
 const nodes:AdventureNode[]=[],ids=new Set<string>(),choiceIds=new Set<string>();
 for(const raw of graph.nodes){
  const n=object(raw);if(!text(n.id)||ids.has(n.id)||!text(n.text))return null;ids.add(n.id);
  if(n.type==='opening'||n.type==='consequence'){if(!text(n.next_node_id))return null;nodes.push({id:n.id,text:n.text,type:n.type,next_node_id:n.next_node_id});}
  else if(n.type==='decision'){
   if(!Array.isArray(n.choices)||n.choices.length<2||n.choices.length>8)return null;
   const choices:AdventureChoice[]=[];
   for(const v of n.choices){const c=object(v);if(!text(c.id)||choiceIds.has(c.id)||!text(c.text)||!text(c.next_node_id))return null;choiceIds.add(c.id);choices.push({id:c.id,text:c.text,next_node_id:c.next_node_id});}
   nodes.push({id:n.id,text:n.text,type:'decision',choices});
  }else if(n.type==='ending'){
   if(!Array.isArray(n.skill_tags)||!n.skill_tags.length||!n.skill_tags.every(text))return null;
   nodes.push({id:n.id,text:n.text,type:'ending',skill_tags:n.skill_tags});
  }else return null;
 }
 const byId=new Map(nodes.map(n=>[n.id,n])),visited=new Set<string>(),stack=new Set<string>();
 if(byId.get(graph.start_node_id)?.type!=='opening'||nodes.filter(n=>n.type==='opening').length!==1)return null;
 function visit(id:string):boolean{
  if(stack.has(id))return false;if(visited.has(id))return true;
  const n=byId.get(id);if(!n)return false;stack.add(id);
  const next=n.type==='ending'?[]:n.type==='decision'?n.choices.map(c=>c.next_node_id):[n.next_node_id];
  if(!next.every(visit))return false;stack.delete(id);visited.add(id);return true;
 }
 if(!visit(graph.start_node_id)||visited.size!==nodes.length)return null;
 return {content_id:contentId,challenge_id:challengeId,adventure_version:row.adventure_version,review_status:row.review_status as RLCAdventure['review_status'],development_preview:row.development_preview===true,start_node_id:graph.start_node_id,nodes};
}
export function adventureIsPublished(value:unknown):boolean {
 const r=object(value);return r.active===true&&r.branching_enabled===true&&r.review_status==='approved'&&(!r.expert_review_required||r.expert_reviewed===true)&&(!r.medical_review_required||r.medical_reviewed===true);
}
