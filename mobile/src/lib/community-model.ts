import { supabase } from './supabase';
export const recipeCategories = ['Breakfast','Lunch','Dinner','Snack','Dessert','Drink','Sauce/Dip','Other'];
export const efforts = ['Quick & Easy','A Little Prep','Weekend Project'];
export const checks = ['Brand matters','Check the label','Cross-contact may matter','Use a GF-certified/labeled version','Nothing special','Not sure'];
export const uses = ['School lunch','After school','Family dinner','Party','Travel','Make ahead'];
export const reasons = ['Food-safety concern','Medical misinformation','Personal information','Bullying or harassment','Inappropriate content','Spam or advertising','Other'];
export const acknowledgements = [
 'I checked the ingredients I listed, but brands and ingredients can change.',
 'Other people should check labels, ingredients, preparation, and cross-contact for themselves before using this recipe.',
 'I understand this is a community recipe, not medical or nutrition advice.',
];
export const disclaimer = 'Shared by a community member. Not expert reviewed. Always check current ingredient labels, brands, preparation methods, and cross-contact considerations for yourself.';
export type Recipe = {
 id: string; title: string; category: string; effort_level: string;
 ingredients: {ingredient_text:string; amount_text:string}[]; steps:string[];
 double_check_tags:string[]; use_case_tags:string[]; friend_tip:string;
 status:'draft'|'pending_review'|'published'|'flagged'|'hidden'|'removed'; revision:number;
 is_author:boolean; saved:boolean; helpful:boolean; submitted_at?:string; published_at?:string;
 review_required?:boolean; prescreen_status?:string; prescreen_flags?:unknown[];
 acknowledgements?:boolean[]; acknowledgement_version?:string;
 reports?:{reason:string;note:string;status:string;created_at:string}[];
 audit?:{action:string;reason:string;note:string;created_at:string}[];
};
export type ListMode='browse'|'mine'|'saved'|'queue';
export async function communityRpc<T>(name:string,args:Record<string,unknown>={}):Promise<T> {
 const {data,error}=await supabase.rpc(name,args);
 if(error) throw Error(error.message.includes('schema cache')||error.code==='42883' ? 'Community setup is not available yet. Please run the Community SQL setup first.' : error.message);
 return data as T;
}
export function readCommunity<T>(mode:string,id?:string,offset=0) {return communityRpc<T>('community_read',{p_mode:mode,p_id:id??null,p_offset:offset});}
export function recipeIssue(r:Recipe,step?:number):string|null {
 if((step===undefined||step===0)&&(!r.title.trim()||!r.category||!r.effort_level))return 'Add a recipe name, category, and effort.';
 if((step===undefined||step===1)&&(!r.ingredients.length||r.ingredients.some(i=>!i.ingredient_text.trim()||!i.amount_text.trim())))return 'Add ingredients and an amount for each one.';
 if((step===undefined||step===2)&&(!r.steps.length||r.steps.some(x=>!x.trim())))return 'Add your preparation steps and fill in each step.';
 return null;
}
export const statusLabel=(status:Recipe['status'])=>({draft:'Draft',pending_review:'Pending review',published:'Published',flagged:'Under review',hidden:'Hidden',removed:'Removed'}[status]);
