import 'react-native-url-polyfill/auto';
import { sessionStorage } from './session-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Add your Supabase URL and publishable key to .env.local, then restart Expo.');
}

// This client handles both authentication and database queries.
export const supabase = createClient(url, key, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: sessionStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
