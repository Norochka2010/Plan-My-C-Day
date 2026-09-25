import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const rules = [
  ['Be kind. Everyone belongs.', 'Share with respect. No bullying, hate, shaming, or judging someone’s food choices, body, or experience.'],
  ['Keep personal details private.', 'Use your community username. Leave real names, phone numbers, emails, school names, locations, and social handles out of recipes. Don’t share someone else’s details or invite people to contact you elsewhere.'],
  ['Share recipes with care.', 'Include clear ingredients, amounts, and steps. Mention anything people should double-check. Don’t promise a recipe is safe for everyone or make claims about curing or treating a condition.'],
  ['Keep it appropriate and on topic.', 'Share recipe ideas and useful cooking tips. No harmful or explicit content, spam, ads, promotions, or off-platform invitations. Share your own wording and respect other people’s work.'],
  ['Let moderators take a look.', 'Submitted recipes are checked for content before they appear in Discover. Content that breaks these rules may stay unpublished, be hidden, or be removed. Approval is not medical advice or a guarantee of food safety.'],
  ['See something concerning? Report it.', 'Open the recipe and tap Report, choose a reason, then send it for review. Reporting also hides that recipe for you. Your identity is not shared with the author.'],
];

export function CommunityRules({ welcome = false }: { welcome?: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={welcome ? s.welcome : s.reminder}>
    {welcome ? <><Text accessibilityRole="header" style={s.heading}>Recipes worth sharing.</Text>
      <Text style={s.body}>Share ideas, stay kind. Recipes are reviewed before appearing here.</Text>
</>
      : <Text style={s.body}>Before you share: be kind, keep personal details private, and share recipes with care.</Text>}
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={s.button}><Text style={s.link}>Read our community rules →</Text></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
      <SafeAreaProvider><SafeAreaView style={s.screen}>
        <View style={s.header}><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={s.button}><Text style={s.link}>‹ Back</Text></Pressable></View>
        <ScrollView contentContainerStyle={s.content}>
          <Text accessibilityRole="header" style={s.title}>Our community rules</Text>
          <Text style={s.body}>You belong here. Help us keep Plan My C‑Day welcoming, thoughtful, and respectful.</Text>
          <Text style={s.small}>Community currently offers recipe sharing. Forums and comments aren’t available yet.</Text>
          {rules.map(([title, body], index) => <View key={title} style={s.card}><Text accessibilityRole="header" style={s.heading}>{index + 1}. {title}</Text><Text style={s.body}>{body}</Text></View>)}
          <Text style={s.small}>Check ingredient labels and preparation for cross-contact, even when a recipe has been approved or liked.</Text>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={s.done}><Text style={s.doneText}>Got it</Text></Pressable>
        </ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  welcome: { backgroundColor: '#F0EDF5', borderRadius: 20, padding: 16, gap: 10 },
  reminder: { backgroundColor: '#EDF3E6', borderRadius: 16, padding: 14, gap: 8 },
  screen: { flex: 1, backgroundColor: '#FFFCF7' },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: '#302040' },
  heading: { fontSize: 18, lineHeight: 25, fontWeight: '600', color: '#302040' },
  body: { fontSize: 16, lineHeight: 24, color: '#62556E' },
  small: { fontSize: 14, lineHeight: 21, color: '#716579' },
  card: { padding: 16, gap: 8, backgroundColor: '#F0EDF5', borderRadius: 18 },
  button: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  link: { color: '#426B43', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  done: { minHeight: 48, padding: 14, backgroundColor: '#426B43', borderRadius: 14 },
  doneText: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
});
