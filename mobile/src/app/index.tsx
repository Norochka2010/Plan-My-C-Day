import { HomeDayPanel } from '@/components/home-day-panel';
import { HomeInspiration } from '@/components/home-inspiration';
import { HomeNextChallenge } from '@/components/home-next-challenge';
import { useState } from 'react';
import { HomeUpcomingCDays } from '@/components/home-upcoming-c-days';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LeafCharacter } from '@/components/leaf-character';
import { Fonts } from '@/constants/theme';

export default function HomeScreen() {
  const [height, setHeight] = useState(0);
  const [leafSize, setLeafSize] = useState(0);
  const collapsedTop = Math.max(0, height - 160);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.viewport} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <View style={[styles.hero, { height: collapsedTop }]}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>MY C-DAY</Text>
          <Text style={styles.title}>Plan My C-Day</Text>
          <Text style={styles.subtitle}>Plan. Practice. Live it. Reflect. Grow.</Text>
        </View>
          <View style={styles.welcome}>
            <View style={styles.leafSpace} onLayout={event => {
              const { width, height } = event.nativeEvent.layout;
              setLeafSize(Math.max(0, Math.min(220, width, height)));
            }}>
              <LeafCharacter size={leafSize} />
            </View>
            <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeTitle}>Your day, a little more confident.</Text>
            <Text style={styles.subtitle}>A space to prepare, connect, and grow at your own pace.</Text>
            </View>
          </View>
      </View>
      <HomeDayPanel collapsedTop={collapsedTop}>
          <HomeUpcomingCDays />
          <HomeInspiration />
          <HomeNextChallenge />
      </HomeDayPanel>
      </View>
    </SafeAreaView>
  );
}

function DashboardCard({ heading, icon, title, description, color, border }: {
  heading: string; icon: string; title: string; description: string; color: string; border: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{heading}</Text>
      <View style={[styles.card, { borderColor: border }]}>
        <View style={[styles.iconBadge, { backgroundColor: color }]}><Text style={styles.icon}>{icon}</Text></View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFCF7' },
  viewport: { flex: 1, overflow: 'hidden' },
  hero: { paddingHorizontal: 24, paddingVertical: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#6E6577', fontSize: 14, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#241638', fontFamily: Fonts.rounded, fontSize: 34, lineHeight: 42, fontWeight: '600' },
  subtitle: { color: '#62556E', fontSize: 16, lineHeight: 25 },
  heading: { gap: 10, flexShrink: 0 },
  leafSpace: { flex: 1, flexBasis: 0, minHeight: 0, justifyContent: 'center' },
  welcomeCopy: { gap: 10, flexShrink: 0 },
  welcome: { flex: 1, minHeight: 0, padding: 16, borderWidth: 1, borderColor: '#D9C4E5', backgroundColor: '#F4EBF7', borderRadius: 24, gap: 10 },
  welcomeTitle: { fontFamily: Fonts.rounded, color: '#302040', fontSize: 24, lineHeight: 32, fontWeight: '600' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#35204E', textTransform: 'uppercase', letterSpacing: 0.7 },
  card: { borderWidth: 1.5, borderRadius: 18, backgroundColor: '#FFFDFA', padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 110 },
  iconBadge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 29, color: '#5D4277' },
  cardCopy: { flex: 1, gap: 6 },
  cardTitle: { color: '#241638', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  description: { color: '#6E6577', fontSize: 14, lineHeight: 21 },
});
