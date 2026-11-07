import { expertReviewBeta, hasCitedSource } from './explore-review';
import { supabase } from './supabase';
import { adventureIsPublished, parseRLCAdventure, type RLCAdventure } from './rlc-adventure-model';
export async function getRLCAdventure(contentId:string,challengeId:string,publishedOnly=false):Promise<RLCAdventure|null>{
 const reviewed = (require('../content/reviewed-adventures.json') as {content_id:string}[]).find(row => row.content_id === contentId);
 if (reviewed && adventureIsPublished(reviewed)) {
  const adventure = parseRLCAdventure(reviewed, contentId, challengeId);
  if (!adventure) throw Error('Journey content needs attention.');
  return adventure;
 }
 if (expertReviewBeta || __DEV__) {
  const rows = require('../dev/rlc-adventure-review-preview.json') as {content_id:string;review_status:string;expert_review_required:boolean;medical_review_required:boolean;original_review_metadata?:{source_basis?:string;source_url?:string}}[];
  const row = rows.find(row => row.content_id === contentId && row.review_status !== 'hidden');
  if (!row) return null;
  const adventure = parseRLCAdventure({...row, development_preview: !hasCitedSource({source_organization:row.original_review_metadata?.source_basis,source_url:row.original_review_metadata?.source_url})}, contentId, challengeId);
  if (!adventure) throw Error('Journey content needs attention.');
  return adventure;
 }
 const {data,error}=await supabase.from('rlc_adventures').select('*').eq('content_id',contentId).eq('active',true).eq('branching_enabled',true).eq('review_status','approved').maybeSingle();
 // Installing the optional layer must not break the existing canonical RLC library.
 if(error&&!['42P01','PGRST205'].includes(error.code))throw error;
 let row:unknown=data&&adventureIsPublished(data)?data:null;
 if(!row&&__DEV__&&!publishedOnly){
  const previews=require('../dev/rlc-adventure-review-preview.json') as {content_id:string;review_status:string;expert_review_required:boolean;medical_review_required:boolean;original_review_metadata?:{source_basis?:string;source_url?:string}}[];
  const preview=previews.find(r=>r.content_id===contentId&&r.review_status==='needs_review');
  if(preview)row={...preview,development_preview:preview.expert_review_required || preview.medical_review_required};
 }
 if(!row)return null;
 const adventure=parseRLCAdventure(row,contentId,challengeId);
 if(!adventure)throw Error('Journey content needs attention. Please try again later.');
 return adventure;
}
