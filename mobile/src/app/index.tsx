import { TabTitle } from '@/constants/theme';
import { HomeInspiration } from '@/components/home-inspiration';
import { HomeNextChallenge } from '@/components/home-next-challenge';
import { HomeUpcomingCDays } from '@/components/home-upcoming-c-days';
import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LeafCharacter } from '@/components/leaf-character';
import { Fonts } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={TabTitle}>Plan My C-Day</Text>
          <Text style={styles.subtitle}>Plan. Practice. Live it. Reflect. Grow.</Text>
        </View>
          <View style={styles.welcome}>
            <View style={styles.leafSpace}>
              <LeafCharacter size={180} />
            </View>
            <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeTitle}>Your day, a little more confident.</Text>
            <Text style={styles.subtitle}>A space to prepare, connect, and grow at your own pace.</Text>
            </View>
          </View>
      </View>
      <View style={styles.dayCards}>
          <HomeUpcomingCDays />
          <HomeInspiration />
          <HomeNextChallenge />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFCF7' },
  page: { paddingBottom: 24 },
  dayCards: { paddingHorizontal: 24, paddingTop: 8, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { paddingHorizontal: 24, paddingVertical: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: '#241638', fontFamily: Fonts.rounded, fontSize: 34, lineHeight: 42, fontWeight: '600' },
  subtitle: { color: '#62556E', fontSize: 16, lineHeight: 25 },
  heading: { gap: 10, flexShrink: 0 },
  leafSpace: { alignItems: 'center', justifyContent: 'center' },
  welcomeCopy: { gap: 10, flexShrink: 0 },
  welcome: { padding: 16, borderWidth: 1, borderColor: '#D9C4E5', backgroundColor: '#F4EBF7', borderRadius: 24, gap: 10 },
  welcomeTitle: { fontFamily: Fonts.rounded, color: '#302040', fontSize: 24, lineHeight: 32, fontWeight: '600' },
});
