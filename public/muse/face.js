/* =====================================================================
   MUSE-ING — face study.
   The monkey's head, built the KAGE way: one sculpted mesh, skin painted
   at runtime, fur grown in shells, lit and graded in our own post chain.
   No photographs, no models, nothing loaded but three.js.
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------------------------------------ 0 · basics */
const Q      = new URLSearchParams(location.search);
const qs     = (k, d) => { const v = Q.get(k); return v === null ? d : v; };
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp  = (v, a, b) => v < a ? a : (v > b ? b : v);
const sat    = v => clamp(v, 0, 1);
const lerp   = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const damp   = (cur, to, rate, dt) => lerp(cur, to, 1 - Math.exp(-rate * dt));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* integer-lattice value noise in 3-D; the skin is painted from surface
   positions, not from UVs, so detail never stretches at the seams */
function hash3(i, j, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const a = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf);
  const b = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf);
  const c = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf);
  const d = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf);
  return lerp(lerp(a, b, yf), lerp(c, d, yf), zf);
}
function fbm3(x, y, z, oct) {
  let a = .5, f = 1, s = 0, m = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); m += a; a *= .5; f *= 2.03; }
  return s / m;                                    /* 0 … 1 */
}
/* a wrinkle: a soft valley at every integer of f */
const crease = (f, w) => { const g = f - Math.round(f); return Math.exp(-(g * g) / (w * w)); };

/* ------------------------------------------------------------ 1 · sculpt */
/* Signed distances, after Quilez. Ellipsoid is the cheap bound — accurate
   at the surface, which is the only place the projection asks it. */
function sdE(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt(x * x / (rx * rx) + y * y / (ry * ry) + z * z / (rz * rz));
  return k1 < 1e-6 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function sdCap(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = sat((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}
function sdRB(px, py, pz, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r, qz = Math.abs(pz - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
const smax = (a, b, k) => -smin(-a, -b, k);

/* The smirk lifts the mouth's left corner (his left, our right: +x). */
const smirk = x => .085 * smooth(-.12, .42, x);

/* A chimp's head: a low skull set back, the forehead sloping away behind a
   brow shelf, a flat triangular primate nose with flared nostril wings and
   deep oblique nostrils, and a broad arched muzzle with a long upper lip. */
function headSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = sdE(x, y, z, 0, .08, -.22, .92, .86, .96);                         /* cranium        */
  d = smin(d, sdE(x, y, z, 0, .38, .22, .64, .28, .52), .2);                 /* sloped forehead*/
  d = smax(d, -sdE(ax, y, z, .98, .2, .12, .18, .25, .32), .16);             /* temples        */
  d = smin(d, sdE(x, y, z, 0, -.02, .38, .76, .58, .55), .22);               /* mid-face mass  */
  d = smin(d, sdCap(ax, y, z, .62, .26, .52, 0, .31, .88, .17), .1);         /* brow ridge     */
  d = smax(d, -sdE(ax, y, z, .28, .11, .88, .19, .12, .15), .07);            /* eye sockets    */
  d = smin(d, sdE(ax, y, z, .46, -.07, .62, .24, .18, .22), .13);            /* cheekbones     */

  /* broad barrel muzzle */
  d = smin(d, sdE(x, y, z, 0, -.40, .79, .49, .39, .51), .18);

  /* primate nose: recessed bridge saddle under the visor, broad flat triangular
     nasal tip & septum, and thick rounded nostril wings (alae) on either side */
  d = smax(d, -sdE(x, y, z, 0, .06, 1.02, .16, .055, .06), .04);             /* recessed bridge saddle */
  d = smin(d, sdCap(x, y, z, 0, .14, .88, 0, -.02, 1.03, .068), .075);       /* low nasal bridge */
  d = smin(d, sdE(x, y, z, 0, -.09, 1.09, .14, .095, .09), .06);             /* broad nasal dorsum */
  d = smin(d, sdCap(x, y, z, 0, -.01, 1.04, 0, -.16, 1.15, .060), .05);      /* septum column  */
  d = smin(d, sdCap(ax, y, z, .055, -.01, 1.05, .175, -.15, 1.07, .076), .055); /* flared nostril wings */
  d = smin(d, sdE(ax, y, z, .185, -.145, 1.04, .072, .065, .07), .045);      /* outer alar rim */

  /* deep, obliquely slanted teardrop nostrils */
  const nx = (ax - .090) * .90 + (y + .122) * .42;
  const ny = -(ax - .090) * .42 + (y + .122) * .90;
  const nz = z - 1.135;
  d = smax(d, -sdE(nx, ny, nz, 0, 0, 0, .046, .062, .080), .018);            /* nostril cavities*/

  /* philtrum & arched upper lip barrel */
  const ly = y - smirk(x);
  d = smin(d, sdE(x, ly, z, 0, -.41, 1.09, .41, .24, .24), .09);             /* long upper lip */
  d = smax(d, -sdCap(0, y, z, 0, -.20, 1.16, 0, -.42, 1.24, .022) - ax * .45, .025); /* philtrum groove */
  d = smin(d, sdE(x, ly, z, 0, -.70, 1.05, .34, .11, .21), .06);             /* lower lip      */
  d = smax(d, -sdCap(ax, ly, z, .36, -.60, .98, 0, -.60, 1.28, .020), .028); /* mouth cleft    */
  d = smin(d, sdE(x, y, z, 0, -.76, .60, .50, .32, .48), .2);                /* chin and jaw   */
  d = smin(d, sdCap(x, y, z, 0, -.75, -.08, 0, -1.75, -.10, .44), .24);      /* neck           */
  return Math.max(d, -(y + 1.65));
}

/* An ear, in its own frame: a cup across x. The bowl faces +x and is
   scooped below a rolled rim, an antihelix ridge curves inside it, and the
   back is a shallow dome. Built as a surface, not projected — a thin cup
   is the one shape a star-projection cannot see into. */
function earGeometry() {
  const NR = 28, NT = 72, RY = .38, RZ = .29;
  const front = r => {
    const rim = .82;
    let x = r < rim ? .048 - .085 * (1 - (r / rim) * (r / rim)) : .048 * Math.cos((r - rim) / (1 - rim) * Math.PI / 2);
    return x;
  };
  const back = r => -.038 * Math.sqrt(Math.max(0, 1 - r * r));
  const P = [], I = [];
  const vert = (r, th, isFront) => {
    const sy = Math.sin(th), cz = Math.cos(th);
    const ry = RY * (sy < 0 ? 1.08 : .95), y = ry * r * sy, z = RZ * r * cz;
    let x = isFront ? front(r) : back(r);
    /* antihelix & tragus folds inside the bowl */
    if (isFront) {
      x += .022 * Math.exp(-Math.pow((r - .58) / .09, 2)) * smooth(.3, -.65, cz);
      x += .020 * Math.exp(-Math.pow((r - .42) / .10, 2)) * smooth(-.1, .55, cz) * smooth(.1, -.4, sy);
    }
    P.push(x, y, z);
  };
  for (const f of [true, false]) {
    for (let i = 0; i <= NR; i++) for (let j = 0; j < NT; j++) vert(Math.max(i / NR, .001), j / NT * Math.PI * 2, f);
  }
  const at = (f, i, j) => f * (NR + 1) * NT + i * NT + (j % NT);
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
      const a = at(f, i, j), b = at(f, i + 1, j), c = at(f, i + 1, j + 1), d = at(f, i, j + 1);
      if (f === 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/* Project a dense sphere onto a surface: march in from outside along each
   vertex's direction, so the outermost crossing wins. */
function projectSphere(sdf, W, H, o, tMax) {
  const g = new THREE.SphereGeometry(1, W, H);
  const pos = g.attributes.position, T = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    let t = tMax, d = sdf(o.x + dx * t, o.y + dy * t, o.z + dz * t);
    for (let k = 0; k < 160 && d > 1e-4; k++) {
      t -= Math.max(d * .8, .002);
      if (t <= .01) { t = .01; break; }
      d = sdf(o.x + dx * t, o.y + dy * t, o.z + dz * t);
    }
    /* refine the step we just crossed */
    let lo = t, hi = Math.min(t + .02, tMax);
    for (let k = 0; k < 14; k++) {
      const m = (lo + hi) * .5;
      if (sdf(o.x + dx * m, o.y + dy * m, o.z + dz * m) < 0) lo = m; else hi = m;
    }
    t = (lo + hi) * .5;
    T[i] = t;
    pos.setXYZ(i, o.x + dx * t, o.y + dy * t, o.z + dz * t);
  }
  g.computeVertexNormals();
  return { geo: g, T: T };
}

/* ------------------------------------------------------------ 2 · skin */
/* Painted straight into the sphere's own UV space: every texel finds its
   point on the sculpted surface through the projection's depth grid, so
   each wrinkle is placed in head space, where it was designed. */
function skinMask(x, y, z) {
  const front = smooth(.18, .46, z);
  const top = smooth(.26, .50, y);
  const noise = (vnoise(x * 7, y * 7, 4.4) - .5) * .12;
  /* smooth hourglass facial mask blending brow/cheekbones into the muzzle without a sharp corner */
  const upper = Math.hypot(x / .68, (y - .12) / .46);
  const lower = Math.hypot(x / .48, (y + .44) / .44);
  const e = smin(upper, lower, .34) + noise * (.4 + .6 * top);
  return (1 - smooth(lerp(.76, .64, top), lerp(1.02, 1.10, top), e)) * front;
}

function paintSkin(proj, W, H, o, TW, TH) {
  const T = proj.T;
  const cosP = new Float32Array(TW), sinP = new Float32Array(TW);
  for (let c = 0; c < TW; c++) { const ph = (c + .5) / TW * Math.PI * 2; cosP[c] = Math.cos(ph); sinP[c] = Math.sin(ph); }

  const N = TW * TH;
  const height = new Float32Array(N);
  const albedo = new Uint8Array(N * 4), rough = new Uint8Array(N * 4), fur = new Uint8Array(N * 4);

  for (let r = 0; r < TH; r++) {
    /* DataTexture row 0 is the bottom of the map: uv.y = 0 */
    const vrow = 1 - (r + .5) / TH, th = vrow * Math.PI;
    const st = Math.sin(th), ct = Math.cos(th);
    const fy = vrow * H, iy = Math.min(H - 1, fy | 0), wy = fy - iy;
    for (let c = 0; c < TW; c++) {
      const fx = (c + .5) / TW * W, ix = Math.min(W - 1, fx | 0), wx = fx - ix;
      const i00 = iy * (W + 1) + ix;
      const t = lerp(lerp(T[i00], T[i00 + 1], wx), lerp(T[i00 + W + 1], T[i00 + W + 2], wx), wy);
      const x = o.x - cosP[c] * st * t, y = o.y + ct * t, z = o.z + sinP[c] * st * t;
      const ax = Math.abs(x);
      const k = r * TW + c, p = k * 4;

      const m = skinMask(x, y, z);
      let h = 0, cav = 0, rg = .88;

      /* fur ground: streaks combed down the head, under the shells */
      const streak = hash3((x * 70) | 0, (y * 9 + z * 6) | 0, (z * 70) | 0);
      const hf = (streak - .5) * .32;

      if (m > .001) {
        let w = 0;
        /* forehead furrows above the visor, bowed with the brow */
        const fh = (y - .35 + .22 * x * x) * 16;
        w += .48 * crease(fh, .15) * smooth(.31, .37, y) * (1 - smooth(.58, .68, y)) * (1 - smooth(.32, .56, ax))
          * (.55 + .45 * vnoise(x * 6, y * 2, 3.1));
        /* concentric bags & folds ringing the eyes and upper cheeks below the visor */
        const ro = Math.hypot((ax - .27) * 1.1, (y - .11) / .82) + (vnoise(x * 9, y * 9, 1.3) - .5) * .045;
        w += .36 * crease((ro - .15) * 18, .17) * smooth(.14, .19, ro) * (1 - smooth(.34, .44, ro)) * smooth(.06, -.02, y)
          * (.45 + .55 * vnoise(x * 5, y * 3, 7.7));
        /* crow's feet out of the outer corners */
        const cr = Math.hypot(ax - .58, y - .10), ca = Math.atan2(y - .10, ax - .58);
        w += .32 * crease(ca * 2.6, .16) * smooth(.03, .08, cr) * (1 - smooth(.16, .26, cr));
        /* across the nose bridge */
        w += .28 * crease(y * 34, .16) * (1 - smooth(.07, .14, ax)) * smooth(-.02, .05, y) * (1 - smooth(.22, .28, y));
        /* deep weathered vertical/radial creases fanning down the long chimpanzee upper lip */
        const lipFan = (x / (.78 - (y + .38) * .45)) * 22 + (vnoise(x * 8, y * 5, 6.1) - .5) * .9;
        w += .34 * crease(lipFan, .17) * (.45 + .55 * vnoise(x * 5, y * 3, 4.2))
          * smooth(-.60, -.52, y) * (1 - smooth(-.20, -.14, y)) * (1 - smooth(.28, .42, ax)) * smooth(.88, 1.02, z);
        /* subtle horizontal tension creases across the upper muzzle */
        const fm = (y + .22 + .28 * x * x) * 15;
        w += .18 * crease(fm + (vnoise(x * 6, y * 4, 2.2) - .5) * 1.1, .15) * (.35 + .65 * vnoise(x * 4.5, y * 2, 9.4))
          * smooth(-.54, -.46, y) * (1 - smooth(-.22, -.16, y)) * (1 - smooth(.26, .40, ax));
        /* philtrum groove down the middle of the upper lip */
        w += .20 * Math.exp(-Math.pow(x / .036, 2)) * smooth(-.56, -.46, y) * (1 - smooth(-.20, -.15, y));
        /* prominent nasolabial folds sweeping from nostril wings around the muzzle */
        const nl = Math.hypot(ax - .74, y + .34);
        w += .58 * Math.exp(-Math.pow((nl - .54) / .038, 2)) * smooth(-.70, -.58, y) * (1 - smooth(-.08, -.02, y));
        /* fine vertical lip lines on the lips */
        const ly = y - smirk(x);
        const lips = (1 - smooth(.30, .40, ax)) * smooth(-.82, -.75, ly) * (1 - smooth(-.52, -.48, ly)) * smooth(.94, 1.04, z);
        w += .26 * crease(x * 54 + .35 * Math.sin(ly * 30), .2) * lips;
        /* smirk corner dimple fold */
        w += .48 * Math.exp(-Math.pow((Math.hypot(x - .38, y + .55) - .055) / .018, 2)) * smooth(.24, .32, x);
        /* chin pebble texture */
        const chin = smooth(-.78, -.88, y) * (1 - smooth(.26, .42, ax));
        const bumps = fbm3(x * 26, y * 26, z * 26, 3);

        const pores = vnoise(x * 155, y * 155, z * 155) - .5;
        const broad = fbm3(x * 7, y * 7, z * 7, 3) - .5;

        h = -w * .56 + pores * .065 + broad * .12 + (bumps - .5) * .22 * chin;
        cav = sat(w * .95);

        /* roughness: warm leathery sheen on nose wings, cheekbones & lips; drier in creases */
        const noseWing = Math.exp(-Math.pow(Math.hypot(x / 1.2, (y + .10) / .7) / .18, 2));
        const cheekHi = Math.exp(-Math.pow(Math.hypot(ax - .36, y + .06) / .22, 2));
        rg = .48 + cav * .24 - noseWing * .14 - cheekHi * .10 - lips * .22 + pores * .06;

        const skinBlend = smooth(.12, .52, m);
        h = lerp(hf, h, skinBlend);
        rg = lerp(.88, rg, skinBlend);
      } else {
        h = hf;
      }
      height[k] = h;

      /* albedo: warm weathered bronze-brown chimpanzee skin (like Panel 1 reference),
         deep umber in every wrinkle crease, dark interior inside the nostrils,
         feathered seamlessly into charcoal-brown fur at the hairline */
      const fv = 13 + (streak - .5) * 11;
      let sr = fv + 1, sg = fv, sb = fv;
      if (m > .001) {
        const mottle = fbm3(x * 4.5, y * 4.5, z * 4.5, 3);
        let kr = 116 + (mottle - .5) * 24;
        let kg = 84 + (mottle - .5) * 18;
        let kb = 66 + (mottle - .5) * 14;
        /* highlight warmth on muzzle bridge and upper lip */
        const muzzleWarm = Math.exp(-Math.pow(Math.hypot(x / .42, (y + .30) / .34), 2)) * smooth(.9, 1.08, z);
        kr += muzzleWarm * 14; kg += muzzleWarm * 9; kb += muzzleWarm * 5;

        /* deep umber creases */
        const dark = 1 - .64 * cav;
        kr *= dark; kg *= dark * .95; kb *= dark * .90;

        /* deep shadow inside the oblique nostril openings */
        const nx = (ax - .090) * .90 + (y + .122) * .42;
        const ny = -(ax - .090) * .42 + (y + .122) * .90;
        const nostrilCav = Math.exp(-(nx * nx / (.044 * .044) + ny * ny / (.060 * .060))) * smooth(1.04, 1.11, z);
        kr = lerp(kr, 12, nostrilCav * .94);
        kg = lerp(kg, 9, nostrilCav * .94);
        kb = lerp(kb, 8, nostrilCav * .94);

        const ly2 = y - smirk(x);
        const lipTone = (1 - smooth(.30, .40, ax)) * smooth(-.82, -.75, ly2) * (1 - smooth(-.54, -.50, ly2));
        kr = lerp(kr, 96, lipTone * .45); kg = lerp(kg, 66, lipTone * .45); kb = lerp(kb, 56, lipTone * .45);

        /* the dark mouth cleft following the smirk */
        const mline = Math.exp(-Math.pow((ly2 + .60) / .015, 2)) * (1 - smooth(.32, .39, ax)) * smooth(.94, 1.04, z);
        kr *= 1 - .78 * mline; kg *= 1 - .78 * mline; kb *= 1 - .78 * mline;

        const sock = Math.exp(-Math.pow(Math.hypot(ax - .28, (y - .11) / .7) / .2, 2));
        kr *= 1 - .38 * sock; kg *= 1 - .38 * sock; kb *= 1 - .38 * sock;

        /* feather skin color only AFTER fur shell density has dropped to zero so no black dots appear on tan skin */
        const skinColorBlend = smooth(.32, .68, m);
        sr = lerp(fv + 1, kr, skinColorBlend);
        sg = lerp(fv, kg, skinColorBlend);
        sb = lerp(fv, kb, skinColorBlend);
      }
      albedo[p]     = clamp(sr, 0, 255);
      albedo[p + 1] = clamp(sg, 0, 255);
      albedo[p + 2] = clamp(sb, 0, 255);
      albedo[p + 3] = 255;

      const rv = clamp(rg, .05, 1) * 255;
      rough[p] = rough[p + 1] = rough[p + 2] = rv; rough[p + 3] = 255;

      /* fur: R density drops to 0 before skin turns tan (m > .38) and below y = -1.00 inside shirt collar */
      const len = .48 + .48 * smooth(.32, .82, y) + .42 * smooth(-.32, -.78, y) * (1 - smooth(.65, .95, z));
      const dens = (1 - smooth(.06, .38, m)) * (1 - smooth(-1.00, -1.24, y));
      const edge = .20 + .80 * (1 - smooth(.02, .36, m));
      fur[p] = sat(dens) * 255;
      fur[p + 1] = sat(len * edge) * 255;
      fur[p + 2] = sat(smooth(.28, .50, y) * smooth(.10, .45, z)) * 255; fur[p + 3] = 255;
    }
  }

  /* height → tangent-space normal map. Rows run bottom-up, so +r is +v. */
  const normal = new Uint8Array(N * 4), S = 3.2;
  for (let r = 0; r < TH; r++) {
    const rU = Math.min(TH - 1, r + 1), rD = Math.max(0, r - 1);
    for (let c = 0; c < TW; c++) {
      const cR = (c + 1) % TW, cL = (c - 1 + TW) % TW;
      const du = (height[r * TW + cR] - height[r * TW + cL]) * S;
      const dv = (height[rU * TW + c] - height[rD * TW + c]) * S;
      const il = 1 / Math.hypot(du, dv, 1), p = (r * TW + c) * 4;
      normal[p]     = (-du * il * .5 + .5) * 255;
      normal[p + 1] = (-dv * il * .5 + .5) * 255;
      normal[p + 2] = (il * .5 + .5) * 255;
      normal[p + 3] = 255;
    }
  }
  return { albedo, normal, rough, fur };
}

/* a small tiling pore map, for the ears */
function poreMap(size) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    h[y * size + x] = vnoise(x * .35, y * .35, 1.7) * .6 + vnoise(x * .09, y * .09, 4.2) * .4;
  }
  const out = new Uint8Array(size * size * 4), S = 1.6;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const du = (h[y * size + (x + 1) % size] - h[y * size + (x - 1 + size) % size]) * S;
    const dv = (h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x]) * S;
    const il = 1 / Math.hypot(du, dv, 1), p = (y * size + x) * 4;
    out[p] = (-du * il * .5 + .5) * 255; out[p + 1] = (-dv * il * .5 + .5) * 255; out[p + 2] = (il * .5 + .5) * 255; out[p + 3] = 255;
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* ================================================================= 3 · gl */
const canvas = document.getElementById('gl');
const status = document.getElementById('status');
const TAG = document.getElementById('tag'), CUE = document.getElementById('cue');
const vpW = () => document.documentElement.clientWidth || innerWidth;
const vpH = () => document.documentElement.clientHeight || innerHeight;
let renderer, scene, camera, maxAniso = 1;

function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.setSize(vpW(), vpH(), true);
  renderer.outputEncoding = THREE.LinearEncoding;   /* the comp pass encodes */
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x070707, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  maxAniso = renderer.capabilities.getMaxAnisotropy();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070707);
  camera = new THREE.PerspectiveCamera(28, vpW() / vpH(), .1, 120);
}

const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b);

