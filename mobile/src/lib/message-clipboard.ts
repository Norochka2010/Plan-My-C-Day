import { requireOptionalNativeModule } from 'expo';

// Older development clients may not contain the newly installed clipboard module.
// Never import expo-clipboard eagerly: its required native lookup crashes those clients.
const clipboard = requireOptionalNativeModule<{ setStringAsync(text: string, options: { inputFormat: 'plainText' }): Promise<boolean> }>('ExpoClipboard');
export const canCopyMessage = typeof clipboard?.setStringAsync === 'function';
export async function copyMessage(text: string): Promise<boolean> {
  if (!clipboard?.setStringAsync) return false;
  // The native method requires options; expo-clipboard's public wrapper supplies them.
  return clipboard.setStringAsync(text, { inputFormat: 'plainText' });
}
