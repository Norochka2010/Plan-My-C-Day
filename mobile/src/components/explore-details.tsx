import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
export function ExploreDetails({ title = 'Sources & learning notes', children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={s.wrap}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)} style={s.button}>
    <Text style={s.label}>{title}</Text><Text accessible={false} style={s.label}>{open ? '−' : '+'}</Text>
  </Pressable>{open && <View style={s.details}>{children}</View>}</View>;
}
const s = StyleSheet.create({ wrap: { borderTopWidth: 1, borderColor: '#DDD3E3' }, button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, label: { fontSize: 15, lineHeight: 23, color: '#594366', fontWeight: '600' }, details: { gap: 12, paddingBottom: 12 } });
