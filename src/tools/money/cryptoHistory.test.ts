import {it,expect,vi,afterEach} from "vitest";
import {candleSeries,getCryptoHistory} from "./cryptoHistory";
import {fetchJson} from "../shared/fetcher";
vi.mock("../shared/fetcher",()=>({fetchJson:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
it("ordena cierres cronológicamente, descarta inválidos y no confunde apertura con cierre",()=>{
 const end=200000;
 const series=candleSeries([[end-3600,1,100,90,30],[end-7200,1,100,80,20],[end-10800,1,100,70,10],[end-500,0,0,0,"bad"]],0,end);
 expect(series[0].values).toEqual([10,20,30]);
});
it("consulta historial incluso si el proveedor del precio era otro",async()=>{
 const now=Math.floor(Date.now()/1000);vi.mocked(fetchJson).mockResolvedValue({ok:true,status:200,data:[[now-3600,1,4,2,3],[now-7200,1,4,1,2]]});
 const data=await getCryptoHistory("BTC","EUR");expect(data.series[0].values).toEqual([2,3]);expect(data.currency).toBe("EUR");expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining("BTC-EUR/candles"),expect.anything());
});
it("recurre a velas de Binance para USDT si Coinbase falla",async()=>{
 const now=Date.now();vi.mocked(fetchJson).mockResolvedValueOnce({ok:false,status:404}).mockResolvedValueOnce({ok:true,status:200,data:[[now-7200000,"1","4","0","2"],[now-3600000,"1","4","0","3"]]});
 const data=await getCryptoHistory("SOL","USDT");expect(data.source).toBe("Binance");expect(data.series[0].values).toEqual([2,3]);
});
it("rechaza datos vacíos sin fabricar una curva",async()=>{
 vi.mocked(fetchJson).mockResolvedValue({ok:true,status:200,data:[]});await expect(getCryptoHistory("DOGE","GBP")).rejects.toThrow("historial");
});
