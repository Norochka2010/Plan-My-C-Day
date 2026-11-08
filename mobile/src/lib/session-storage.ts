import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { createLogger, elapsed } from './logger';
// Keep the existing Supabase key. Old development builds continue using their current storage.
const secure: typeof import('expo-secure-store') | null = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoSecureStore')
  ? require('expo-secure-store') : null;
type Manifest = { generation: string; count: number };
const safeKey = (key: string) => `auth.${Array.from(key).map(c=>c.charCodeAt(0).toString(16)).join('-')}`;
const options = secure ? { keychainAccessible: secure.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } : {};

// Session values are never logged — only sizes, chunk counts, timings and failures.
const log = createLogger('session_storage');
// Session keys look like "sb-<project>-auth-token"; only the suffix is useful in logs.
const keyLabel = (key: string) => key.replace(/^sb-[^-]+-/, 'sb-*-');
const isAuthKey = (key: string) => /auth-token$/.test(key);
if (!secure) log.warn('secure_store_unavailable', { platform: Platform.OS, fallback: 'async_storage' });

function parseManifest(raw: string, key: string, op: string): Manifest {
  try {
    const manifest = JSON.parse(raw) as Manifest;
    // Shape problems are logged but not thrown, to keep the original read behaviour.
    if (!manifest || typeof manifest.count !== 'number' || typeof manifest.generation !== 'string') log.error('session_manifest_shape_invalid', { key: keyLabel(key), op, raw_length: raw.length });
    return manifest;
  } catch (error) {
    log.error('session_manifest_corrupt', { key: keyLabel(key), op, raw_length: raw.length, error });
    throw error;
  }
}

export const sessionStorage = {
  async getItem(key: string): Promise<string|null> {
    const started = Date.now();
    const k = keyLabel(key);
    try {
      if(!secure){
        const value = await AsyncStorage.getItem(key);
        if (isAuthKey(key)) log.info('session_read', { key: k, backend: 'async_storage', found: value !== null, length: value?.length ?? 0, duration_ms: elapsed(started) });
        return value;
      }
      const base=safeKey(key);
      const raw=await secure.getItemAsync(base,options);
      if(raw){
        const manifest=parseManifest(raw,key,'get');
        const chunks=await Promise.all(Array.from({length:manifest.count},(_,i)=>secure.getItemAsync(`${base}.${manifest.generation}.${i}`,options)));
        const missing=chunks.reduce<number[]>((acc,c,i)=>c===null?[...acc,i]:acc,[]);
        if(missing.length){
          // This makes auth-js treat the session as unreadable — a likely "randomly signed out" cause.
          log.error('session_chunks_missing', { key: k, generation: manifest.generation, chunk_count: manifest.count, missing_indexes: missing, duration_ms: elapsed(started) });
          throw new Error('Your saved session could not be read. Please retry.');
        }
        const value = chunks.join('');
        if (isAuthKey(key)) log.info('session_read', { key: k, backend: 'secure_store', found: true, chunk_count: manifest.count, generation: manifest.generation, length: value.length, duration_ms: elapsed(started) });
        return value;
      }
      if(await AsyncStorage.getItem(`${key}.secure-migrated`)){
        if (isAuthKey(key)) log.info('session_read', { key: k, backend: 'secure_store', found: false, migrated_marker: true, duration_ms: elapsed(started) });
        return null;
      }
      const legacy=await AsyncStorage.getItem(key);
      if(legacy){
        log.info('session_legacy_found', { key: k, length: legacy.length });
        // Never discard the legacy session unless a complete replacement is verified.
        try{await sessionStorage.setItem(key,legacy);log.info('session_legacy_migrated', { key: k });}
        catch(error){log.warn('session_legacy_migration_failed', { key: k, error });/* Preserve the working legacy session for retry. */}
      } else if (isAuthKey(key)) {
        log.info('session_read', { key: k, backend: 'secure_store', found: false, legacy_found: false, duration_ms: elapsed(started) });
      }
      return legacy;
    } catch (error) {
      log.error('session_read_failed', { key: k, error, duration_ms: elapsed(started) });
      throw error;
    }
  },
  async setItem(key:string,value:string){
    const started = Date.now();
    const k = keyLabel(key);
    try {
      if(!secure){await AsyncStorage.setItem(key,value);if (isAuthKey(key)) log.info('session_written', { key: k, backend: 'async_storage', length: value.length, duration_ms: elapsed(started) });return;}
      const base=safeKey(key);
      const previous=await secure.getItemAsync(base,options);
      const generation=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const chunks=value.match(/[\s\S]{1,500}/g)||[''];
      for(let i=0;i<chunks.length;i++){
        const chunkKey=`${base}.${generation}.${i}`;
        await secure.setItemAsync(chunkKey,chunks[i],options);
        if(await secure.getItemAsync(chunkKey,options)!==chunks[i]){
          log.error('session_chunk_verify_failed', { key: k, generation, chunk_index: i, chunk_count: chunks.length });
          throw new Error('Could not safely save your session.');
        }
      }
      await secure.setItemAsync(base,JSON.stringify({generation,count:chunks.length}),options);
      // A metadata marker prevents any stale legacy session from being restored after logout.
      await AsyncStorage.setItem(`${key}.secure-migrated`,'1');
      await AsyncStorage.removeItem(key);
      let staleCleanupFailures = 0;
      let previousGeneration: string | null = null;
      if(previous){const old=parseManifest(previous,key,'set_cleanup');previousGeneration=old.generation;
        await Promise.all(Array.from({length:old.count},(_,i)=>secure.deleteItemAsync(`${base}.${old.generation}.${i}`,options).catch(()=>{staleCleanupFailures++;})));
      }
      if (isAuthKey(key) || staleCleanupFailures) log[staleCleanupFailures ? 'warn' : 'info']('session_written', { key: k, backend: 'secure_store', length: value.length, chunk_count: chunks.length, generation, previous_generation: previousGeneration, stale_cleanup_failures: staleCleanupFailures, duration_ms: elapsed(started) });
    } catch (error) {
      log.error('session_write_failed', { key: k, length: value.length, error, duration_ms: elapsed(started) });
      throw error;
    }
  },
  async removeItem(key:string){
    const started = Date.now();
    const k = keyLabel(key);
    try {
      if(!secure){await AsyncStorage.removeItem(key);log.info('session_removed', { key: k, backend: 'async_storage' });return;}
      const base=safeKey(key);const raw=await secure.getItemAsync(base,options);
      await AsyncStorage.setItem(`${key}.secure-migrated`,'1');
      await AsyncStorage.removeItem(key);
      await secure.deleteItemAsync(base,options);
      let chunkCount = 0;
      if(raw){const old=parseManifest(raw,key,'remove');chunkCount=old.count;await Promise.all(Array.from({length:old.count},(_,i)=>secure.deleteItemAsync(`${base}.${old.generation}.${i}`,options)));}
      // Supabase removes the session on sign-out *and* when a refresh is rejected; the auth
      // event that follows (see supabase.ts) tells you which.
      log.info('session_removed', { key: k, backend: 'secure_store', had_manifest: !!raw, chunk_count: chunkCount, duration_ms: elapsed(started) });
    } catch (error) {
      log.error('session_remove_failed', { key: k, error, duration_ms: elapsed(started) });
      throw error;
    }
  },
};
