// Koru Quality Test Suite v2 — 150 escenarios conversacionales realistas
// Estilo: como habla una persona real (vago, sin acentos, sin comillas, multi-turno)
// Criterios: intent detection + calidad de contenido + memoria proactiva

import { writeFileSync } from "node:fs";

const URL = "https://koru-mvp.onrender.com";

async function callKoru(input, state, history = []) {
  const start = Date.now();
  try {
    const res = await fetch(`${URL}/api/koru/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input, history,
        state: state || { userName: "Test", records: [], commitments: [], memories: [] },
        model: "nvidia/nemotron-3-ultra-550b-a55b",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const objs = [];
    for (const line of lines) { try { objs.push(JSON.parse(line)); } catch (e) {} }
    if (objs.length === 0) return { ok: false, elapsed, error: "empty" };
    // Buscar el ÚLTIMO chunk que tiene stateEvents con "done" (respuesta final)
    let finalJson = objs[objs.length - 1];
    for (let i = objs.length - 1; i >= 0; i--) {
      if (objs[i].stateEvents?.some(e => e.kind === "done")) {
        finalJson = objs[i];
        break;
      }
    }
    return { ok: true, elapsed, json: finalJson };
  } catch (err) {
    return { ok: false, elapsed: Date.now() - start, error: err.message };
  }
}

function judge(reply, blocks, tools, memories, commitments, input) {
  const issues = [];
  const r = (reply || "").toLowerCase();
  let quality = 10;

  // Critical issues
  if (/\b(the user|let me|i should|i need to|thinking|let's|i'll now|i will now)\b/i.test(reply)) { issues.push("THINKING_LEAK"); quality -= 5; }
  if (!reply || reply.trim().length < 3) { issues.push("EMPTY"); quality = 1; }
  if (/no pude (armar|procesar)|repetis|otra forma/i.test(reply)) { issues.push("GENERIC_ERROR"); quality -= 4; }
  if (/ya te (la|lo)|en un momento|ahora te|dejame/i.test(reply) && !/tarjeta|encontre|encontré/i.test(reply)) { issues.push("PROMISE_NO_DELIVER"); quality -= 3; }
  if (reply && reply.toLowerCase().includes(input.toLowerCase()) && reply.length < input.length + 25) { issues.push("ECHO"); quality -= 2; }

  // Quality boosters
  if (reply && reply.length > 15 && reply.length < 250 && !issues.length) quality = Math.min(10, quality + 1);
  if (blocks && blocks.length > 0) quality = Math.min(10, quality);

  return { issues, quality: Math.max(1, quality) };
}

// ═══════════════════════════════════════════════════════════════════
// 150 ESCENARIOS — conversacionales, vagos, sin acentos
// ═══════════════════════════════════════════════════════════════════

const tests = [
  // ── REMINDERS conversacionales (no "recordame X a las Y") ──
  { id: "r01", input: "el martes q viene tengo q ir al dentista a las 18" },
  { id: "r02", input: "no me olvides llamar a mi vieja mañana" },
  { id: "r03", input: "la semana q viene tengo q pagar el alquiler" },
  { id: "r04", input: "acordate q el 20 vence la tarjeta" },
  { id: "r05", input: "mañana x la mañana tengo q llevar el auto al taller" },
  { id: "r06", input: "el finde largo me toca regar las plantas de mi hermana" },
  { id: "r07", input: "no me dejes olvidar comprar el regalo de ana" },
  { id: "r08", input: "necesito q me avises el viernes x la tarde q tengo q retirar el traje" },
  { id: "r09", input: "el 15 del mes q viene se vence el seguro" },
  { id: "r10", input: "acordarme de pasar x la farmacia antes de las 8" },
  { id: "r11", input: "tengo q llamar al plomero lunes primero" },
  { id: "r12", input: "el miercoles tengo reunion con el jefe a las 10" },
  { id: "r13", input: "no me olvides de hacer el transferencia" },
  { id: "r14", input: "avisame el dia del cumple de maria" },
  { id: "r15", input: "tengo q renovar el carnet antes q venza" },

  // ── ALARMS conversacionales ──
  { id: "a01", input: "despertame temprano mañana" },
  { id: "a02", input: "necesito levantarme a las 6 el sabado" },
  { id: "a03", input: "mañana tengo q estar en el laburo a las 7" },
  { id: "a04", input: "poneme una alarma para las 5 y media" },
  { id: "a05", input: "el domingo me toca madrugar" },
  { id: "a06", input: "no me dejes dormir tarde mañana" },
  { id: "a07", input: "tengo q estar listo a las 9 el viernes" },

  // ── COUNTDOWN conversacionales ──
  { id: "c01", input: "cuanto falta para navidad" },
  { id: "c02", input: "cuantos dias para mi cumple" },
  { id: "c03", input: "el 20 del mes q viene q dia es" },
  { id: "c04", input: "cuanto falta para fin de año" },
  { id: "c05", input: "cuantos dias pasaron desde enero" },
  { id: "c06", input: "cuanto para el verano" },
  { id: "c07", input: "el 25 q dia cae" },

  // ── WEATHER conversacionales ──
  { id: "w01", input: "sale salir hoy?", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "w02", input: "que pongo?", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "w03", input: "llueve mañana?", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "w04", input: "hace frio alla", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "w05", input: "necesito campera?", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "w06", input: "paraguas o no?", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "w07", input: "esta para shorts?", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },

  // ── RECIPES conversacionales ──
  { id: "rc01", input: "tengo pollo y arroz q hago" },
  { id: "rc02", input: "algo rapido de cenar" },
  { id: "rc03", input: "tengo ganas de pasta" },
  { id: "rc04", input: "tirame algo con lo q tengo en la heladera" },
  { id: "rc05", input: "no se q cocinar hoy" },
  { id: "rc06", input: "alguna idea de cena" },
  { id: "rc07", input: "receta de brownies" },
  { id: "rc08", input: "como hago panqueques" },
  { id: "rc09", input: "tengo huevos y pan" },
  { id: "rc10", input: "algo sin horno" },
  { id: "rc11", input: "tengo carne picada q le hago" },
  { id: "rc12", input: "postre facil y rapido" },

  // ── MOVIES conversacionales (multi-turno) ──
  { id: "m01", input: "que veo hoy" },
  { id: "m02", input: "algo para el finde" },
  { id: "m03", input: "tirame una peli" },
  { id: "m04", input: "que puedo ver" },
  { id: "m05", input: "estoy aburrido" },
  { id: "m06", input: "info de inception" },
  { id: "m07", input: "quien actua en joker" },
  { id: "m08", input: "de q trata interstellar" },
  { id: "m09", input: "el padrino cuanto dura" },
  { id: "m10", input: "quien dirigio avatar" },
  { id: "m11", input: "resenha de la peli oppenheimer" },
  { id: "m12", input: "dame info de la pelicula dune" },

  // ── GAMES conversacionales ──
  { id: "g01", input: "como es elden ring" },
  { id: "g02", input: "informacion de minecraft" },
  { id: "g03", input: "tirame un juego bueno" },
  { id: "g04", input: "q juego compro" },
  { id: "g05", input: "zelda tears of the kingdom" },
  { id: "g06", input: "el cyberpunk vale la pena" },
  { id: "g07", input: "cuanto cuesta el gta" },
  { id: "g08", input: "resenha del juego red dead" },

  // ── SPORTS conversacionales ──
  { id: "s01", input: "como le fue a boca" },
  { id: "s02", input: "jugo river ayer" },
  { id: "s03", input: "el partido de españa" },
  { id: "s04", input: "como salio argentina" },
  { id: "s05", input: "gano el madrid?" },
  { id: "s06", input: "resultado de ayer" },
  { id: "s07", input: "como va la champions" },
  { id: "s08", input: "el barsa cuanto gano" },

  // ── KNOWLEDGE conversacionales ──
  { id: "k01", input: "q es la relatividad" },
  { id: "k02", input: "quien era tesla" },
  { id: "k03", input: "como funcionan los agujeros negros" },
  { id: "k04", input: "q es el blockchain" },
  { id: "k05", input: "quien invento el telefono" },
  { id: "k06", input: "q son los bitcoins" },
  { id: "k07", input: "explicame la fotosintesis" },
  { id: "k08", input: "q es la inflacion" },
  { id: "k09", input: "quien fue borges" },
  { id: "k10", input: "q es AOE2" },
  { id: "k11", input: "q es la teoria de cuerdas" },
  { id: "k12", input: "quien escribio 1984" },

  // ── RESTAURANTS conversacionales ──
  { id: "rt01", input: "donde como bien cerca", state: { userName: "Test", records: [], commitments: [], memories: [{ kind: "profile", text: "User location: Madrid", status: "confirmed" }] } },
  { id: "rt02", input: "tengo ganas de mexicano" },
  { id: "rt03", input: "un buen lugar para cenar" },
  { id: "rt04", input: "sushi en madrid" },
  { id: "rt05", input: "donde puedo comer tacos" },
  { id: "rt06", input: "parrilla buena en palermo" },
  { id: "rt07", input: "algo para comer ahora" },
  { id: "rt08", input: "tirame una pizzeria" },

  // ── CRYPTO conversacionales ──
  { id: "cr01", input: "como esta el btc" },
  { id: "cr02", input: "a cuanto esta ethereum" },
  { id: "cr03", input: "precio del bitcoin" },
  { id: "cr04", input: "el ether subio o bajo" },
  { id: "cr05", input: "como esta solana" },
  { id: "cr06", input: "cuanto vale el doge" },

  // ── SHOPPING conversacionales ──
  { id: "sh01", input: "necesito auriculares nuevos" },
  { id: "sh02", input: "que notebook compro" },
  { id: "sh03", input: "iphone vs samsung" },
  { id: "sh04", input: "donde compro mas barato airpods" },
  { id: "sh05", input: "que tablet me conviene" },
  { id: "sh06", input: "mejor celular del 2024" },

  // ── PLAN DAY conversacionales ──
  { id: "p01", input: "organizame el dia" },
  { id: "p02", input: "tengo muchas cosas hoy" },
  { id: "p03", input: "no se por donde empezar" },
  { id: "p04", input: "ayudame a planificar" },

  // ── MEMORY: passive capture ──
  { id: "me01", input: "me encanta el sushi" },
  { id: "me02", input: "estoy aprendiendo guitarra" },
  { id: "me03", input: "tengo un gato q se llama michi" },
  { id: "me04", input: "odio el morron" },
  { id: "me05", input: "mi cumple es en marzo" },
  { id: "me06", input: "estoy ahorrando para un viaje a japon" },
  { id: "me07", input: "trabajo de programador" },
  { id: "me08", input: "me gusta correr x las mañanas" },
  { id: "me09", input: "mi novia se llama laura" },
  { id: "me10", input: "estoy leyendo cien años de soledad" },
  { id: "me11", input: "tengo alergia al polen" },
  { id: "me12", input: "me copa la fotografia" },

  // ── FOLLOW-UPS multi-turno ──
  { id: "f01", input: "y de eso?", history: [{ role: "user", content: "que veo hoy" }, { role: "assistant", content: "Te recomendé algunas películas" }] },
  { id: "f02", input: "de suspenso nada mas", history: [{ role: "user", content: "que veo hoy" }, { role: "assistant", content: "¿Qué género te pega?" }] },
  { id: "f03", input: "otra", history: [{ role: "user", content: "una peli" }, { role: "assistant", content: "Te recomendé Inception" }] },
  { id: "f04", input: "q es eso", history: [{ role: "user", content: "que veo" }, { role: "assistant", content: "Te recomendé algo" }] },
  { id: "f05", input: "no me gusta", history: [{ role: "user", content: "tirame una peli" }, { role: "assistant", content: "Te recomendé Saw" }] },
  { id: "f06", input: "mas barato", history: [{ role: "user", content: "auriculares" }, { role: "assistant", content: "Te recomendé Sony" }] },
  { id: "f07", input: "y el otro?", history: [{ role: "user", content: "como salio boca" }, { role: "assistant", content: "Boca ganó 2-1" }] },
  { id: "f08", input: "gracias" },
  { id: "f09", input: "q groso" },
  { id: "f10", input: "no entendi", history: [{ role: "user", content: "q es blockchain" }, { role: "assistant", content: "explicación..." }] },
  { id: "f11", input: "decime otra", history: [{ role: "user", content: "una receta" }, { role: "assistant", content: "Te dejé una receta" }] },
  { id: "f12", input: "mas info", history: [{ role: "user", content: "como salio argentina" }, { role: "assistant", content: "Argentina ganó 3-1" }] },
];

// ═══════════════════════════════════════════════════════════════════
// PROACTIVE MEMORY TESTS — decir algo personal, luego preguntar algo no relacionado
// ═══════════════════════════════════════════════════════════════════

const proactiveTests = [
  { id: "pro01", memory: { kind: "preference", text: "Le encanta el helado." }, input: "que calor", expect: "helado" },
  { id: "pro02", memory: { kind: "routine", text: "Aprende guitarra." }, input: "que hago este finde", expect: "guitarra" },
  { id: "pro03", memory: { kind: "profile", text: "Tiene un gato." }, input: "que regalo le doy a mi novia", expect: "gato|mascota" },
  { id: "pro04", memory: { kind: "preference", text: "Es celíaca." }, input: "tirame una receta", expect: "celiaco|sin gluten|sin tacc" },
  { id: "pro05", memory: { kind: "preference", text: "Le interesa la IA." }, input: "que estudio", expect: "ia|inteligencia artificial" },
  { id: "pro06", memory: { kind: "preference", text: "Odia el morrón." }, input: "receta de pizza", expect: "morron|morrón|sin morron" },
  { id: "pro07", memory: { kind: "goal", text: "Ahorra para ir a Japón." }, input: "que hago con mi sueldo", expect: "japon|japón|ahorro|viaje" },
  { id: "pro08", memory: { kind: "routine", text: "Le gusta correr por las mañanas." }, input: "que tal el dia", expect: "correr|mañana|running" },
  { id: "pro09", memory: { kind: "preference", text: "Le encanta el sushi." }, input: "tengo hambre", expect: "sushi|japones|asiatico" },
  { id: "pro10", memory: { kind: "goal", text: "Quiere bajar de peso." }, input: "que como hoy", expect: "peso|dieta|saludable|calorias" },
  { id: "pro11", memory: { kind: "preference", text: "Le gusta el rock." }, input: "tirame musica para escuchar", expect: "rock|música|tema" },
  { id: "pro12", memory: { kind: "relationship", text: "Su madre se llama Ana." }, input: "ideas para el dia de la madre", expect: "ana|madre|mama" },
];

// ═══════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════

const START = parseInt(process.argv[2] || "0", 10);
const COUNT = parseInt(process.argv[3] || "8", 10);

console.log(`▶ Koru Quality Suite v2 — ${tests.length} single-turn + ${proactiveTests.length} proactive\n`);

const slice = tests.slice(START, START + COUNT);
const results = [];

for (const t of slice) {
  process.stdout.write(`▶ ${t.id.padEnd(6)} `);
  const r = await callKoru(t.input, t.state, t.history || []);

  if (!r.ok) {
    console.log(`✗ ${r.elapsed}ms ${r.error}`);
    results.push({ id: t.id, ok: false, error: r.error, input: t.input });
    continue;
  }

  const { json, elapsed } = r;
  const reply = json.reply || "";
  const blocks = json.uiBlocks || [];
  const tools = json.toolResults || [];
  const memories = json.memoryCandidates || [];
  const commitments = json.commitments || [];
  const blockTypes = blocks.map(b => b.type);
  const toolTypes = tools.map(t => t.tool);

  const j = judge(reply, blocks, tools, memories, commitments, t.input);
  const mark = j.quality >= 8 ? "✓" : j.quality >= 5 ? "~" : "✗";

  console.log(`${mark} ${elapsed}ms Q=${j.quality} tools=[${toolTypes.join(",")}] blocks=[${blockTypes.join(",")}] mem=${memories.length} commits=${commitments.length}`);
  console.log(`   reply: ${reply.slice(0, 140)}`);
  if (j.issues.length) console.log(`   issues: ${j.issues.join(", ")}`);
  if (memories.length) console.log(`   mem: ${memories.map(m => `[${m.kind}] ${m.text?.slice(0, 50)}`).join(" | ")}`);

  results.push({ id: t.id, ok: true, elapsed, input: t.input, reply, quality: j.quality, issues: j.issues, tools: toolTypes, blocks: blockTypes, memories: memories.length, commitments: commitments.length });
  await new Promise(r => setTimeout(r, 500));
}

// Si es el último batch, correr proactive tests
if (START + COUNT >= tests.length) {
  console.log(`\n▶ PROACTIVE MEMORY TESTS (${proactiveTests.length})\n`);
  for (const t of proactiveTests) {
    process.stdout.write(`▶ ${t.id.padEnd(6)} `);
    const r = await callKoru(t.input, {
      userName: "Test", records: [], commitments: [],
      memories: [{ ...t.memory, status: "confirmed" }],
    });
    if (!r.ok) {
      console.log(`✗ ${r.error}`);
      continue;
    }
    const reply = (r.json.reply || "").toLowerCase();
    const expects = t.expect.toLowerCase().split("|");
    const found = expects.some(e => reply.includes(e));
    const mark = found ? "✓" : "✗";
    console.log(`${mark} Q=${found ? 10 : 4} expect="${t.expect}"`);
    console.log(`   reply: ${r.json.reply.slice(0, 160)}`);
    results.push({ id: t.id, ok: true, input: t.input, reply: r.json.reply, proactive: found, expect: t.expect, quality: found ? 10 : 4 });
    await new Promise(r => setTimeout(r, 500));
  }
}

// Summary
const total = results.filter(r => r.ok).length;
const highQ = results.filter(r => r.quality >= 8).length;
const medQ = results.filter(r => r.quality >= 5 && r.quality < 8).length;
const lowQ = results.filter(r => r.quality < 5).length;
console.log(`\n📊 SUMMARY: ${total} ok, ${highQ} high-Q (8-10), ${medQ} medium (5-7), ${lowQ} low (<5)`);

writeFileSync(`/home/z/my-project/tool-results/quality-v2-${START}-${START + COUNT - 1}.json`, JSON.stringify(results, null, 2));
