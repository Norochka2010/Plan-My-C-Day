import { Image } from 'expo-image';

/** Shared original artwork; future outfits can be layered in this component. */
export function LeafCharacter({ size = 160 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/leaf.png')}
      contentFit="contain"
      accessibilityLabel="Leaf, your smiling green leaf companion"
      accessible
      style={{ width: size, height: size, maxWidth: '100%', alignSelf: 'center' }}
    />
  );
}
