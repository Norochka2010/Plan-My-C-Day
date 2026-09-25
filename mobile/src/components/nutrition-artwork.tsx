import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
/** Temporary generated illustrations; replace with Nora's artwork without changing content IDs. */
export const nutritionArtwork: Record<string, { label: string; source?: ImageSourcePropType }> = {
  VIS_NUT_001: { label: 'Naturally GF Food Board', source: require('../../assets/images/nutrition/naturally-gf-v3.png') },
  VIS_NUT_002: { label: 'GF Grain Lineup', source: require('../../assets/images/nutrition/gf-grains-v3.png') },
  VIS_NUT_003: { label: 'Check the Details', source: require('../../assets/images/nutrition/check-details-v3.png') },
  VIS_NUT_004: { label: 'Contains Gluten', source: require('../../assets/images/nutrition/contains-gluten-v3.png') },
  VIS_NUT_005: { label: 'Balanced GF Meal', source: require('../../assets/images/nutrition/balanced-meal-v3.png') },
};
export function NutritionArtwork({ assetId }: { assetId: string | null }) {
  const asset = assetId ? nutritionArtwork[assetId] : null;
  if (!asset) return null;
  return asset.source ? <View style={s.artwork} accessible accessibilityLabel={asset.label}>
    <Image source={asset.source} resizeMode="contain" style={s.background} />
    <Image source={require('../../assets/images/leaf.png')} resizeMode="contain"
      style={[s.leaf, assetId === 'VIS_NUT_003' ? s.leafCheck : assetId === 'VIS_NUT_004' ? s.leafGluten : s.leafBottom]} />
  </View> :
    <View style={s.placeholder} accessible accessibilityLabel={`Illustration placeholder: ${asset.label}`}>
      <Text style={s.mark} accessibilityElementsHidden importantForAccessibility="no">◇</Text>
      <Text style={s.label}>{asset.label}</Text>
    </View>;
}
const s = StyleSheet.create({
  artwork: { aspectRatio: 1.5, width: '100%', borderRadius: 16, overflow: 'hidden' },
  background: { width: '100%', height: '100%' },
  // Reuse the original mascot verbatim rather than generating a different Leaf.
  leaf: { position: 'absolute', width: '24%', height: '36%' },
  leafBottom: { left: '2%', bottom: '2%' },
  leafCheck: { right: '13%', top: '12%' },
  leafGluten: { right: '16%', top: '4%' },
  placeholder: { minHeight: 76, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9CDBE', backgroundColor: '#FAF8F0', padding: 14, gap: 8, flexDirection: 'row', alignItems: 'center' },
  mark: { color: '#858877', fontSize: 30 }, label: { flex: 1, fontSize: 14, lineHeight: 21, color: '#666858' },
});
