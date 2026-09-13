import type { MichiSchoolProgress } from "./types";

export type MichiSchoolQuestion = {
  id: string;
  grade: number;
  category: string;
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
  fact: string;
};

export const SCHOOL_QUESTIONS_PER_GRADE = 10;
export const SCHOOL_XP_PER_ANSWER = 10;
export const SCHOOL_MAX_GRADE = 3;

export const MICHI_SCHOOL_QUESTIONS: MichiSchoolQuestion[] = [
  { id: "g1-jupiter", grade: 1, category: "Cultura general", question: "¿Cuál es el planeta más grande del sistema solar?", options: ["Tierra", "Marte", "Júpiter", "Saturno"], answer: 2, explanation: "Júpiter es el planeta más grande del sistema solar y tiene más del doble de masa que todos los demás planetas juntos.", fact: "En Júpiter cabrían más de 1.300 planetas del tamaño de la Tierra." },
  { id: "g1-pacifico", grade: 1, category: "Geografía", question: "¿Cuál es el océano más grande del planeta?", options: ["Atlántico", "Índico", "Pacífico", "Ártico"], answer: 2, explanation: "El océano Pacífico ocupa cerca de un tercio de la superficie terrestre.", fact: "Su nombre se lo dio Fernando de Magallanes porque encontró sus aguas tranquilas." },
  { id: "g1-fotosintesis", grade: 1, category: "Naturaleza", question: "¿Qué necesitan las plantas para hacer la fotosíntesis?", options: ["Luz", "Arena", "Sal", "Viento"], answer: 0, explanation: "Las plantas usan la energía de la luz para transformar agua y dióxido de carbono en alimento.", fact: "La clorofila es el pigmento que les permite captar la luz y les da su color verde." },
  { id: "g1-continentes", grade: 1, category: "Geografía", question: "¿Cuántos continentes se enseñan habitualmente en el modelo de siete continentes?", options: ["Cinco", "Seis", "Siete", "Ocho"], answer: 2, explanation: "Ese modelo distingue África, Antártida, Asia, Europa, América del Norte, América del Sur y Oceanía.", fact: "En algunos países se usa un modelo de seis continentes que considera América como uno solo." },
  { id: "g1-mamifero", grade: 1, category: "Animales", question: "¿Cuál de estos animales es un mamífero?", options: ["Pulpo", "Delfín", "Tiburón", "Pingüino"], answer: 1, explanation: "El delfín respira aire, es de sangre caliente y alimenta a sus crías con leche.", fact: "Los delfines duermen con una mitad del cerebro activa para poder seguir respirando." },
  { id: "g1-agua", grade: 1, category: "Ciencia", question: "¿A qué temperatura se congela el agua pura al nivel del mar?", options: ["0 °C", "10 °C", "32 °C", "100 °C"], answer: 0, explanation: "En la escala Celsius, el agua pura se congela a 0 °C bajo presión atmosférica normal.", fact: "El hielo flota porque al congelarse el agua se vuelve menos densa." },
  { id: "g1-autor", grade: 1, category: "Literatura", question: "¿Quién escribió Don Quijote de la Mancha?", options: ["Federico García Lorca", "Miguel de Cervantes", "Pablo Neruda", "Jorge Luis Borges"], answer: 1, explanation: "Miguel de Cervantes publicó la primera parte de Don Quijote en 1605.", fact: "La obra es uno de los libros más traducidos de la historia." },
  { id: "g1-corazon", grade: 1, category: "Cuerpo humano", question: "¿Qué órgano impulsa la sangre por el cuerpo?", options: ["Pulmón", "Hígado", "Corazón", "Estómago"], answer: 2, explanation: "El corazón funciona como una bomba que mantiene la sangre circulando.", fact: "Un corazón adulto late alrededor de 100.000 veces por día." },
  { id: "g1-rojo", grade: 1, category: "Arte", question: "¿Qué color se obtiene al mezclar azul y amarillo?", options: ["Verde", "Naranja", "Violeta", "Rojo"], answer: 0, explanation: "En la mezcla tradicional de pigmentos, azul y amarillo forman verde.", fact: "En pantallas se usa otro modelo de color, llamado RGB." },
  { id: "g1-luna", grade: 1, category: "Espacio", question: "¿Cómo se llama el satélite natural de la Tierra?", options: ["Titán", "Europa", "Fobos", "Luna"], answer: 3, explanation: "La Luna es el único satélite natural permanente de la Tierra.", fact: "La luz tarda aproximadamente 1,3 segundos en viajar de la Luna a la Tierra." },

  { id: "g2-atmosfera", grade: 2, category: "Ciencia", question: "¿Qué gas es el más abundante en la atmósfera terrestre?", options: ["Oxígeno", "Nitrógeno", "Dióxido de carbono", "Hidrógeno"], answer: 1, explanation: "El nitrógeno representa cerca del 78 % de la atmósfera terrestre.", fact: "El oxígeno ocupa aproximadamente el 21 %; el resto son gases presentes en cantidades mucho menores." },
  { id: "g2-capital-australia", grade: 2, category: "Geografía", question: "¿Cuál es la capital de Australia?", options: ["Sídney", "Melbourne", "Canberra", "Perth"], answer: 2, explanation: "Canberra fue elegida como capital y se encuentra entre Sídney y Melbourne.", fact: "La ciudad fue planificada a partir de un concurso internacional de diseño." },
  { id: "g2-sangre", grade: 2, category: "Cuerpo humano", question: "¿Qué células transportan principalmente el oxígeno?", options: ["Glóbulos rojos", "Neuronas", "Plaquetas", "Glóbulos blancos"], answer: 0, explanation: "Los glóbulos rojos contienen hemoglobina, una proteína que se une al oxígeno.", fact: "Un glóbulo rojo tarda cerca de un minuto en recorrer todo el sistema circulatorio." },
  { id: "g2-renacimiento", grade: 2, category: "Historia", question: "¿En qué país europeo comenzó el Renacimiento?", options: ["Francia", "Italia", "Alemania", "Portugal"], answer: 1, explanation: "El Renacimiento surgió en ciudades italianas como Florencia y luego se expandió por Europa.", fact: "Florencia fue un centro clave gracias al comercio y al mecenazgo artístico." },
  { id: "g2-luz", grade: 2, category: "Física", question: "¿Qué viaja más rápido en el vacío?", options: ["El sonido", "La luz", "El viento", "Una onda del mar"], answer: 1, explanation: "La luz se propaga en el vacío a unos 300.000 kilómetros por segundo.", fact: "La luz del Sol tarda alrededor de ocho minutos y veinte segundos en llegar a la Tierra." },
  { id: "g2-adn", grade: 2, category: "Biología", question: "¿Dónde se guarda la mayor parte del ADN de una célula humana?", options: ["En el núcleo", "En la membrana", "En el citoplasma", "En los ribosomas"], answer: 0, explanation: "La mayor parte del ADN se organiza en cromosomas dentro del núcleo celular.", fact: "Si se estirara, el ADN de una sola célula humana mediría cerca de dos metros." },
  { id: "g2-primo", grade: 2, category: "Matemática", question: "¿Cuál de estos números es primo?", options: ["21", "29", "35", "39"], answer: 1, explanation: "29 solo puede dividirse exactamente por 1 y por sí mismo.", fact: "Los números primos son piezas fundamentales para la criptografía moderna." },
  { id: "g2-amazonas", grade: 2, category: "Naturaleza", question: "¿Qué selva tropical es la más extensa del mundo?", options: ["Congo", "Daintree", "Amazonas", "Sundarbans"], answer: 2, explanation: "La selva amazónica se extiende por varios países de América del Sur.", fact: "Brasil contiene la mayor parte de la Amazonia, pero no es el único país que la comparte." },
  { id: "g2-beethoven", grade: 2, category: "Música", question: "¿Quién compuso la Novena Sinfonía?", options: ["Mozart", "Beethoven", "Vivaldi", "Chopin"], answer: 1, explanation: "Ludwig van Beethoven estrenó su Novena Sinfonía en Viena en 1824.", fact: "Su último movimiento incluye la célebre Oda a la alegría." },
  { id: "g2-volcan", grade: 2, category: "Tierra", question: "¿Cómo se llama la roca fundida cuando está bajo la superficie terrestre?", options: ["Lava", "Magma", "Basalto", "Granito"], answer: 1, explanation: "Bajo la superficie se llama magma; cuando sale al exterior recibe el nombre de lava.", fact: "El magma también contiene cristales y gases disueltos." },

  { id: "g3-mitocondria", grade: 3, category: "Biología", question: "¿Qué orgánulo produce la mayor parte de la energía utilizable de una célula?", options: ["Lisosoma", "Mitocondria", "Ribosoma", "Aparato de Golgi"], answer: 1, explanation: "Las mitocondrias convierten la energía de los nutrientes en ATP mediante la respiración celular.", fact: "Las mitocondrias tienen su propio ADN, distinto del ADN del núcleo." },
  { id: "g3-machu", grade: 3, category: "Historia", question: "¿Qué civilización construyó Machu Picchu?", options: ["Maya", "Azteca", "Inca", "Olmeca"], answer: 2, explanation: "Machu Picchu fue una ciudad inca construida en los Andes durante el siglo XV.", fact: "El sitio se encuentra a unos 2.430 metros sobre el nivel del mar." },
  { id: "g3-elemento", grade: 3, category: "Química", question: "¿Qué elemento químico tiene el símbolo Fe?", options: ["Flúor", "Fermio", "Hierro", "Francio"], answer: 2, explanation: "Fe es el símbolo del hierro y proviene de su nombre en latín, ferrum.", fact: "El hierro es el principal elemento del núcleo terrestre." },
  { id: "g3-inercia", grade: 3, category: "Física", question: "¿Qué ley explica que un objeto mantenga su movimiento si no actúa una fuerza neta?", options: ["Primera ley de Newton", "Ley de Ohm", "Ley de Hooke", "Principio de Arquímedes"], answer: 0, explanation: "La primera ley de Newton, o ley de inercia, describe ese comportamiento.", fact: "La inercia depende de la masa: cuanto mayor es la masa, más cuesta cambiar el movimiento." },
  { id: "g3-celcius", grade: 3, category: "Ciencia", question: "¿A cuántos grados Celsius hierve el agua al nivel del mar?", options: ["80 °C", "90 °C", "100 °C", "120 °C"], answer: 2, explanation: "A presión atmosférica estándar, el agua hierve a 100 °C.", fact: "En lugares altos hierve a menor temperatura porque la presión atmosférica es menor." },
  { id: "g3-antartida", grade: 3, category: "Geografía", question: "¿Cuál es el continente más seco?", options: ["África", "Australia", "Antártida", "Asia"], answer: 2, explanation: "La Antártida recibe tan poca precipitación que se considera un desierto polar.", fact: "También es el continente más frío y ventoso." },
  { id: "g3-decimal", grade: 3, category: "Matemática", question: "¿Qué fracción equivale a 0,75?", options: ["1/2", "2/3", "3/4", "4/5"], answer: 2, explanation: "0,75 son 75 centésimos, que se simplifican a 3/4.", fact: "Convertir decimales a fracciones ayuda a comparar cantidades exactas." },
  { id: "g3-cervantes", grade: 3, category: "Lengua", question: "¿Qué figura literaria compara usando palabras como «como» o «parece»?", options: ["Metáfora", "Símil", "Hipérbole", "Anáfora"], answer: 1, explanation: "El símil establece una comparación explícita entre dos elementos.", fact: "La metáfora también compara, pero lo hace de manera implícita." },
  { id: "g3-democracia", grade: 3, category: "Sociedad", question: "¿Qué poder del Estado suele encargarse de elaborar las leyes?", options: ["Ejecutivo", "Legislativo", "Judicial", "Electoral"], answer: 1, explanation: "En la división clásica de poderes, el Legislativo debate y aprueba las leyes.", fact: "La forma concreta del poder legislativo cambia según la constitución de cada país." },
  { id: "g3-clima", grade: 3, category: "Tierra", question: "¿Qué instrumento mide la presión atmosférica?", options: ["Termómetro", "Anemómetro", "Barómetro", "Pluviómetro"], answer: 2, explanation: "El barómetro mide la presión ejercida por la atmósfera.", fact: "Los cambios de presión ayudan a anticipar variaciones del tiempo." },
];

