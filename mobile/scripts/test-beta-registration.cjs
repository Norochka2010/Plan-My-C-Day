const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const source=fs.readFileSync(root+'/src/components/account-setup.tsx','utf8');
const policySource=fs.readFileSync(root+'/src/lib/beta-policies.ts','utf8');
const policies=JSON.parse(policySource.slice(policySource.indexOf('{'),policySource.lastIndexOf('}')+1));
function harness(){
 let states=[],index=0,calls=[];
 const jsx=(type,props)=>({type,...props});
 const react={useState(init){const n=index++;if(!(n in states))states[n]=init;return[states[n],v=>states[n]=typeof v==='function'?v(states[n]):v]},useRef:v=>({current:v}),useEffect:()=>{}};
 const supabase={rpc:async()=>({data:true}),auth:{signUp:async data=>{calls.push(data);return{data:{session:{},user:{}}}}}};
 const context={exports:{},Date:class extends Date{constructor(...a){super(...(a.length?a:['2026-11-07T12:00:00']))}},process:{env:{}},setTimeout,clearTimeout,require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='react-native')return new Proxy({StyleSheet:{create:x=>x},Keyboard:{dismiss(){}}},{get:(o,k)=>o[k]||k});if(name==='@/lib/supabase')return{supabase};if(name==='@/lib/beta-policies')return{betaPolicies:policies};if(name==='@/lib/us-phone')return{normalizeUSPhone:()=>null,formatUSPhone:x=>x};return new Proxy({},{get:(o,k)=>k});}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,context);
 let tree;
 function render(){index=0;tree=context.exports.AccountSignIn({});return tree;}
 function all(n){if(arguments.length===0)n=tree;return !n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(all):[n,...all(n.children)];}
 function text(n){return n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(text).join(''):text(n.children);}
 function button(label){return all().find(n=>n.accessibilityRole==='button'&&text(n)===label);}
 function field(label,value){const n=all().find(n=>n.accessibilityLabel===label);assert(n,label);n.onChangeText(value);render();}
 function click(label){const n=button(label);assert(n,label);assert(!n.disabled,label+' disabled');n.onPress();render();}
 function check(phrase){const n=all().find(n=>n.accessibilityRole==='checkbox'&&text(n).includes(phrase));assert(n,phrase);n.onPress();render();}
 render();return{render,all,text,button,field,click,check,calls};
}
(async()=>{
 for(const [dob,allowed,parent] of [['11-08-2013',false,false],['11-07-2013',true,true],['11-08-2008',true,true],['11-07-2008',true,false],['11-07-2000',true,false]]){
 const h=harness();h.click('Create account');h.field('Birthday',dob);h.click('Continue');
 assert.equal(h.all().some(n=>n.accessibilityLabel==='Public username, required'),allowed,dob);
 if(!allowed)continue;
 assert.equal(h.all().some(n=>n.accessibilityRole==='checkbox'&&h.text(n).includes('My parent')),parent,dob);
 h.field('First name','Test');h.field('Last name, required','Tester');h.field('Public username, required','tester123');h.field('Email','test@example.com');h.field('Password','long-test-password');h.field('Confirm password','long-test-password');
 h.check('agree to the Terms');h.check('acknowledge the Privacy');assert(h.button('Create account').disabled);
 h.check('live in the United States');if(parent){assert(h.button('Create account').disabled);h.check('My parent');}
 h.click('Create account');await new Promise(setImmediate);assert.equal(h.calls.length,1);
 const legal=h.calls[0].options.data.legal_acknowledgment;assert.equal(legal.parent_permission_confirmed,parent?true:null);assert.equal(legal.terms_version,policies.terms.version);assert(legal.us_resident_confirmed);
 }
 for(const p of Object.values(policies)){assert(!/Israel|Beta Round 1|\[Teen participation/.test(p.text));assert(p.text.includes('13'));}
 console.log('PASS: under-13 rejection; 13th and 18th birthday boundaries; teen-only permission checkbox; US/terms/privacy gating; signup acknowledgment metadata; policy consistency. No real accounts created.');
})().catch(e=>{console.error(e);process.exitCode=1});
