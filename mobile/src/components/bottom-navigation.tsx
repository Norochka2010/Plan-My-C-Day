import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const items = [
  { name: 'home', href: '/', label: 'Home', ios: 'house', selected: 'house.fill', icon: 'home' },
  { name: 'plan', href: '/plan', label: 'Plan', ios: 'calendar', selected: 'calendar', icon: 'calendar_month' },
  { name: 'community', href: '/community', label: 'Community', ios: 'bubble', selected: 'bubble.fill', icon: 'chat_bubble' },
  { name: 'explore', href: '/explore', label: 'Explore', ios: 'star', selected: 'star.fill', icon: 'star' },
  { name: 'me', href: '/me', label: 'Me', ios: 'person', selected: 'person.fill', icon: 'person' },
] as const;

function NavigationButton({ isFocused, label, icon, ...props }: TabTriggerSlotProps & { label: string; icon: SymbolViewProps['name'] }) {
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={({ pressed }) => [styles.button, isFocused && styles.selected, { opacity: pressed ? 0.55 : 1 }]}>
      <SymbolView name={icon} size={23} tintColor="#302040" />
      <Text style={[styles.label, isFocused && { fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export default function BottomNavigation() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.container} />
      <TabList style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), paddingLeft: Math.max(insets.left, 4), paddingRight: Math.max(insets.right, 4) }]}>
        {items.map(item => (
          <TabTrigger key={item.name} name={item.name} href={item.href as Href} asChild>
            <IconTab item={item} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function IconTab({ item, isFocused, ...props }: TabTriggerSlotProps & { item: typeof items[number] }) {
  return <NavigationButton {...props} isFocused={isFocused} label={item.label}
    icon={{ ios: isFocused ? item.selected : item.ios, android: item.icon, web: item.icon }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bar: { flexDirection: 'row', backgroundColor: '#FFFCFA', borderWidth: 1, borderColor: '#CBB7DD', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingTop: 4 },
  selected: { backgroundColor: '#EEE9E2', borderRadius: 16 },
  label: { color: '#302040', fontSize: 11, lineHeight: 15, textAlign: 'center' },
  button: { flex: 1, gap: 3, paddingVertical: 6, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
});
