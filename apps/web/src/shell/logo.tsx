import { useId } from 'react';

/** The logo, recoloured with the teal gradient #115e59 → #0d9488 (spec UX §2). Decorative. */
export function Logo({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="2.2"
          y1="21.5"
          x2="21.7"
          y2="2.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#115e59" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <g transform="matrix(1.1414556,0,0,1.1414556,-1.697467,-1.6974671)">
        <path
          fill={`url(#${gradientId})`}
          d="m 7.0086575,2.5357693 c 3.4043515,-0.4095461 6.7063165,-0.4095461 9.9058945,0 2.637333,0.3375786 4.496242,2.1578532 4.799367,4.799367 0.358353,3.1227887 0.358353,6.2455767 0,9.3683657 -0.303125,2.641514 -2.155018,4.522059 -4.799367,4.799367 -3.557931,0.373114 -6.859896,0.342618 -9.9058945,0 -2.6421873,-0.297196 -4.5821569,-2.149404 -4.799367,-4.799367 -0.2559663,-3.122789 -0.2559663,-6.245577 0,-9.3683658 0.21721,-2.6499621 2.1595511,-4.4817951 4.799367,-4.7993669 z"
        />
        <g
          transform="translate(-0.00424034,-0.41817542)"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.48321"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m 18.67556,8.2908867 -2.628997,2.6289973 m -5.257995,5.257995 -2.6289974,2.628998 c -0.820606,0.811535 -2.1424927,0.808215 -2.9590126,-0.0074 -0.8185133,-0.819423 -0.8185133,-2.147006 0,-2.966429 l 2.6271433,-2.62717 M 13.081988,7.9515978 15.709131,5.324458" />
          <path d="m 14.967525,4.5828508 4.449643,4.4496431" />
          <path d="M 10.435496,16.530951 H 4.8853411" />
          <polyline
            points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"
            transform="matrix(0.74160718,0,0,0.74160718,3.8434168,3.5667773)"
            strokeWidth="2"
          />
          <line x1="13.48431" x2="17.933952" y1="17.657314" y2="13.207671" />
          <line x1="15.709131" x2="18.67556" y1="15.432492" y2="18.398922" />
          <line x1="17.933952" x2="19.417168" y1="19.140528" y2="17.657314" />
        </g>
      </g>
    </svg>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2 text-xl font-semibold">
      <Logo className="size-8" />
      BattleCRM
    </span>
  );
}