export function createSchoolProgress(): MichiSchoolProgress {
  return { currentGrade: 1, questionIndex: 0, correctInGrade: 0, totalCorrect: 0, completedQuestionIds: [], graduatedGrades: [] };
}

export function normalizeSchoolProgress(value?: Partial<MichiSchoolProgress> | null): MichiSchoolProgress {
  const grade = Math.max(1, Math.min(SCHOOL_MAX_GRADE, Math.floor(value?.currentGrade ?? 1)));
  return {
    currentGrade: grade,
    questionIndex: Math.max(0, Math.min(SCHOOL_QUESTIONS_PER_GRADE - 1, Math.floor(value?.questionIndex ?? 0))),
    correctInGrade: Math.max(0, Math.min(SCHOOL_QUESTIONS_PER_GRADE, Math.floor(value?.correctInGrade ?? 0))),
    totalCorrect: Math.max(0, Math.floor(value?.totalCorrect ?? 0)),
    completedQuestionIds: Array.from(new Set(value?.completedQuestionIds ?? [])),
    graduatedGrades: Array.from(new Set(value?.graduatedGrades ?? [])).filter((item) => item >= 1 && item <= SCHOOL_MAX_GRADE),
  };
}

export function questionsForGrade(grade: number) {
  return MICHI_SCHOOL_QUESTIONS.filter((question) => question.grade === grade);
}

