-- One test lesson only; preserves the existing Explore schema and records.
insert into public.explore_content (
 content_id, content_type, title, subtitle, domain, topic, interaction_type,
 estimated_minutes, intro, content_body, teaching_point, next_step,
 xp_value, source_type, source_organization, source_title, source_url,
 review_status, active
) values (
 '87aca241-c8d5-4c45-b7d6-b786b08f7d01', 'QUICK_LEARN', 'Cross-Contact 101',
 'Small steps to keep gluten from sneaking in.', 'KNOW', 'Cross-contact', 'KNOWLEDGE',
 2, 'Gluten-free ingredients are a starting point. How food is prepared matters too.',
 '[{"type":"heading","text":"What is cross-contact?"},{"type":"paragraph","text":"Cross-contact happens when gluten gets into gluten-free food through contact with gluten-containing food, utensils, or surfaces."},{"type":"heading","text":"Notice the shared items"},{"type":"paragraph","text":"A knife used on regular bread can leave crumbs in a shared spread. Clean utensils and a separate spread can help prevent that transfer."},{"type":"heading","text":"Ask about preparation"},{"type":"paragraph","text":"Try asking: Can you use clean utensils and a clean preparation surface for my gluten-free food? If the answer is unclear, you can pause and ask for more information. You do not have to eat something you are uncomfortable with."}]'::jsonb,
 'Check both the ingredients and how food is handled.',
 'Think of one shared item in your kitchen. With a trusted adult, decide on one way to keep gluten from transferring to your food.',
 0, 'EDITORIAL', 'Beyond Celiac', 'Cross-Contact',
 'https://www.beyondceliac.org/gluten-free-diet/cross-contact/', 'APPROVED', true
) on conflict (content_id) do nothing;
