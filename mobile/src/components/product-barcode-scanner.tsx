import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
/** Loaded only after confirming the native ExpoCamera module exists. No capture/storage/upload. */
export function ProductBarcodeScanner({onBarcode,onCancel}:{onBarcode:(code:string)=>void;onCancel:()=>void}) {
 const [permission,requestPermission]=useCameraPermissions(),[active,setActive]=useState(AppState.currentState==='active'),[error,setError]=useState('');
 const scanned=useRef(false);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>sub.remove();},[]);
 return <View style={s.wrap}>
  <Text style={s.title}>Scan a package barcode</Text>
  <Text style={s.body}>Only the barcode number is used. No photo is saved or uploaded.</Text>
  {!permission?.granted ? <>
   <Text style={s.body}>Allow camera access to scan, or enter the barcode instead.</Text>
   <Pressable accessibilityRole="button" style={s.button} onPress={()=>void (permission?.canAskAgain===false?Linking.openSettings():requestPermission()).catch(()=>setError('Camera access could not be opened. You can enter the barcode instead.'))}><Text style={s.buttonText}>{permission?.canAskAgain===false?'Open camera settings':'Allow camera'}</Text></Pressable>
  </> : active&&<CameraView style={s.camera} facing="back" barcodeScannerSettings={{barcodeTypes:['ean13','ean8','upc_a','itf14']}}
   onMountError={()=>setError('The camera could not start. You can enter the barcode instead.')}
   onBarcodeScanned={({data})=>{if(!scanned.current){scanned.current=true;onBarcode(data);}}}/>}
  {!!error&&<Text accessibilityLiveRegion="polite" style={s.body}>{error}</Text>}
  <Pressable accessibilityRole="button" style={s.button} onPress={onCancel}><Text style={s.buttonText}>Enter barcode instead</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({wrap:{gap:16},title:{fontSize:23,fontWeight:'700',color:'#30203F'},body:{fontSize:16,lineHeight:24,color:'#61566B'},camera:{height:300,borderRadius:20,overflow:'hidden'},button:{padding:16,minHeight:48,borderRadius:16,backgroundColor:'#E2EAF5'},buttonText:{fontSize:16,fontWeight:'600',color:'#344F75'}});
