export default function BananaMark({
  size = 28,
  state = 'idle',
}: {
  size?: number;
  state?: 'idle' | 'loading';
}) {
  return (
    <span
      className={`banana-mark-icon ${state === 'loading' ? 'banana-loading' : ''}`}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 32 32">
        <g className="banana-shape">
          <path d="M25 4c1 13-7 22-20 20 6 9 25 1 23-16Z" fill="currentColor" />
          <path
            d="M25.4 4.6c1.6-0.5 2.8-1.4 3.4-3.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}