function dataTex(arr, W, H, o) {
  o = o || {};
  const t = new THREE.DataTexture(arr, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = Math.min(8, maxAniso);
  if (o.srgb) t.encoding = THREE.sRGBEncoding;
  t.needsUpdate = true;
  return t;
}

/* A studio for the reflections: one big soft key up and to the left, a
   strip behind each shoulder, a red sliver for the visor to see. */
function buildEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020203);
  const panel = (w, h, c, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]); m.lookAt(look[0], look[1], look[2]); env.add(m);
  };
  panel(6, 4, hdr(5, 5, 5.2), [-5, 6, 5], [0, 0, 0]);
  panel(3, 8, hdr(1.4, 1.4, 1.5), [-6, 1, -5], [0, 0, 0]);
  panel(3, 8, hdr(1.6, 1.6, 1.7), [6, 1.5, -5], [0, 0, 0]);
  panel(10, .6, hdr(2.4, .25, .2), [0, -1, 7], [0, 0, 0]);
  panel(20, 20, hdr(.06, .06, .07), [0, -8, 0], [0, 0, 0]);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, .02);
  pm.dispose();
  return rt.texture;
}

/* ========================================================== 4 · the head */
const O = new THREE.Vector3(0, -.1, .15);
const SEG_W = 256, SEG_H = 192;
const HEAD = { deform: { uDraw: { value: 0 }, uPuff: { value: 0 } } };

/* The smoking face. uDraw: lips purse round the filter and the cheeks hollow.
   uPuff: the lower lip drops, the cheeks fill. Applied in the vertex stage of
   the skin and of every fur shell, so the coat moves with the face. */
const DEFORM_GLSL = [
  'uniform float uDraw; uniform float uPuff;',
  'vec3 muzzleDeform(vec3 p){',
  '  float ax = abs(p.x);',
  '  vec3 c = (vec3(ax, p.y, p.z) - vec3(0.42, -0.36, 0.68)) / vec3(0.17, 0.16, 0.2);',
  '  float ch = exp(-dot(c, c));',
  '  float inward = ch * (0.035 * uDraw - 0.016 * uPuff);',
  '  p.x -= sign(p.x) * inward * 0.8; p.z -= inward * 0.4;',
  '  float lip = exp(-pow(ax / 0.3, 4.0)) * exp(-pow((p.y + 0.62) / 0.13, 2.0)) * smoothstep(0.9, 1.05, p.z);',
  '  p.x *= 1.0 - 0.1 * uDraw * lip;',
  '  p.z += 0.025 * uDraw * lip + 0.01 * uPuff * lip;',
  '  p.y -= 0.024 * uPuff * lip * smoothstep(-0.6, -0.7, p.y);',
  '  return p;',
  '}'
].join('\n');

function buildHead(envMap) {
  const TW = 2048, TH = 1024;
  let t = performance.now();
  const proj = projectSphere(headSDF, SEG_W, SEG_H, O, 2.8);
  console.info('[face] sculpt', Math.round(performance.now() - t), 'ms'); t = performance.now();
  const maps = paintSkin(proj, SEG_W, SEG_H, O, TW, TH);
  console.info('[face] skin', Math.round(performance.now() - t), 'ms');
  HEAD.geo = proj.geo;

  const map = dataTex(maps.albedo, TW, TH, { srgb: true });
  const normalMap = dataTex(maps.normal, TW, TH);
  const roughnessMap = dataTex(maps.rough, TW, TH);
  HEAD.furTex = dataTex(maps.fur, TW, TH);

  const skin = new THREE.MeshPhysicalMaterial({
    map: map, normalMap: normalMap, normalScale: new THREE.Vector2(1, 1),
    roughnessMap: roughnessMap, roughness: 1, metalness: 0,
    clearcoat: .1, clearcoatRoughness: .45, clearcoatNormalMap: normalMap,
    envMap: envMap, envMapIntensity: .26
  });
  skin.onBeforeCompile = sh => {
    sh.uniforms.uDraw = HEAD.deform.uDraw; sh.uniforms.uPuff = HEAD.deform.uPuff;
    sh.vertexShader = DEFORM_GLSL + '\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n  transformed = muzzleDeform(transformed);');
  };
  HEAD.skin = skin;
  const mesh = new THREE.Mesh(proj.geo, skin);
  mesh.castShadow = mesh.receiveShadow = true;
  HEAD.mesh = mesh;
  return mesh;
}

function buildEars(envMap) {
  const geo = earGeometry();
  const mat = new THREE.MeshPhysicalMaterial({
    color: hdr(.085, .052, .036), roughness: .62, metalness: 0, clearcoat: .08, clearcoatRoughness: .45,
    normalMap: poreMap(256), normalScale: new THREE.Vector2(1.1, 1.1),
    envMap: envMap, envMapIntensity: .22,
    side: THREE.DoubleSide
  });
  const g = new THREE.Group();
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(geo, mat);
    /* angled forward and outward like true chimpanzee pinnae so the bowl is visible from front & 3/4 views */
    e.position.set(s * .95, .07, -.03);
    e.rotation.set(-.05, s * 1.08, s * -.12);
    e.scale.set(s * 1.04, 1.06, 1.02);
    e.castShadow = e.receiveShadow = true;
    g.add(e);
  });
  return g;
}

/* ---------------------------------------------------------- fur shells */
const FUR_VS = [
  DEFORM_GLSL,
  'uniform float uLevel; uniform float uLen; uniform float uDroop; uniform sampler2D tFur;',
  'varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDens;',
  'void main(){',
  '  vUv = uv;',
  '  vec4 f = texture2D(tFur, uv);',
  '  float len = uLen * (0.25 + f.g);',
  '  vec3 p = muzzleDeform(position) + normal * len * uLevel;',
  '  vec3 lie = normalize(mix(vec3(0.0, -0.95, -0.55), vec3(0.0, 0.15, -1.0), f.b));',
  '  p += lie * len * uLevel * uLevel * uDroop;',
  '  vec4 w = modelMatrix * vec4(p, 1.0);',
  '  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vDens = f.r;',
  '  gl_Position = projectionMatrix * viewMatrix * w;',
  '}'
].join('\n');
const FUR_FS = [
  'uniform float uLevel; uniform vec2 uRep; uniform float uGuard; uniform float uRad;',
  'uniform vec3 uKeyDir; uniform vec3 uKey; uniform vec3 uAmb; uniform vec3 uRim; uniform vec3 uRoot; uniform vec3 uTip;',
  'varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDens;',
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
  'void main(){',
  '  if (vDens < 0.03) discard;',
  '  vec2 g = vUv * uRep;',
  '  vec2 cell = floor(g); vec2 fr = fract(g) - 0.5;',
  '  fr += (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.52;',
  '  if (hash(cell + 11.3) > smoothstep(0.0, 0.85, vDens)) discard;',
  '  float h = hash(cell);',
  '  if (uGuard > 0.5) {',
  '    if (hash(cell + 23.1) < 0.84) discard;',
  '    h = 0.45 + 0.55 * h;',
  '  } else {',
  '    h *= 0.65 + 0.35 * hash(floor(cell / 5.0) + 5.0);',
  '  }',
  '  if (h < uLevel) discard;',
  '  float rad = uRad * (1.0 - uLevel * 0.82) * mix(0.22, 1.0, smoothstep(0.05, 0.75, vDens));',
  '  if (dot(fr, fr) > rad * rad) discard;',
  '  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);',
  '  float diff = pow(clamp(dot(N, uKeyDir) * 0.5 + 0.5, 0.0, 1.0), 1.8);',
  '  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);',
  '  vec3 base = mix(uRoot, uTip, pow(uLevel, 1.25));',
  '  vec3 c = base * (uAmb + uKey * diff) + uRim * rim * pow(uLevel, 1.35);',
  '  c *= mix(0.42, 1.0, uLevel);',
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');

function shellGroup(NS, own, order) {
  const g = new THREE.Group();
  const shared = Object.assign({
    tFur: { value: HEAD.furTex },
    uKeyDir: { value: new THREE.Vector3(-.55, .7, .45).normalize() },
    uKey: { value: hdr(1.3, 1.3, 1.38) }, uAmb: { value: hdr(.08, .08, .09) },
    uDraw: HEAD.deform.uDraw, uPuff: HEAD.deform.uPuff
  }, own);
  for (let i = 0; i < NS; i++) {
    const u = Object.assign({}, shared, { uLevel: { value: (i + 1) / NS } });
    const m = new THREE.Mesh(HEAD.geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: FUR_VS, fragmentShader: FUR_FS }));
    m.renderOrder = order + i;
    g.add(m);
  }
  return g;
}

/* Two coats, as on the animal: a dense dark undercoat, and through it long
   wiry guard hairs that go silver at the tips and catch every rim light. */
function buildFur() {
  const g = new THREE.Group();
  g.add(shellGroup(28, {
    uLen: { value: .065 }, uDroop: { value: .55 }, uRep: { value: new THREE.Vector2(920, 460) },
    uGuard: { value: 0 }, uRad: { value: .48 },
    uRim: { value: hdr(.52, .54, .60) }, uRoot: { value: hdr(.007, .007, .008) }, uTip: { value: hdr(.055, .055, .062) }
  }, 1));
  g.add(shellGroup(26, {
    uLen: { value: .14 }, uDroop: { value: 1.25 }, uRep: { value: new THREE.Vector2(480, 240) },
    uGuard: { value: 1 }, uRad: { value: .19 },
    uRim: { value: hdr(1.45, 1.48, 1.6) }, uRoot: { value: hdr(.015, .015, .018) }, uTip: { value: hdr(.46, .47, .52) }
  }, 40));
  return g;
}

