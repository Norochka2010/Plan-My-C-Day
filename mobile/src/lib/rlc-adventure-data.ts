import { supabase } from './supabase';
import { adventureIsPublished, parseRLCAdventure, type RLCAdventure } from './rlc-adventure-model';
export async function getRLCAdventure(contentId:string,challengeId:string,publishedOnly=false):Promise<RLCAdventure|null>{
 const {data,error}=await supabase.from('rlc_adventures').select('*').eq('content_id',contentId).eq('active',true).eq('branching_enabled',true).eq('review_status','approved').maybeSingle();
 // Installing the optional layer must not break the existing canonical RLC library.
 if(error&&!['42P01','PGRST205'].includes(error.code))throw error;
 let row:unknown=data&&adventureIsPublished(data)?data:null;
 if(!row&&__DEV__&&!publishedOnly){
  const previews=require('../dev/rlc-adventure-review-preview.json') as {content_id:string;review_status:string}[];
  const preview=previews.find(r=>r.content_id===contentId&&r.review_status==='needs_review');
  if(preview)row={...preview,development_preview:true};
 }
 if(!row)return null;
 const adventure=parseRLCAdventure(row,contentId,challengeId);
 if(!adventure)throw Error('Adventure content needs attention. Please try again later.');
 return adventure;
}
