import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function PlannedActionCarousel({ items, index, onIndexChange }: {
  items: { id: string; title: string; time: string }[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const page = Math.max(0, Math.min(index, items.length - 1));
  useEffect(() => {
    if (width > 0) scroll.current?.scrollTo({ x: page * width, animated: true });
  }, [page, width]);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <ScrollView ref={scroll} horizontal pagingEnabled directionalLockEnabled
      showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
      onMomentumScrollEnd={event => onIndexChange(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}>
      {items.map((item, i) => <View key={item.id} style={[s.card, { width }]}>
        <View style={s.header}>
          <Text style={s.count}>Action {i + 1} of {items.length}</Text>
          {items.length > 1 && <View style={s.arrows}>
            {([-1, 1] as const).map(direction => {
              const disabled = direction === -1 ? i === 0 : i === items.length - 1;
              return <Pressable key={direction} accessibilityRole="button"
                accessibilityLabel={direction === -1 ? 'Previous planned action' : 'Next planned action'}
                accessibilityState={{ disabled }} disabled={disabled}
                onPress={() => onIndexChange(i + direction)}
                style={({ pressed }) => [s.button, { opacity: disabled ? 0.35 : pressed ? 0.65 : 1 }]}>
                <Text style={s.arrow}>{direction === -1 ? '‹' : '›'}</Text>
              </Pressable>;
            })}
          </View>}
        </View>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.time}>{item.time}</Text>
      </View>)}
    </ScrollView>}
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 20, borderRadius: 22, borderWidth: 1, borderColor: '#C5DDB5', backgroundColor: '#E6EFDD', gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { flex: 1, color: '#62556E', fontSize: 14 },
  arrows: { flexDirection: 'row', gap: 4 },
  button: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DCEACF', alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 28, color: '#405D35' },
  title: { color: '#302040', fontSize: 20, lineHeight: 28, fontWeight: '600' },
  time: { color: '#62556E', fontSize: 16, lineHeight: 25 },
});