/* ------------------------------------------- wisps: swept-back silver strands */
function buildWisps() {
  const pos = HEAD.geo.attributes.position, nrm = HEAD.geo.attributes.normal;
  const rnd = mulberry32(41), pts = [], col = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3(), d = new THREE.Vector3(), flow = new THREE.Vector3();
  const counts = { beard: 0, cheek: 0, crown: 0 }, want = { beard: 420, cheek: 280, crown: 260 };
  for (let tries = 0; tries < 240000; tries++) {
    if (counts.beard >= want.beard && counts.cheek >= want.cheek && counts.crown >= want.crown) break;
    const i = (rnd() * pos.count) | 0;
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
    const m = skinMask(p.x, p.y, p.z);
    let kind = null;
    if (p.y < -.42 && p.y > -1.08 && p.z > -.15 && m < .35) kind = 'beard';
    else if (p.y > -.42 && p.y < .48 && p.z > .02 && m > .02 && m < .55) kind = 'cheek';
    else if (p.y > .42 && m < .28) kind = 'crown';
    if (!kind || counts[kind] >= want[kind]) continue;
    counts[kind]++;

    /* combed naturally along the surface contour: swept back over the crown,
       down and back along the cheeks and jawline beard — no vertical spikes */
    if (kind === 'crown') {
      flow.set(Math.sign(p.x) * .25, -.15, -.95).normalize();
    } else if (kind === 'cheek') {
      flow.set(Math.sign(p.x) * .20, -.85, -.48).normalize();
    } else {
      flow.set(-Math.sign(p.x) * .12, -.82, -.55).normalize();
    }
    flow.addScaledVector(n, -flow.dot(n)).normalize();
    const lift = kind === 'crown' ? .22 : kind === 'cheek' ? .26 : .20;
    d.copy(flow).addScaledVector(n, lift);
    d.x += (rnd() - .5) * .22; d.y += (rnd() - .5) * .18; d.z += (rnd() - .5) * .22;
    d.normalize();
    const len = kind === 'beard' ? .085 + rnd() * .095 : kind === 'cheek' ? .065 + rnd() * .085 : .08 + rnd() * .10;
    const segs = 7, curl = (rnd() - .5) * .18;
    const q = p.clone().addScaledVector(n, .008);
    const silver = .38 + rnd() * .48;
    for (let s = 0; s < segs; s++) {
      const a = q.clone(), t0 = s / segs, t1 = (s + 1) / segs;
      /* curve back toward the surface tangent so strands hug the silhouette */
      d.lerp(flow, .28); d.y -= .03; d.x += curl * .08; d.normalize();
      q.addScaledVector(d, len / segs);
      pts.push(a.x, a.y, a.z, q.x, q.y, q.z);
      const c0 = lerp(.03, silver, t0 * t0), c1 = lerp(.03, silver, t1 * t1);
      col.push(c0, c0, c0 * 1.06, c1, c1, c1 * 1.06);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .48, depthWrite: false }));
}

/* ------------------------------------------------------------ the visor */
function rayHit(sdf, ox, oy, oz, dx, dz, tMax) {
  let t = tMax;
  for (let k = 0; k < 200; k++) {
    const d = sdf(ox + dx * t, oy, oz + dz * t);
    if (d < 1e-4) break;
    t -= Math.max(d * .8, .002);
    if (t < .01) return .01;
  }
  return t;
}
function buildVisor(envMap) {
  const A = 1.38, NA = 120, yC = .115, HT = .23, DEP = .075, CZ = .10;
  const R = [];
  for (let i = 0; i <= NA; i++) {
    const a = -A + 2 * A * i / NA, sx = Math.sin(a), cz = Math.cos(a);
    let m = 0;
    for (const yy of [yC - HT * .3, yC, yC + HT * .3]) m = Math.max(m, rayHit(headSDF, 0, yy, CZ, sx, cz, 2.5));
    R.push(m);
  }
  const Rs = R.map((_, i) => { let m = 0; for (let k = -2; k <= 2; k++) m = Math.max(m, R[clamp(i + k, 0, NA)]); return m; });
  const box = (arr, w) => arr.map((_, i) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { s += arr[clamp(i + k, 0, NA)]; n++; } return s / n; });
  const Rb = box(box(Rs, 6), 6);
  const Rf = Rb.map((r, i) => { const a = -A + 2 * A * i / NA; return r + .018 + .045 * smooth(.55, 1.15, Math.abs(a)); });

  const P = [], idx = [];
  const endT = i => smooth(0, 10, i) * smooth(NA, NA - 10, i);
  /* subtle dip over the nasal bridge on the lower rim, like contoured cyber-shades */
  const bridgeDip = a => -.026 * Math.exp(-Math.pow(a / .22, 2)) + .018 * Math.exp(-Math.pow((Math.abs(a) - .38) / .24, 2));
  const ring = (rOff, y, isBot) => Rf.map((r, i) => {
    const a = -A + 2 * A * i / NA, e = endT(i);
    const dip = isBot ? bridgeDip(a) * e : -.008 * Math.exp(-Math.pow(a / .35, 2)) * e;
    const yy = yC + (y - yC) * (.38 + .62 * Math.sqrt(e)) + dip;
    const rr = r + rOff - (1 - e) * .022;
    return [Math.sin(a) * rr, yy, CZ + Math.cos(a) * rr];
  });
  const quadStrip = (a, b) => {
    const base = P.length / 3;
    for (let i = 0; i <= NA; i++) { P.push(...a[i]); P.push(...b[i]); }
    for (let i = 0; i < NA; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  };
  const oT = ring(0, yC + HT / 2, false), oB = ring(0, yC - HT / 2, true);
  const iT = ring(-DEP, yC + HT / 2, false), iB = ring(-DEP, yC - HT / 2, true);
  const cT = ring(-.014, yC + HT / 2 + .014, false), cB = ring(-.014, yC - HT / 2 - .014, true);
  quadStrip(cT, oT); quadStrip(oT, oB); quadStrip(oB, cB);
  quadStrip(iT, cT); quadStrip(cB, iB); quadStrip(iB, iT);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  /* dark ruby-obsidian glossy lens + housing */
  const shell = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({
    color: hdr(.014, .005, .007), roughness: .14, metalness: .35, clearcoat: 1, clearcoatRoughness: .08,
    envMap: envMap, envMapIntensity: 1.15, side: THREE.DoubleSide
  }));
  shell.castShadow = shell.receiveShadow = true;

  /* molded matte-gunmetal frame rails along top and bottom of visor */
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: hdr(.018, .018, .022), roughness: .38, metalness: .75, clearcoat: .4, envMap: envMap, envMapIntensity: .9
  });
  const fP = [], fIdx = [];
  const fQuad = (a, b) => {
    const base = fP.length / 3;
    for (let i = 0; i <= NA; i++) { fP.push(...a[i]); fP.push(...b[i]); }
    for (let i = 0; i < NA; i++) { const k = base + i * 2; fIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  };
  fQuad(ring(.004, yC + HT / 2 + .022, false), ring(.004, yC + HT / 2 - .006, false));
  fQuad(ring(.004, yC - HT / 2 + .006, true), ring(.004, yC - HT / 2 - .020, true));
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fP, 3));
  fg.setIndex(fIdx);
  fg.computeVertexNormals();
  const frameMesh = new THREE.Mesh(fg, frameMat);

  /* circular temple hinge pods on both sides (like Panel 1 reference) */
  const v = new THREE.Group();
  v.add(shell, frameMesh);
  [-1, 1].forEach(s => {
    const idxSide = s < 0 ? 11 : NA - 11;
    const a = -A + 2 * A * idxSide / NA, r = Rf[idxSide];
    const px = Math.sin(a) * r, pz = CZ + Math.cos(a) * r;
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(.048, .052, .028, 24), frameMat);
    pod.position.set(px, yC, pz);
    pod.quaternion.setFromUnitVectors(v3(0, 1, 0), v3(Math.sin(a), 0, Math.cos(a)).normalize());
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .034, 20), frameMat);
    cap.position.copy(pod.position);
    cap.quaternion.copy(pod.quaternion);
    v.add(pod, cap);
  });

  /* razor-sharp HDR laser eye beam inset in the glossy dark visor lens */
  const GA = .82, G = [], gi = [];
  const gb = Math.round(NA * (A - GA) / (2 * A)), ge = NA - gb;
  for (let i = gb; i <= ge; i++) {
    const a = -A + 2 * A * i / NA, r = Rf[i] + .004;
    const e = clamp(Math.min(i - gb, ge - i) / 8, 0, 1), k = 1 - e;
    const hBeam = .0135 * Math.sqrt(Math.max(.01, 1 - k * k));
    G.push(Math.sin(a) * r, yC + hBeam, CZ + Math.cos(a) * r, Math.sin(a) * r, yC - hBeam, CZ + Math.cos(a) * r);
  }
  for (let i = 0; i < ge - gb; i++) { const k = i * 2; gi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(G, 3));
  gg.setIndex(gi);
  const bar = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: hdr(8.5, .14, .06), side: THREE.DoubleSide }));

  v.add(bar);
  v.userData.frontZ = CZ + Rf[NA >> 1];
  return v;
}

/* ---------------------------------------------------- the cigarette */
/* Parked in the raised corner of the smirk: the corner is found on the
   sculpt itself, so the filter sits on the lips wherever they end up. */
function mouthCorner(x, y) {
  let z = 2;
  for (let k = 0; k < 240; k++) {
    const d = headSDF(x, y, z);
    if (d < 1e-4) break;
    z -= Math.max(d * .8, .002);
  }
  return new THREE.Vector3(x, y, z);
}

const CIG = { tip: new THREE.Vector3() };

function buildCigarette() {
  const R = .028, L = .6, F = .17;
  const corner = mouthCorner(.3, -.63 + smirk(.3));
  const dir = new THREE.Vector3(.84, -.14, .52).normalize();      /* out to the side, a slight droop */
  const g = new THREE.Group();
  g.position.copy(corner).addScaledVector(dir, -.045);              /* held between the lips */
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  const cyl = (r0, r1, h, y, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 28, 1), mat);
    m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  /* black filter, a hairline of red, white paper */
  cyl(R * 1.02, R * 1.02, F, F / 2, new THREE.MeshStandardMaterial({ color: hdr(.012, .012, .014), roughness: .7 }));
  cyl(R * 1.04, R * 1.04, .01, F - .012, new THREE.MeshBasicMaterial({ color: hdr(2.2, .06, .04) }));
  cyl(R, R, L - F, F + (L - F) / 2, new THREE.MeshStandardMaterial({ color: hdr(.62, .61, .6), roughness: .75 }));
  /* the burning edge, then a short grey cap of ash */
  CIG.emberMat = new THREE.MeshBasicMaterial({ color: hdr(3.2, .6, .12) });
  cyl(R * 1.005, R * .96, .016, L + .008, CIG.emberMat);
  cyl(R * .95, R * .8, .04, L + .036, new THREE.MeshStandardMaterial({ color: hdr(.09, .09, .09), roughness: 1 }));

  HEAD.group.add(g);
  g.updateWorldMatrix(true, false);
  CIG.tip.set(0, L + .06, 0).applyMatrix4(g.matrixWorld);

  /* the ember lights the lip and chin, and breathes */
  CIG.light = new THREE.PointLight(0xff5a28, .7, .9, 2);
  CIG.light.position.copy(CIG.tip);
  scene.add(CIG.light);
  return g;
}

/* ---------------------------------------------------- the smoke */
/* Points on the GPU: each particle leaves the ember on its own clock, rises,
   corkscrews wider as it climbs, and drifts with the air. Small at birth,
   so near the tip it reads as one thin stream. */
const SMOKE_VS = [
  'uniform float uT; uniform vec3 uTip; uniform float uPx;',
  'attribute float aSeed; attribute float aOff;',
  'varying float vA; varying float vSeed; varying float vAge;',
  'void main(){',
  '  float life = 6.5;',
  '  float age = fract(uT / life + aOff);',
  '  float t = age * life;',
  '  vec3 p = uTip;',
  '  p.y += t * 0.09 + t * t * 0.006;',
  '  p.x += t * 0.075 + sin(t * 0.8 + aSeed * 6.28) * 0.016 * t;',
  '  p.z += t * 0.02 + cos(t * 0.6 + aSeed * 12.0) * 0.016 * t;',
  '  float sw = 0.006 + t * 0.022;',
  '  p.x += sin(t * 1.7 + aSeed * 40.0) * sw;',
  '  p.z += cos(t * 1.3 + aSeed * 23.0) * sw;',
  '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  '  gl_PointSize = uPx * (0.016 + t * 0.045) / -mv.z;',
  '  gl_Position = projectionMatrix * mv;',
  '  vA = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.25, 1.0, age));',
  '  vSeed = aSeed; vAge = age;',
  '}'
].join('\n');
const SMOKE_FS = [
  'uniform float uAlpha;',
  'varying float vA; varying float vSeed; varying float vAge;',
  'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'void main(){',
  '  vec2 pc = gl_PointCoord - 0.5;',
  '  float r = length(pc);',
  '  if (r > 0.5) discard;',
  '  float a = vSeed * 6.2831 + vAge * 2.5;',                       /* each puff turns as it rises */
  '  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * pc;',
  '  float f = n(q * 3.0 + vSeed * 17.0) * 0.6 + n(q * 7.0 + vSeed * 5.0) * 0.4;',
  '  float alpha = smoothstep(0.5, 0.0, r) * smoothstep(0.32, 0.8, f) * vA * uAlpha;',
  '  gl_FragColor = vec4(0.6, 0.6, 0.64, alpha);',
  '}'
].join('\n');

function buildSmoke() {
  const N = 150, rnd = mulberry32(7);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), off = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = rnd(); off[i] = i / N + rnd() / N; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
  CIG.smokeMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uTip: { value: CIG.tip.clone() }, uPx: { value: 1000 }, uAlpha: { value: .13 } },
    vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS,
    transparent: true, depthWrite: false
  });
  const pts = new THREE.Points(g, CIG.smokeMat);
  pts.frustumCulled = false;
  pts.renderOrder = 100;
  return pts;
}
/* The exhale: every particle leaves the lips inside the first second of the
   breath, is pushed out and slows, then rises and spreads. uStart is the
   breath's start time; before it, and after a particle's life, it is gone. */
const EXHALE_VS = [
  'uniform float uT; uniform float uStart; uniform vec3 uMouth; uniform float uPx;',
  'attribute float aSeed; attribute float aOff;',
  'varying float vA; varying float vSeed; varying float vAge;',
  'void main(){',
  '  float life = 3.2;',
  '  float age = uT - (uStart + aOff * 1.0);',
  '  float k = clamp(age / life, 0.0, 1.0);',
  '  vec3 dir = normalize(vec3((aSeed - 0.5) * 0.7, -0.2 + aSeed * 0.15, 1.0));',
  '  vec3 p = uMouth + dir * 0.45 * (1.0 - exp(-max(age, 0.0) * 1.7));',
  '  p += vec3(0.05 * age, 0.04 * age + 0.03 * age * age, 0.0);',
  '  float sw = 0.01 + max(age, 0.0) * 0.05;',
  '  p.x += sin(age * 1.9 + aSeed * 30.0) * sw; p.y += cos(age * 1.5 + aSeed * 17.0) * sw * 0.6;',
  '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  '  vA = (age < 0.0 || age > life) ? 0.0 : smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.25, 1.0, k));',
  '  gl_PointSize = vA > 0.0 ? uPx * (0.035 + max(age, 0.0) * 0.085) / -mv.z : 0.0;',
  '  gl_Position = projectionMatrix * mv;',
  '  vSeed = aSeed; vAge = k;',
  '}'
].join('\n');

