import { Pressable, StyleSheet, Text } from 'react-native';

type Variant = 'primary' | 'choice' | 'navigation';
/** Color follows the control's purpose, independently of its content label. */
export function ExploreActionButton({ label, onPress, disabled = false, variant = 'primary' }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: Variant;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, surfaces[variant], disabled && styles.disabled,
      pressed && !disabled && styles.pressed]}>
    <Text style={[styles.label, { color: ink[variant] }, disabled && styles.disabledLabel]}>{label}</Text>
  </Pressable>;
}
const surfaces = StyleSheet.create({
  primary: { backgroundColor: '#426B43', borderColor: '#426B43' },
  choice: { backgroundColor: '#EEE4F4', borderColor: '#EEE4F4' },
  navigation: { backgroundColor: '#E5EDF8', borderColor: '#BCCDE4' },
});
const ink = { primary: '#FFFFFF', choice: '#432B58', navigation: '#354F70' };
const styles = StyleSheet.create({
  button: { borderWidth: 2, borderRadius: 14, minHeight: 48, padding: 14, justifyContent: 'center' },
  label: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  disabled: { backgroundColor: '#E6E3DE', borderColor: '#E6E3DE' },
  disabledLabel: { color: '#68645F' },
  pressed: { opacity: 0.8 },
});
