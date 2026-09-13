import {useEffect,useState} from "react";
import type {PriceHistory} from "../../../tools/money/cryptoHistory";
const cache=new Map<string,{data:PriceHistory;until:number}>();
export function useCryptoHistory(symbol:string|undefined,currency:string,needed:boolean) {
 const [state,setState]=useState<{key:string;data?:PriceHistory;loading:boolean;error:boolean}>({key:"",loading:false,error:false});
 const [attempt,setAttempt]=useState(0);
 const key=`${symbol}:${currency}`;
 useEffect(()=>{
   if(!needed||!symbol)return;
   const hit=cache.get(key);if(hit&&hit.until>Date.now()){setState({key,data:hit.data,loading:false,error:false});return;}
   const controller=new AbortController();let active=true;
   const timeout=window.setTimeout(()=>controller.abort(),12000);
   setState({key,loading:true,error:false});
   void fetch("/api/michi/crypto-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol,currency}),signal:controller.signal})
     .then(async response=>{if(!response.ok)throw Error("history");const data:PriceHistory=await response.json();if(!Array.isArray(data.series)||!data.series.some(s=>Array.isArray(s.values)&&s.values.length>1))throw Error("empty");return data;})
     .then(data=>{if(active){cache.set(key,{data,until:Date.now()+300000});setState({key,data,loading:false,error:false});}})
     .catch(()=>{if(active)setState({key,loading:false,error:true});}).finally(()=>clearTimeout(timeout));
   return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[key,symbol,currency,needed,attempt]);
 return {...(state.key===key?state:{loading:needed,error:false,data:undefined}),retry:()=>setAttempt(n=>n+1)};
}