function buildExhale() {
  const N = 90, rnd = mulberry32(19);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), off = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = rnd(); off[i] = rnd(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
  CIG.mouth = mouthCorner(.04, -.64).add(new THREE.Vector3(0, 0, .03)).applyMatrix4(HEAD.group.matrixWorld);
  CIG.exhaleMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uStart: { value: -99 }, uMouth: { value: CIG.mouth }, uPx: { value: 1000 }, uAlpha: { value: .16 } },
    vertexShader: EXHALE_VS, fragmentShader: SMOKE_FS,
    transparent: true, depthWrite: false
  });
  const pts = new THREE.Points(g, CIG.exhaleMat);
  pts.frustumCulled = false;
  pts.renderOrder = 101;
  return pts;
}

/* point sizes are in world units: scale by the buffer's pixels per unit at depth 1 */
function smokePx() {
  if (!CIG.smokeMat) return;
  const h = renderer.domElement.height;
  const px = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  CIG.smokeMat.uniforms.uPx.value = px;
  if (CIG.exhaleMat) CIG.exhaleMat.uniforms.uPx.value = px;
  if (WORD.mat) WORD.mat.uniforms.uPx.value = px;
}

/* ============================================================ the body */
/* He stands the way he smirks: weight dropped on his right leg, the left
   one loose and turned out, right hand shoved in a pocket, the chrome
   thumb hooked in his belt. Everything below the collar is built from the
   same three tools as the head — SDF projections for the big soft volumes,
   tubes for limbs and trims, and fabric painted into tiling normal maps. */
const FLOOR_Y = -7.85;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* --- fabrics: one tile of height, turned into a normal map that repeats */
function tiledNormal(size, heightAt, strength) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = heightAt(x / size, y / size, x, y);
  const out = new Uint8Array(size * size * 4), S = strength;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const du = (h[y * size + (x + 1) % size] - h[y * size + (x - 1 + size) % size]) * S;
    const dv = (h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x]) * S;
    const il = 1 / Math.hypot(du, dv, 1), p = (y * size + x) * 4;
    out[p] = (-du * il * .5 + .5) * 255; out[p + 1] = (-dv * il * .5 + .5) * 255; out[p + 2] = (il * .5 + .5) * 255; out[p + 3] = 255;
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = Math.min(8, maxAniso);
  t.needsUpdate = true;
  return t;
}
const withRepeat = (tex, u, v) => { const t = tex.clone(); t.repeat.set(u, v); t.needsUpdate = true; return t; };

function fabrics() {
  /* fine suiting wool weave for the tailored overcoat */
  const wool = tiledNormal(256, (u, v, x, y) => .5 + .24 * Math.sin(u * Math.PI * 2 * 42) * Math.cos(v * Math.PI * 2 * 42) + (vnoise(x * .6, y * .6, 1.4) - .5) * .35, 1.7);
  /* diagonal wool-twill with subtle vertical suiting pinstripe for the 70s waistcoat & pleated trousers */
  const twill = tiledNormal(256, (u, v, x, y) => {
    const diag = .28 * Math.sin((u * 28 + v * 28) * Math.PI * 2);
    const stripe = .18 * Math.pow(Math.max(0, Math.cos(u * Math.PI * 2 * 16)), 12);
    return .5 + diag + stripe + (vnoise(x * .5, y * .5, 2.3) - .5) * .22;
  }, 1.9);
  /* crisp cotton poplin for the dress shirt */
  const poplin = tiledNormal(256, (u, v, x, y) => .5 + .15 * Math.sin(u * Math.PI * 2 * 64) * Math.sin(v * Math.PI * 2 * 64) + (vnoise(x * .8, y * .8, 3.7) - .5) * .18, 1.1);
  /* fine calfskin leather grain for dress shoes and belt */
  const grain = tiledNormal(256, (u, v, x, y) => vnoise(x * .35, y * .35, 4.4) * .6 + vnoise(x * .08, y * .08, 5.1) * .4, 2.0);
  return { wool, twill, poplin, grain };
}

function bodyMaterials(env) {
  const F = fabrics();
  return {
    F,
    coat: new THREE.MeshPhysicalMaterial({
      color: hdr(.011, .011, .014), roughness: .75, metalness: .02,
      sheen: .10, sheenRoughness: .58, sheenColor: hdr(.022, .024, .032),
      normalMap: withRepeat(F.wool, 8, 16), normalScale: new THREE.Vector2(.75, .75),
      envMap: env, envMapIntensity: .36, side: THREE.DoubleSide
    }),
    lapel: new THREE.MeshPhysicalMaterial({
      color: hdr(.013, .013, .017), roughness: .68, metalness: .03,
      sheen: .14, sheenRoughness: .52, sheenColor: hdr(.028, .032, .042),
      normalMap: withRepeat(F.wool, 5, 10), normalScale: new THREE.Vector2(.62, .62),
      envMap: env, envMapIntensity: .40, side: THREE.DoubleSide
    }),
    seamWelt: new THREE.MeshPhysicalMaterial({
      color: hdr(.017, .018, .023), roughness: .58, metalness: .04,
      sheen: .18, sheenRoughness: .45, sheenColor: hdr(.035, .038, .050),
      envMap: env, envMapIntensity: .44, side: THREE.DoubleSide
    }),
    vest: new THREE.MeshPhysicalMaterial({
      color: hdr(.014, .014, .018), roughness: .72, metalness: .03,
      sheen: .10, sheenRoughness: .55, sheenColor: hdr(.024, .026, .034),
      normalMap: withRepeat(F.twill, 6, 10), normalScale: new THREE.Vector2(.68, .68),
      envMap: env, envMapIntensity: .38, side: THREE.DoubleSide
    }),
    lining: new THREE.MeshStandardMaterial({
      color: hdr(.055, .006, .009), emissive: hdr(.010, .001, .001), roughness: .62, side: THREE.DoubleSide
    }),
    dressShirt: new THREE.MeshPhysicalMaterial({
      color: hdr(.27, .28, .31), roughness: .62, metalness: .01, clearcoat: .03,
      normalMap: withRepeat(F.poplin, 8, 8), normalScale: new THREE.Vector2(.32, .32),
      envMap: env, envMapIntensity: .32, side: THREE.DoubleSide
    }),
    tie: new THREE.MeshPhysicalMaterial({
      color: hdr(.13, .009, .018), roughness: .38, metalness: .05, clearcoat: .22, clearcoatRoughness: .28,
      normalMap: withRepeat(F.twill, 8, 12), normalScale: new THREE.Vector2(.28, .28),
      envMap: env, envMapIntensity: .65, side: THREE.DoubleSide
    }),
    button: new THREE.MeshPhysicalMaterial({
      color: hdr(.018, .018, .022), roughness: .26, metalness: .45, clearcoat: .75, envMap: env, envMapIntensity: .85
    }),
    neon: new THREE.MeshBasicMaterial({ color: hdr(4.2, .11, .06) }),
    neonSoft: new THREE.MeshBasicMaterial({ color: hdr(1.6, .04, .03) }),
    chrome: new THREE.MeshPhysicalMaterial({ color: hdr(.78, .81, .86), metalness: 1, roughness: .17, clearcoat: .6, clearcoatRoughness: .14, envMap: env, envMapIntensity: 1.4 }),
    chromeDark: new THREE.MeshPhysicalMaterial({ color: hdr(.065, .070, .082), metalness: .92, roughness: .32, clearcoat: .28, envMap: env, envMapIntensity: 1.0 }),
    pants: new THREE.MeshPhysicalMaterial({
      color: hdr(.015, .015, .019), roughness: .78, metalness: .02, clearcoat: 0,
      normalMap: withRepeat(F.twill, 7, 14), normalScale: new THREE.Vector2(.62, .62),
      envMap: env, envMapIntensity: .35
    }),
    strap: new THREE.MeshPhysicalMaterial({
      color: hdr(.012, .011, .012), roughness: .42, clearcoat: .35,
      normalMap: withRepeat(F.grain, 4, 8), normalScale: new THREE.Vector2(.4, .4), envMap: env, envMapIntensity: .55
    }),
    boot: new THREE.MeshPhysicalMaterial({
      color: hdr(.008, .008, .010), roughness: .38, metalness: .04, clearcoat: .35, clearcoatRoughness: .28,
      normalMap: withRepeat(F.grain, 5, 5), normalScale: new THREE.Vector2(.38, .38), envMap: env, envMapIntensity: .35
    }),
    sole: new THREE.MeshStandardMaterial({ color: hdr(.016, .015, .017), roughness: .88 }),
    furHand: new THREE.MeshStandardMaterial({ color: hdr(.016, .015, .014), roughness: .84, normalMap: withRepeat(F.wool, 6, 6) }),
    skinHand: new THREE.MeshPhysicalMaterial({ color: hdr(.075, .046, .034), roughness: .54, clearcoat: .08, envMap: env, envMapIntensity: .28 }),
    guitarWood: new THREE.MeshPhysicalMaterial({ color: hdr(.026, .013, .009), roughness: .24, clearcoat: .85, clearcoatRoughness: .14, envMap: env, envMapIntensity: .9 })
  };
}

/* --- a tube along a path; safe against collinear, 2-point, or duplicate paths */
function tubeGeometry(pts, radius, radial, seg) {
  const raw = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].distanceToSquared(raw[raw.length - 1]) > 1e-6) raw.push(pts[i].clone());
  }
  if (raw.length === 2) {
    raw.splice(1, 0, raw[0].clone().lerp(raw[1], .5).add(v3(1e-4, 1e-4, -1e-4)));
  }
  const clean = raw.map((p, i) => {
    const c = p.clone();
    c.x += Math.sin(i * 1.7 + .3) * 1e-4;
    c.z += Math.cos(i * 2.3 + .7) * 1e-4;
    return c;
  });
  const curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal');
  const fr = curve.computeFrenetFrames(seg, false);
  const P = [], UV = [], I = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t);
    let n = fr.normals[i], b = fr.binormals[i];
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.z) ||
        !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) {
      n = v3(1, 0, 0); b = v3(0, 0, 1);
    }
    for (let j = 0; j <= radial; j++) {
      const th = j / radial * Math.PI * 2, r = radius(t, th), cx = Math.cos(th), sx = Math.sin(th);
      P.push(c.x + (cx * n.x + sx * b.x) * r, c.y + (cx * n.y + sx * b.y) * r, c.z + (cx * n.z + sx * b.z) * r);
      UV.push(j / radial, t);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    I.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}
