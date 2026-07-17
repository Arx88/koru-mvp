<div align="center">

# 🌱 Koru

### _Un compañero que escucha, ordena y recuerda — con tu permiso._

**No un chatbot. Una mascota que opera tu día.**

[![Deploy](https://img.shields.io/badge/App-koru--mvp.onrender.com-black?logo=render&logoColor=white)](https://koru-mvp.onrender.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-287%20pass-22C55E?logo=vitest&logoColor=white)](https://vitest.dev/)

</div>

---

> _"Koru no se alimenta de secretos."_

Koru es una mascota virtual que vive en tu teléfono. La abrís, le hablás como a un amigo, y ella **ordena tu día**: te recuerda cosas, anota tus gastos, busca en la web, te hace un informe, te sugiere una receta con lo que tenés en la heladera, te avisa si llové, te cuenta cómo le fue a tu equipo. Y **memoriza lo que le contás** — pero solo cuando vos querés.

No es un chatbot que escupe texto. Es un operador: cuando le pedís algo, **devuelve una card visual** con los datos organizados, fuentes verificables y botones para actuar.

```
Vos:    "anotá $1500 que gasté en café y medialunas"
Koru:   "Listo, anoté los 500 pesos de café y medialunas. ¡Buen provecho!"
        ┌─────────────────────────────┐
        │ 💸 Tus Finanzas              │
        │                              │
        │  ARS 500                     │
        │  café y medialunas           │
        │                              │
        │  [Ver todos los gastos →]    │
        └─────────────────────────────┘
```

---

## ✨ ¿Qué puedo pedirle a Koru?

Acá van ejemplos **reales**, escritos como los escribiría un humano (sin tildes, vago, conversacional). Todos estos están en los tests E2E y funcionan hoy.

### 📅 Recordatorios y alarmas

```
Vos:    "el martes q viene tengo q ir al dentista a las 18"
Koru:   "Anotado. Te aviso el martes a las 17:30 así llegás tranquilo."
        → crea compromiso + recordatorio

Vos:    "no me olvides llamar a mi vieja mañana"
Vos:    "acordate q el 20 vence la tarjeta"
Vos:    "mañana x la mañana tengo q llevar el auto al taller"
Vos:    "el 15 del mes q viene se vence el seguro"
Vos:    "despertame temprano mañana"
Vos:    "necesito levantarme a las 6 el sabado"
```

### 💸 Gastos y dinero

```
Vos:    "anotá $1500 que gasté en café y medialunas"
Koru:   "Listo, anoté los 500 pesos de café y medialunas. ¡Buen provecho!"
        → card "Tus Finanzas" con ARS 500

Vos:    "gaste 23000 en super, 8900 en farmacia y 12000 en nafta"
Vos:    "anota gasto de 100 euros en supermercado"
Vos:    "pague 8 euros de farmacia hoy"

Vos:    "cuanto gaste esta semana?"
Koru:   "Esta semana gastaste 20 euros: 12 en supermercado y 8 en farmacia."
        → card "Dinero" con desglose

Vos:    "Puedo permitirme comprar una silla de 90 euros?"
Koru:   "Mirá tus gastos de los últimos 7 días..."
        → card "Decisión" con "Mi voto: Yo esperaría" + justificación
```

### 🛒 Listas y compras

```
Vos:    "necesito leche, huevos, pan y queso para el super"
Koru:   "Listo, guardé la lista: leche, huevos, pan y queso. ¡Que vaya bien la compra!"
        ┌─────────────────────────────┐
        │ 📝 Tu Lista · LISTA DE COMPRAS│
        │    Ítems: 4                   │
        │    [Ver lista →]              │
        └─────────────────────────────┘

Vos:    "necesito auriculares nuevos"
Vos:    "comparar auriculares Sony WH-1000XM5 vs Bose QC Ultra"
Vos:    "donde compro mas barato airpods"
```

### ☀️ Clima

```
Vos:    "¿qué clima hace en Madrid?"
Koru:   "En Madrid hace 34°C ahora, con máximas de 37°C y mínimas de 21°C.
        No hay probabilidad de lluvia y el viento está a 10 km/h.
        Día para ir ligero de ropa y llevar agua."
        ┌─────────────────────────────────────┐
        │ ☀️ Tu Clima · Madrid, España          │
        │                                       │
        │        34°C                           │
        │        Viento 10 km/h                 │
        │        Mín/Máx 21-37°C                │
        │        Lluvia 0%                      │
        │                                       │
        │  💧 Día para ir ligero y llevar agua   │
        └─────────────────────────────────────┘

Vos:    "sale salir hoy?"
Vos:    "paraguas o no?"
Vos:    "esta para shorts?"
```

### 🍳 Recetas y comida

```
Vos:    "tengo pollo y arroz q hago"
Koru:   "Mirá estas opciones con lo que tenés..."
        → card con recetas que matchean tus ingredientes

Vos:    "algo rapido de cenar"
Vos:    "tirame algo con lo w tengo en la heladera"
Vos:    "tengo huevos y pan"
Vos:    "algo sin horno"
Vos:    "postre facil y rapido"
```

### 🍽️ Restaurantes (DeepHungry)

```
Vos:    "mejor parrilla de Palermo"
Koru:   "Cruzé 5 fuentes y esto es lo que encontré."
        ┌─────────────────────────────────────────────┐
        │ 🍖 DeepHungry Synthesis · 5 fuentes           │
        │                                                │
        │  TOP COINCIDENCIAS                             │
        │  ⭐⭐⭐⭐  Don Julio          4/4 fuentes        │
        │  ⭐⭐      La Cabrera         2/4 fuentes        │
        │  ⭐        El Pobre Luis      1/4 fuentes        │
        │                                                │
        │  ✅ A FAVOR                                     │
        │  · Asado de tira excepcional                   │
        │  · Servicio atento y consistente               │
        │  · Entradas de nivel                           │
        │                                                │
        │  ⚠️ A CONSIDERAR                                │
        │  · Reservar 2 semanas antes                    │
        │  · Ambiente ruidoso                            │
        │  · Espera ~45 min sin reserva                  │
        │                                                │
        │  📝 SÍNTESIS                                    │
        │  "La consistencia en carne y servicio lo       │
        │   posicionan como top indiscutido. El asado    │
        │   de tira es el plato más repetido."           │
        │                                                │
        │  Fuentes: La Nación · TripAdvisor · Yelp ·     │
        │  Guía Oleo · Infobae                           │
        │                                                │
        │  [Cómo llegar] [Reservar] [share]              │
        └─────────────────────────────────────────────┘
```

Si solo encuentra 2 fuentes, **no inventa**. Te muestra una caja ámbar:

> ⚠️ Profundidad limitada — Solo crucé 2 fuentes. Para una recomendación confiable probá especificar barrio (Malasaña, Chueca) o tipo de cocina. No voy a inventar.

### ⚽ Deportes

```
Vos:    "como salio España ayer"
Koru:   "España le ganó 2-1. Te dejé el detalle en la tarjeta."
        → card LiveMatch con tabs Stats / Lineups / Timeline

Vos:    "como le fue a Boca"
Vos:    "gano el madrid?"
Vos:    "el barsa cuanto gano"
Vos:    "como va la champions"
```

### 💰 Crypto y finanzas

```
Vos:    "a cuanto esta el bitcoin"
Koru:   → card CryptoPortfolio con precio en vivo

Vos:    "como esta el btc"
Vos:    "precio del bitcoin"
Vos:    "a cuanto está el dólar"
Koru:   → card "Dato de Hoy · DÓLAR · Blue subió 1,2%"
        OFICIAL $1.185 / BLUE $1.320 / MEP $1.292
```

### 📚 Conocimiento y reseñas

```
Vos:    "que es la relatividad"
Vos:    "quien era tesla"
Vos:    "como funcionan los agujeros negros"
Vos:    "quien escribio 1984"
Vos:    "info de inception"
Vos:    "quien actua en joker"
Vos:    "de q trata interstellar"
```

### 📝 Informes profundos

```
Vos:    "quiero un informe sobre Age of Empires 2: su historia, civilizaciones
        y cómo se juega hoy"

Koru:   "¡Buenísimo! 🏰 Me pongo a investigar y te armo el informe."

        ┌─────────────────────────────────────────┐
        │ 🔍 Trabajando en tu informe...           │
        │                                          │
        │  ✓ Buscando fuentes 1/4                  │
        │    "Age of Empires 2 qué es y panorama"  │
        │  ✓ Buscando fuentes 2/4                  │
        │    "Historia del juego y expansiones"    │
        │  ✓ Buscando fuentes 3/4                  │
        │    "Noticias y actualizaciones recientes"│
        │  ✓ Buscando fuentes 4/4                  │
        │    "Civilizaciones y meta actual"        │
        │                                          │
        │  ✓ Redactando tu informe...              │
        │                                          │
        │  → 78% → 100% → Entregado                │
        └─────────────────────────────────────────┘

                          ↓ 90 segundos después

        ┌─────────────────────────────────────────┐
        │ 📄 Tu Informe                            │
        │    AGE OF EMPIRES II: HISTORIA           │
        │    El RTS clásico que sigue vivo         │
        │    25 años después                       │
        │                                          │
        │  ┌────────┬────────┬────────┐           │
        │  │  1999  │  2026  │   15   │           │
        │  │ Lanza- │ Expan- │Títulos │           │
        │  │ miento │  sión  │ S-Tier │           │
        │  └────────┴────────┴────────┘           │
        │                                          │
        │  [Ver informe completo →]                │
        └─────────────────────────────────────────┘

Koru:   "¡Listo! Tu informe sobre Age of Empires 2 está terminado.
        Lo investigué en 18 fuentes."
```

### 🧠 Memoria — el Jardín

Koru **no guarda nada sin tu permiso**. Cuando mencionás algo personal, ella te lo muestra como candidato y vos decidís:

```
Vos:    "me encanta el helado de pistacho"
Koru:   → card memoria candidata "Te encanta el helado de pistacho"
        [🌊 Regar]  [✂️ Poda]  [📋 Archivar]

Vos:    "estoy aprendiendo japonés los martes"
Vos:    "tengo un gato q se llama michi"
Vos:    "odio el morron"
Vos:    "mi cumple es en marzo"
Vos:    "estoy ahorrando para un viaje a japon"
Vos:    "trabajo de programador"
```

Después, **Koru usa esa memoria** en contextos no relacionados:

```
Vos:    "que calor"        → Koru sugiere helado (recordó pistacho)
Vos:    "que hago este finde"  → Koru sugiere practicar japonés
Vos:    "tirame una receta" → Koru excluye morrón de las opciones
Vos:    "que hago con mi sueldo" → Koru recuerda tu ahorro para Japón
Vos:    "que tal el dia"  → Koru sabe que te gusta correr por la mañana
```

### 🌍 Radar del mundo

```
Vos:    "El mundo está hablando de esto en IA, te enteraste?"
Koru:   → card "El mundo" con señales recientes
        [Seguir radar]

Koru (proactivo, luego): "Te voy a traer este radar cada mañana."
```

### 🌧️ Anti-alucinación — Koru no inventa

```
Vos:    "¿cómo le fue a River Plate en el último partido?"
Koru:   "Busqué en las noticias pero no apareció el resultado concreto
        del último partido (ni el rival ni el marcador). ¿Querés que
        intente una búsqueda más específica o preferís mirar directo
        en 365Scores / la web oficial?"

Vos:    "¿qué paso en el mundo hoy?"
Koru:   "No pude conseguir noticias frescas con las fuentes abiertas
        ahora mismo. ¿Querés que lo intente más tarde?"
```

Esto es **deliberado**. Koru prefiere decir "no sé" antes que inventar un resultado o un número.

---

## 🌅 Un día con Koru

### 8:00 — Despertar

```
Vos:    "buen día"
Koru:   "Hola. ¿Cómo va todo?"
        [mascota: happy]
```

### 10:30 — Café con medialunas

```
Vos:    "anotá $1500 que gasté en café y medialunas"
Koru:   "Listo, anoté los 500 pesos de café y medialunas. ¡Buen provecho!"
        → card "Tus Finanzas" con ARS 500
```

### 12:00 — Lista del super

```
Vos:    "necesito leche, huevos, pan y queso para el super"
Koru:   "Listo, guardé la lista: leche, huevos, pan y queso.
        ¡Que vaya bien la compra!"
        → card "Tu Lista · LISTA DE COMPRAS · Ítems: 4"
```

### 14:00 — Salida

```
Vos:    "¿qué clima hace en Madrid hoy?"
Koru:   "En Madrid hace 34°C ahora, con máximas de 37°C y mínimas de 21°C.
        No hay probabilidad de lluvia y el viento está a 10 km/h.
        Día para ir ligero de ropa y llevar agua."
        → card "Tu Clima · Madrid, España"
```

### 16:00 — Deportes

```
Vos:    "¿cómo le fue a River Plate en el último partido?"
Koru:   "Busqué en las noticias pero no apareció el resultado concreto.
        ¿Querés que intente una búsqueda más específica?"
        → (no inventa resultado — anti-alucinación)
```

### 18:00 — Informe profundo

```
Vos:    "quiero un informe sobre Age of Empires 2: su historia,
        civilizaciones y cómo se juega hoy"

Koru:   "¡Buenísimo! 🏰 Me pongo a investigar y te armo el informe."
        → WorkingPanel con 4 fases de búsqueda
        → (90 segundos después)
        → card "Tu Informe · AGE OF EMPIRES II: HISTORIA"

Koru:   "¡Listo! Tu informe está terminado. Lo investigué en 18 fuentes."
```

### 20:00 — Cena

```
Vos:    "¿qué puedo cenar esta noche?"
Koru:   "¿En qué barrio o ciudad estás? Así te busco opciones cerca."
Vos:    "estoy en Palermo, Buenos Aires"
Koru:   → card RestaurantSynthesis con top coincidencias
```

### 23:00 — Cierre del día

```
Vos:    "anotá que hoy fue un buen día"
Koru:   "Listo, guardado. Qué lindo que haya sido un buen día 🌿"
        [mascota: affectionate]
        → card "Guardado en · GUARDADO · Hoy fue un buen día"
```

### Resultado al final del día

- **2 recuerdos** sembrados (tu nombre, "hoy fue un buen día")
- **5 colecciones** (gastos, lista de compras, compromisos, memorias, registros)
- **0 alucinaciones** — todo lo que no sabía, lo dijo

---

## 💜 La personalidad de Koru

Koru tiene un **tono calibrado**: cálido pero directriz, con humor tímido. Voseo rioplatense. Frases cortas. Cero jerga.

### Lo que Koru **sí** dice

| Situación | Frase típica |
|---|---|
| Loading | "Lo estoy oliendo…" |
| Guardado | "Listo, guardado en {colección}." |
| Error | "Se nubló el dato — no te muestro números viejos como si fueran de ahora" |
| Vacío | "Todavía no sembraste nada" |
| Idle | "Koru se durmió un rato — despertalo con un hola" |
| Cansancio del usuario | "Te entiendo. Si querés, bajo el ritmo y ordenamos lo mínimo indispensable para hoy." |
| Cumpleaños | "¡Feliz cumple! 🌿" |
| Saludo | "Hola. ¿Cómo va todo?" |

### Lo que Koru **nunca** dice

> "Te extrañe" / "No me abandones" / "Soy la única persona que te entiende" / "Si no vuelves me marchito" / "Siempre estaré aquí para ti" / "Yo sé lo que necesitas mejor que tú"

Koru no es **dependiente**. No es **empalagosa**. No te convierte todo en plan. Respeta tu estado emocional.

### Las 4 personas que evaluamos

Koru se prueba contra 4 perfiles reales con voces distintas:

| | Persona | Voz | Cómo la usa |
|---|---|---|---|
| 🎨 | **Camila** (23) — diseñadora freelance, ansiedad social | warmth 8, humor 4, proactivity 6 | "Estoy agotada. ¿Qué me recomendás para bajar la ansiedad?" |
| 💼 | **Martín** (34) — PM en startup, padre primerizo | warmth 5, directness 9, proactivity 9 | "Hoy tengo 4 reuniones. Armame el día como un campamento militar." |
| 📚 | **Laura** (47) — docente, 2 hijos adolescentes | warmth 6, directness 7, detail 6 | "Los chicos están raros, Juani no quiere estudiar. ¿Qué hago?" |
| 🌿 | **Roberto** (61) — jubilado, viudo | warmth 9, humor 5, detail 5 | "Me siento un poco solo. Contame algo lindo." |

Cada uno recibe respuestas con **tono ajustado a su voz**.

---

## 🎭 Los 16 estados de la mascota

Koru se renderiza como una mascota animada que refleja lo que está pasando:

| Estado | Cuándo lo ves |
|---|---|
| 🌿 `idle` | Esperando que le hables |
| 🤔 `thinking` | Procesando tu mensaje |
| ⚙️ `working` | Ejecutando una tool (clima, búsqueda, etc.) |
| 😊 `happy` | Respuesta exitosa / "Hola" |
| 😴 `sleeping` | Inactividad prolongada |
| 😬 `mistake` | Algo falló |
| 📋 `planning` | Generando un plan |
| 🔍 `product-search` | Buscando productos |
| 🏗️ `building` | Construyendo algo complejo (informe) |
| 🍳 `cooking` | Modo cocina activo |
| 🎉 `celebrating` | Logro desbloqueado |
| 😟 `worried` | Detectó algo sensible ("estoy cansado") |
| 🥰 `affectionate` | Tono cálido activado |
| 🧐 `curious` | Te va a preguntar algo |
| 🥱 `tired` | Muchos turnos seguidos |
| 💭 `thinking-2` | Reflexión profunda |

---

## 🧠 El Jardín de la Memoria

La memoria de Koru es **confirmable, no absorbente**. No como otros asistentes que absorben todo sin pedir permiso.

### Cómo funciona

```
1. Vos mencionás algo personal
   "estoy aprendiendo japonés los martes"

2. Koru lo propone como candidato
   ┌──────────────────────────────────────┐
   │ 🌱 Memoria candidata                  │
   │                                       │
   │  "Estás aprendiendo japonés los       │
   │   martes"                             │
   │                                       │
   │  [🌊 Regar]  [✂️ Poda]  [📋 Archivar] │
   └──────────────────────────────────────┘

3. Vos decidís
   🌊 Regar  →  se confirma y entra a tu jardín
   ✂️ Poda   →  se descarta para siempre
   📋 Archivar  →  se guarda pero no se usa en sugerencias

4. Koru la usa después, en contexto no relacionado
   Vos: "que hago este finde?"
   Koru: "... ¿quizás practicar japonés? Sé que los martes es tu día."
```

### Las 5 etapas del jardín

Tu relación con Koru crece con la confianza:

```
seed → sprout → roots → born → garden
 └──────└────────└────────└───────┘
   recién      confianza      compañero
   empezando   construida      total
```

Cuantas más memorias confirmás, más crece el jardín. Koru no te pide todo de entrada — te lo pregunta cuando es relevante.

---

## 🛡️ Lo que Koru NO hace sin tu permiso

Koru tiene **boundaries explícitas**. Cada tool declara su nivel de riesgo:

| Tool | Riesgo | Requiere aprobación |
|---|---|---|
| `weather_forecast` | low | ❌ auto |
| `crypto_price` | low | ❌ auto |
| `recipe_find` | low | ❌ auto |
| `expense_track` | medium | ❌ auto (anota) |
| `reminder_set` | medium | ❌ auto |
| `alarm_set` | medium | ❌ auto |
| `email_draft` | high | ✅ SÍ |
| `message_draft` | high | ✅ SÍ |
| `doc_create_pdf` | medium | ✅ SÍ |
| `image_generate` | medium | ✅ SÍ |

Y **siempre** te explica qué no hizo y por qué:

```
Vos:    "mandale un mensaje a mi jefe que me voy a casa"
Koru:   "Te armé el borrador del mensaje. Antes de enviarlo
        necesito que lo apruebes — no envío mensajes en tu
        nombre sin tu visto bueno."
        → card MessageDraft + botón [Aprobar y enviar]
```

---

## ✨ El "+1" — Enhancement Engine

Después de cada respuesta, Koru propone **una** acción contextual como botón clickeable. No te inunda con opciones. Solo una, la más relevante.

```
Vos:    "anota que gasté 18 euros en farmacia"
Koru:   "Guardado: 18 EUR en farmacia."

        ┌─────────────────────────────────────────┐
        │ 💡 Como fue farmacia, ¿quieres que deje  │
        │    una alarma para tomar algo, reponerlo │
        │    o seguir el tratamiento?              │
        │                                          │
        │  [Crear recordatorio]                    │
        └─────────────────────────────────────────┘
```

```
Vos:    "estoy quemado, no puedo con todo"
Koru:   "Te creo. Hoy no hace falta convertir todo en una montaña."

        ┌─────────────────────────────────────────┐
        │ 💡 ¿Querés que sugiera pausas?            │
        │                                          │
        │  [Sugerir pausas]                        │
        └─────────────────────────────────────────┘
```

Si aceptás, Koru ejecuta la acción. Si la rechazás, **aprende** y no te lo vuelve a proponer con esa frecuencia.

---

## 📴 Offline-first

Koru funciona **sin internet** para lo básico:

- ✅ Ver tus gastos, listas, memorias y compromisos guardados
- ✅ Crear nuevas notas, gastos, recordatorios (se encolan)
- ✅ Ver el historial completo de turnos
- ✅ Onboarding y ajustes

Cuando recuperás conexión, **Koru replay** automáticamente todo lo que hiciste offline:

```
[Offline] "anota 25 euros de farmacia"     → se encola
[Offline] "mañana llamar a Ana"            → se encola
[Online]  → se envían en orden, se confirmen una por una
```

El cache de respuestas del LLM dura 24 horas en IndexedDB.

---

## 🌐 Idiomas

Koru habla **español** e **inglés**, y detecta automáticamente cuál estás usando:

```
Vos:    "good morning, how are you?"
Koru:   "Hey! I'm doing good. What's up?"

Vos:    "buenas, como andás?"
Koru:   "Buenas. Todo tranqui por acá. ¿Vos?"
```

Podés forzar el idioma en Ajustes si querés.

---

## 📱 Instalación

### Como PWA (recomendado)

1. Abrí https://koru-mvp.onrender.com en tu móvil (Chrome / Safari)
2. Menú → **"Agregar a pantalla de inicio"**
3. Ícono de Koru aparece en tu home
4. Abrilo → pantalla completa, sin barra del navegador

### Como APK Android

(Todavía no hay APK firmado en el repo — está planeado para la Fase 2.)

---

## 🚀 Empezar a usarlo

### Opción A: Usar la demo pública

Andá a https://koru-mvp.onrender.com, hacé el onboarding (3 pantallas), y empezá a hablarle.

### Opción B: Correrlo local

```bash
git clone https://github.com/Arx88/koru-mvp.git
cd koru-mvp
npm install
cp .env.example .env
# Editar .env con al menos 1 API key (NVIDIA_API_KEY recomendado)
npm run dev
# → http://localhost:5173
```

**API keys soportadas** (necesitás al menos una):
- `NVIDIA_API_KEY` (recomendado — Nemotron-3-Ultra gratis)
- `OPENROUTER_API_KEY` (fallback con 3 modelos gratis)
- `MINIMAX_ACCESS_TOKEN` (opcional)
- `OLLAMA_EMBED_BASE_URL` (si querés Semantic Router local con Ollama)

---

## 🎨 Galería de cards

Koru tiene **56 tipos de cards visuales** organizadas en 13 dominios. Algunas de las más usadas:

### ☀️ WeatherCard
Ciudad · temperatura actual · min/max · viento · probabilidad de lluvia · advice ("Día para salir ligero")

### 🍖 RestaurantSynthesisCard (DeepHungry)
Top coincidencias con score de fuentes · pros / cons · síntesis textual · 5 fuentes citadas · botones Cómo llegar / Reservar / share

### 📄 DeliverableCard (informes)
Kicker + título + métricas (3 datos) + secciones (texto / bullets / timeline / grid / rows) + sources

### 💸 MoneySummaryCard
Total gastado en el período + desglose por categoría + tendencia

### 📋 PlanCard
Lista de tareas/actividades del día con botón "Aplicar plan"

### ⚽ LiveMatchCard
Equipos · marcador · minuto · tabs interactivas Stats / Lineups / Timeline

### 💰 CryptoPortfolioCard
Precio en vivo · variación 24h · sparkline

### 🌍 ForexCard
OFICIAL / BLUE / MEP · variación · "Ver evolución"

### 📝 ShoppingListCard
Ítems agrupados · contador · "Ver lista"

### 🧠 MemoryCard
Memoria candidata con botones Regar / Poda / Archivar

### 🎂 BirthdayCalendarCard / BirthdayAlarmCard
Calendario con cumpleaños marcados / alarma con días restantes

### 🗺️ RouteTimelineCard
Pasos numerados con direcciones + duración estimada

### 📰 ResearchSourcesCard
Lista de fuentes verificadas con icono "verified" + link al original

### 💡 DecisionSupportCard
"Mi voto" claro (Yo esperaría / Yo avanzaría / Me falta un dato) + justificación basada en tus datos

---

## 🛠️ Para desarrolladores

> Esta sección es **reference material**. Si solo querés usar Koru, no la necesitás.

### Stack

- **Frontend**: React 19 + Vite 8 + TypeScript 6 + Tailwind 4 + lucide-react
- **Estado**: `useReducer` + Context (sin Redux/Zustand)
- **Animaciones**: CSS puro + `tw-animate-css` + hooks propios (`useTapRipple`, `KoruCountUp`)
- **Backend**: Node.js 22 HTTP nativo (sin Express), bundleable con esbuild
- **Streaming**: NDJSON para feedback de progreso en cada turno
- **PWA**: Service Worker (push + background sync + offline cache 24h)
- **OCR**: Tesseract.js (en cliente, para receipts)
- **Tests**: 287 unitarios (Vitest) + 13 E2E (Playwright desktop + Pixel 7)

### Proveedores LLM con fallback

Koru prueba en este orden hasta que uno responde:

1. **MiniMax** (si está configurado) — `MiniMax-M2.7`
2. **NVIDIA Integrate** — `nvidia/nemotron-3-ultra-550b-a55b` (default)
3. **Ollama local** — `qwen3:32b` o el que tengas
4. **OpenRouter** — 3 keys × 3 modelos (rotación con `Promise.any`)

Si todo falla, te dice "Se nubló el dato" y te explica por qué en `fallbackReason`.

### Pipeline de un turno

```
1. Usuario escribe → TalkOverlay → submitEntry
2. backendAgentClient → POST /api/koru/turn (streaming NDJSON)
3. buildMessages (systemPrompt + memorias relevantes + historial)
4. SemanticRouter (Ollama nomic-embed-text) → decide tool ANTES del LLM
5. callProvider (fallback chain: MiniMax → NVIDIA → OpenRouter)
6. executeProviderToolCalls (121+ tools)
7. detectSimulatedToolCall (compat Qwen3, DeepSeek-R1 sin tool-calls nativos)
8. Segunda llamada LLM (sin tools) → componse reply JSON
9. structureExtractor → valida datos contra citas literales (anti-alucinación)
10. enhancementEngine → propone "+1" contextual
11. finalizePayload → JSON → NDJSON stream → cliente
```

### Las 121+ tools reales

Distribuidas en 14 dominios:

| Dominio | Ejemplos |
|---|---|
| Money | crypto_price, stock_quote, currency_convert, expense_track, budget_set, subscription_reminder, price_compare_product, price_history |
| Sports | match_schedule, match_live, league_standings, team_follow, player_stats, tennis_atp_wta, tournament_bracket, golf_leaderboard |
| Food | recipe_find, recipe_by_ingredients, food_info, nutrition_calc, wine_pairing, restaurant_deep_search, menu_extract |
| Travel | route_plan, flight_search, hotel_search, transport_nearby, currency_atm, language_phrase, visa_check |
| News | news_urgent, news_radar_topic, rss_digest, trending_twitter, trending_reddit, trending_youtube, trending_github |
| Tasks | task_create, task_done, reminder_set, alarm_set, countdown, note_write, project_create, calendar_add, calendar_export_ics |
| Productivity | translate, summarize_text, summarize_url, email_draft, message_draft, extract_action_items, deep_research, qr_generate |
| Documents | doc_create_md, doc_create_word, doc_create_excel, doc_create_pdf, data_analyze, data_chart, ocr_text |
| Knowledge | wikipedia_lookup, dictionary_define, math_calc, unit_convert, slang_translate, memory_save, memory_search, memory_garden_show |
| Health | medication_reminder, hydration_remind, sleep_track, mood_track, habit_streak, air_quality_advice |
| People/Media | person_info, movie_info, book_info, game_info, image_generate |
| Apps | app_deals, app_recommend, game_deals, game_recommend |
| Weather | weather_forecast (open-meteo) |
| Calendar | googleCalendar (OAuth flow) |

### Deploy (5 opciones)

| Target | Comando |
|---|---|
| **Vercel + Render** | Frontend en Vercel, backend en Render (`vercel.json` ya rewrites `/api/*`) |
| **Railway** | `railway up` (config en `railway.toml`, nixpacks builder) |
| **Fly.io** | `fly deploy` (config en `fly.toml`, 1 CPU / 1 GB RAM / iad) |
| **Docker** | `docker build -t koru-mvp . && docker run -p 3000:3000 ...` |
| **Local prod** | `npm run build && npx esbuild ... && node server-bundle.mjs` |

### Tests

```bash
npm test              # 287 unitarios (Vitest)
npx playwright test   # 13 E2E (Playwright desktop + Pixel 7)
```

---

## 📊 Estado del proyecto

| Métrica | Valor |
|---|---|
| **Líneas de código** | ~64.000 (TS/TSX) |
| **Tests pasando** | 287 unitarios + 13 E2E = 300 |
| **Cards Tier-S** | 56 variantes |
| **Tools reales** | 121+ |
| **Proveedores LLM** | 5 (NVIDIA, OpenRouter, MiniMax, Ollama, BlueSminds) |
| **Commits en main** | 454 |
| **Edad del proyecto** | 28 días (19 jun → 17 jul 2026) |
| **Deploy targets** | 5 (Vercel+Render, Railway, Fly, Docker, local) |
| **Idiomas** | 2 (es, en) |
| **Estados de mascota** | 16 |

---

## 🛣️ Roadmap

| Fase | Estado | Highlight |
|---|---|---|
| **F1** MVP estabilizado | ✅ Done | 287 tests · 56 cards · 121 tools · 5 LLM providers |
| **F2** Personalización | 🚧 Plan | Voice preferences ajustables · APK Android firmado |
| **F3** Proactividad avanzada | 📋 Plan | Heartbeat con nudges contextuales (clima, tráfico, medicación, resultados) |
| **F4** Multi-dispositivo | 📋 Plan | Sync opcional cifrada entre dispositivos |
| **F5** Koru-Qwen 27B local | 📋 Plan | Fine-tuning propio · 100% offline · pipeline en `finetune/` |

---

## 💜 Filosofía

> _"Se siente como un compañero. Funciona como un operador. Respeta como un amigo."_

5 principios no negociables:

1. **Memoria confirmable.** Vos sos el único dueño de tu memoria. Koru propone, vos decidís.
2. **Boundaries explícitas.** Koru nunca hace algo sensible sin aprobación. Y siempre explica qué no hizo y por qué.
3. **Anti-alucinación estructural.** Todo dato en una respuesta debe tener una cita literal verificable. Si no la tiene, no se incluye.
4. **Enhancement "+1".** Koru no solo responde — propone la próxima acción relevante como botón clickeable. Vos decidís si la ejecutás.
5. **Personalidad calibrada.** Cálido pero directriz. No empalagoso. No convierte todo a plan. Respeta tu estado emocional.

---

## 📜 Licencia

Uso privado. Código propiedad de Arx88.

Las skills en `skills/` son catálogo del **z-ai-web-dev-sdk** y mantienen sus propias licencias (propietarias Z.AI o MIT según el caso).

---

<div align="center">

**Abrí Koru y contale algo. Ella escucha, ordena y recuerda — con tu permiso.**

[🌱 Usar Koru →](https://koru-mvp.onrender.com) · [🐛 Reportar bug](https://github.com/Arx88/koru-mvp/issues)

</div>
