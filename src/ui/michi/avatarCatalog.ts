export const PERSONAL_AVATARS = Array.from({ length: 15 }, (_, i) => ({
  id: `personal-${String(i + 1).padStart(2, "0")}`,
  name: `Retrato ${i + 1}`,
  src: `/assets/michi-world/personal-${String(i + 1).padStart(2, "0")}.webp`,
}));

const names = [
  "Pirata",
  "Astronauta",
  "Vaquero",
  "Tenista",
  "Aviador",
  "Rey",
  "Buzo",
  "Constructor",
  "Director",
  "Superhéroe",
  "Doctor",
  "DJ",
  "Detective",
  "Barista",
  "Skater",
  "Reportero",
  "Arqueólogo",
  "Apicultor",
  "Mecánico",
  "Cartero",
];
export const EXTRA_MICHI_AVATARS = names.map((name, index) => ({
  id: `companion-${String(index + 1).padStart(2, "0")}`,
  name,
  level: 45 + index * 5,
  motto: "Una nueva aventura para compartir.",
}));

export const MICHI_AVATARS = [
  {
    id: "playita",
    name: "Playita",
    level: 1,
    motto: "Relájate, todo va a estar bien",
  },
  { id: "corazones", name: "Corazones", level: 10 },
  { id: "cool", name: "Cool", level: 15 },
  { id: "dormilon", name: "Dormilón", level: 20 },
  { id: "gamer", name: "Gamer", level: 25 },
  { id: "aventurero", name: "Aventurero", level: 30 },
  { id: "mago", name: "Mago", level: 35 },
  { id: "explorador", name: "Explorador", level: 40 },
  ...EXTRA_MICHI_AVATARS,
];
export const MICHI_AVATAR_SRC = (id: string) =>
  id.startsWith("companion-")
    ? `/assets/michi-world/${id}.webp`
    : `/assets/avatar-${id}.webp`;

export function migratePersonalAvatar(src: string | null): string {
  if (PERSONAL_AVATARS.some((a) => a.src === src)) return src!;
  const legacy = src?.match(/art-(2[0-5])\.webp$/);
  if (legacy) return PERSONAL_AVATARS[Number(legacy[1]) - 11].src;
  return PERSONAL_AVATARS[0].src;
}
