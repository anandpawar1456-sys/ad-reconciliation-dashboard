// Fixed, full-screen DAWN scene behind every page (teal sky, sun rising on
// the left) so it is not confused with the purple sunset in the other tool:
// sky gradient, a soft sun glow, four overlapping mountain ridges (far -> near, light -> dark)
// and a faint dark overlay so white text on top stays readable.
export default function SceneBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0e2a47]">
      <svg className="h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e2a47" />
            <stop offset="0.38" stopColor="#1f6f8b" />
            <stop offset="0.62" stopColor="#5fb5a8" />
            <stop offset="0.8" stopColor="#f2d9a0" />
            <stop offset="1" stopColor="#14394a" />
          </linearGradient>
          <radialGradient id="scene-sun" cx="0.2" cy="0.62" r="0.5">
            <stop offset="0" stopColor="#fff1c4" stopOpacity="0.95" />
            <stop offset="0.25" stopColor="#ffd07a" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffd07a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="scene-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#04141f" stopOpacity="0.34" />
            <stop offset="0.5" stopColor="#04141f" stopOpacity="0.12" />
            <stop offset="1" stopColor="#04141f" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <rect width="1600" height="900" fill="url(#scene-sky)" />
        <rect width="1600" height="900" fill="url(#scene-sun)" />

        <path
          fill="#5aa5a3"
          d="M0 600 L120 520 L240 580 L380 470 L520 560 L640 500 L800 590 L960 480 L1120 570 L1280 500 L1440 580 L1600 520 L1600 900 L0 900Z"
        />
        <path
          fill="#2f7f86"
          d="M0 680 L160 590 L300 650 L470 540 L620 640 L780 570 L940 660 L1100 590 L1260 670 L1420 600 L1600 680 L1600 900 L0 900Z"
        />
        <path
          fill="#1b5668"
          d="M0 760 L140 690 L300 750 L460 680 L620 760 L800 700 L980 770 L1160 700 L1340 770 L1480 710 L1600 760 L1600 900 L0 900Z"
        />
        <path
          fill="#103646"
          d="M0 830 L180 780 L340 830 L520 790 L700 840 L900 795 L1100 845 L1300 800 L1460 845 L1600 810 L1600 900 L0 900Z"
        />

        <rect width="1600" height="900" fill="url(#scene-shade)" />
      </svg>
    </div>
  );
}