export function currentSchoolQuestion(progress: MichiSchoolProgress) {
  const questions = questionsForGrade(progress.currentGrade);
  return questions[Math.min(progress.questionIndex, questions.length - 1)] ?? questions[0];
}

export function advanceSchoolProgress(progress: MichiSchoolProgress, questionId: string): MichiSchoolProgress {
  const normalized = normalizeSchoolProgress(progress);
  if (normalized.completedQuestionIds.includes(questionId) || currentSchoolQuestion(normalized).id !== questionId) return normalized;

  const nextCompleted = [...normalized.completedQuestionIds, questionId];
  const nextCorrect = normalized.correctInGrade + 1;
  if (nextCorrect >= SCHOOL_QUESTIONS_PER_GRADE) {
    const graduatedGrades = Array.from(new Set([...normalized.graduatedGrades, normalized.currentGrade]));
    const nextGrade = Math.min(SCHOOL_MAX_GRADE, normalized.currentGrade + 1);
    return {
      currentGrade: nextGrade,
      questionIndex: normalized.currentGrade < SCHOOL_MAX_GRADE ? 0 : SCHOOL_QUESTIONS_PER_GRADE - 1,
      correctInGrade: normalized.currentGrade < SCHOOL_MAX_GRADE ? 0 : SCHOOL_QUESTIONS_PER_GRADE,
      totalCorrect: normalized.totalCorrect + 1,
      completedQuestionIds: nextCompleted,
      graduatedGrades,
    };
  }

  return {
    ...normalized,
    questionIndex: Math.min(normalized.questionIndex + 1, SCHOOL_QUESTIONS_PER_GRADE - 1),
    correctInGrade: nextCorrect,
    totalCorrect: normalized.totalCorrect + 1,
    completedQuestionIds: nextCompleted,
  };
}
