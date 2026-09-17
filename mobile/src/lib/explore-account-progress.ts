import { supabase } from './supabase';
export type AccountProgress = { content_id:string;content_type:string;status:'started'|'tried'|'completed';saved:boolean;started_at:string;completed_at:string|null;reflection:string|null;xp_awarded:number;imported_from_device:boolean };
export async function exploreAccountId(){const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('Sign in to save Explore progress to your account.');return data.session.user.id;}
async function sameAccount(id:string){if(await exploreAccountId()!==id)throw Error('Account changed. Please reopen this screen.');}
export async function readAccountProgress(contentId?:string):Promise<AccountProgress[]>{
 const user=await exploreAccountId();const rows:AccountProgress[]=[];
 for(let offset=0;;offset+=200){let query=supabase.from('explore_user_progress').select('*').eq('user_id',user).order('content_id').range(offset,offset+199);if(contentId)query=query.eq('content_id',contentId);const {data,error}=await query;if(error)throw Error('Account progress could not load. Check your connection and try again.');rows.push(...data);if(data.length<200)break;}
 await sameAccount(user);return rows;
}
export async function writeAccountProgress(contentId:string,operation:string,reflection?:string,legacy?:unknown,expectedUser?:string):Promise<AccountProgress>{
 const user=expectedUser??await exploreAccountId();await sameAccount(user);
 const {data,error}=await supabase.rpc('save_explore_progress',{p_expected_user:user,p_content_id:contentId,p_operation:operation,p_reflection:reflection??null,p_legacy:legacy??null}).single();
 if(error)throw Error('Your progress could not be saved to your account. Check your connection and try again.');await sameAccount(user);return data as AccountProgress;
}
