/**
 * Crypto wallet reader via Etherscan (free, no API key required for basic
 * balance lookups).
 *
 * Etherscan permite consultar el balance ETH de una dirección sin API key:
 *   https://api.etherscan.io/api?module=account&action=balance
 *     &address={ADDR}&tag=latest
 *
 * Para tokens ERC-20 (tokenCount) usamos el endpoint `tokentx` que lista
 * transferencias — sin key devuelve las últimas ~10k transferencias, lo cual
 * es suficiente para inferir qué tokens tuvo/tiene la wallet.
 *
 * Ambos endpoints están sujetos al rate-limit "free tier" (~5 req/s sin key).
 */

import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";

const ETH_RPC_BASE = "https://api.etherscan.io/api";

type EtherscanBalanceResponse = {
  status: "1" | "0";
  message: string;
  result: string; // wei como string
};

type EtherscanTokenTx = {
  contractAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  value?: string;
  to?: string;
  from?: string;
};

type EtherscanTokenListResponse = {
  status: "1" | "0";
  message: string;
  result: EtherscanTokenTx[];
};

const WEI_PER_ETH = 1e18;

function weiToEth(weiStr: string): number {
  const wei = BigInt(weiStr || "0");
  // Convertimos a ETH sin perder precisión: integer wei / 1e18.
  const eth = Number(wei) / WEI_PER_ETH;
  return Math.round(eth * 1e6) / 1e6;
}

/**
 * Verifica que una dirección sea un address ETH válido (40 hex después de 0x).
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Trae el balance ETH de una wallet desde Etherscan (sin API key).
 *
 * @param address Dirección ETH (0x…).
 * @returns { ethBalance, tokenCount } o null si la API falla o la dirección
 *          es inválida.
 */
export async function fetchWalletBalance(
  address: string,
): Promise<{ ethBalance: number; tokenCount: number } | null> {
  const addr = address.trim();
  if (!isValidEthAddress(addr)) return null;

  const cacheKey = `etherscan:balance:${addr.toLowerCase()}`;
  try {
    return await cached(cacheKey, ttls.crypto, async () => {
      // 1) Balance ETH.
      const balanceUrl =
        `${ETH_RPC_BASE}?module=account&action=balance` +
        `&address=${encodeURIComponent(addr)}&tag=latest`;
      const balRes = await fetchJson<EtherscanBalanceResponse>(balanceUrl, {
        timeoutMs: 10_000,
      });
      if (!balRes.ok || !balRes.data) {
        return null;
      }
      // Etherscan devuelve status "0" cuando la dirección es válida pero
      // sin transacciones, con message "No transactions found" y result "0".
      // Tratamos ambos casos (status 1 con result, o result "0") como ok.
      const weiStr = balRes.data.result ?? "0";
      const ethBalance = weiToEth(weiStr);

      // 2) Token count: lista transferencias ERC-20 y cuenta contracts únicos.
      //    Sin key devuelve las últimas 10k transferencias; suficiente para
      //    inferir qué tokens tuvo la wallet.
      let tokenCount = 0;
      try {
        const tokenUrl =
          `${ETH_RPC_BASE}?module=account&action=tokentx` +
          `&address=${encodeURIComponent(addr)}&page=1&offset=100&sort=desc`;
        const tokRes = await fetchJson<EtherscanTokenListResponse>(tokenUrl, {
          timeoutMs: 10_000,
        });
        if (tokRes.ok && tokRes.data && Array.isArray(tokRes.data.result)) {
          const contracts = new Set<string>();
          for (const t of tokRes.data.result) {
            if (t.contractAddress) contracts.add(t.contractAddress.toLowerCase());
          }
          tokenCount = contracts.size;
        }
      } catch {
        // Sin tokens o fallo de red: tokenCount queda en 0.
      }

      return { ethBalance, tokenCount };
    });
  } catch {
    return null;
  }
}