function mesh(geo, mat, shadow) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow !== false; m.receiveShadow = true;
  return m;
}
function ball(p, r, mat, s) {
  const m = mesh(new THREE.SphereGeometry(1, 32, 24), mat);
  m.position.copy(p); m.scale.set(r * (s ? s[0] : 1), r * (s ? s[1] : 1), r * (s ? s[2] : 1));
  return m;
}
function ringAt(p, d, r, tube, mat) {
  const m = mesh(new THREE.TorusGeometry(r, tube, 10, 48), mat, false);
  m.position.copy(p);
  m.quaternion.setFromUnitVectors(v3(0, 0, 1), d.clone().normalize());
  return m;
}
function surfaceAlong(sdf, o, d, tMax) {
  let t = tMax;
  for (let k = 0; k < 240; k++) {
    const dd = sdf(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
    if (dd < 1e-4) break;
    t -= Math.max(dd * .8, .002);
  }
  return o.clone().addScaledVector(d, t);
}

/* --- Solid 3D cloth shell builder: creates a watertight garment panel with outward-facing normals & stitched edges */
function solidClothShell(NR, NC, pointAt, thickness, radialCenter) {
  const stride = NC + 1, count = (NR + 1) * stride;
  const outP = new Array(count), N = new Array(count);
  for (let r = 0; r <= NR; r++) {
    const v = r / NR;
    for (let c = 0; c <= NC; c++) {
      outP[r * stride + c] = pointAt(c / NC, v, c, r);
    }
  }
  /* Determine consistent winding sign across the whole panel so outer faces always point outward */
  const dU = new THREE.Vector3(), dV = new THREE.Vector3();
  let orientVotes = 0;
  for (let r = 0; r <= NR; r++) {
    const r0 = Math.max(0, r - 1), r1 = Math.min(NR, r + 1);
    for (let c = 0; c <= NC; c++) {
      const c0 = Math.max(0, c - 1), c1 = Math.min(NC, c + 1);
      const p = outP[r * stride + c];
      dU.subVectors(outP[r * stride + c1], outP[r * stride + c0]);
      dV.subVectors(outP[r1 * stride + c], outP[r0 * stride + c]);
      /* Standard grid quad (a, a+stride, a+stride+1, a+1) has geometric normal dV x dU */
      const n = new THREE.Vector3().crossVectors(dV, dU);
      if (n.lengthSq() < 1e-10) n.set(0, 0, 1); else n.normalize();
      const refX = radialCenter ? p.x - radialCenter.x : p.x;
      const refZ = radialCenter ? p.z - radialCenter.z : p.z + .05;
      if (n.x * refX + n.z * refZ >= 0) orientVotes++; else orientVotes--;
      N[r * stride + c] = n;
    }
  }
  const flip = orientVotes < 0;
  if (flip) {
    for (let i = 0; i < count; i++) N[i].negate();
  }

  const P = [], UV = [], I = [];
  for (let pass = 0; pass < 2; pass++) {
    const off = pass === 0 ? 0 : -thickness;
    for (let r = 0; r <= NR; r++) {
      for (let c = 0; c <= NC; c++) {
        const idx = r * stride + c, p = outP[idx], n = N[idx];
        P.push(p.x + n.x * off, p.y + n.y * off, p.z + n.z * off);
        UV.push(c / NC, r / NR);
      }
    }
  }
  const quad = (a, b, c, d, rev) => {
    if (rev) I.push(a, c, b, a, d, c);
    else I.push(a, b, c, a, c, d);
  };
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      const a = r * stride + c, b = a + 1, d = a + stride, e = d + 1;
      quad(a, d, e, b, flip);
      quad(count + a, count + b, count + e, count + d, flip);
    }
  }
  /* Stitch all 4 perimeter edges for real tailored cloth thickness */
  for (let c = 0; c < NC; c++) {
    const t0 = c, t1 = c + 1;
    quad(t0, t1, count + t1, count + t0, flip);
    const b0 = NR * stride + c, b1 = b0 + 1;
    quad(b1, b0, count + b0, count + b1, flip);
  }
  for (let r = 0; r < NR; r++) {
    const l0 = r * stride, l1 = (r + 1) * stride;
    quad(l1, l0, count + l0, count + l1, flip);
    const r0 = r * stride + NC, r1 = (r + 1) * stride + NC;
    quad(r0, r1, count + r1, count + r0, flip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/* Anatomical menswear torso cross-section helper (tapered neck, broad barrel chest, stocky primate waist) */
function torsoCrossSection(y, a, extraRx, extraRz) {
  const sx = Math.sin(a), cz = Math.cos(a);
  const neckTaper = smooth(-1.62, -1.00, y);
  const chestFullness = smooth(-3.9, -1.5, y) * (1 - .68 * neckTaper);
  const waistTaper = Math.exp(-Math.pow((y + 3.60) / .70, 2));
  const hipFlare = smooth(-3.60, -4.35, y);
  const rx = (.92 + .16 * chestFullness - .44 * neckTaper - .04 * waistTaper + .05 * hipFlare) + (extraRx || 0);
  const rzFront = (.53 + .09 * chestFullness - .18 * neckTaper - .03 * waistTaper + .03 * hipFlare) + (extraRz || 0);
  const rzBack = (.48 + .06 * chestFullness - .14 * neckTaper - .03 * waistTaper + .04 * hipFlare) + (extraRz || 0);
  const rz = cz >= 0 ? rzFront : rzBack;
  const sq = 1 + .06 * chestFullness * Math.sin(a * 2) * Math.sin(a * 2);
  return v3(sx * rx * sq, y, -.04 + cz * rz * sq);
}

/* --- 1970s Formal Suit: Crisp Dress Shirt, Sculpted Burgundy Tie, 5-Button Waistcoat & Billowing Overcoat */
function buildJacket(M) {
  const g = new THREE.Group();

  /* =========================================================================
     SEGMENT 1: Crisp Dress Shirt Placket, Neckband Stand & Sharp Triangular Collar Wings
     Tucked cleanly inside the waistcoat V-neck & under the bearded chin (Panels 1, 2 & 3)
     ========================================================================= */
  const shirtBib = solidClothShell(24, 24, (u, v) => {
    const y = lerp(-1.08, -2.42, v);
    const maxA = lerp(.40, .46, smooth(0, .4, v));
    const a = lerp(-maxA, maxA, u);
    const p = torsoCrossSection(y, a, -.038, -.024);
    const placket = Math.abs(p.x) < .038 ? .005 : 0;
    p.z += placket;
    return p;
  }, .012);
  g.add(mesh(shirtBib, M.dressShirt));

  /* Smooth continuous collar stand hugging the neck inside the coat collar */
  const shirtStand = solidClothShell(10, 32, (u, v) => {
    const a = lerp(-.80, .80, u);
    const y = lerp(-.98, -1.28, v);
    return torsoCrossSection(y, a, -.035, -.020);
  }, .012);
  g.add(mesh(shirtStand, M.dressShirt));

  /* Left & Right Crisp Triangular Pointed Dress-Shirt Collar Wings framing the tie knot */
  [-1, 1].forEach(s => {
    const wingGeo = solidClothShell(16, 26, (u, v) => {
      const a = s * lerp(.025, .64, u);
      const yTop = -1.00 - .04 * Math.cos(u * Math.PI * .5);
      const uPeak = .45;
      const tri = u <= uPeak
        ? smooth(0, 1, u / uPeak)
        : 1 - smooth(0, 1, (u - uPeak) / (1 - uPeak));
      const yBot = lerp(-1.12, -1.62, tri);
      const y = lerp(yTop, yBot, v);
      const base = torsoCrossSection(y, a, -.028, -.016);
      const lift = .012 + .020 * v * (.35 + .65 * tri);
      base.z += lift * Math.cos(a * .55);
      base.x += s * lift * .45 * Math.sin(Math.abs(a) * .55);
      return base;
    }, .014);
    g.add(mesh(wingGeo, M.dressShirt));
  });

  /* =========================================================================
     SEGMENT 2: Sculpted 3D Burgundy Silk Necktie (Knot + Dimpled 70s Blade)
     Tucks cleanly BEHIND the waistcoat V-neck at y = -2.24 so it never bleeds through
     ========================================================================= */
  {
    const knotGeo = solidClothShell(14, 18, (u, v) => {
      const uu = (u - .5) * 2;
      const y = lerp(-1.06, -1.34, v);
      const w = lerp(.092, .052, Math.pow(v, .85));
      const x = uu * w;
      const baseZ = torsoCrossSection(y, 0, -.038, -.024).z;
      const dome = Math.sqrt(Math.max(0, 1 - uu * uu * .88)) * lerp(.048, .034, v);
      const wrapFold = .004 * Math.sin(uu * 2.5 + v * 3.0);
      return v3(x, y, baseZ + .018 + dome + wrapFold);
    }, .020);
    g.add(mesh(knotGeo, M.tie));

    const bladeGeo = solidClothShell(28, 20, (u, v) => {
      const uu = (u - .5) * 2;
      const y = lerp(-1.31, -2.38, v);
      const belly = smooth(0, .58, v);
      const w = lerp(.050, .148, belly);
      const x = uu * w;
      const baseZ = torsoCrossSection(y, x * .70, -.038, -.024).z;
      const arch = Math.sqrt(Math.max(0, 1 - uu * uu * .85)) * .024;
      const dimple = -.012 * Math.exp(-Math.pow(uu / .30, 2)) * (1 - smooth(0, .52, v));
      const tuckIn = -.045 * smooth(-1.92, -2.32, y);
      return v3(x, y, baseZ + .018 + arch + dimple + tuckIn);
    }, .012);
    g.add(mesh(bladeGeo, M.tie));
  }

  /* =========================================================================
     SEGMENT 3: Tailored 5-Button 1970s Waistcoat (Vest) with Crisp V-Collar Welt,
     Stylized Horizontal Button-Pull Drape & 4 Recessed Welt Pockets
     ========================================================================= */
  const vestSurfaceAt = (s, u, v) => {
    const vNeckT = clamp(u / .22, 0, 1);
    const armholeScoop = Math.exp(-Math.pow((u - .46) / .14, 2));
    const yTop = u <= .22
      ? lerp(-2.26, -1.18, Math.pow(vNeckT, .88))
      : -1.18 - .50 * armholeScoop - .04 * smooth(.22, 1.0, u);

    let yBot;
    if (u < .16) {
      yBot = lerp(-3.98, -4.42, smooth(0, .16, u));
    } else {
      yBot = lerp(-4.42, -4.12, smooth(.16, .48, u));
    }
    const y = lerp(yTop, yBot, v);

    const aMin = u < .04 && y < -2.22 && y > -3.96 ? (s < 0 ? .012 : -.015) : s * .010;
    const a = aMin + s * u * Math.PI;
    const p = torsoCrossSection(y, a, .018, .018);

    const shSlope = (1 - v) * .16 * Math.exp(-Math.pow((u - .24) / .12, 2));
    p.y -= shSlope;

    const frontFactor = Math.exp(-Math.pow(u / .26, 2)) * smooth(-2.22, -2.45, y) * smooth(-4.02, -3.72, y);
    const buttonPull = .010 * Math.cos((y + 2.40) * Math.PI * 2 / .34) * frontFactor;
    const overlap = (s < 0 ? .012 : .002) * Math.exp(-Math.pow(u / .07, 2));
    p.z += buttonPull + overlap;
    return p;
  };

  [-1, 1].forEach(s => {
    const vestPanel = solidClothShell(44, 38, (u, v) => vestSurfaceAt(s, u, v), .024);
    g.add(mesh(vestPanel, M.vest));

    const vCollar = solidClothShell(8, 24, (u, v) => {
      const uu = u * .22;
      const p = vestSurfaceAt(s, uu, v * .058);
      p.z += .014 * Math.sin(v * Math.PI);
      return p;
    }, .014);
    g.add(mesh(vCollar, M.seamWelt));

    [
      { u0: .065, u1: .215, v0: .73, tilt: -.022 },
      { u0: .075, u1: .195, v0: .36, tilt: -.028 }
    ].forEach(pk => {
      const welt = solidClothShell(5, 14, (u, v) => {
        const uu = lerp(pk.u0, pk.u1, u);
        const vv = pk.v0 + u * pk.tilt + (v - .5) * .028;
        const p = vestSurfaceAt(s, uu, vv);
        p.z += .016 * Math.sin(v * Math.PI);
        return p;
      }, .012);
      g.add(mesh(welt, M.seamWelt));
    });
  });

  for (const by of [-2.40, -2.74, -3.08, -3.42, -3.76]) {
    const bp = torsoCrossSection(by, 0, .018, .018);
    bp.z += .038;
    const btn = mesh(new THREE.CylinderGeometry(.034, .034, .018, 20), M.button);
    btn.rotation.x = Math.PI / 2;
    btn.position.copy(bp);
    g.add(btn);
  }

  /* =========================================================================
     SEGMENT 4: Tailored 1970s Long Overcoat with Broad Primate Shoulders,
     Stocky Barrel Chest, Deep Stylized Pleats & Wind-Billowed Skirt (Panels 1, 2 & 3)
     ========================================================================= */
  const coatPointAt = (u, v) => {
    const yokeT = smooth(0, .085, v);
    const bodyV = clamp((v - .085) / .915, 0, 1);
    const y = v <= .085
      ? lerp(-1.18, -1.52, yokeT)
      : lerp(-1.52, -6.28, bodyV);

    const chestT = smooth(-3.8, -1.4, y);
    const waistT = Math.exp(-Math.pow((y + 3.65) / .70, 2));
    const skirtT = smooth(-3.65, -6.28, y);
    const billow = Math.pow(skirtT, .92);

    /* Above the waist the coat frames the vest; below the waist the front edges part diagonally (/ \).
       On the right side (u -> 1), the front edge sweeps wider and back behind the pocketed right wrist (like Panel 2). */
    const ALeft = .38 + .02 * smooth(-1.18, -3.65, y) + .24 * Math.pow(skirtT, .95);
    const pocketPart = .34 * smooth(-2.15, -3.85, y) * (1 - .22 * smooth(-4.8, -6.28, y));
    const ARight = ALeft + pocketPart;
    const a = lerp(ALeft, Math.PI * 2 - ARight, u);
    const sx = Math.sin(a), cz = Math.cos(a), ax = Math.abs(sx);

    /* Broad, stocky primate shoulders: right side extends over thick wool sleeve cap; left side has sleeveless armhole */
    const sideReach = sx < 0 ? .38 : .22;
    const shHead = Math.exp(-Math.pow((y + 1.68) / .55, 2)) * Math.pow(ax, 1.15);
    const rxYoke = lerp(.62, 1.02 + sideReach * ax, yokeT);
    const rxBody = 1.02
      + (sx < 0 ? .26 : .14) * ax * smooth(-3.5, -1.5, y)
      + .16 * shHead
      + .08 * chestT
      - .02 * waistT
      + .88 * billow * (.36 + .64 * ax);
    const rx = v <= .085 ? rxYoke : rxBody;

    const rzYoke = lerp(.48, .58, yokeT);
    const rzBody = .58
      + .06 * chestT
      - .02 * waistT
      + .30 * billow;
    const rz = v <= .085 ? rzYoke : rzBody;

    const shDrop = v <= .085 ? yokeT * ax * .04 : (.04 * ax * Math.exp(-Math.pow((y + 1.52) / .35, 2)));
    const frontEdgeDist = Math.min(u, 1 - u);
    const torsoDrape = .012 * Math.sin(u * Math.PI * 8) * smooth(-1.6, -3.6, y) * (1 - skirtT);
    const pleatWave = Math.sin(u * Math.PI * 7) * smooth(0, .06, frontEdgeDist);
    const flute = billow * (.11 * pleatWave + .05 * Math.cos(a * 4));
    const hemWave = Math.pow(skirtT, 2.2) * .08 * pleatWave;
    const sweepBack = billow * .14 * (1 - cz) * .5;
    const wingLift = billow * .12 * Math.pow(ax, 1.4) + hemWave;

    /* Right wrist/hand in trouser pocket pushes the right coat flap backward & outward behind the hip */
    const rightPocketZone = smooth(.65, .98, u) * smooth(-2.15, -3.75, y) * (1 - .28 * smooth(-4.85, -6.28, y));
    const pocketPushZ = -.32 * rightPocketZone;
    const pocketPushX = -.15 * rightPocketZone;

    const x = sx * (rx + flute + torsoDrape) + pocketPushX;
    const py = y - shDrop + wingLift;
    const z = -.05 + cz * (rz + flute * .6 + torsoDrape) - sweepBack + pocketPushZ;
    return v3(x, py, z);
  };

  const coatShell = solidClothShell(72, 84, coatPointAt, .040);
  g.add(mesh(coatShell, M.coat));

  const liningShell = solidClothShell(44, 56, (u, v) => {
    const p = coatPointAt(.02 + u * .96, .35 + v * .63);
    const n = v3(p.x, 0, p.z + .05).normalize();
    return p.addScaledVector(n, -.043);
  }, .006);
  g.add(mesh(liningShell, M.lining, false));

  /* =========================================================================
     SEGMENT 5: Proportional 3D Step-Notch Suit Lapels with Top-Stitched Edge Bevels,
     Coat Buttons & Sculpted Hip Pocket Flaps (Panels 1, 2 & 3)
     ========================================================================= */
  [-1, 1].forEach(s => {
    const lapelPointAt = (u, v) => {
      const y = lerp(-1.36, -3.72, v);
      const tCoat = clamp(.085 + (y - (-1.52)) / (-6.28 - (-1.52)) * .915, .04, .98);
      const uIn = s > 0 ? 0 : 1;
      const stepOut = smooth(0, .055, v);
      const taperDown = 1 - smooth(.07, 1.0, v);
      const widthU = (.018 + .054 * stepOut) * Math.pow(taperDown, .82);
      const uCoat = clamp(uIn + s * u * widthU, 0, 1);
      const base = coatPointAt(uCoat, tCoat);
      const roll = Math.sin(u * Math.PI * .72);
      const lift = .018 + .028 * roll * taperDown + .016 * u * stepOut * taperDown;
      base.z += lift;
      base.x += s * u * .038 * stepOut * taperDown;
      return base;
    };
    const lapelGeo = solidClothShell(36, 16, lapelPointAt, .024);
    g.add(mesh(lapelGeo, M.lapel));

    const lapelEdgePts = [];
    for (let r = 0; r <= 36; r++) {
      lapelEdgePts.push(lapelPointAt(1, r / 36).add(v3(0, 0, .005)));
    }
    g.add(mesh(tubeGeometry(lapelEdgePts, () => .008, 8, 48), M.seamWelt, false));

    const flapGeo = solidClothShell(8, 16, (u, v) => {
      const uCoat = s > 0 ? lerp(.035, .135, u) : lerp(.965, .865, u);
      const vCoat = lerp(.50, .532, v) + u * .008;
      const p = coatPointAt(uCoat, vCoat);
      p.z += .018 + .006 * Math.sin(v * Math.PI);
      return p;
    }, .016);
    g.add(mesh(flapGeo, M.lapel));
  });

  for (const vBtn of [.44, .54]) {
    const bp = coatPointAt(.975, vBtn);
    bp.z += .024;
    const btn = mesh(new THREE.CylinderGeometry(.044, .044, .018, 20), M.button);
    btn.rotation.x = Math.PI / 2;
    btn.position.copy(bp);
    g.add(btn);
  }

  /* =========================================================================
     SEGMENT 6: True < and > Flared Winged Popped Overcoat Collar (Panels 1, 2 & 3)
     ========================================================================= */
  {
    const colNR = 18, colNC = 64;
    const collarPointAt = (u, v) => {
      const s = u < .5 ? 1 : -1;
      const distFromFront = Math.min(u, 1 - u);
      const wingZone = smooth(.24, 0, distFromFront);

      const uClamped = clamp(.005 + u * .99, .005, .995);
      const a = lerp(.38, Math.PI * 2 - .38, uClamped);
      const sx = Math.sin(a), cz = Math.cos(a);

      const baseX = lerp(sx * .62, s * .46, wingZone);
      const baseY = lerp(-1.20, -1.42, wingZone);
      const baseZ = lerp(-.05 + cz * .48, .52, wingZone);

      const topX = lerp(sx * .70, s * 1.02, Math.pow(wingZone, .85));
      const topY = lerp(-.74, -1.08, Math.pow(wingZone, .90));
      const topZ = lerp(-.05 + cz * .54, .48, wingZone);

      const roll = Math.sin(v * Math.PI) * .025 * wingZone;
      return v3(
        lerp(baseX, topX, v) + s * roll,
        lerp(baseY, topY, v) + roll * .5,
        lerp(baseZ, topZ, v) + roll
      );
    };
    const collarGeo = solidClothShell(colNR, colNC, collarPointAt, .024);
    g.add(mesh(collarGeo, M.lapel));

    const leftEdge = [], topEdge = [], rightEdge = [];
    for (let r = 0; r <= colNR; r++) {
      const v = r / colNR;
      leftEdge.push(collarPointAt(0, v).add(v3(.004, 0, .006)));
      rightEdge.push(collarPointAt(1, v).add(v3(-.004, 0, .006)));
    }
    for (let c = 1; c < colNC; c++) {
      topEdge.push(collarPointAt(c / colNC, 1).add(v3(0, .004, .004)));
    }
    const rimPath = leftEdge.concat(topEdge, rightEdge.reverse());
    g.add(mesh(tubeGeometry(rimPath, () => .010, 12, 136), M.neon, false));
  }

  return g;
}

/* ===========================================================================
   SEGMENT 7: Cool Swagger Arm Pose — Right Arm Bent Outward with Hand Casually Tucked
   into the Trouser Pocket (Panel 2); Left Cyber-Arm Cocked in Hydraulic Readiness
   =========================================================================== */
const R_SH_CAP = v3(-.92, -1.68, -.02), R_SH = v3(-1.22, -1.84, -.04), R_EL = v3(-1.62, -2.90, -.16), R_WR = v3(-.94, -3.96, .22);
const L_SH = v3(1.22, -1.66, .03),       L_EL = v3(1.60, -2.86, -.10),  L_WR = v3(1.48, -4.14, .30);

function buildArms(M) {
  const g = new THREE.Group();

  /* --- RIGHT ARM: Bent at Elbow with Forearm Angling Inward to Trouser Pocket (Like Panel 2) --- */
  const rMidFore = v3(-1.32, -3.48, .05);
  const rPath = [
    R_SH_CAP,
    R_SH,
    R_SH.clone().lerp(R_EL, .50).add(v3(-.04, 0, -.02)),
    R_EL,
    rMidFore,
    R_WR
  ];
  const sleeveProfile = (t, th) => {
    const capGrow = smooth(0, .15, t);
    const baseR = lerp(.16, .355, capGrow) * lerp(1.0, .68, Math.pow(clamp((t - .15) / .85, 0, 1), .82));
    const bicepDrape = .020 * Math.sin(t * 22 + th * 2) * smooth(.15, .42, t) * (1 - smooth(.50, .82, t));
    /* Deep accordion compression folds inside the bent right elbow crook (t ~ 0.56) */
    const elbowZone = Math.exp(-Math.pow((t - .56) / .17, 2));
    const elbowCrease = .044 * elbowZone * (
      .68 * Math.sin(t * 52 + Math.cos(th) * 2.4) +
      .32 * Math.cos(t * 32 - Math.sin(th) * 3.0)
    ) * (.58 + .42 * Math.cos(th));
    const cuffLip = .014 * smooth(.92, .98, t);
    return baseR + bicepDrape + elbowCrease + cuffLip;
  };
  g.add(mesh(tubeGeometry(rPath, sleeveProfile, 36, 116), M.coat));

  const rFore = R_WR.clone().sub(rMidFore).normalize();
  for (let k = 0; k < 3; k++) {
    const btnPos = R_WR.clone().addScaledVector(rFore, -.26 + k * .080).add(v3(-.21, -.04, .06));
    const b = mesh(new THREE.CylinderGeometry(.020, .020, .012, 14), M.button);
    b.rotation.set(.4, .2, 1.1);
    b.position.copy(btnPos);
    g.add(b);
  }

  /* Crisp white dress-shirt barrel cuff angled into the trouser pocket */
  g.add(mesh(tubeGeometry([R_WR.clone().addScaledVector(rFore, -.02), R_WR.clone().addScaledVector(rFore, .12)],
    () => .210, 28, 14), M.dressShirt));

  /* Right Chimpanzee Hand Casually Tucked Inside the Slanted Trouser Pocket (Like Panel 2):
     Dark furred dorsal back of hand sliding behind the slanted trouser pocket welt */
  const rPalm = R_WR.clone().addScaledVector(rFore, .22).add(v3(.04, -.02, -.02));
  g.add(ball(rPalm, .185, M.furHand, [.88, 1.15, .56]));
  /* Subtle furred thumb base hooking at the top corner of the pocket opening */
  const rTh0 = rPalm.clone().add(v3(.11, .04, .06));
  const rTh1 = rTh0.clone().add(v3(.05, -.09, .02));
  g.add(ball(rTh0, .044, M.furHand));
  g.add(mesh(tubeGeometry([rTh0, rTh1], t => .040 - .008 * t, 10, 8), M.skinHand));

  /* Slanted Trouser Pocket Welt sitting directly across the lower edge of the furred hand
     so the fingers disappear cleanly inside the trouser pocket */
  const pocketWelt = solidClothShell(8, 20, (u, v) => {
    const pTop = rPalm.clone().add(v3(.13, -.02, .07));
    const pBot = rPalm.clone().add(v3(-.14, -.22, .03));
    const base = pTop.lerp(pBot, u);
    base.x += (v - .5) * .045;
    base.y -= (v - .5) * .045;
    base.z += .022 + .012 * Math.sin(v * Math.PI);
    return base;
  }, .020);
  g.add(mesh(pocketWelt, M.pants));

  /* --- LEFT ARM: Sleeveless Coat Armhole + Broad, Muscular Segmented Chrome & Gunmetal Cyber-Arm --- */
  g.add(ball(L_SH, .28, M.chromeDark, [.95, .98, .92]));
  for (let p = 0; p < 3; p++) {
    const py = L_SH.y + .06 - p * .14;
    const pauldron = solidClothShell(10, 18, (u, v) => {
      const a = lerp(-.20, 1.85, u);
      const yy = lerp(py + .09, py - .09, v);
      const r = (.325 - p * .012) * (1 - .12 * Math.pow(v - .5, 2));
      return v3(L_SH.x - .02 + Math.sin(a) * r, yy, L_SH.z + Math.cos(a) * r * .92);
    }, .020, L_SH);
    g.add(mesh(pauldron, p === 1 ? M.chromeDark : M.chrome));
  }
  const leftArmholeCuff = solidClothShell(8, 24, (u, v) => {
    const th = lerp(-.30, Math.PI + .30, u);
    const r = .335;
    return v3(
      L_SH.x - .10 + v * .08 + Math.sin(th) * .04,
      L_SH.y + .05 + Math.sin(th) * r,
      L_SH.z + Math.cos(th) * r * .92
    );
  }, .022, L_SH);
  g.add(mesh(leftArmholeCuff, M.lapel));
  g.add(ringAt(L_SH.clone().add(v3(.02, -.06, 0)), v3(.86, -.48, .04), .315, .008, M.neonSoft));

  /* Upper arm: Muscular dark gunmetal hydraulic chassis + chiseled chrome bicep & triceps shell plates */
  const uArmDir = L_EL.clone().sub(L_SH).normalize();
  g.add(mesh(tubeGeometry([L_SH, L_SH.clone().lerp(L_EL, .5), L_EL],
    t => lerp(.28, .225, t), 24, 32), M.chromeDark));
  [-1, 1].forEach(sideSign => {
    const midArm = L_SH.clone().lerp(L_EL, .5);
    const plate = solidClothShell(16, 14, (u, v) => {
      const c = L_SH.clone().lerp(L_EL, lerp(.14, .88, v));
      const a = (sideSign > 0 ? .35 : Math.PI - .35) + (u - .5) * 1.35;
      const swell = Math.sin(v * Math.PI) * .044;
      const r = lerp(.295, .245, v) + swell;
      return v3(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r);
    }, .018, midArm);
    g.add(mesh(plate, M.chrome));
  });

  /* Mechanical Elbow Joint: Heavy-duty gunmetal rotary drum, chrome clevis hinges & recessed red LED ring */
  const elbowDrum = mesh(new THREE.CylinderGeometry(.24, .24, .28, 28), M.chromeDark);
  elbowDrum.rotation.x = Math.PI / 2;
  elbowDrum.position.copy(L_EL);
  g.add(elbowDrum);
  g.add(ball(L_EL, .255, M.chrome, [1.05, .75, .85]));
  g.add(ringAt(L_EL, uArmDir, .252, .009, M.neon));

  /* Forearm: Muscular tapered gunmetal chassis, segmented chrome forearm plates & dual hydraulic pistons */
  const foreDir = L_WR.clone().sub(L_EL).normalize();
  const foreSide = v3(0, 0, 1).cross(foreDir).normalize();
  const midFore = L_EL.clone().lerp(L_WR, .5);
  g.add(mesh(tubeGeometry([L_EL, midFore, L_WR],
    t => lerp(.24, .178, t), 24, 32), M.chromeDark));
  for (let seg = 0; seg < 2; seg++) {
    const v0 = seg === 0 ? .10 : .52, v1 = seg === 0 ? .48 : .90;
    const fPlate = solidClothShell(12, 20, (u, v) => {
      const t = lerp(v0, v1, v);
      const c = L_EL.clone().lerp(L_WR, t);
      const a = lerp(-.65, Math.PI + .65, u);
      const r = lerp(.272, .205, t) * (1 + .06 * Math.cos(a * 2));
      return v3(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r);
    }, .018, midFore);
    g.add(mesh(fPlate, M.chrome));
  }
  [-1, 1].forEach(s => {
    const pA = L_EL.clone().addScaledVector(foreSide, s * .19).addScaledVector(foreDir, .18);
    const pB = L_WR.clone().addScaledVector(foreSide, s * .15).addScaledVector(foreDir, -.10);
    g.add(mesh(tubeGeometry([pA, pA.clone().lerp(pB, .55)], () => .028, 12, 8), M.chromeDark));
    g.add(mesh(tubeGeometry([pA.clone().lerp(pB, .45), pB], () => .018, 10, 8), M.chrome));
  });

  /* Mechanical Wrist Gimbal */
  g.add(ball(L_WR, .195, M.chromeDark, [1.0, .82, .88]));
  g.add(ringAt(L_WR, foreDir, .200, .014, M.chrome));
  g.add(ringAt(L_WR.clone().addScaledVector(foreDir, .03), foreDir, .192, .008, M.neonSoft));

  /* Heavy-Duty Articulated 5-Finger Mechanical Cyber-Hand */
  const lPalm = L_WR.clone().addScaledVector(foreDir, .25).add(v3(-.02, 0, .03));
  g.add(ball(lPalm, .195, M.chromeDark, [.90, 1.20, .65]));
  const dorsalPlate = solidClothShell(8, 10, (u, v) => {
    const x = lPalm.x + .042 + .024 * Math.sin(u * Math.PI);
    const y = lPalm.y + lerp(.17, -.18, v);
    const z = lPalm.z + lerp(-.12, .12, u);
    return v3(x, y, z);
  }, .022, lPalm);
  g.add(mesh(dorsalPlate, M.chrome));

  for (let i = 0; i < 4; i++) {
    const zOff = .125 - i * .078;
    const spreadZ = (.030 - i * .019);
    const len = i === 1 ? 1.08 : i === 2 ? 1.02 : i === 0 ? .94 : .82;
    const k0 = lPalm.clone().add(v3(-.01, -.20, zOff));
    const k1 = k0.clone().add(v3(-.04, -.17 * len, spreadZ + .02));
    const k2 = k1.clone().add(v3(-.07, -.14 * len, spreadZ));
    const k3 = k2.clone().add(v3(-.08, -.11 * len, -.02));
    g.add(ball(k0, .042, M.chromeDark));
    g.add(mesh(tubeGeometry([k0, k1], () => .037, 12, 6), M.chrome));
    g.add(ball(k1, .036, M.chromeDark));
    g.add(mesh(tubeGeometry([k1, k2], () => .032, 12, 6), M.chrome));
    g.add(ball(k2, .030, M.chromeDark));
    g.add(mesh(tubeGeometry([k2, k3], t => lerp(.029, .020, t), 10, 6), M.chrome));
  }
  const th0 = lPalm.clone().add(v3(-.11, -.04, .15));
  const th1 = th0.clone().add(v3(-.08, -.16, .07));
  const th2 = th1.clone().add(v3(-.05, -.13, -.01));
  g.add(ball(th0, .048, M.chromeDark));
  g.add(mesh(tubeGeometry([th0, th1], () => .042, 12, 6), M.chrome));
  g.add(ball(th1, .040, M.chromeDark));
  g.add(mesh(tubeGeometry([th1, th2], t => lerp(.037, .025, t), 12, 6), M.chrome));

  return g;
}

/* ===========================================================================
   SEGMENT 8: Stocky, Powerful Primate Legs in Wide-Cut 1970s Pleated Trousers
   & Classic Polished Black Calfskin Oxford Dress Shoes (Matching Panel 3)
   =========================================================================== */
const R_HIP = v3(-.32, -4.14, -.06), R_KN = v3(-.54, -5.78, .01), R_AN = v3(-.64, -7.48, -.03);
const L_HIP = v3(.32, -4.14, -.04),  L_KN = v3(.64, -5.76, .16),  L_AN = v3(.80, -7.48, .16);

function bootSDF(x, y, z) {
  let d = sdCap(x, y, z, 0, -.42, -.04, 0, -.28, -.04, .14);
  d = smin(d, sdRB(x, y, z, 0, -.42, .28, .22, .10, .56, .08), .07);
  d = smin(d, sdRB(x, y, z, 0, -.43, .76, .17, .075, .22, .06), .05);
  return Math.max(d, -(y + .52));
}
function soleSDF(x, y, z) {
  const qx = Math.abs(x) - .23 * (1 - .28 * smooth(.38, .95, z)), qy = Math.abs(y + .55) - .028, qz = Math.abs(z - .35) - .59;
  const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
  const heel = sdRB(x, y, z, 0, -.58, -.08, .19, .045, .16, .02);
  return Math.min(o - .030, heel);
}

function buildLegs(M) {
  const g = new THREE.Group();

  /* 1. Stocky Upper Trouser Hip Saddle tucked cleanly inside the waistcoat & upper thighs */
  const upperTrousers = solidClothShell(14, 48, (u, v) => {
    const a = lerp(-Math.PI, Math.PI, u);
    const sx = Math.sin(a), cz = Math.cos(a);
    const y = lerp(-3.82, -4.28, v);
    const rx = lerp(.78, .72, v);
    const rz = lerp(.36, .34, v);
    return v3(sx * rx, y, -.06 + cz * rz);
  }, .016);
  g.add(mesh(upperTrousers, M.pants));

  /* 2. Heavy-Cut Tailored Pleated Straight-Leg Dress Trousers in Contrapposto Swagger Stance */
  [-1, 1].forEach(s => {
    const legGeo = solidClothShell(56, 44, (u, v) => {
      const a = lerp(-Math.PI, Math.PI, u);
      const sx = Math.sin(a), cz = Math.cos(a);
      const y = lerp(-3.96, -7.54, v);
      /* Right leg planted back/anchor; Left leg stepped wide and forward with a relaxed knee bend */
      const cx = s < 0
        ? -lerp(.27, .64, Math.pow(v, .82))
        : lerp(.27, .80, Math.pow(v, .78)) + .03 * Math.sin(v * Math.PI);
      const cz0 = s < 0
        ? -.06 + .05 * Math.sin(v * Math.PI * .75) - .03 * v
        : -.05 + .14 * Math.sin(v * Math.PI * .72) + .16 * v;

      /* Inner-thigh fullness above the crotch so both legs meet in a clean V-seam at y = -4.42 */
      const isInner = s * sx < 0;
      const crotchClamp = isInner ? .08 * (1 - smooth(.06, .22, v)) * Math.abs(sx) : 0;
      /* Slight outward pocket flare on the right hip where the hand is tucked in */
      const rPocketBulge = (s < 0 && sx < -.3 && cz > .1)
        ? .055 * Math.exp(-Math.pow((v - .08) / .09, 2)) * (-sx) * cz
        : 0;
      const rx = lerp(.46, .38, Math.pow(v, .82)) + crotchClamp + rPocketBulge;
      const rz = lerp(.41, .37, Math.pow(v, .76)) + rPocketBulge * .8;

      /* Sharp front center knife-edge trouser crease (+z) & 1970s front pleats */
      const frontCrease = .038 * Math.pow(Math.max(0, cz), 10) * smooth(.08, .24, v);
      const backCrease = .020 * Math.pow(Math.max(0, -cz), 10);
      const upperPleats = .022 * smooth(.05, .15, v) * (1 - smooth(.18, .58, v)) * Math.max(0, cz) * Math.cos(sx * 10);
      const kneeFold = .015 * Math.exp(-Math.pow((v - .48) / .13, 2)) * Math.sin(v * 34 + cz * 2);
      const shoeBreak = .048 * smooth(.82, 1.0, v) * Math.max(0, cz) + .016 * smooth(.80, 1.0, v) * Math.sin(v * 26 + cz * 2);

      const rX = rx + upperPleats * .4 + kneeFold * .5;
      const rZ = rz + frontCrease + backCrease + upperPleats + kneeFold + shoeBreak;
      return v3(cx + sx * rX, y, cz0 + cz * rZ);
    }, .018, v3(s * .52, -5.8, 0));
    g.add(mesh(legGeo, M.pants));
  });

  /* 3. Classic Polished Black Calfskin Oxford Dress Shoes (Asymmetrical Contrapposto Foot Turn) */
  const boot = projectSphere(bootSDF, 88, 64, v3(0, -.25, .25), 1.8);
  const sole = projectSphere(soleSDF, 64, 48, v3(0, -.56, .36), 1.6);
  [[R_AN, -.18], [L_AN, .34]].forEach(([A, yaw]) => {
    const b = new THREE.Group();
    b.position.set(A.x, FLOOR_Y + .62 * .98, A.z);
    b.rotation.y = yaw;
    b.scale.setScalar(.98);
    b.add(mesh(boot.geo, M.boot), mesh(sole.geo, M.sole));
    g.add(b);
  });
  return g;
}

function buildBelt(M) {
  const g = new THREE.Group();
  const belt = [];
  for (let i = 0; i < 56; i++) {
    const a = i / 56 * Math.PI * 2;
    const sx = Math.sin(a), cz = Math.cos(a);
    belt.push(v3(sx * .84, -4.02, -.03 + cz * .44));
  }
  belt.push(belt[0].clone().add(v3(.001, 0, 0)));
  g.add(mesh(tubeGeometry(belt, () => .032, 10, 96), M.strap));
  return g;
}

/* ===========================================================================
   SEGMENT 9: Slung Electric Guitar Behind Left Shoulder (Like Panels 2 & 3)
   Cleanly mounted behind the back with NO strap slicing across the front vest!
   =========================================================================== */
function buildGuitar(M) {
  const g = new THREE.Group();
  const gtr = new THREE.Group();

  const bodySDF = (x, y, z) => {
    const lower = sdE(x, y, z, 0, -.52, 0, .86, .72, .16);
    const upper = sdE(x, y, z, 0, .28, 0, .64, .54, .15);
    const waist = sdE(Math.abs(x), y, z, .72, -.06, 0, .26, .28, .30);
    let d = smin(lower, upper, .22);
    d = smax(d, -waist, .12);
    return Math.max(d, Math.abs(z) - .13);
  };
  const bodyGeo = projectSphere(bodySDF, 96, 72, v3(0, -.15, 0), 2.2).geo;
  gtr.add(mesh(bodyGeo, M.guitarWood));

  const rimPts = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const p = surfaceAlong(bodySDF, v3(0, -.15, 0), v3(Math.sin(a), Math.cos(a), 0), 2);
    rimPts.push(v3(p.x, p.y, .125));
  }
  rimPts.push(rimPts[0].clone().add(v3(.001, 0, 0)));
  gtr.add(mesh(tubeGeometry(rimPts, () => .012, 8, 96), M.dressShirt, false));

  /* Neck & Ebony Fretboard */
  const neck = mesh(new THREE.BoxGeometry(.17, 2.35, .07), M.guitarWood);
  neck.position.set(0, 1.55, .03);
  const board = mesh(new THREE.BoxGeometry(.18, 2.38, .025), M.coat);
  board.position.set(0, 1.55, .075);
  gtr.add(neck, board);

  /* Silver frets & 6 metallic strings */
  for (let f = 0; f < 18; f++) {
    const fy = .55 + f * .115 * (1 - f * .012);
    const fret = mesh(new THREE.BoxGeometry(.182, .008, .012), M.chrome, false);
    fret.position.set(0, fy, .090);
    gtr.add(fret);
  }

  /* Gibson-style angled headstock with 3+3 chrome tuning pegs */
  const head = new THREE.Group();
  head.position.set(0, 2.72, .065);
  head.rotation.x = -.18;
  const hPlate = mesh(new THREE.BoxGeometry(.24, .54, .045), M.coat);
  hPlate.position.set(0, .26, 0);
  head.add(hPlate);
  [-1, 1].forEach(s => {
    for (let k = 0; k < 3; k++) {
      const py = .12 + k * .14;
      const post = mesh(new THREE.CylinderGeometry(.012, .012, .06, 12), M.chrome, false);
      post.rotation.x = Math.PI / 2;
      post.position.set(s * .085, py, .03);
      const peg = mesh(new THREE.CylinderGeometry(.008, .008, .09, 10), M.chrome, false);
      peg.rotation.z = Math.PI / 2;
      peg.position.set(s * .145, py, .01);
      const button = ball(v3(s * .19, py, .01), .024, M.chrome, [.6, 1.3, .4]);
      head.add(post, peg, button);
    }
  });
  gtr.add(head);

  /* Bridge & 6 strings */
  const bridge = mesh(new THREE.BoxGeometry(.32, .06, .04), M.chrome);
  bridge.position.set(0, -.32, .13);
  gtr.add(bridge);
  for (let s = 0; s < 6; s++) {
    const sx = -.065 + s * .026;
    const str = mesh(new THREE.CylinderGeometry(.0035, .0035, 3.15, 6), M.chrome, false);
    str.position.set(sx, 1.25, .105);
    gtr.add(str);
  }

  /* Slung diagonally behind the back so the neck & headstock rise cleanly behind
     the left shoulder (+x) and the upper bout peeks behind the left ribcage */
  gtr.position.set(.38, -2.50, -.76);
  gtr.rotation.set(.12, Math.PI + .14, .54);
  g.add(gtr);

  return g;
}

/* a floor to stand on: it fades out before it can make a horizon */
function buildFloor() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const fade = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshLambertMaterial({
    color: hdr(.012, .012, .014), alphaMap: fade, transparent: true, depthWrite: false
  }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, FLOOR_Y, .5);
  m.receiveShadow = true;
  return m;
}

