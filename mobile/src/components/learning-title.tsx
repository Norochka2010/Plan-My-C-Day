import { Text } from 'react-native';
import { Fonts } from '@/constants/theme';

/** Preserve short phrases without truncating titles or limiting accessible text sizes. */
export function formatLearningTitle(title: string) {
  return title
    .replace(/\bC-Day\b/g, 'C‑Day')
    .replace(/\b(Naturally|Prepared) GF\b/gi, '$1\u00a0GF')
    .replace(/\s+(\S{1,3}[?!.]?)$/, '\u00a0$1');
}
export function LearningTitle({ title }: { title: string }) {
  return <Text accessibilityRole="header" textBreakStrategy="balanced" lineBreakStrategyIOS="standard"
    style={{ fontFamily: Fonts.rounded, fontSize: title.length > 26 ? 24 : 28, lineHeight: title.length > 26 ? 32 : 36, fontWeight: '700', color: '#241638', flexShrink: 1 }}>
    {formatLearningTitle(title)}
  </Text>;
}
