import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, AppState, Image, Keyboard, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { normalizeBarcode, SOURCE_LINKS, type LookupResult } from '@/lib/product-lookup';
import { lookupProduct, offTesting, productImageHeaders } from '@/lib/product-lookup-config';
import { getExploreCatalog, type ExploreSummary } from '@/lib/explore-content';
import { QuickLearn } from './quick-learn';
import { PracticeScenario } from './practice-scenario';
const LABEL_LESSON='b89f6056-96ac-5248-8bf1-c85369e3cad8';
const note='Product information can change. Check the current package label and source when it matters.';
function Button({label,onPress,disabled=false,secondary=false}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,secondary&&s.secondary,(disabled||pressed)&&{opacity:.55}]}><Text style={[s.buttonText,secondary&&{color:'#365379'}]}>{label}</Text></Pressable>;
}
export function ProductCheckerEntry() {
 const [open,setOpen]=useState(false);
 return <View style={s.wrap}><Text accessibilityRole="header" style={s.heading}>CHECK</Text><View style={s.card}>
 <Text style={s.heading}>Check a Food / Product</Text><Text style={s.body}>Find external product and label information, with each source shown separately.</Text>
 <Button label="Check a Food / Product →" onPress={()=>setOpen(true)}/></View>
 <Modal visible={open} animationType="none" onRequestClose={()=>setOpen(false)}>{open&&<SafeAreaProvider><ProductChecker onClose={()=>setOpen(false)}/></SafeAreaProvider>}</Modal></View>;
}
function ProductChecker({onClose}:{onClose:()=>void}) {
 const [barcode,setBarcode]=useState(''),[result,setResult]=useState<LookupResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [scanner,setScanner]=useState<ComponentType<{onBarcode:(code:string)=>void;onCancel:()=>void}>|null>(null);
 const [imageFailed,setImageFailed]=useState(false),[catalog,setCatalog]=useState<ExploreSummary[]>([]),[learning,setLearning]=useState<ExploreSummary|null>(null);
 const lock=useRef(false),alive=useRef(true),request=useRef<AbortController|null>(null),scroll=useRef<ScrollView>(null),input=useRef<TextInput>(null);
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',state=>{if(state!=='active'){setScanner(null);request.current?.abort();setResult(null);setBarcode('');}});return()=>{alive.current=false;request.current?.abort();sub.remove();};},[]);
 async function lookup(value:string) {
  if(lock.current)return;Keyboard.dismiss();setScanner(null);setError('');setResult(null);setImageFailed(false);
  let normalized:string;try{normalized=normalizeBarcode(value);}catch(e){setError((e as Error).message);return;}
  setBarcode(normalized);lock.current=true;setBusy(true);const controller=new AbortController();request.current=controller;
  try{const found=await lookupProduct(normalized,controller.signal);if(alive.current&&!controller.signal.aborted){setResult(found);scroll.current?.scrollTo({y:0,animated:false});}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Lookup could not start. Please try again.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function scan() {
  Keyboard.dismiss();setError('');setResult(null);
  try {
   if(Platform.OS==='web'||!requireOptionalNativeModule('ExpoCamera'))throw Error();
   const component=require('./product-barcode-scanner').ProductBarcodeScanner;
   setScanner(()=>component);
  }catch{setError('Scanning needs the updated development app with camera support. You can enter a barcode below.');input.current?.focus();}
 }
 async function link(url:string){try{await Linking.openURL(url);}catch{setError('The source could not open. Please try again.');}}
 async function learn(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const items=await getExploreCatalog({publishedOnly:true});if(!alive.current)return;setCatalog(items);const item=items.find(i=>i.content_id===LABEL_LESSON);if(item)setLearning(item);else setError('Label Reading is not available right now. You can still check the current package and trusted sources.');}catch{if(alive.current)setError('Learning content could not load. Please try again.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 function openLearning(item?:ExploreSummary){if(item&&['QUICK_LEARN','PRACTICE_A_SKILL'].includes(item.content_type))setLearning(item);else{setLearning(null);setError('You can find more learning activities in Explore.');}}
 const Scanner=scanner,product=result?.product;
 return <SafeAreaView edges={['top','left','right','bottom']} style={s.screen}><ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
 <Button secondary label="‹ Back to Nutrition & Eating Well" onPress={onClose}/>
 <Text accessibilityRole="header" style={s.title}>Check a Food / Product</Text>
 <Text style={s.note}>{note}</Text>
 {offTesting&&<Text style={s.small}>Development test · Open Food Facts testing service. Records may differ from its main service.</Text>}
 {!!error&&<Text accessibilityLiveRegion="polite" style={s.note}>{error}</Text>}
 {Scanner?<Scanner onBarcode={value=>void lookup(value)} onCancel={()=>{setScanner(null);input.current?.focus();}}/>:<>
 <Button label="Scan Barcode" disabled={busy} onPress={scan}/>
 <Text style={s.heading}>Enter Barcode</Text>
 <TextInput ref={input} accessibilityLabel="Barcode number" value={barcode} onChangeText={value=>{setBarcode(value);setResult(null);setError('');}} editable={!busy} keyboardType="number-pad" maxLength={30} style={s.input} placeholder="Digits printed below the barcode" placeholderTextColor="#7A7180" onSubmitEditing={()=>void lookup(barcode)}/>
 <Button label={busy?'Checking Open Food Facts…':'Look up barcode'} disabled={busy||!barcode.trim()} onPress={()=>void lookup(barcode)}/>
 <Text style={s.small}>This sends the barcode to Open Food Facts. We don’t save a scan history or send your account or health information.</Text>
 </>}
 {busy&&<ActivityIndicator accessibilityLabel="Loading product information"/>}
 {!!result&&<View style={s.card}>
 <Text accessibilityLiveRegion="polite" style={s.heading}>{result.state}</Text>
 <Text style={s.small}>Barcode: {result.barcode}</Text>
 {result.reasons.map(reason=><Text key={reason} style={s.body}>{reason}</Text>)}
 {result.conflicts.map(conflict=><Text key={conflict} style={s.body}>Source conflict: {conflict}</Text>)}
 <Text style={s.small}>No certification lookup has been performed by this app.</Text>
 </View>}
 {!!product&&<View style={s.card}>
 <Text style={s.heading}>{product.name||'Product name not available'}</Text><Text style={s.body}>{product.brand||'Brand not available'}</Text>
 <Text style={s.small}>Identity from Open Food Facts. Compare the package and barcode.</Text>
 {product.image&&!imageFailed&&<><Image accessibilityLabel="Product image from Open Food Facts" source={{uri:product.image,headers:productImageHeaders(product.image)}} style={s.image} resizeMode="contain" onError={()=>setImageFailed(true)}/><Text style={s.small}>Image: Open Food Facts contributors · CC BY-SA. See the source page for attribution.</Text></>}
 </View>}
 <View style={s.card}><Text style={s.heading}>Open Food Facts</Text><Text style={s.small}>Supplemental, crowdsourced product information</Text>
 {!result?<Text style={s.body}>Enter or scan a barcode to check this source.</Text>:<>
 <Text style={s.body}>{result.state}</Text><Text style={s.small}>Lookup time: {new Date(result.fetchedAt).toLocaleString()}</Text>
 {product&&<><Text style={s.small}>Source record updated: {product.modifiedAt?new Date(product.modifiedAt).toLocaleDateString():'Not provided'}. This is not a date of product verification.</Text>
 <Text style={s.heading}>Ingredient text from Open Food Facts</Text><Text selectable style={s.body}>{product.ingredients||'Not provided by this source.'}</Text>
 <Text style={s.heading}>Labels / claims recorded by Open Food Facts</Text><Text selectable style={s.body}>{product.labels||'Not provided by this source.'}</Text></>}
 <Text style={s.body}>These records are not independent certification or a Plan My C-Day determination that a product is gluten-free.</Text>
 <Button secondary label={offTesting?"Open main Open Food Facts record ↗":"Open Open Food Facts source ↗"} onPress={()=>void link(`https://world.openfoodfacts.org/product/${result.barcode}`)}/>
 </>}
 <Button secondary label="Open Food Facts data & image licenses ↗" onPress={()=>void link(SOURCE_LINKS.license)}/>
 <Text style={s.small}>Data: Open Food Facts contributors · Open Database License (ODbL); individual contents: Database Contents License.</Text></View>
 <View style={s.card}><Text style={s.heading}>GFCO</Text><Text style={s.body}>Gluten-Free Certification Organization</Text><Text style={s.body}>Live lookup not connected yet. Open the official directory to check the exact product. A brand or facility match does not establish product certification.</Text><Button secondary label="Open trusted source ↗" onPress={()=>void link(SOURCE_LINKS.gfco)}/></View>
 <View style={s.card}><Text style={s.heading}>Celiac Canada</Text><Text style={s.body}>Gluten-Free Product Finder</Text><Text style={s.body}>Live lookup not connected yet. Open the official finder and check its current information. An absent result does not tell you whether a product contains gluten.</Text><Button secondary label="Open trusted source ↗" onPress={()=>void link(SOURCE_LINKS.canada)}/></View>
 <View style={s.card}><Text style={s.heading}>More information is needed?</Text><Text style={s.body}>Compare the current package label, contact the manufacturer using the details on the package, or check the official certification source.</Text><Button secondary label="Optional: Reading a Food Label →" disabled={busy} onPress={()=>void learn()}/></View>
 </ScrollView>
 <Modal visible={!!learning} animationType="none" onRequestClose={()=>setLearning(null)}>{learning&&<SafeAreaProvider>{learning.content_type==='QUICK_LEARN'?<QuickLearn key={learning.content_id} publishedOnly contentId={learning.content_id} catalog={catalog} onClose={()=>setLearning(null)} onNext={id=>openLearning(catalog.find(i=>i.content_id===id))} onPractice={openLearning}/>:<PracticeScenario key={learning.content_id} publishedOnly contentId={learning.content_id} catalog={catalog} onClose={()=>setLearning(null)} onOpen={openLearning}/>}</SafeAreaProvider>}</Modal>
 </SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#F8F5EF'},content:{padding:20,gap:16,paddingBottom:36},wrap:{gap:14},title:{fontFamily:Fonts.rounded,fontSize:28,lineHeight:36,color:'#2D203E',fontWeight:'700'},heading:{fontFamily:Fonts.rounded,fontSize:19,lineHeight:27,color:'#344B38',fontWeight:'600'},body:{fontSize:16,lineHeight:25,color:'#5B5263'},small:{fontSize:13,lineHeight:20,color:'#625A69'},note:{fontSize:15,lineHeight:23,color:'#4B4A56',padding:16,backgroundColor:'#EDEBF2',borderRadius:16},card:{padding:18,gap:14,borderRadius:22,borderWidth:1,borderColor:'#CBD8BE',backgroundColor:'#F3F6EB'},button:{minHeight:48,padding:15,borderRadius:16,backgroundColor:'#536B44',alignItems:'center'},secondary:{backgroundColor:'#E3EBF6'},buttonText:{fontSize:16,lineHeight:23,fontWeight:'600',color:'#FFFFFF'},input:{minHeight:52,borderWidth:1,borderColor:'#BAC9AF',borderRadius:16,padding:14,fontSize:18,color:'#30233F',backgroundColor:'#FFFFFF'},image:{height:170,width:'100%'}});
