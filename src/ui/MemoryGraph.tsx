import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MemoryFact, MemoryKind } from "../domain/types";
import { cosineSimilarity } from "../domain/memory/embeddings";

// MemoryGraph — visualización force-directed de las memorias del usuario.
// Cada memoria es un nodo; dos nodos se conectan cuando la similitud del
// coseno entre sus embeddings supera 0.5. El color del nodo depende del
// MemoryKind y el tamaño de la confidence. La física es simple: repulsión
// entre todos los pares de nodos + atracción a lo largo de las aristas.
// Se renderiza en un <canvas> de 400px de alto dentro de un modal portal.

// ───────── Paleta por MemoryKind ─────────
const KIND_COLORS: Record<MemoryKind, string> = {
  profile: "#8363f9",
  routine: "#059669",
  preference: "#d97706",
  goal: "#dc2626",
  relationship: "#ec4899",
  boundary: "#0f172a",
  retail: "#0284c7",
  wellbeing: "#10b981",
  task: "#4f46e5",
};

const EDGE_THRESHOLD = 0.5;

type GNode = {
  id: string;
  memory: MemoryFact;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type GEdge = { a: number; b: number; weight: number };

export interface MemoryGraphProps {
  memories: MemoryFact[];
  onClose: () => void;
}

export function MemoryGraph({ memories, onClose }: MemoryGraphProps) {
  // Memorias con embedding válido — sin embedding no podemos calcular similitud.
  const embedded = useMemo(
    () => memories.filter((m) => Array.isArray(m.embedding) && (m.embedding?.length ?? 0) > 0),
    [memories],
  );

  // Nodos: inicializamos en una circunferencia alrededor del centro del canvas.
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dimsRef = useRef<{ w: number; h: number }>({ w: 360, h: 400 });
  const [hovered, setHovered] = useState<string | null>(null);

  // Build nodes + edges once per memories change.
  useMemo(() => {
    const w = dimsRef.current.w;
    const h = dimsRef.current.h;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;
    const nodes: GNode[] = embedded.map((memory, i) => {
      const angle = (i / Math.max(1, embedded.length)) * Math.PI * 2;
      return {
        id: memory.id,
        memory,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    const edges: GEdge[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const sim = cosineSimilarity(
          nodes[i].memory.embedding ?? [],
          nodes[j].memory.embedding ?? [],
        );
        if (sim > EDGE_THRESHOLD) {
          edges.push({ a: i, b: j, weight: sim });
        }
      }
    }
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [embedded]);

  // Physics loop — repulsión entre todos los pares + atracción a lo largo de
  // las aristas, con un suave centro de gravedad y damping.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Hi-DPI scaling.
    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 360;
      const h = 400;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimsRef.current = { w, h };
    }
    resize();
    window.addEventListener("resize", resize);

    const REPEL = 1400; // Coulomb-like constant
    const SPRING = 0.02; // edge spring constant
    const SPRING_LEN = 90; // rest length
    const CENTER = 0.005; // gravity toward canvas center
    const DAMP = 0.85; // velocity damping

    function step() {
      if (!ctx || !canvas) return;
      const { w, h } = dimsRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Repulsion between all pairs.
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = Math.max(dx * dx + dy * dy, 1);
          const dist = Math.sqrt(distSq);
          const force = REPEL / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Attraction along edges.
      for (const edge of edges) {
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(Math.max(dx * dx + dy * dy, 1));
        const displacement = dist - SPRING_LEN;
        const force = SPRING * displacement * edge.weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center gravity + integration + bounds.
      for (const node of nodes) {
        node.vx += (cx - node.x) * CENTER;
        node.vy += (cy - node.y) * CENTER;
        node.vx *= DAMP;
        node.vy *= DAMP;
        node.x += node.vx;
        node.y += node.vy;
        // Soft bounds — keep nodes inside the canvas with a margin.
        const margin = 24;
        if (node.x < margin) { node.x = margin; node.vx *= -0.4; }
        if (node.x > w - margin) { node.x = w - margin; node.vx *= -0.4; }
        if (node.y < margin) { node.y = margin; node.vy *= -0.4; }
        if (node.y > h - margin) { node.y = h - margin; node.vy *= -0.4; }
      }

      // Render.
      ctx.clearRect(0, 0, w, h);
      // Background.
      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(0, 0, w, h);

      // Edges first (so nodes paint on top).
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        if (!a || !b) continue;
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.5, edge.weight * 0.6)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes.
      for (const node of nodes) {
        const conf = Math.max(0, Math.min(1, node.memory.confidence ?? 0));
        const r = 6 + conf * 12; // 6..18 px
        const color = KIND_COLORS[node.memory.kind] ?? "#94a3b8";
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (hovered === node.id) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#fff";
          ctx.stroke();
        }
      }

      rafRef.current = window.requestAnimationFrame(step);
    }

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [hovered]);

  // Hit-test on click — alert with the memory text (simple per requirements).
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nodes = nodesRef.current;
    for (const node of nodes) {
      const conf = Math.max(0, Math.min(1, node.memory.confidence ?? 0));
      const r = 6 + conf * 12;
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= r * r) {
        // eslint-disable-next-line no-alert
        alert(node.memory.text);
        return;
      }
    }
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nodes = nodesRef.current;
    let next: string | null = null;
    for (const node of nodes) {
      const conf = Math.max(0, Math.min(1, node.memory.confidence ?? 0));
      const r = 6 + conf * 12;
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= r * r) {
        next = node.id;
        break;
      }
    }
    if (next !== hovered) setHovered(next);
  }

  // Empty state: memorias sin embeddings no generan grafo.
  if (embedded.length === 0) {
    return createPortal(
      <div style={overlayStyle} role="dialog" aria-label="Grafo de memorias">
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>
              Grafo de memorias
            </h3>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={closeBtnStyle}>
              ×
            </button>
          </div>
          <div
            style={{
              height: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              color: "#5a5a72",
              fontSize: 13,
              background: "#0f0f1a",
              borderRadius: 12,
            }}
          >
            No hay memorias con embeddings suficientes para construir el grafo.
            <br />
            Las memorias se embeben en segundo plano; volvé a intentarlo más tarde.
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-label="Grafo de memorias">
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>
            Grafo de memorias
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={closeBtnStyle}>
            ×
          </button>
        </div>
        <div style={{ position: "relative", width: "100%" }}>
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "block",
              width: "100%",
              height: 400,
              borderRadius: 12,
              cursor: hovered ? "pointer" : "default",
              background: "#0f0f1a",
              touchAction: "manipulation",
            }}
          />
          {/* Legend — pequeña superposición con los colores por MemoryKind. */}
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              background: "rgba(15,15,26,0.78)",
              padding: "8px 10px",
              borderRadius: 8,
              display: "grid",
              gridTemplateColumns: "auto auto",
              gap: "2px 8px",
              fontSize: 10,
              color: "#e5e7eb",
              pointerEvents: "none",
              maxWidth: 150,
            }}
          >
            {Object.entries(KIND_COLORS).map(([kind, color]) => (
              <div key={kind} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                <span>{kind}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ margin: "8px 4px 0", fontSize: 11, color: "#5a5a72" }}>
          {embedded.length} memorias · {edgesRef.current.length} conexiones (similitud &gt; {EDGE_THRESHOLD}) · tocá un nodo para ver el texto.
        </p>
      </div>
    </div>,
    document.body,
  );
}

// ───────── Estilos en línea del modal ─────────
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 260,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(420px, 100%)",
  background: "#fff",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 4px",
};

const closeBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 24,
  lineHeight: 1,
  color: "#5a5a72",
  cursor: "pointer",
  padding: "0 4px",
};
