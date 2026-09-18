import { ExploreActivityCatalog } from '@/components/explore-activity-catalog';
import { ExploreGrowthCard } from '@/components/explore-growth-card';
import { ExpertResources } from '@/components/expert-resources';
import { RealLifeChallenge } from '@/components/real-life-challenge';
import { PracticeScenario } from '@/components/practice-scenario';
import { MythOrFact } from '@/components/myth-or-fact';
import { QuickLearn } from '@/components/quick-learn';
import { useFocusEffect, useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { supportTypes } from '@/lib/c-day-explore-support';
import { getExploreCatalog, type ExploreSummary, type ContentType } from '@/lib/explore-content';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LeafCharacter } from '@/components/leaf-character';
import { Fonts } from '@/constants/theme';

const sections = [
  { type: 'QUICK_LEARN' as ContentType, title: 'Quick Learn', icon: '✦', description: 'Understand one useful idea.', color: '#EDF5E7', border: '#C5DDB5' },
  { type: 'MYTH_OR_FACT' as ContentType, title: 'Myth or Fact?', icon: '?', description: 'Pick an answer and discover why.', color: '#F4EBF7', border: '#D9C4E5' },
  { type: 'PRACTICE_A_SKILL' as ContentType, title: 'Practice a Skill', icon: '💬', description: 'Rehearse what you could say or do.', color: '#EFEDF9', border: '#CEC8E8' },
  { type: 'REAL_LIFE_CHALLENGE' as ContentType, title: 'Real-Life Challenges', icon: '☆', description: 'Try a small step at your own pace.', color: '#FFF3DC', border: '#EBD4A5' },
  { type: 'EXPERT_RESOURCE' as ContentType, title: 'Trusted Resources', icon: '◎', description: 'Read guidance from trusted sources.', color: '#EAF0FA', border: '#C8D7EB' },
] as const;

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ supportContentId?: string; supportEntry?: string; returnTo?: string; homeChallenge?: string }>();
  return <ExploreContents key={typeof params.supportEntry === 'string' ? params.supportEntry : 'browse'}
    supportId={typeof params.supportContentId === 'string' ? params.supportContentId : undefined}
    homeChallenge={params.homeChallenge === '1' && params.returnTo === 'home'}
    returnTo={params.returnTo === 'home' ? 'home' : 'plan'} />;
}
function ExploreContents({ supportId, returnTo, homeChallenge = false }: { supportId?: string; returnTo: 'home' | 'plan'; homeChallenge?: boolean }) {
  const router = useRouter();
  const navigation = useNavigation();
  const handledEntry = useRef(false);
  const [supportSession, setSupportSession] = useState(!!supportId);
  // Keep HOME challenge previews and their linked activities under one access policy.
  // Release builds and ordinary Plan support still require published content.
  const publishedOnly = supportSession && !(__DEV__ && homeChallenge);
  const [supportMessage, setSupportMessage] = useState('');
  function returnToCDay() {
    setSelected(null); setLessonId(null); setMythId(null); setPracticeId(null); setChallengeId(null); setExpertOpen(false); setExpertId(null);
    setSupportSession(false);
    // Switching back preserves the already-mounted Plan and its HOME return context.
    if (returnTo === 'home') router.push('/');
    else navigation.dispatch({ type: 'NAVIGATE', payload: { name: 'plan', merge: true } });
  }
  const [expertOpen, setExpertOpen] = useState(false);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(homeChallenge ? supportId ?? null : null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [mythId, setMythId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const catalogOffsets = useRef<Record<string, number>>({});
  const [catalog, setCatalog] = useState<ExploreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    getExploreCatalog({ publishedOnly }).then(items => {
      if (active) {
        setCatalog(items);
        if (!homeChallenge && supportSession && supportId && !handledEntry.current) {
          handledEntry.current = true;
          const item = items.find(item => item.content_id === supportId && !item.development_preview && ((supportTypes as readonly string[]).includes(item.content_type) || item.content_type === 'REAL_LIFE_CHALLENGE'));
          if (item) openContent(item);
          else setSupportMessage('This optional activity isn’t available right now. You can continue with your C-Day.');
        }
      }
    }).catch(() => {
      if (active) { setFailed(true); setCatalog([]); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, supportSession, supportId, homeChallenge, publishedOnly]));
  function openContent(item: ExploreSummary) {
    // Preserve the collection while opening related activities in the same modal.
    setLessonId(null); setMythId(null); setPracticeId(null); setChallengeId(null); setExpertOpen(false); setExpertId(null);
    if (item.content_type === 'QUICK_LEARN') setLessonId(item.content_id);
    else if (item.content_type === 'PRACTICE_A_SKILL') setPracticeId(item.content_id);
    else if (item.content_type === 'MYTH_OR_FACT') setMythId(item.content_id);
    else if (item.content_type === 'REAL_LIFE_CHALLENGE') setChallengeId(item.content_id);
    else if (item.content_type === 'EXPERT_RESOURCE') { setExpertId(item.content_id); setExpertOpen(true); }
    else setSelected(sections.find(section => section.type === item.content_type)?.title ?? null);
  }
  const selectedType = selected === 'Real-Life Challenges' ? 'REAL_LIFE_CHALLENGE' : selected === 'Quick Learn' ? 'QUICK_LEARN' : selected === 'Practice a Skill' ? 'PRACTICE_A_SKILL' : 'MYTH_OR_FACT';
  const scroll = useRef<ScrollView>(null);
  const growthTop = useRef(0);
  const scrollToGrowth = useRef(false);
  const recommended = catalog[0];
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} onContentSizeChange={() => {
        if (scrollToGrowth.current) {
          scrollToGrowth.current = false;
          scroll.current?.scrollTo({ y: growthTop.current, animated: true });
        }
      }}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={styles.title}>Explore</Text>
            <Text style={styles.subtitle}>Learn. Practice. Build confidence.</Text>
          </View>
          <LeafCharacter size={64} />
        </View>

        <View style={styles.cardList}>
          {sections.map(section => (
            <Pressable key={section.title} accessibilityRole="button" accessibilityLabel={section.title} accessibilityHint="Opens this Explore collection" onPress={() => { if (section.type === 'EXPERT_RESOURCE') { setExpertId(null); setExpertOpen(true); } else setSelected(section.title); }} style={({ pressed }) => [styles.card, { backgroundColor: section.color, borderColor: section.border }, pressed && styles.pressed]}>
              <View style={styles.iconBadge}><Text style={styles.icon}>{section.icon}</Text></View>
              <View style={styles.copy}><Text style={styles.cardTitle}>{section.title}</Text><Text style={styles.body}>{section.description}</Text><Text style={styles.small}>{loading ? 'Loading…' : failed ? 'Unavailable right now' : `${catalog.filter(item => item.content_type === section.type).length} available`}</Text></View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}
        </View>

        {supportSession && <View style={styles.recommendation}>
          <Text style={styles.heading}>Optional support for your C-Day</Text>
          <Text style={styles.body}>{supportMessage || 'Explore if you’d like. You can return to your C-Day at any time without completing an activity.'}</Text>
          <Pressable accessibilityRole="button" style={styles.closeButton} onPress={returnToCDay}>
            <Text style={styles.closeLabel}>{returnTo === 'home' ? 'Back to Home' : 'Back to My Plan'}</Text>
          </Pressable>
        </View>}
        <View style={styles.recommendation}>
          <Text accessibilityRole="header" style={styles.heading}>Recommended for You</Text>
          {loading ? <Text style={styles.body}>Finding something for you…</Text> : failed ? <>
            <Text style={styles.body}>We couldn’t load Explore right now.</Text>
            <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.recommendationButton}><Text style={styles.cardTitle}>Try again</Text></Pressable>
          </> : recommended ? <Pressable accessibilityRole="button" onPress={() => openContent(recommended)} style={styles.recommendationButton}>
            <View style={styles.copy}><Text style={styles.cardTitle}>{recommended.title}</Text><Text style={styles.small}>{recommended.domain} · From the available collection; not personalized yet.</Text></View>
            <Text style={styles.arrow}>›</Text>
          </Pressable> : <Text style={styles.body}>New things to explore are on their way.</Text>}
        </View>

        <View onLayout={event => { growthTop.current = event.nativeEvent.layout.y; }}>
        <ExploreGrowthCard onOpen={openContent} onExpand={() => { scrollToGrowth.current = true; }} catalog={catalog} catalogLoading={loading} catalogFailed={failed}
          refreshKey={[lessonId, mythId, practiceId, challengeId, selected].join('|')} />
        </View>

      </ScrollView>
      <Modal visible={selected !== null || expertOpen || !!challengeId || !!practiceId || !!mythId || !!lessonId}
        animationType="slide" onRequestClose={() => {
          if (expertOpen) { setExpertOpen(false); setExpertId(null); }
          else if (challengeId) { if (homeChallenge) returnToCDay(); else setChallengeId(null); }
          else if (practiceId) setPracticeId(null);
          else if (mythId) setMythId(null);
          else if (lessonId) setLessonId(null);
          else setSelected(null);
        }}>
        <SafeAreaProvider>
          {expertOpen ? <ExpertResources initialContentId={expertId} onClose={() => { setExpertOpen(false); setExpertId(null); }} />
          : challengeId ? <RealLifeChallenge backLabel={homeChallenge ? '‹ Back to Home' : selected ? '‹ Back to collection' : undefined} publishedOnly={publishedOnly} key={challengeId} contentId={challengeId} onClose={() => { if (homeChallenge) returnToCDay(); else setChallengeId(null); }} onOpen={openContent} />
          : practiceId ? <PracticeScenario publishedOnly={publishedOnly} key={practiceId} contentId={practiceId} catalog={catalog} onClose={() => setPracticeId(null)} onOpen={openContent} />
          : mythId ? <MythOrFact publishedOnly={publishedOnly} key={mythId} contentId={mythId} catalog={catalog} onClose={() => setMythId(null)} onOpen={openContent} />
          : lessonId ? <QuickLearn publishedOnly={publishedOnly} key={lessonId} contentId={lessonId} catalog={catalog} onClose={() => setLessonId(null)} onNext={setLessonId} onPractice={item => { if (item) openContent(item); else { setLessonId(null); setSelected('Practice a Skill'); } }} />
          : selected ? <SafeAreaView style={styles.screen}>
            <ExploreActivityCatalog key={selected} kind={selectedType} title={selected}
              initialOffset={catalogOffsets.current[selected] ?? 0} onOffsetChange={y => { catalogOffsets.current[selected] = y; }}
              items={catalog.filter(item => item.content_type === selectedType)} loading={loading} failed={failed}
              onRetry={() => setRetry(v => v + 1)} onOpen={openContent} onClose={() => setSelected(null)} />
          </SafeAreaView> : null}
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFCF7' },
  content: { padding: 24, paddingBottom: 32, gap: 18, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 7 },
  title: { color: '#241638', fontSize: 34, lineHeight: 42, fontWeight: '600', fontFamily: Fonts.rounded },
  subtitle: { color: '#62556E', fontSize: 16, lineHeight: 25 },
  heading: { color: '#302040', fontSize: 19, lineHeight: 27, fontWeight: '600', fontFamily: Fonts.rounded },
  body: { color: '#62556E', fontSize: 14, lineHeight: 22 },
  small: { color: '#716579', fontSize: 14, lineHeight: 21 },
  recommendation: { padding: 14, gap: 8, borderRadius: 22, backgroundColor: '#F4EBF7', borderWidth: 1, borderColor: '#D9C4E5' },
  recommendationButton: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: '#FFFCF7', minHeight: 48 },
  progress: { gap: 10 },
  domainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  domain: { minWidth: 80, flexGrow: 1, gap: 6, paddingVertical: 8 },
  domainLabel: { color: '#594366', fontSize: 14, letterSpacing: 0.6, fontWeight: '700' },
  track: { height: 5, backgroundColor: '#E7DFEB', borderRadius: 3 },
  status: { color: '#716579', fontSize: 14 },
  cardList: { gap: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 12, minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBadge: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 30, color: '#63497B' },
  cardTitle: { color: '#302040', fontFamily: Fonts.rounded, fontWeight: '600', fontSize: 18, lineHeight: 25 },
  arrow: { color: '#63497B', fontSize: 28 },
  pressed: { opacity: 0.65 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(36,22,56,0.35)' },
  dialog: { width: '100%', maxWidth: 420, padding: 24, borderRadius: 24, backgroundColor: '#FFFCF7', gap: 18 },
  closeButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#EEE4F4', padding: 14, alignItems: 'center' },
  closeLabel: { color: '#432B58', fontWeight: '600', fontSize: 16 },
});
