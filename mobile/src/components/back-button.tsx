import { Pressable, Text } from 'react-native';
export function BackButton({label='‹ Back',onPress,disabled=false}:{label?:string;onPress:()=>void;disabled?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>({alignSelf:'flex-start',minHeight:44,paddingVertical:10,paddingHorizontal:4,justifyContent:'center',opacity:disabled||pressed?0.5:1})}><Text style={{color:'#604378',fontSize:16,lineHeight:24,fontWeight:'600'}}>{label.startsWith('‹')?label:`‹ ${label}`}</Text></Pressable>;
}
