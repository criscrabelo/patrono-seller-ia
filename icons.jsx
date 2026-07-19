/* ============ Icons (lucide-style, simple strokes) ============ */
const Icon = ({ name, size = 18, style }) => {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style,
  };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    radar: <><circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l7-7"/><path d="M12 7a5 5 0 1 0 5 5"/></>,
    sparkles: <><path d="M12 3l1.8 4.9L18.7 9 13.8 10.8 12 15.7 10.2 10.8 5.3 9l4.9-1.1z"/><path d="M19 14l.9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6z"/><path d="M5 15l.7 1.9L7.5 17l-1.8.6L5 19.5l-.7-1.9L2.5 17l1.8-.5z"/></>,
    library: <><path d="M3 5v14M8 5v14"/><rect x="11" y="4" width="4" height="16" rx="1"/><path d="M18 5l3 13-2 .5L16 6z"/></>,
    check: <><path d="M20 6L9 17l-5-5"/></>,
    checkCircle: <><circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.5 2.5 4.5-5"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 14l3-4 3 2 4-6"/></>,
    video: <><rect x="2" y="5" width="14" height="14" rx="2.5"/><path d="M16 10l6-3v10l-6-3z"/></>,
    bag: <><path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    plug: <><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></>,
    dollar: <><path d="M12 2v20M17 6a4 4 0 0 0-4-3H10a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7h-3.5A4 4 0 0 1 7 18"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>,
    message: <><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z"/></>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.5a6 6 0 0 1 3 5.5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    brain: <><path d="M9 4a2.5 2.5 0 0 0-2.5 2.5A2.5 2.5 0 0 0 5 11a2.5 2.5 0 0 0 1.5 4.5A2.5 2.5 0 0 0 9 20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M15 4a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 19 11a2.5 2.5 0 0 1-1.5 4.5A2.5 2.5 0 0 1 15 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></>,
    layers: <><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></>,
    bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.5 21a2 2 0 0 0 3 0"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    x: <><path d="M18 6L6 18M6 6l12 12"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
    heart: <><path d="M12 20s-7-4.5-9.5-9A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></>,
    bookmark: <><path d="M6 3h12v18l-6-4-6 4z"/></>,
    trend: <><path d="M3 17l6-6 4 4 7-7"/><path d="M17 8h4v4"/></>,
    fire: <><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 10 7 12 7 14a5 5 0 0 0 10 0c0-5-5-8-5-12z"/></>,
    pencil: <><path d="M16 3l5 5L8 21H3v-5z"/></>,
    play: <><path d="M6 4l14 8-14 8z"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    chevR: <><path d="M9 6l6 6-6 6"/></>,
    chevD: <><path d="M6 9l6 6 6-6"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    shield: <><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    rocket: <><path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.9-.9.9-2.4 0-3.3a2.3 2.3 0 0 0-3 .3z"/><path d="M9 12l3 3M19 3s-4 0-8 4c-1.6 1.6-2.5 3-3 4l4 4c1-.5 2.4-1.4 4-3 4-4 4-8 4-8z"/><circle cx="14" cy="9" r="1.2"/></>,
    flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/></>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></>,
    download: <><path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 21h14"/></>,
    alert: <><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></>,
    star: <><path d="M12 3l2.6 5.6L21 9.3l-4.5 4.3 1.1 6.4L12 17l-5.6 3 1.1-6.4L3 9.3l6.4-.7z"/></>,
    filter: <><path d="M3 5h18l-7 8v5l-4 2v-7z"/></>,
    refresh: <><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 4v4h-4M3 20v-4h4"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    tag: <><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/></>,
    pause: <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h5"/></>,
    scale: <><path d="M12 3v18M8 21h8"/><path d="M5 6h14l-3-2"/><path d="M5 6l-2.5 6a3 3 0 0 0 5 0z"/><path d="M19 6l-2.5 6a3 3 0 0 0 5 0z"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 21h14"/></>,
    ban: <><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></>,
    crown: <><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
};

/* ============ Brand mark ============ */
const BrandMark = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 2.5l1.7 4.6 4.8.2-3.7 3 1.3 4.6L12 16.3 7.9 14.9l1.3-4.6-3.7-3 4.8-.2z"
      fill="oklch(0.2 0.02 70)"/>
    <circle cx="12" cy="19.5" r="1.6" fill="oklch(0.2 0.02 70)"/>
  </svg>
);

window.Icon = Icon;
window.BrandMark = BrandMark;
