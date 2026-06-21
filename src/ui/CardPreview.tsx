import { WebNavCardA } from "./chatCards";
import type { UiBlock } from "../domain/types";

const loadingBlock: Extract<UiBlock, { type: "web_nav" }> = {
  type: "web_nav",
  status: "loading",
  title: "Web Navigation",
  query: "computación cuántica",
  url: "wikipedia.org/wiki/Quantum_computing",
  results: [],
};

const completeBlock: Extract<UiBlock, { type: "web_nav" }> = {
  type: "web_nav",
  status: "complete",
  title: "Web Navigation",
  query: "computación cuántica",
  results: [
    {
      title: "Historia de la computación cuántica",
      source: "Wikipedia",
      url: "https://es.wikipedia.org/wiki/Computaci%C3%B3n_cu%C3%A1ntica",
      type: "article",
      readTime: "2 min read",
    },
    {
      title: "Qubits y superposición",
      source: "IBM Research",
      url: "https://research.ibm.com/quantum",
      type: "description",
      readTime: "PDF",
    },
    {
      title: "Quantum Computing: The Next Frontier",
      source: "Nature",
      url: "https://nature.com/articles/quantum",
      type: "article",
      readTime: "5 min read",
    },
  ],
};

export function CardPreview() {
  const isWebNav = new URLSearchParams(window.location.search).get("preview") === "web-nav";
  if (!isWebNav) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#FCFCFA] p-4">
      <div className="mx-auto w-full max-w-md space-y-6 pt-8">
        <h1 className="text-center text-lg font-bold text-gray-900">Preview — Web Navigation Card</h1>

        <div>
          <p className="mb-2 text-center text-sm font-semibold text-gray-500">Estado: Loading</p>
          <div className="mx-auto w-full max-w-[420px]">
            <WebNavCardA block={loadingBlock} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-center text-sm font-semibold text-gray-500">Estado: Complete</p>
          <div className="mx-auto w-full max-w-[420px]">
            <WebNavCardA block={completeBlock} />
          </div>
        </div>

        <div className="pt-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Volver a Koru
          </a>
        </div>
      </div>
    </div>
  );
}
