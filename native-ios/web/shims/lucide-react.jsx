// Web build stand-in for lucide-react (the package could not be installed in the
// environment this build was made in). Same export names and props as the real
// thing — size, strokeWidth, className — so src/ imports are unchanged and the
// iOS/Vite build keeps using the real package. Icon geometry follows Lucide (ISC).
import React from 'react';

const h = React.createElement;
const P = (d) => h('path', { d, key: d });
const L = (x1, y1, x2, y2) => h('line', { x1, y1, x2, y2, key: [x1, y1, x2, y2].join() });
const C = (cx, cy, r) => h('circle', { cx, cy, r, key: [cx, cy, r].join() });
const R = (x, y, width, height, rx) => h('rect', { x, y, width, height, rx, key: [x, y, width, height].join() });
const PL = (points) => h('polyline', { points, key: points });

function icon(children) {
  return function Icon({ size = 24, strokeWidth = 2, className, ...rest }) {
    return h('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
      className, 'aria-hidden': 'true', ...rest,
    }, children);
  };
}

export const Plus = icon([P('M5 12h14'), P('M12 5v14')]);
export const Minus = icon([P('M5 12h14')]);
export const X = icon([P('M18 6 6 18'), P('m6 6 12 12')]);
export const ChevronLeft = icon([P('m15 18-6-6 6-6')]);
export const ChevronRight = icon([P('m9 18 6-6-6-6')]);
export const ChevronUp = icon([P('m18 15-6-6-6 6')]);
export const ChevronDown = icon([P('m6 9 6 6 6-6')]);
export const Check = icon([P('M20 6 9 17l-5-5')]);
export const Loader2 = icon([P('M21 12a9 9 0 1 1-6.219-8.56')]);
export const History = icon([P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'), P('M3 3v5h5'), P('M12 7v5l4 2')]);
export const RotateCcw = icon([P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'), P('M3 3v5h5')]);
export const Pencil = icon([P('M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'), P('m15 5 4 4')]);
export const Clock = icon([C(12, 12, 10), PL('12 6 12 12 16 14')]);
export const Download = icon([P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), PL('7 10 12 15 17 10'), L(12, 15, 12, 3)]);
export const Upload = icon([P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), PL('17 8 12 3 7 8'), L(12, 3, 12, 15)]);
export const Copy = icon([R(8, 8, 14, 14, 2), P('M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2')]);
export const Trophy = icon([
  P('M6 9H4.5a2.5 2.5 0 0 1 0-5H6'), P('M18 9h1.5a2.5 2.5 0 0 0 0-5H18'), P('M4 22h16'),
  P('M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'),
  P('M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'),
  P('M18 2H6v7a6 6 0 0 0 12 0V2Z'),
]);
export const Timer = icon([L(10, 2, 14, 2), L(12, 14, 15, 11), C(12, 14, 8)]);
export const Layers = icon([P('M12 2 2 7l10 5 10-5-10-5Z'), P('m2 17 10 5 10-5'), P('m2 12 10 5 10-5')]);
export const Star = icon([h('polygon', { key: 's', points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })]);
export const Dumbbell = icon([P('M6.5 6.5v11'), P('M17.5 6.5v11'), P('M3 9.5v5'), P('M21 9.5v5'), P('M6.5 12h11')]);
export const Link2 = icon([P('M9 17H7A5 5 0 0 1 7 7h2'), P('M15 7h2a5 5 0 1 1 0 10h-2'), L(8, 12, 16, 12)]);
export const Flame = icon([P('M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z')]);
export const TrendingUp = icon([PL('22 7 13.5 15.5 8.5 10.5 2 17'), PL('16 7 22 7 22 13')]);
export const Calendar = icon([R(3, 4, 18, 18, 2), L(16, 2, 16, 6), L(8, 2, 8, 6), L(3, 10, 21, 10)]);
export const List = icon([L(8, 6, 21, 6), L(8, 12, 21, 12), L(8, 18, 21, 18), L(3, 6, 3.01, 6), L(3, 12, 3.01, 12), L(3, 18, 3.01, 18)]);
export const Target = icon([C(12, 12, 10), C(12, 12, 6), C(12, 12, 2)]);
export const Settings = icon([
  P('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'),
  C(12, 12, 3),
]);
export const Scale = icon([P('M12 3v18'), P('M7 21h10'), P('M5 7h14'), P('M5 7l-3 7a3 3 0 0 0 6 0L5 7'), P('M19 7l-3 7a3 3 0 0 0 6 0l-3-7')]);
export const Sailboat = icon([P('M12 2v15'), P('M12 4l7 11h-7'), P('M10 7l-5 8h5'), P('M3 18h18l-2 3H5l-2-3z')]);
export const Search = icon([C(11, 11, 8), P('m21 21-4.3-4.3')]);
export const Trash2 = icon([P('M3 6h18'), P('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'), P('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'), L(10, 11, 10, 17), L(14, 11, 14, 17)]);
export const Archive = icon([R(2, 3, 20, 5, 1), P('M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8'), P('M10 12h4')]);
export const Lock = icon([R(3, 11, 18, 11, 2), P('M7 11V7a5 5 0 0 1 10 0v4')]);
export const BookOpen = icon([P('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'), P('M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z')]);
export const Info = icon([C(12, 12, 10), P('M12 16v-4'), P('M12 8h.01')]);
