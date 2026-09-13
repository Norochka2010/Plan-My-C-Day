import { createOFFClient } from './product-lookup';
// OFF asks development tests to use staging. Change deliberately for release after provider review.
export const offTesting = process.env.EXPO_PUBLIC_OFF_ENVIRONMENT !== 'production';
export const offBaseUrl = offTesting ? 'https://world.openfoodfacts.net' : 'https://world.openfoodfacts.org';
const contact = process.env.EXPO_PUBLIC_OFF_CONTACT_EMAIL;
export const lookupProduct = contact
 ? createOFFClient({baseUrl:offBaseUrl,userAgent:`PlanMyCDay/1.0 (${contact})`,testing:offTesting})
 : async () => { throw new Error('Product lookup is not configured yet. Please try again later.'); };

export const productImageHeaders = (url:string):Record<string,string> => ({
 ...(contact?{'User-Agent':`PlanMyCDay/1.0 (${contact})`}:{}),
 ...(offTesting&&new URL(url).hostname==='images.openfoodfacts.net'?{Authorization:'Basic b2ZmOm9mZg=='}:{})
});
