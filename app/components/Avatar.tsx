export default function Avatar({
  initials,
  color,
  size = 28,
}: {
  initials: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.31) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
