import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { LeafCharacter } from './leaf-character';
import { Fonts } from '@/constants/theme';

const sections: Record<string, { subtitle: string; color: string; border: string; heading: string; note: string }> = {
  'Plan My C-Day App': { subtitle: 'Plan it. Practice it. Live it. Reflect. Grow.', color: '#F4EBF7', border: '#D9C4E5', heading: 'Your day, a little more confident.', note: 'A space to prepare, connect, and grow at your own pace.' },
  'Plan my C-day': { subtitle: 'Plan. Prepare. Practice. Reflect.', color: '#EDF5E7', border: '#C5DDB5', heading: 'Make room for your next C-day.', note: 'Your plans will have a home here.' },
  Community: { subtitle: 'Connect. Share. You’re not alone.', color: '#EFEDF9', border: '#CEC8E8', heading: 'A place to feel understood.', note: 'Your community space is coming soon.' },
  Explore: { subtitle: 'Build skills. Learn. Take on challenges.', color: '#FFF3DC', border: '#EBD4A5', heading: 'Grow a little every day.', note: 'Future lessons and activities will live here.' },
};

export function SectionScreen({ title }: { title: string }) {
  const section = sections[title] ?? sections['Plan My C-Day App'];
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>MY C-DAY</ThemedText>
          <ThemedText type="title" style={styles.title}>{title}</ThemedText>
          <ThemedText themeColor="textSecondary">{section.subtitle}</ThemedText>
          <View style={[styles.card, { backgroundColor: section.color, borderColor: section.border }]}>
            <LeafCharacter size={title === 'Plan My C-Day App' ? 220 : 150} />
            <ThemedText style={styles.cardTitle}>{section.heading}</ThemedText>
            <ThemedText style={styles.cardNote}>{section.note}</ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 36, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  eyebrow: { letterSpacing: 2, fontWeight: '700' },
  title: { fontFamily: Fonts.rounded, fontSize: 34, lineHeight: 42 },
  card: { marginTop: 20, padding: 24, borderWidth: 1, borderRadius: 24, gap: 14 },
  cardTitle: { fontFamily: Fonts.rounded, color: '#302040', fontSize: 24, lineHeight: 32, fontWeight: '600' },
  cardNote: { color: '#62556E', lineHeight: 25 },
});