function buildBody(env) {
  const M = bodyMaterials(env);
  const upper = new THREE.Group(), lower = new THREE.Group();
  upper.add(buildJacket(M), buildArms(M), buildBelt(M), buildGuitar(M));
  lower.add(buildLegs(M), buildFloor());
  /* Stocky, broad-shouldered primate posture: high trapezius/shoulders tucked right under
     the chin beard and 12% wider shoulder/chest/limb mass relative to the cranium */
  upper.position.set(0, .20, .04);
  upper.scale.set(1.12, 1.0, 1.08);
  lower.position.set(0, .20, .04);
  lower.scale.set(1.12, 1.0, 1.08);
  return { upper: upper, lower: lower };
}

/* Contrapposto swagger stance: torso angled slightly with right shoulder dropped toward the
   pocketed hand, left cyber-shoulder rolled forward, and head counter-turned toward the lens */
const POSE = {
  waist: v3(0, -4.1, 0), upper: { x: -.022, y: .11, z: .028 },
  neck: v3(0, -1.05, 0), head: { x: .018, y: -.07, z: -.032 }
};
function pivotGroup(pivot, rot) {
  const outer = new THREE.Group();
  outer.position.copy(pivot); outer.rotation.set(rot.x, rot.y, rot.z);
  const inner = new THREE.Group();
  inner.position.copy(pivot).negate();
  outer.add(inner);
  return { outer: outer, inner: inner };
}

