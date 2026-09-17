import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'>) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.row}>
    <TextInput {...props} style={[styles.input, props.style]} secureTextEntry={!visible}
      autoCapitalize="none" autoCorrect={false} />
    <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${props.accessibilityLabel || 'password'}`}
      accessibilityState={{ disabled: props.editable === false }} disabled={props.editable === false}
      onPress={() => setVisible(value => !value)} style={styles.toggle}>
      <View accessible={false} style={styles.eye}><View style={styles.pupil}/></View>
      {!visible && <View accessible={false} style={styles.slash}/>}
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#B9CDAA', borderRadius: 14, backgroundColor: '#FFFFFF' },
  input: { flex: 1, minWidth: 0, minHeight: 52, padding: 14, fontSize: 16, color: '#291D3B' },
  toggle: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 24, height: 16, borderRadius: 12, borderWidth: 2, borderColor: '#3F6541', alignItems: 'center', justifyContent: 'center' },
  pupil: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3F6541' },
  slash: { position: 'absolute', width: 28, height: 2, backgroundColor: '#3F6541', transform: [{ rotate: '-45deg' }] },
});
