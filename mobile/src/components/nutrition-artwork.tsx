import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
/** Nora's future original artwork replaces these slots without changing the content IDs. */
export const nutritionArtwork: Record<string, { label: string; source?: ImageSourcePropType }> = {
  VIS_NUT_001: { label: 'Naturally GF Food Board' },
  VIS_NUT_002: { label: 'GF Grain Lineup' },
  VIS_NUT_003: { label: 'Check the Details' },
  VIS_NUT_004: { label: 'Contains Gluten' },
  VIS_NUT_005: { label: 'Balanced GF Meal' },
};
export function NutritionArtwork({ assetId }: { assetId: string | null }) {
  const asset = assetId ? nutritionArtwork[assetId] : null;
  if (!asset) return null;
  return asset.source ? <Image source={asset.source} accessibilityLabel={asset.label} resizeMode="contain" style={s.image} /> :
    <View style={s.placeholder} accessible accessibilityLabel={`Illustration placeholder: ${asset.label}`}>
      <Text style={s.mark} accessibilityElementsHidden importantForAccessibility="no">◇</Text>
      <Text style={s.label}>{asset.label}</Text>
    </View>;
}
const s = StyleSheet.create({
  image: { height: 160, width: '100%' },
  placeholder: { minHeight: 76, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9CDBE', backgroundColor: '#FAF8F0', padding: 14, gap: 8, flexDirection: 'row', alignItems: 'center' },
  mark: { color: '#858877', fontSize: 30 }, label: { flex: 1, fontSize: 14, lineHeight: 21, color: '#666858' },
});
