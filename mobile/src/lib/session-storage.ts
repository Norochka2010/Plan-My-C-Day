import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
// Keep the existing Supabase key. Old development builds continue using their current storage.
const secure: typeof import('expo-secure-store') | null = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoSecureStore')
  ? require('expo-secure-store') : null;
type Manifest = { generation: string; count: number };
const safeKey = (key: string) => `auth.${Array.from(key).map(c=>c.charCodeAt(0).toString(16)).join('-')}`;
const options = secure ? { keychainAccessible: secure.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } : {};
export const sessionStorage = {
  async getItem(key: string): Promise<string|null> {
    if(!secure)return AsyncStorage.getItem(key);
    const base=safeKey(key);
    const raw=await secure.getItemAsync(base,options);
    if(raw){
      const manifest=JSON.parse(raw) as Manifest;
      const chunks=await Promise.all(Array.from({length:manifest.count},(_,i)=>secure.getItemAsync(`${base}.${manifest.generation}.${i}`,options)));
      if(chunks.some(c=>c===null))throw new Error('Your saved session could not be read. Please retry.');
      return chunks.join('');
    }
    if(await AsyncStorage.getItem(`${key}.secure-migrated`))return null;
    const legacy=await AsyncStorage.getItem(key);
    if(legacy){
      // Never discard the legacy session unless a complete replacement is verified.
      try{await sessionStorage.setItem(key,legacy);}catch{/* Preserve the working legacy session for retry. */}
    }
    return legacy;
  },
  async setItem(key:string,value:string){
    if(!secure){await AsyncStorage.setItem(key,value);return;}
    const base=safeKey(key);
    const previous=await secure.getItemAsync(base,options);
    const generation=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const chunks=value.match(/[\s\S]{1,500}/g)||[''];
    for(let i=0;i<chunks.length;i++){
      const chunkKey=`${base}.${generation}.${i}`;
      await secure.setItemAsync(chunkKey,chunks[i],options);
      if(await secure.getItemAsync(chunkKey,options)!==chunks[i])throw new Error('Could not safely save your session.');
    }
    await secure.setItemAsync(base,JSON.stringify({generation,count:chunks.length}),options);
    // A metadata marker prevents any stale legacy session from being restored after logout.
    await AsyncStorage.setItem(`${key}.secure-migrated`,'1');
    await AsyncStorage.removeItem(key);
    if(previous){const old=JSON.parse(previous) as Manifest;
      await Promise.all(Array.from({length:old.count},(_,i)=>secure.deleteItemAsync(`${base}.${old.generation}.${i}`,options).catch(()=>{})));
    }
  },
  async removeItem(key:string){
    if(!secure){await AsyncStorage.removeItem(key);return;}
    const base=safeKey(key);const raw=await secure.getItemAsync(base,options);
    await AsyncStorage.setItem(`${key}.secure-migrated`,'1');
    await AsyncStorage.removeItem(key);
    await secure.deleteItemAsync(base,options);
    if(raw){const old=JSON.parse(raw) as Manifest;await Promise.all(Array.from({length:old.count},(_,i)=>secure.deleteItemAsync(`${base}.${old.generation}.${i}`,options)));}
  },
};
