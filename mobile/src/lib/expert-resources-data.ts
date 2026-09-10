import { supabase } from './supabase';
import { parseExpertResource, type ExpertResource } from './expert-resource-model';
/** Uses the existing table/client/RLS. Community and non-resource records never enter this collection. */
export async function getExpertResources(): Promise<ExpertResource[]> {
  const resources: ExpertResource[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('explore_content').select('*')
      .eq('content_type', 'EXPERT_RESOURCE').eq('source_type', 'EXPERT')
      .eq('active', true).eq('review_status', 'APPROVED')
      .order('title').order('content_id').range(offset, offset + 99);
    if (error) throw error;
    if (!data) throw Error('Resources could not load');
    for (const row of data) { const resource = parseExpertResource(row); if (resource) resources.push(resource); }
    if (data.length < 100) return resources;
  }
}
