import { supabase } from './supabase';
import type { BuilderAnswers, PlanTemplate } from './custom-model';
export async function saveBuilder(eventId:string,answers:BuilderAnswers){
 const {data,error}=await supabase.rpc('save_c_day_builder',{p_event_id:eventId,p_answers:answers}).single();
 if(error)throw error;return data;
}
export async function getTemplates(userId:string):Promise<PlanTemplate[]>{
 const {data,error}=await supabase.from('c_day_plan_templates').select('id,title,context_tags,source_event_id').eq('user_id',userId).eq('active',true).order('updated_at',{ascending:false});
 if(error)throw error;return data??[];
}
export async function saveTemplate(eventId:string,title:string){
 const {data,error}=await supabase.rpc('save_c_day_template',{p_event_id:eventId,p_title:title});if(error)throw error;return data;
}
export async function useTemplate(eventId:string,templateId:string){
 const {data,error}=await supabase.rpc('use_c_day_template',{p_event_id:eventId,p_template_id:templateId});if(error)throw error;return data as {added:number;unavailable:number};
}
