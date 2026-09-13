/** External information only. Never infer dietary suitability from words or tags. */
export type LookupState = 'PRODUCT / LABEL INFORMATION FOUND' | 'MORE INFORMATION NEEDED' | 'PRODUCT NOT FOUND' | 'SOURCE UNAVAILABLE';
export type ProductInformation = { code: string; name: string; brand: string; ingredients: string; labels: string; image: string | null; modifiedAt: string | null };
export type LookupResult = { state: LookupState; barcode: string; fetchedAt: string; product?: ProductInformation; reasons: string[]; conflicts: string[] };
export const OFF_FIELDS = 'code,product_name,brands,ingredients_text,labels,tags_sources,image_front_url,last_modified_t';
export const SOURCE_LINKS = { gfco: 'https://gfco.org/product-directory/', canada: 'https://www.celiac.ca/gf-product-finder/', license: 'https://world.openfoodfacts.org/terms-of-use' };
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
export function normalizeBarcode(input: string): string {
 const code = input.replace(/[\s-]/g, '');
 if (!/^\d{8}$|^\d{12,14}$/.test(code)) throw new Error('Enter the 8, 12, 13 or 14 digits printed below the barcode.');
 // Preserve leading zeros and let OFF apply its documented normalization.
 let sum=0; for(let i=code.length-2, n=0;i>=0;i--,n++)sum+=Number(code[i])*(n%2===0?3:1);
 if ((10-sum%10)%10!==Number(code.at(-1))) throw new Error('Please check the barcode digits and try again.');
 return code;
}
function equivalent(a: string, b: string) { return a.replace(/^0+(?=\d)/,'') === b.replace(/^0+(?=\d)/,''); }
export function unavailable(barcode: string, reason: string, now=Date.now()): LookupResult {
 return {state:'SOURCE UNAVAILABLE',barcode,fetchedAt:new Date(now).toISOString(),reasons:[reason],conflicts:[]};
}
/** Explicit source conflicts can be carried here by a future permitted connector. No word-based classifier. */
export function interpretOFF(payload: unknown, barcode: string, now=Date.now(), sourceConflicts: string[]=[]): LookupResult {
 const body=record(payload), raw=record(body.product), result=record(body.result);
 const base={barcode,fetchedAt:new Date(now).toISOString(),conflicts:[...sourceConflicts]};
 if (result.id==='product_not_found') return {...base,state:'PRODUCT NOT FOUND',reasons:['This barcode was not found in Open Food Facts. This does not tell you whether it contains gluten.']};
 if (!Object.keys(raw).length || body.status==='failure') return unavailable(barcode,'Open Food Facts did not return usable product information.',now);
 const code=text(raw.code), conflicts=[...sourceConflicts];
 if (!code || !equivalent(code,barcode)) {
  conflicts.push('The barcode returned by Open Food Facts does not match the requested barcode. Product details are withheld to avoid showing the wrong product.');
  return {...base,state:'MORE INFORMATION NEEDED',conflicts,reasons:['Check the current package barcode and the source.']};
 }
 const labels = text(raw.labels) || Object.entries(record(record(raw.tags_sources).labels)).flatMap(([source,value])=>{
  const tags=record(value).tags;
  return Array.isArray(tags) ? tags.filter((v):v is string=>typeof v==='string').map(v=>`${v} (OFF source: ${source})`) : [];
 }).join(', ');
 const stamp=Number(raw.last_modified_t), modifiedAt=Number.isFinite(stamp)&&stamp>0&&stamp*1000<=now ? new Date(stamp*1000).toISOString():null;
 let image: string|null=null; try {const u=new URL(text(raw.image_front_url));if(u.protocol==='https:'&&['images.openfoodfacts.org','images.openfoodfacts.net'].includes(u.hostname)) image=u.href;}catch{}
 const product={code,name:text(raw.product_name),brand:text(raw.brands),ingredients:text(raw.ingredients_text),labels,image,modifiedAt};
 const reasons:string[]=[];
 if(!product.name)reasons.push('A product name is missing from this source.');
 if(!product.ingredients)reasons.push('An ingredient list is missing from this source.');
 if(!modifiedAt)reasons.push('The source record’s update date is unavailable.');
 // A UI freshness reminder, not a shelf-life or safety threshold.
 else if(now-stamp*1000>365*86400000)reasons.push('This source record was last updated over a year ago. Compare it with the current package.');
 if(body.status==='success_with_errors'||body.status==='success_with_warnings')reasons.push('Open Food Facts returned a warning or incomplete response. Review its source page.');
 return {...base,product,conflicts,state:reasons.length||conflicts.length?'MORE INFORMATION NEEDED':'PRODUCT / LABEL INFORMATION FOUND',reasons};
}
export type ConnectorConfig={baseUrl:string;userAgent:string;testing:boolean};
/** One request at a time, a 6-second minimum gap, no persistent cache or scan history. */
export function createOFFClient(config:ConnectorConfig, request:typeof fetch=fetch, now=Date.now, timeoutMs=12000) {
 let nextAt=0, pending=false;
 return async function lookup(input:string, signal?:AbortSignal):Promise<LookupResult> {
  const barcode=normalizeBarcode(input), time=now();
  if(pending||time<nextAt)return unavailable(barcode,'Please wait a moment before another lookup.',time);
  pending=true;nextAt=time+6000;
  const controller=new AbortController(),cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel);if(signal?.aborted)controller.abort();
  const timer=setTimeout(cancel,timeoutMs);
  try {
   const headers:Record<string,string>={'User-Agent':config.userAgent,Accept:'application/json'};
   if(config.testing)headers.Authorization='Basic b2ZmOm9mZg=='; // Documented public OFF staging credentials, not a user secret.
   const response=await request(`${config.baseUrl}/api/v3.6/product/${barcode}.json?fields=${OFF_FIELDS}`,{method:'GET',headers,signal:controller.signal,credentials:'omit',redirect:'error'});
   if(response.status===429){const retry=response.headers.get('Retry-After');const seconds=Number(retry);const date=Date.parse(retry??'');nextAt=Math.max(nextAt,now()+60000,Number.isFinite(seconds)?now()+seconds*1000:0,Number.isFinite(date)?date:0);return unavailable(barcode,'Open Food Facts is receiving too many requests. Please try again later.',now());}
   if(response.status===404)return {state:'PRODUCT NOT FOUND',barcode,fetchedAt:new Date(now()).toISOString(),conflicts:[],reasons:['This barcode was not found in Open Food Facts. This does not tell you whether it contains gluten.']};
   if(!response.ok)return unavailable(barcode,'Open Food Facts could not be checked right now. Please try again later.',now());
   return interpretOFF(await response.json(),barcode,now());
  }catch{return unavailable(barcode,'Open Food Facts could not be reached. Check your connection or try again later.',now());}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);pending=false;}
 };
}
