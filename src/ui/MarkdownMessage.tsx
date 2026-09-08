import { useState, type ReactNode } from "react";

/**
 * 🔴 UX (2026-09-10): render de markdown liviano para las burbujas de Koru.
 * Soporta: **negrita**, *itálica*, `código`, [links](https://...), listas con
 * "-" y "1.", títulos "### " y saltos de línea. Sin HTML crudo (safe by
 * construction — nunca dangerouslySetInnerHTML).
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(`([^`\n]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-i${i++}`;
    if (m[1]) {
      nodes.push(<b key={key}>{m[2]}</b>);
    } else if (m[3]) {
      nodes.push(<i key={key}>{m[4]}</i>);
    } else if (m[5]) {
      nodes.push(
        <code
          key={key}
          style={{
            background: "rgba(124, 95, 246, 0.12)",
            borderRadius: 6,
            padding: "1px 6px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.92em",
          }}
        >
          {m[6]}
        </code>,
      );
    } else if (m[7] && m[9]) {
      nodes.push(
        <a
          key={key}
          href={m[9]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#6d4ee0", textDecoration: "underline", wordBreak: "break-all" }}
        >
          {m[8]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdownBody(text: string): ReactNode[] {
  const lines = (text ?? "").split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listItems) return;
    const { ordered, items } = listItems;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l${key++}`}
        style={{
          margin: "4px 0",
          paddingLeft: 20,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          textAlign: "left",
          listStyle: ordered ? "decimal" : "disc",
        }}
      >
        {items.map((item, idx) => (
          <li key={idx} style={{ textAlign: "left" }}>{renderInline(item, `li${key}-${idx}`)}</li>
        ))}
      </Tag>,
    );
    listItems = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) {
      if (!listItems || listItems.ordered) {
        flushList();
        listItems = { ordered: false, items: [] };
      }
      listItems.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      if (!listItems || !listItems.ordered) {
        flushList();
        listItems = { ordered: true, items: [] };
      }
      listItems.items.push(numbered[1]);
      continue;
    }
    flushList();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={`h${key++}`} style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: "0.98em" }}>
          {renderInline(heading[1], `hh${key}`)}
        </p>,
      );
      continue;
    }
    blocks.push(
      <p key={`p${key++}`} style={{ margin: "3px 0" }}>
        {renderInline(line, `pp${key}`)}
      </p>,
    );
  }
  flushList();
  return blocks;
}

/**
 * 🔴 UX (2026-09-10): botón de copiar debajo del mensaje de Koru.
 * Clipboard API con fallback a execCommand (navegadores viejos / permisos).
 */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const clean = (text ?? "").trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = clean;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        /* sin clipboard — nada */
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copiado" : "Copiar mensaje"}
      className="koru-copy-button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        marginLeft: 66,
        border: "none",
        background: "transparent",
        color: copied ? "#3fae7a" : "rgba(90, 74, 128, 0.65)",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        padding: "2px 6px",
        borderRadius: 8,
        transition: "color 150ms ease, background 150ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        className="material-symbols-outlined"
        aria-hidden
        style={{ fontSize: 14, lineHeight: 1, fontVariationSettings: copied ? "'FILL' 1" : undefined }}
      >
        {copied ? "check_circle" : "content_copy"}
      </span>
      <span>{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}
