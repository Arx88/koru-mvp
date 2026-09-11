const icons = { memory: "memory", profile: "friends", today: "sun", create: "notes", history: "clock" };
export function WorldObject({kind, className = ""}: {kind: keyof typeof icons; className?: string}) {
  return <img aria-hidden="true" alt="" className={`mw-object mw-object-${kind} ${className}`} src={`/assets/michi-icons/${icons[kind]}.webp`} width="64" height="64" />;
}
