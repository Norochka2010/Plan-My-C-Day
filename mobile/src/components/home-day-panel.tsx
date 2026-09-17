import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';

/** The handle moves this panel; card scrolling and carousels keep their own gestures. */
export function HomeDayPanel({ collapsedTop, children }: { collapsedTop: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const position = useRef(new Animated.Value(collapsedTop)).current;
  const currentTop = useRef(collapsedTop);
  const dragStart = useRef(collapsedTop);
  const expandedRef = useRef(false);
  const limit = useRef(collapsedTop);
  limit.current = collapsedTop;

  useEffect(() => {
    const listener = position.addListener(({ value }) => { currentTop.current = value; });
    return () => { position.removeListener(listener); position.stopAnimation(); };
  }, [position]);

  useEffect(() => {
    position.stopAnimation();
    position.setValue(expandedRef.current ? 0 : collapsedTop);
  }, [collapsedTop, position]);

  const settle = (next: boolean) => {
    expandedRef.current = next;
    setExpanded(next);
    Animated.timing(position, {
      toValue: next ? 0 : limit.current,
      duration: 650,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      position.stopAnimation();
      dragStart.current = currentTop.current;
    },
    onPanResponderMove: (_, gesture) => {
      position.setValue(Math.max(0, Math.min(limit.current, dragStart.current + gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dy) >= 16 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) settle(gesture.dy < 0);
      else if (Math.abs(gesture.dy) < 8 && Math.abs(gesture.dx) < 8) settle(!expandedRef.current);
      else settle(expandedRef.current);
    },
    onPanResponderTerminate: () => settle(expandedRef.current),
    onPanResponderTerminationRequest: () => false,
  }), [position]);
  return (
    <Animated.View style={[styles.panel, { top: position }]}>
      <View {...gestures.panHandlers} style={styles.divider} accessible accessibilityRole="button"
        accessibilityLabel="Your day" accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Swipe down or double tap to reveal Leaf.' : 'Swipe up or double tap to expand your day.'}
        onAccessibilityTap={() => settle(!expandedRef.current)}
        accessibilityActions={[{ name: 'expand', label: 'Expand your day' }, { name: 'collapse', label: 'Reveal Leaf' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'expand') settle(true);
          if (event.nativeEvent.actionName === 'collapse') settle(false);
        }}>
        <View style={styles.handle} />
        <Text style={styles.dividerTitle}>Your day</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.cards} showsVerticalScrollIndicator={false}
        nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFCF7', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  divider: { height: 64, backgroundColor: '#FFFCF7', borderTopWidth: 2, borderColor: '#D5C0E3', borderTopLeftRadius: 24, borderTopRightRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#B4A5BE' },
  dividerTitle: { color: '#6E6577', fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  content: { flex: 1 },
  cards: { padding: 24, paddingTop: 12, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
