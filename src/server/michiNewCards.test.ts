import { describe, expect, it } from "vitest";
import { blocksFromToolResults } from "./blocksFromToolResults";
const run = (result: Record<string, unknown>) => blocksFromToolResults([{ tool:String(result.type), arguments:{}, result } as any]);
describe("Michi news and market card data", () => {
  it("marks news results explicitly and preserves each article's source", () => {
    const [block] = run({type:"news_topic",topic:"Ciencia",articles:[{title:"Una noticia",summary:"Su resumen",url:"https://example.com/noticia",source:"Medio"}]});
    expect(block).toMatchObject({type:"research_sources",mode:"news",sources:[{title:"Una noticia",snippet:"Su resumen",url:"https://example.com/noticia",domain:"Medio"}]});
  });
  it("retains market metrics and real history without inventing a missing change", () => {
    const series=[{label:"1S",values:[20,21,22]}];
    const [block] = run({type:"crypto_price",symbol:"BTC",coin:"Bitcoin",price:22,currency:"USD",marketCap:123000,volume24h:2000,series});
    expect(block.type).toBe("crypto_portfolio");
    if(block.type !== "crypto_portfolio") throw Error("wrong block");
    expect(block.items?.[0].series).toEqual(series);
    expect(block.items?.[0].marketCap).toBeTruthy();
    expect(block.items?.[0].volume).toBeTruthy();
    expect(block.items?.[0].change).toBeUndefined();
  });
  it("retains a stock's volume and series and identifies missing prices", () => {
    const [block] = run({type:"stock_quote",symbol:"AAPL",volume:1000,series:[{label:"1D",values:[1,2]}]});
    expect(block).toMatchObject({type:"market",assets:[{symbol:"AAPL",price:"Cotización no disponible",series:[{label:"1D",values:[1,2]}]}]});
  });
});
