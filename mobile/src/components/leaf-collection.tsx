import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants/theme';
export const leafRewards = [
  { id: 'star', name: 'Star dimple', symbol: '⭐', xp: 25 },
  { id: 'flower', name: 'Flower', symbol: '🌼', xp: 75 },
  { id: 'bow', name: 'Bow tie', symbol: '🎀', xp: 150 },
];
export function LeafAccessory({ id, size = 30 }: { id: string | null; size?: number }) {
  const reward = leafRewards.find(r => r.id === id);
  return reward ? <Text accessible={false} style={[{ position: 'absolute', bottom: '23%', right: '23%', fontSize: size, lineHeight: size * 1.3 }, id === 'star' && { right: '29%', bottom: '36%', fontSize: size * 0.4, lineHeight: size * 0.55, color: '#D9A323' }, id === 'flower' && { bottom: undefined, top: '8%', right: '10%', fontSize: size * 0.65, lineHeight: size * 1.3 * 0.65 }, id === 'bow' && { fontSize: size * 0.5525, lineHeight: size * 0.7225, right: undefined, bottom: '18%', left: '50%', width: size * 1.5, textAlign: 'center', transform: [{ translateX: -size * 0.75 }] }]}>{id === 'star' ? '✦' : reward.symbol}</Text> : null;
}
export function LeafCollection({ userId, xp, onEquip }: { userId: string; xp: number | null; onEquip: (id: string | null) => void }) {
  const [earned, setEarned] = useState(0), [equipped, setEquipped] = useState<string | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const key = `leaf-collection:v1:${userId}`;
  useEffect(() => {
    let active = true;
    setReady(false);
    AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      const saved = raw ? JSON.parse(raw) : {};
      const points = Number.isFinite(saved.earned) ? Math.max(0, saved.earned) : 0;
      const item = leafRewards.find(r => r.id === saved.equipped && points >= r.xp)?.id ?? null;
      setEarned(points); setEquipped(item); onEquip(item); setReady(true);
    }).catch(() => { if (active) setError('Your collection could not load. Reopen Me to try again.'); });
    return () => { active = false; };
  }, [key, onEquip]);
  const total = Math.max(earned, xp ?? 0);
  // Preserve earned unlocks even if a completed plan is later deleted.
  useEffect(() => {
    if (!ready || xp === null || total <= earned || busy) return;
    let active = true;
    AsyncStorage.setItem(key, JSON.stringify({ earned: total, equipped })).then(() => { if (active) setEarned(total); })
      .catch(() => { if (active) setError('New unlocks could not save. Try again when you equip an accessory.'); });
    return () => { active = false; };
  }, [ready, xp, total, earned, equipped, key, busy]);
  async function equip(id: string | null) {
    if (!ready || busy || (id && !leafRewards.some(r => r.id === id && total >= r.xp))) return;
    setBusy(true); setError('');
    try { await AsyncStorage.setItem(key, JSON.stringify({ earned: total, equipped: id })); setEarned(total); setEquipped(id); onEquip(id); }
    catch { setError('Your accessory could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  const next = leafRewards.find(r => r.xp > total);
  return <View style={s.card}>
    <View style={s.header}>
      <View style={{ width: 72, height: 72 }} accessible accessibilityLabel={`Leaf wearing ${leafRewards.find(r => r.id === equipped)?.name ?? 'no accessory'}`}>
        <Image source={require('@/assets/images/leaf.png')} contentFit="contain" style={{width:72,height:72}} />
        <LeafAccessory id={equipped} size={18} />
      </View>
      <View style={{flex:1,gap:3}}>
        <Text accessibilityRole="header" style={s.title}>Leaf’s collection</Text>
        <Text style={s.small}>{!ready ? 'Loading…' : xp === null ? 'Refresh progress for new rewards.' : `${total} XP · Points stay yours`}</Text>
        {ready && <Text style={s.small}>{next ? `${next.xp - total} XP to ${next.name.toLowerCase()}` : 'All three unlocked!'}</Text>}
      </View>
    </View>
    <View style={s.rewards}>
    {leafRewards.map(r => {
      const unlocked = ready && total >= r.xp;
      return <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ disabled: !unlocked || busy, selected: equipped === r.id }} disabled={!unlocked || busy} onPress={() => void equip(equipped === r.id ? null : r.id)} style={[s.item, equipped === r.id && {borderColor:'#426B43',backgroundColor:'#EAF3E3'}]}>
        <Text accessible={false} style={{fontSize:24,lineHeight:30}}>{r.symbol}</Text><Text style={s.name}>{r.name}</Text>
        <Text style={s.small}>{unlocked ? equipped === r.id ? 'Wearing ✓' : 'Tap to wear' : `${r.xp} XP`}</Text>
      </Pressable>;
    })}
    </View>
    {!!error && <Text accessibilityRole="alert" style={s.copy}>{error}</Text>}
    <Text style={s.small}>Tap a worn item to remove it. Saved on this device.</Text>
  </View>;
}
const s = StyleSheet.create({
  card: { padding:16,borderRadius:20,backgroundColor:'#EDF4E6',gap:8 },
  header:{flexDirection:'row',alignItems:'center',gap:10},
  rewards:{flexDirection:'row',flexWrap:'wrap',gap:6},
  title: {fontFamily:Fonts.rounded,fontSize:22,lineHeight:29,fontWeight:'700',color:'#302040'},
  copy: {fontSize:16,lineHeight:24,color:'#62556E'},small:{fontSize:14,lineHeight:21,color:'#62556E'},
  item:{flexGrow:1,flexBasis:'29%',minWidth:80,alignItems:'center',padding:8,gap:2,minHeight:48,borderRadius:16,borderWidth:2,borderColor:'#D9DFD3',backgroundColor:'#FFFCF7'},
  name:{textAlign:'center',fontSize:15,lineHeight:21,fontWeight:'600',color:'#302040'},
});
