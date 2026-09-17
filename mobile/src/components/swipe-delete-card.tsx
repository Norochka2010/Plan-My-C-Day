import { type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

/** Native gesture tracking keeps fast flicks responsive while the list scrolls. */
export function SwipeDeleteCard({ children, disabled, onDelete }: { children: ReactNode; disabled: boolean; onDelete: () => void }) {
  return (
    <ReanimatedSwipeable
      enabled={!disabled}
      friction={1}
      rightThreshold={16}
      dragOffsetFromRightEdge={6}
      dragOffsetFromLeftEdge={6}
      overshootLeft={false}
      overshootRight={false}
      animationOptions={{ damping: 28, stiffness: 320, mass: 0.7, overshootClamping: true }}
      containerStyle={styles.container}
      renderRightActions={() => (
        <RectButton enabled={!disabled} onPress={onDelete} style={styles.deleteButton}>
          <Text accessible accessibilityRole="button" accessibilityLabel="Delete this C-Day"
            accessibilityState={{ disabled }} style={styles.label}>Delete</Text>
        </RectButton>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
const styles = StyleSheet.create({
  container: { borderRadius: 20, overflow: 'hidden' },
  deleteButton: { width: 96, backgroundColor: '#A62F40', justifyContent: 'center', alignItems: 'center' },
  label: { color: 'white', fontSize: 17, fontWeight: '700' },
});