/* ========================================================= 5 · lights */
function buildLights(visorZ) {
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-9.8, 12.6, 8.4);                /* same direction, far enough to frame the whole figure */
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 6; sc.bottom = -9; sc.near = 4; sc.far = 40;
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc9d2ff, .32); fill.position.set(3, .2, 3); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 1.3); rimL.position.set(-3.2, 1.2, -3); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xffffff, 1.6); rimR.position.set(3.4, 2, -2.8); scene.add(rimR);
  scene.add(new THREE.HemisphereLight(0x2a2a30, 0x050505, .45));

  /* the bar lights what is right below it */
  const red = new THREE.PointLight(0xff2a24, 2.6, 1.6, 2);
  red.position.set(0, .06, visorZ + .18);
  HEAD.group.add(red);                              /* it rides with the visor */
}

/* ================================================== 6 · post-processing */
/* KAGE's chain, regraded: neutral greys, the red left alone. */
const POST = { levels: [] };
const QUAD_VS = 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';

function initPost() {
  POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  POST.quad.frustumCulled = false;
  POST.qScene = new THREE.Scene(); POST.qScene.add(POST.quad);
  POST.up = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uAmt: { value: 1 } }, vertexShader: QUAD_VS,
    fragmentShader: 'uniform sampler2D tS; uniform float uAmt; varying vec2 vUv;\nvoid main(){ gl_FragColor = vec4(texture2D(tS,vUv).rgb*uAmt, 1.0); }',
    blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false
  });
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const O = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
  POST.scene = new THREE.WebGLRenderTarget(w, h, Object.assign({}, O, { depthBuffer: true, samples: 4 }));
  let lw = Math.max(2, w >> 1), lh = Math.max(2, h >> 1);
  for (let i = 0; i < 5; i++) {
    POST.levels.push({ a: new THREE.WebGLRenderTarget(lw, lh, O), b: new THREE.WebGLRenderTarget(lw, lh, O), w: lw, h: lh });
    lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
  }
  POST.bright = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uThr: { value: .8 }, uKnee: { value: .6 } },
    vertexShader: QUAD_VS,
    fragmentShader:
      'uniform sampler2D tS; uniform float uThr; uniform float uKnee; varying vec2 vUv;\n' +
      'void main(){ vec3 c = texture2D(tS, vUv).rgb;\n' +
      ' float l = max(c.r, max(c.g, c.b));\n' +
      ' float k = smoothstep(uThr, uThr+uKnee, l);\n' +
      ' gl_FragColor = vec4(c*k, 1.0); }'
  });
  POST.blur = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: QUAD_VS,
    fragmentShader:
      'uniform sampler2D tS; uniform vec2 uDir; varying vec2 vUv;\n' +
      'void main(){ vec3 c = texture2D(tS, vUv).rgb * 0.2270270270;\n' +
      ' c += texture2D(tS, vUv + uDir*1.3846153846).rgb * 0.3162162162;\n' +
      ' c += texture2D(tS, vUv - uDir*1.3846153846).rgb * 0.3162162162;\n' +
      ' c += texture2D(tS, vUv + uDir*3.2307692308).rgb * 0.0702702703;\n' +
      ' c += texture2D(tS, vUv - uDir*3.2307692308).rgb * 0.0702702703;\n' +
      ' gl_FragColor = vec4(c, 1.0); }'
  });
  POST.comp = new THREE.ShaderMaterial({
    uniforms: {
      tS: { value: null }, tB: { value: null }, uRes: { value: new THREE.Vector2(w, h) },
      uT: { value: 0 }, uBloom: { value: .75 }, uCA: { value: 1 }, uGrain: { value: .024 },
      uVig: { value: 1 }, uExp: { value: 1.0 }, uSat: { value: .9 }
    },
    vertexShader: QUAD_VS,
    fragmentShader:
      'uniform sampler2D tS; uniform sampler2D tB; uniform vec2 uRes;\n' +
      'uniform float uT, uBloom, uCA, uGrain, uVig, uExp, uSat;\n' +
      'varying vec2 vUv;\n' +
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }\n' +
      'void main(){\n' +
      ' vec2 d = vUv - 0.5; float r2 = dot(d,d);\n' +
      ' float ca = uCA * (0.25 + r2*2.4) * 0.0012;\n' +
      ' vec3 c;\n' +
      ' c.r = texture2D(tS, vUv + d*ca).r;\n' +
      ' c.g = texture2D(tS, vUv).g;\n' +
      ' c.b = texture2D(tS, vUv - d*ca).b;\n' +
      ' c += texture2D(tB, vUv).rgb * uBloom;\n' +
      ' c *= uExp;\n' +
      ' c = aces(c);\n' +
      ' float l = dot(c, vec3(0.2126,0.7152,0.0722));\n' +
      ' float red = smoothstep(0.08, 0.3, c.r - max(c.g, c.b));\n' +      /* keep the vermilion */
      ' c = mix(vec3(l), c, mix(uSat, 1.0, red));\n' +
      ' c = mix(c, c*vec3(0.98,0.99,1.02), smoothstep(0.5,0.0,l)*0.5);\n' + /* cool, faintly, in the blacks */
      ' float v = smoothstep(1.2, 0.22, length(d*vec2(1.0,0.9))*1.45);\n' +
      ' c *= mix(1.0, v, uVig);\n' +
      ' float g = fract(sin(dot(vUv*uRes + uT*137.0, vec2(12.9898,78.233)))*43758.5453);\n' +
      ' c += (g-0.5)*uGrain;\n' +
      ' vec3 e = pow(max(c,0.0), vec3(1.0/2.2));\n' +
      ' e = clamp((e - 0.28) * 1.06 + 0.28, 0.0, 1.0);\n' +
      ' gl_FragColor = vec4( e, 1.0 );\n' +
      '}'
  });
}
function pass(mat, target, additive) {
  POST.quad.material = mat;
  renderer.setRenderTarget(target || null);
  if (!additive) renderer.clear(true, false, false);
  renderer.render(POST.qScene, POST.cam);
}
function renderPost() {
  const L = POST.levels;
  POST.bright.uniforms.tS.value = POST.scene.texture;
  pass(POST.bright, L[0].a);
  for (let i = 0; i < L.length; i++) {
    if (i > 0) { POST.up.blending = THREE.NoBlending; POST.up.uniforms.uAmt.value = 1; POST.up.uniforms.tS.value = L[i - 1].a; pass(POST.up, L[i].a); }
    POST.blur.uniforms.tS.value = L[i].a; POST.blur.uniforms.uDir.value.set(1 / L[i].w, 0); pass(POST.blur, L[i].b);
    POST.blur.uniforms.tS.value = L[i].b; POST.blur.uniforms.uDir.value.set(0, 1 / L[i].h); pass(POST.blur, L[i].a);
  }
  POST.up.blending = THREE.AdditiveBlending; POST.up.uniforms.uAmt.value = .55;
  for (let i = L.length - 1; i > 0; i--) { POST.up.uniforms.tS.value = L[i].a; pass(POST.up, L[i - 1].a, true); }
  POST.comp.uniforms.tS.value = POST.scene.texture;
  POST.comp.uniforms.tB.value = L[0].a;
  pass(POST.comp, null);
}
function resizePost() {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  POST.scene.setSize(w, h);
  let lw = Math.max(2, w >> 1), lh = Math.max(2, h >> 1);
  POST.levels.forEach(L => { L.a.setSize(lw, lh); L.b.setSize(lw, lh); L.w = lw; L.h = lh; lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1); });
  POST.comp.uniforms.uRes.value.set(w, h);
}

