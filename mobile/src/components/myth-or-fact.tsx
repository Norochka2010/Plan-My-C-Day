import { LearningTitle } from './learning-title';
import { ExploreDetails } from './explore-details';
import { ExploreActionButton as Action } from '@/components/explore-action-button';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { getExploreContent, type ExploreSummary } from '@/lib/explore-content';
import { parseMythCard, responseHeading, type MythCard } from '@/lib/myth-or-fact-model';
import { completeMyth, readMythProgress, type Progress } from '@/lib/myth-progress';
export function MythOrFact({ contentId, catalog, onClose, onOpen, publishedOnly = false }: {
  publishedOnly?: boolean; contentId: string; catalog: ExploreSummary[]; onClose: () => void; onOpen: (item: ExploreSummary) => void;
}) {
  const [card, setCard] = useState<MythCard | null>(null);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0), [revealed, setRevealed] = useState(false);
  const [guess, setGuess] = useState<'FACT' | 'MYTH' | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false); setCard(null); setRevealed(false); setGuess(null); setReady(false); setMessage('');
    getExploreContent(contentId, { publishedOnly }).then(row => { if (active) setCard(parseMythCard(row)); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    readMythProgress().then(value => { if (active) { setProgress(value); setReady(true); } }).catch(() => { if (active) setMessage('Progress could not load. Try again before completing.'); });
    return () => { active = false; };
  }, [contentId, retry, publishedOnly]);
  async function complete(): Promise<boolean> {
    if (progress[contentId]) return true;
    if (!card || !revealed || !ready || locked.current) return false;
    locked.current = true; setBusy(true); setMessage('');
    try { const value = await completeMyth(contentId, card.xp_value); setProgress(value); setMessage(value[contentId].xp > 0 ? `Completed · ${value[contentId].xp} XP saved.` : 'Completed and saved.'); return true; }
    catch { setMessage('Completion did not save. Please try again.'); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  const choices = card?.answer_type === 'FACT' || card?.answer_type === 'MYTH';
  const items = catalog.filter(item => item.content_type === 'MYTH_OR_FACT');
  const index = items.findIndex(item => item.content_id === contentId);
  const next = index < 0 ? undefined : items[index + 1];
  const related = catalog.find(item => item.content_id === card?.related_content_id);
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Action variant="back" label="‹ Back" onPress={onClose} disabled={busy} />
    <Text style={s.small}>MYTH OR FACT</Text>
    {loading ? <Text style={s.body}>Loading activity…</Text> : failed ? <><Text style={s.body}>This activity couldn’t load.</Text><Action label="Try again" onPress={() => setRetry(v => v + 1)} /></> : !card ? <Text style={s.body}>This activity isn’t ready yet. Please choose another one.</Text> : <>
      {!!card.topic && <Text style={s.small}>{card.topic}</Text>}
      {__DEV__ && card.development_preview && <Text style={s.small}>Development preview · Expert review required</Text>}
      <View style={s.card}><LearningTitle title={card.statement}/></View>
      {!revealed ? choices ? <><Text style={s.body}>What do you think?</Text>{(['FACT', 'MYTH'] as const).map(value => <Action variant="choice" key={value} label={value === 'FACT' ? 'Fact' : 'Myth'} onPress={() => { setGuess(value); setRevealed(true); }} />)}</> : <><Text style={s.body}>Take a moment to reflect. This one has room for context, not a right-or-wrong score.</Text><Action label="Reveal" onPress={() => setRevealed(true)} /></> : <>
        <View style={[s.card, s.green]} accessibilityLiveRegion="polite"><Text style={s.heading}>{responseHeading(card.answer_type, guess)}</Text><Text style={s.body}>{card.explanation}</Text></View>
        <ExploreDetails title="Takeaway & source">
        {!!card.takeaway && <View style={[s.card, s.green]}><Text style={s.heading}>Takeaway</Text><Text style={s.body}>{card.takeaway}</Text></View>}
        {!!card.source && <Text style={s.body}>Source: {card.source}</Text>}
        {!!card.source_url && /^https?:\/\//i.test(card.source_url) && <Action variant="navigation" label="Read the source ↗" onPress={() => { Linking.openURL(card.source_url!).catch(() => setMessage('The source could not open. Please try again.')); }} />}
        {related ? <Action variant="navigation" label={`Related: ${related.title}`} onPress={() => onOpen(related)} disabled={busy} /> : card.related_content_id ? <Text style={s.small}>Related activity isn’t available yet.</Text> : null}
        <Text style={s.small}>XP is for taking part, whichever answer you chose. Each activity earns its available XP once.</Text>
        </ExploreDetails>
        <Action label={progress[contentId] ? progress[contentId].xp > 0 ? `Completed ✓ · ${progress[contentId].xp} XP` : 'Completed ✓' : busy ? 'Saving…' : 'Mark complete'} onPress={complete} disabled={busy || !ready || !!progress[contentId]} />
      </>}

      {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
      {!ready && <Action label="Retry progress" onPress={() => setRetry(v => v + 1)} />}
      <Action variant="navigation" label={!revealed ? (next ? 'Skip' : 'Back to collection') : progress[contentId] ? (next ? 'Next question' : 'Done') : (next ? 'Save & next question' : 'Save & finish')} onPress={async () => { if (revealed && !await complete()) return; next ? onOpen(next) : onClose(); }} disabled={busy || (revealed && !ready)} />
    </>}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFCF7' },
  content: { padding: 24, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center', gap: 18 },
  title: { color: '#241638', fontFamily: Fonts.rounded, fontSize: 25, lineHeight: 34, fontWeight: '600' },
  heading: { color: '#302040', fontFamily: Fonts.rounded, fontSize: 20, lineHeight: 29, fontWeight: '600' },
  body: { color: '#62556E', fontSize: 16, lineHeight: 26 },
  small: { color: '#716579', fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: '#F4EBF7', borderColor: '#D9C4E5', borderWidth: 1, borderRadius: 22, padding: 20, gap: 12 },
  green: { backgroundColor: '#EDF5E7', borderColor: '#C5DDB5' },
  button: { backgroundColor: '#EEE4F4', borderRadius: 14, minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#432B58', fontSize: 16, fontWeight: '600' },
});
