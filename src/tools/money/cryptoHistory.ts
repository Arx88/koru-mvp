import { fetchJson } from "../shared/fetcher";
import { cached } from "../shared/cache";
export type PriceHistory={series:Array<{label:string;values:number[]}>;source:string;currency:string;fetchedAt:string};
export function candleSeries(rows:unknown,start:number,end:number,milliseconds=false) {
 if(!Array.isArray(rows))return [];
 const unique=new Map<number,number>();
 for(const row of rows){if(!Array.isArray(row))continue;const t=Number(row[0])/(milliseconds?1000:1),price=Number(row[4]);if(Number.isFinite(t)&&Number.isFinite(price)&&price>0&&t>=start&&t<=end)unique.set(t,price);}
 const ordered=[...unique].sort((a,b)=>a[0]-b[0]);
 return [{label:"1D",values:ordered.filter(([time])=>time>=end-86400).map(([,price])=>price)},{label:"1S",values:ordered.map(([,price])=>price)}].filter(s=>s.values.length>1);
}
const pending=new Map<string,Promise<PriceHistory>>();
export async function getCryptoHistory(symbolRaw:string,currencyRaw="USD"):Promise<PriceHistory> {
 const symbol=symbolRaw.toUpperCase(),currency=currencyRaw.toUpperCase();
 if(!/^[A-Z0-9]{2,12}$/.test(symbol)||!["USD","EUR","GBP","USDT"].includes(currency))throw Error("Par de precios no compatible");
 const key=`crypto-history:${symbol}:${currency}`;
 const inFlight=pending.get(key);if(inFlight)return inFlight;
 const request=cached(key,300_000,async()=>{
   const end=Math.floor(Date.now()/1000),start=end-7*86400;
   const from=new Date(start*1000).toISOString(),to=new Date(end*1000).toISOString();
   const response=await fetchJson<unknown>(`https://api.exchange.coinbase.com/products/${symbol}-${currency}/candles?granularity=3600&start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}`,{timeoutMs:4500,retries:0});
   let series=response.ok?candleSeries(response.data,start,end):[],source="Coinbase";
   if(!series.length&&currency==="USDT"){
     const fallback=await fetchJson<unknown>(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=168`,{timeoutMs:4500,retries:0});
     series=fallback.ok?candleSeries(fallback.data,start,end,true):[];source="Binance";
   }
   if(!series.length)throw Error("No se pudo obtener el historial de precios");
   return {series,source,currency,fetchedAt:new Date().toISOString()};
 });
 pending.set(key,request);
 try{return await request;}finally{pending.delete(key);}
}