/* ====================================================== 7 · the camera */
/* Two shots, scrubbed by the scroll: the close side-on profile with the
   cigarette, and the wide that leaves room on the left for the word. A drag
   turns the head on top of either, and springs back when let go. */
const SHOTS = {
  close: { yaw: 1.08, pitch: .02, dist: 3.9, base: new THREE.Vector3(0, -.58, .56), shift: .08 },
  wide:  { yaw: .86, pitch: .05, dist: 8.6, base: new THREE.Vector3(0, -.58, .36), shift: 1.35 },
  full:  { yaw: .10, pitch: -.03, dist: 22.8, base: new THREE.Vector3(0, -3.95, .2), shift: .35 }
};
/* the scroll, in two acts: the exhale, then the reveal */
const ACT1 = () => sat(SCROLL.sp / .5);
const ACT2 = () => smooth(.56, .92, SCROLL.sp);
const SCROLL = { p: 0, sp: 0 };
const RIG = { dYaw: 0, dPitch: 0, tdYaw: 0, tdPitch: 0, dragging: false };
const _right = new THREE.Vector3(), _target = new THREE.Vector3();

/* the frame a shot sees: target shifted along the camera's right, so the
   head can sit off-centre */
function shotPose(yaw, pitch, dist, base, shift, outPos, outTarget) {
  _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  outTarget.copy(base).addScaledVector(_right, -shift);
  outPos.set(
    outTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    outTarget.y + Math.sin(pitch) * dist,
    outTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
}
const tallFix = () => clamp((1.2 - vpW() / vpH()) / .7, 0, 1);

function applyCamera(dt) {
  SCROLL.sp = damp(SCROLL.sp, SCROLL.p, REDUCE ? 30 : 5, dt);
  if (!RIG.dragging) { RIG.tdYaw = damp(RIG.tdYaw, 0, 1.6, dt); RIG.tdPitch = damp(RIG.tdPitch, 0, 1.6, dt); }
  RIG.dYaw = damp(RIG.dYaw, RIG.tdYaw, 8, dt);
  RIG.dPitch = damp(RIG.dPitch, RIG.tdPitch, 8, dt);
  const a = SHOTS.close, b = SHOTS.wide, c = SHOTS.full, u = smooth(0, .55, ACT1()), w = ACT2(), tf = tallFix();
  _target.lerpVectors(a.base, b.base, u).lerp(c.base, w);
  const yaw = lerp(lerp(a.yaw, b.yaw, u), c.yaw, w), pitch = lerp(lerp(a.pitch, b.pitch, u), c.pitch, w);
  const dist = lerp(lerp(a.dist, b.dist, u), c.dist, w) + tf * lerp(2.4, 12, w);
  const shift = lerp(lerp(a.shift, b.shift, u), c.shift, w) * (1 - tf * .85);
  shotPose(yaw + RIG.dYaw, pitch + RIG.dPitch, dist, _target, shift, camera.position, _target);
  camera.lookAt(_target);
}

function wireControls() {
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;                /* touch scrolls the page */
    drag = { x: e.clientX, y: e.clientY }; RIG.dragging = true;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-drag');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    RIG.tdYaw = clamp(RIG.tdYaw - (e.clientX - drag.x) * .006, -1.6, 1.6);
    RIG.tdPitch = clamp(RIG.tdPitch + (e.clientY - drag.y) * .004, -.4, .5);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = () => { drag = null; RIG.dragging = false; canvas.classList.remove('is-drag'); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  /* the canvas sits under the page; let the wheel scroll it */
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - vpH();
    SCROLL.p = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll(); SCROLL.sp = SCROLL.p;

  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    if (b.dataset.toggle === 'fur') { HEAD.fur.visible = on; HEAD.wisps.visible = on; }
    if (b.dataset.toggle === 'post') setFilm(on);
  }));
}

/* =================================================== 7b · the wordmark */
/* The exhale that becomes the name. Every particle leaves the lips on its
   own clock, billows out through a turbulent middle, and settles onto a
   glyph of "muse-ing" set in a plane that faces the wide shot — so the word
   is only perfectly legible once the camera has arrived. Scrolling back
   draws it all back in. */
const WORD_VS = [
  'uniform float uP; uniform float uT; uniform float uPx; uniform float uFade;',
  'attribute vec3 aStart; attribute vec3 aMid; attribute float aR;',
  'varying float vA; varying float vK; varying float vSeed;',
  'vec3 bez(vec3 a, vec3 b, vec3 c, float t){ return mix(mix(a, b, t), mix(b, c, t), t); }',
  'void main(){',
  '  float k = clamp((uP - aR * 0.45) / 0.55, 0.0, 1.0);',
  '  float e = k * k * (3.0 - 2.0 * k);',
  '  vec3 p = bez(aStart, aMid, position, e);',
  '  float turb = sin(e * 3.14159);',                                  /* wild mid-flight, calm once set */
  '  p += vec3(sin(uT * 1.3 + aR * 40.0), cos(uT * 1.1 + aR * 31.0), sin(uT * 0.9 + aR * 23.0)) * (0.07 * turb + 0.005);',
  '  p += vec3(sin(aR * 50.0) * 0.6, 1.4 + aR * 1.2, cos(aR * 37.0) * 0.5) * uFade * uFade;',   /* drifts up and apart */
  '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  '  vA = smoothstep(0.0, 0.06, k) * (1.0 - uFade);',
  '  gl_PointSize = vA > 0.0 ? uPx * mix(0.11, 0.024, e) / -mv.z : 0.0;',
  '  gl_Position = projectionMatrix * mv;',
  '  vK = e; vSeed = aR;',
  '}'
].join('\n');
const WORD_FS = [
  'varying float vA; varying float vK; varying float vSeed;',
  'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'void main(){',
  '  vec2 pc = gl_PointCoord - 0.5; float r = length(pc);',
  '  if (r > 0.5) discard;',
  '  float wisp = mix(smoothstep(0.25, 0.75, n(pc * 4.0 + vSeed * 13.0)), 1.0, vK);',  /* puffs in flight, dots once set */
  '  float a = smoothstep(0.5, 0.05, r) * wisp * vA * mix(0.055, 0.62, vK * vK);',
  '  vec3 c = mix(vec3(0.6, 0.6, 0.64), vec3(0.93, 0.92, 0.9), vK);',
  '  gl_FragColor = vec4(c, a);',
  '}'
].join('\n');

function sampleWord(text, family, maxPts) {
  const W = 1600, H = 420, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '330px ' + family;
  g.fillText(text, W / 2, H / 2 + 10);
  const d = g.getImageData(0, 0, W, H).data, pts = [];
  let minX = W, maxX = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (d[(y * W + x) * 4 + 3] > 140) { pts.push(x, y); if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  const rnd = mulberry32(5), idx = [];
  for (let i = 0; i < pts.length / 2; i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  const n = Math.min(maxPts, idx.length), out = new Float32Array(n * 2);
  const cx = (minX + maxX) / 2, span = Math.max(1, maxX - minX);
  /* normalised: x across [-.5, .5] of the word's ink width, y in the same units */
  for (let i = 0; i < n; i++) { const k = idx[i]; out[i * 2] = (pts[k * 2] - cx) / span; out[i * 2 + 1] = -(pts[k * 2 + 1] - H / 2) / span; }
  return out;
}

const WORD = {};
function buildWord(family) {
  /* the plane the word sits on: in front of the face, in the left of the wide shot */
  const b = SHOTS.wide, cam = new THREE.Vector3(), tgt = new THREE.Vector3(), tf = tallFix();
  shotPose(b.yaw, b.pitch, b.dist + tf * 2.4, b.base, b.shift * (1 - tf * .8), cam, tgt);
  const fwd = tgt.clone().sub(cam).normalize();
  const right = new THREE.Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw));
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const D = b.dist + tf * 2.4 - 1.6;
  const halfH = D * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), halfW = halfH * camera.aspect;
  /* wide frames: the left half, beside the head. Tall frames: across the top, above it. */
  const tall = camera.aspect < .85;
  const centre = cam.clone().addScaledVector(fwd, D)
    .addScaledVector(right, tall ? 0 : -.42 * halfW)
    .addScaledVector(up, tall ? .62 * halfH : .12 * halfH);
  const width = tall ? 1.7 * halfW : .76 * halfW;

  const uv = sampleWord('muse-ing', family, 9000), N = uv.length / 2;
  const end = new Float32Array(N * 3), start = new Float32Array(N * 3), mid = new Float32Array(N * 3), r = new Float32Array(N);
  const rnd = mulberry32(23), mouth = CIG.mouth, out = mouth.clone().add(new THREE.Vector3(0, -.05, .4));
  const e = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    e.copy(centre).addScaledVector(right, uv[i * 2] * width).addScaledVector(up, uv[i * 2 + 1] * width)
      .addScaledVector(fwd, (rnd() - .5) * .04);
    end.set([e.x, e.y, e.z], i * 3);
    start.set([mouth.x + (rnd() - .5) * .04, mouth.y + (rnd() - .5) * .03, mouth.z], i * 3);
    m.lerpVectors(out, e, .3 + rnd() * .25);
    m.x += (rnd() - .5) * .9; m.y += .1 + rnd() * .7; m.z += (rnd() - .5) * .7;
    mid.set([m.x, m.y, m.z], i * 3);
    /* the letters fill roughly in reading order, with plenty of overlap */
    r[i] = clamp((uv[i * 2] + .5) * .55 + rnd() * .45, 0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(end, 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aMid', new THREE.BufferAttribute(mid, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  WORD.mat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 0 }, uP: { value: WORD.mat ? WORD.mat.uniforms.uP.value : 0 }, uT: { value: 0 }, uPx: { value: CIG.smokeMat ? CIG.smokeMat.uniforms.uPx.value : 1000 } },
    vertexShader: WORD_VS, fragmentShader: WORD_FS, transparent: true, depthWrite: false
  });
  const pts = new THREE.Points(g, WORD.mat);
  pts.frustumCulled = false; pts.renderOrder = 102;
  if (WORD.pts) { scene.remove(WORD.pts); WORD.pts.geometry.dispose(); }
  scene.add(pts);
  WORD.pts = pts;
  WORD.family = family;
}

/* film off keeps the tone curve, drops what the lens adds */
function setFilm(on) {
  const u = POST.comp.uniforms;
  u.uBloom.value = on ? .75 : 0; u.uGrain.value = on ? .024 : 0; u.uCA.value = on ? 1 : 0; u.uVig.value = on ? 1 : 0;
}

/* ===================================================== 8 · page wiring */
function resize() {
  renderer.setSize(vpW(), vpH(), true);
  camera.aspect = vpW() / vpH(); camera.updateProjectionMatrix();
  resizePost();
  smokePx();
  clearTimeout(WORD.relayout);
  if (WORD.family) WORD.relayout = setTimeout(() => buildWord(WORD.family), 250);
}

function start() {
  initGL();
  const env = buildEnvironment();
  const UP = pivotGroup(POSE.waist, POSE.upper), HD = pivotGroup(POSE.neck, POSE.head);
  scene.add(UP.outer); UP.inner.add(HD.outer);
  HEAD.group = HD.inner;
  const head = buildHead(env);
  HEAD.group.add(head, buildEars(env));
  HEAD.fur = buildFur(); HEAD.group.add(HEAD.fur);
  HEAD.wisps = buildWisps(); HEAD.group.add(HEAD.wisps);
  const visor = buildVisor(env); HEAD.group.add(visor);
  let tb = performance.now();
  const body = buildBody(env);
  UP.inner.add(body.upper); scene.add(body.lower);
  console.info('[face] body', Math.round(performance.now() - tb), 'ms');
  scene.updateMatrixWorld(true);
  /* the shots were framed on an upright head: carry them to where it is now */
  ['close', 'wide'].forEach(k => {
    SHOTS[k].base.applyMatrix4(HEAD.group.matrixWorld);
    SHOTS[k].yaw += POSE.upper.y + POSE.head.y;
  });
  buildCigarette();
  scene.add(buildSmoke());
  scene.add(buildExhale());
  smokePx();
  buildLights(visor.userData.frontZ);
  initPost();
  if (qs('post', '1') === '0') setFilm(false);
  if (qs('debug', '0') === '1') window.__face = { scene: scene, camera: camera, renderer: renderer, HEAD: HEAD, RIG: RIG };
  wireControls();
  const family = '"Instrument Serif", Georgia, serif';
  (document.fonts ? document.fonts.load('330px "Instrument Serif"', 'muse-ing') : Promise.resolve())
    .catch(() => {}).then(() => buildWord(family));
  addEventListener('resize', resize);

  let last = performance.now(), t0 = last;
  (function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    applyCamera(dt);
    const tt = (now - t0) / 1000;
    POST.comp.uniforms.uT.value = tt;
    /* A drag every nine seconds: draw on the filter (lips purse, cheeks
       hollow, ember flares), hold, then let it out through the lips. */
    const CYCLE = 9, ct = tt % CYCLE;
    const sp = ACT1(), act2 = ACT2();
    const scrolled = smooth(0, .03, sp);                /* once scrolling, the scroll breathes for him */
    const cycleOn = REDUCE ? 0 : 1 - scrolled;
    const inhale = cycleOn * smooth(0, 1.1, ct) * (1 - smooth(1.6, 2.1, ct));
    const cyclePuff = cycleOn * smooth(2.2, 2.5, ct) * (1 - smooth(3.5, 4.4, ct));
    const longExhale = smooth(.03, .1, sp) * (1 - smooth(.45, .62, sp));
    HEAD.deform.uDraw.value = inhale;
    HEAD.deform.uPuff.value = Math.max(cyclePuff, longExhale);
    const flicker = .06 * Math.sin(tt * 17.0 + Math.sin(tt * 5.0) * 2.0);
    const glow = .7 + .8 * inhale + flicker;
    CIG.emberMat.color.setRGB(3.2 * glow, .6 * glow, .12 * glow);
    CIG.light.intensity = .6 * glow;
    if (!REDUCE) {
      CIG.smokeMat.uniforms.uT.value = tt;
      CIG.exhaleMat.uniforms.uT.value = tt;
      CIG.exhaleMat.uniforms.uStart.value = scrolled > .5 ? -99 : Math.floor(tt / CYCLE) * CYCLE + 2.2;
    }
    if (WORD.mat) {
      WORD.mat.uniforms.uP.value = smooth(.06, .62, sp); WORD.mat.uniforms.uT.value = tt;
      WORD.mat.uniforms.uFade.value = smooth(.5, .66, SCROLL.sp);
    }
    TAG.style.opacity = smooth(.58, .72, sp) * (1 - smooth(.5, .58, SCROLL.sp));
    CUE.style.opacity = 1 - smooth(.01, .06, sp);
    renderer.setRenderTarget(POST.scene);
    renderer.render(scene, camera);
    renderPost();
    requestAnimationFrame(frame);
  })(last);
  status.classList.add('is-done');
  CUE.classList.add('is-in');             /* the cue arrives once there is something to scroll */
}

/* let the status line paint before the sculpt blocks the thread */
function boot() {
  if (!window.THREE) { status.textContent = 'WebGL is unavailable'; return; }
  requestAnimationFrame(() => setTimeout(() => {
    try { start(); } catch (e) { console.error(e); status.textContent = 'Could not start the study'; }
  }, 30));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
