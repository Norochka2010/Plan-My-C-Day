import { useMemo, useState, type ReactNode } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';

/** The handle moves this panel; card scrolling and carousels keep their own gestures. */
export function HomeDayPanel({ collapsedTop, children }: { collapsedTop: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState(0);
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => setDrag(0),
    onPanResponderMove: (_, gesture) => setDrag(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dy) >= 16 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) setExpanded(gesture.dy < 0);
      else if (Math.abs(gesture.dy) < 8 && Math.abs(gesture.dx) < 8) setExpanded(value => !value);
      setDrag(0);
    },
    onPanResponderTerminate: () => setDrag(0),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const top = Math.max(0, Math.min(collapsedTop, (expanded ? 0 : collapsedTop) + drag));
  return (
    <View style={[styles.panel, { top }]}>
      <View {...gestures.panHandlers} style={styles.divider} accessible accessibilityRole="button"
        accessibilityLabel="Your day" accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Swipe down or double tap to reveal Leaf.' : 'Swipe up or double tap to expand your day.'}
        onAccessibilityTap={() => setExpanded(value => !value)}
        accessibilityActions={[{ name: 'expand', label: 'Expand your day' }, { name: 'collapse', label: 'Reveal Leaf' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'expand') setExpanded(true);
          if (event.nativeEvent.actionName === 'collapse') setExpanded(false);
        }}>
        <View style={styles.handle} />
        <Text style={styles.dividerTitle}>Your day</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.cards} showsVerticalScrollIndicator={false}
        nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFCF7', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  divider: { height: 64, backgroundColor: '#FFFCF7', borderTopWidth: 2, borderColor: '#D5C0E3', borderTopLeftRadius: 24, borderTopRightRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#B4A5BE' },
  dividerTitle: { color: '#6E6577', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  content: { flex: 1 },
  cards: { padding: 24, paddingTop: 12, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
