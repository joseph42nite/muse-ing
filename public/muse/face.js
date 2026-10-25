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
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
const smax = (a, b, k) => -smin(-a, -b, k);

/* The smirk lifts the mouth's left corner (his left, our right: +x). */
const smirk = x => .075 * smooth(-.1, .38, x);

/* A chimp's head: a low skull set back, the forehead sloping away behind a
   brow shelf, and a snout that juts — the long upper lip out past the nose.
   Every primitive is blended, never stacked. */
function headSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = sdE(x, y, z, 0, .06, -.24, .9, .84, .96);                         /* skull          */
  d = smin(d, sdE(x, y, z, 0, .36, .22, .62, .26, .5), .2);                 /* sloped brow    */
  d = smax(d, -sdE(ax, y, z, .99, .2, .1, .2, .26, .34), .18);              /* temples        */
  d = smin(d, sdE(x, y, z, 0, -.04, .38, .74, .58, .55), .22);              /* face mass      */
  d = smin(d, sdCap(ax, y, z, .64, .26, .5, 0, .31, .86, .17), .1);         /* brow shelf     */
  d = smax(d, -sdE(ax, y, z, .29, .1, .88, .19, .12, .15), .07);            /* eye sockets    */
  d = smin(d, sdE(ax, y, z, .45, -.08, .6, .22, .17, .2), .12);             /* cheekbones     */
  d = smin(d, sdE(x, y, z, 0, -.42, .78, .44, .38, .5), .18);               /* the snout      */
  d = smin(d, sdCap(x, y, z, 0, .2, .88, 0, -.06, 1.06, .07), .1);          /* nose bridge    */
  d = smin(d, sdE(x, y, z, 0, -.1, 1.06, .22, .1, .1), .07);                /* broad flat nose */
  d = smax(d, -sdE(ax, y, z, .085, -.15, 1.13, .048, .028, .055), .02);     /* flared nostrils */
  const ly = y - smirk(x);
  d = smin(d, sdE(x, ly, z, 0, -.42, 1.08, .36, .22, .22), .08);            /* long upper lip */
  d = smin(d, sdE(x, ly, z, 0, -.72, 1.06, .3, .1, .19), .06);              /* lower lip      */
  d = smax(d, -sdCap(ax, ly, z, .33, -.63, 1.02, 0, -.63, 1.27, .018), .03); /* the lip line  */
  d = smin(d, sdE(x, y, z, 0, -.74, .58, .5, .32, .48), .2);                /* chin and jaw   */
  d = smin(d, sdCap(x, y, z, 0, -.75, -.1, 0, -1.7, -.12, .52), .3);        /* neck           */
  return Math.max(d, -(y + 1.6));
}

/* An ear, in its own frame: a cup across x. The bowl faces +x and is
   scooped below a rolled rim, an antihelix ridge curves inside it, and the
   back is a shallow dome. Built as a surface, not projected — a thin cup
   is the one shape a star-projection cannot see into. */
function earGeometry() {
  const NR = 28, NT = 72, RY = .42, RZ = .33;
  const front = r => {
    const rim = .85;
    let x = r < rim ? .045 - .07 * (1 - (r / rim) * (r / rim)) : .045 * Math.cos((r - rim) / (1 - rim) * Math.PI / 2);
    return x;
  };
  const back = r => -.035 * Math.sqrt(Math.max(0, 1 - r * r));
  const P = [], I = [];
  const vert = (r, th, isFront) => {
    const sy = Math.sin(th), cz = Math.cos(th);
    /* a heavier lobe below, a flatter top */
    const ry = RY * (sy < 0 ? 1.06 : .96), y = ry * r * sy, z = RZ * r * cz;
    let x = isFront ? front(r) : back(r);
    /* antihelix: a ridge inside the rim, on the back half of the bowl */
    if (isFront) x += .018 * Math.exp(-Math.pow((r - .62) / .08, 2)) * smooth(.2, -.6, cz);
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
  const front = smooth(.2, .45, z);
  const upper = Math.hypot(x / .74, (y - .12) / .5);
  const lower = Math.hypot(x / .5, (y + .5) / .42);
  return (1 - smooth(.8, 1.05, Math.min(upper, lower))) * front;
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
      let h = 0, cav = 0, rg = .9;

      /* fur ground: streaks combed down the head, under the shells */
      const streak = hash3((x * 70) | 0, (y * 9 + z * 6) | 0, (z * 70) | 0);
      const hf = (streak - .5) * .35;

      if (m > .001) {
        let w = 0;
        /* forehead furrows above the visor, bowed with the brow */
        const fh = (y - .36 + .2 * x * x) * 15;
        w += .42 * crease(fh, .14) * smooth(.34, .4, y) * (1 - smooth(.6, .7, y)) * (1 - smooth(.3, .56, ax))
          * (.55 + .45 * vnoise(x * 6, y * 2, 3.1));
        /* folds ringing the eyes, below the visor line */
        const ro = Math.hypot(ax - .29, (y - .13) / .85) + (vnoise(x * 9, y * 9, 1.3) - .5) * .05;
        w += .24 * crease((ro - .17) * 15, .17) * smooth(.17, .21, ro) * (1 - smooth(.3, .38, ro)) * smooth(.1, .0, y)
          * (.4 + .6 * vnoise(x * 5, y * 3, 7.7));
        /* crow's feet out of the outer corners */
        const cr = Math.hypot(ax - .6, y - .12), ca = Math.atan2(y - .12, ax - .6);
        w += .3 * crease(ca * 2.4, .16) * smooth(.03, .08, cr) * (1 - smooth(.16, .26, cr));
        /* across the nose bridge */
        w += .3 * crease(y * 34, .16) * (1 - smooth(.06, .12, ax)) * smooth(.16, .2, y) * (1 - smooth(.3, .36, y));
        /* fine horizontal lines across the long upper lip */
        const fm = (y + .2 + .3 * x * x) * 16;
        w += .22 * crease(fm + (vnoise(x * 6, y * 4, 2.2) - .5) * 1.2, .15) * (.35 + .65 * vnoise(x * 4.5, y * 2, 9.4))
          * smooth(-.58, -.52, y) * (1 - smooth(-.26, -.2, y)) * (1 - smooth(.24, .38, ax));
        /* a soft groove down the middle of it */
        w += .14 * Math.exp(-Math.pow(x / .04, 2)) * smooth(-.58, -.5, y) * (1 - smooth(-.24, -.18, y));
        /* nasolabial folds: from the nose wings round to the mouth corners */
        const nl = Math.hypot(ax - .78, y + .36);
        w += .5 * Math.exp(-Math.pow((nl - .56) / .04, 2)) * smooth(-.72, -.64, y) * (1 - smooth(-.16, -.1, y));
        /* lip lines, fine and vertical, on the lips only */
        const ly = y - smirk(x);
        const lips = (1 - smooth(.28, .38, ax)) * smooth(-.84, -.78, ly) * (1 - smooth(-.56, -.52, ly)) * smooth(.95, 1.05, z);
        w += .22 * crease(x * 58 + .4 * Math.sin(ly * 30), .2) * lips;
        /* the smirk folds the raised corner */
        w += .45 * Math.exp(-Math.pow((Math.hypot(x - .37, y + .58) - .06) / .016, 2)) * smooth(.25, .32, x);
        /* the chin's orange-peel */
        const chin = smooth(-.82, -.9, y) * (1 - smooth(.25, .4, ax));
        const bumps = fbm3(x * 26, y * 26, z * 26, 3);

        const pores = vnoise(x * 150, y * 150, z * 150) - .5;
        const broad = fbm3(x * 7, y * 7, z * 7, 3) - .5;

        h = -w * .5 + pores * .06 + broad * .12 + (bumps - .5) * .25 * chin;
        cav = sat(w * .9);

        /* roughness: oilier on the nose and lips, drier in the creases */
        const nose = Math.exp(-Math.pow(Math.hypot(x / 1.4, (y + .1) / .6) / .17, 2));
        rg = .52 + cav * .2 - nose * .14 - lips * .1 + pores * .06;

        h = lerp(hf, h, m);
        rg = lerp(.9, rg, m);
      } else {
        h = hf;
      }
      height[k] = h;

      /* albedo: graphite skin, darker in every crease, darker nose and
         lips; near-black fur with a little grey in the streaks */
      const fv = 12 + (streak - .5) * 12;
      let sr = fv, sg = fv, sb = fv + 2;
      if (m > .001) {
        const mottle = fbm3(x * 4, y * 4, z * 4, 2);
        let kr = 66 + (mottle - .5) * 20, kg = 65 + (mottle - .5) * 20, kb = 70 + (mottle - .5) * 18;
        const dark = 1 - .6 * cav;
        kr *= dark; kg *= dark; kb *= dark;
        const nosePad = Math.exp(-Math.pow(Math.hypot(x / 1.5, (y + .1) / .6) / .16, 2));
        kr = lerp(kr, 32, nosePad * .7); kg = lerp(kg, 31, nosePad * .7); kb = lerp(kb, 36, nosePad * .7);
        const ly2 = y - smirk(x);
        const lipTone = (1 - smooth(.28, .38, ax)) * smooth(-.84, -.78, ly2) * (1 - smooth(-.58, -.54, ly2));
        kr = lerp(kr, 40, lipTone * .6); kg = lerp(kg, 38, lipTone * .6); kb = lerp(kb, 44, lipTone * .6);
        const sock = Math.exp(-Math.pow(Math.hypot(ax - .29, (y - .12) / .7) / .2, 2));
        kr *= 1 - .35 * sock; kg *= 1 - .35 * sock; kb *= 1 - .35 * sock;
        sr = lerp(fv, kr, m); sg = lerp(fv, kg, m); sb = lerp(fv + 2, kb, m);
      }
      albedo[p]     = clamp(sr, 0, 255);
      albedo[p + 1] = clamp(sg, 0, 255);
      albedo[p + 2] = clamp(sb, 0, 255);
      albedo[p + 3] = 255;

      const rv = clamp(rg, .05, 1) * 255;
      rough[p] = rough[p + 1] = rough[p + 2] = rv; rough[p + 3] = 255;

      /* fur: R density, G length — longer on the crown and the beard */
      const len = .45 + .55 * smooth(.35, .85, y) + .45 * smooth(-.35, -.8, y) * (1 - smooth(.6, .9, z));
      /* the hairline: hairs thin out and shorten across a wide band,
         the last few spilling onto the bare skin */
      const dens = 1 - smooth(.1, .78, m);
      const edge = .3 + .7 * (1 - smooth(0, .55, m));
      fur[p] = sat(dens) * 255;
      fur[p + 1] = sat(len * edge) * 255;
      fur[p + 2] = 0; fur[p + 3] = 255;
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
  camera = new THREE.PerspectiveCamera(28, vpW() / vpH(), .1, 60);
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
const HEAD = {};

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
  HEAD.skin = skin;
  const mesh = new THREE.Mesh(proj.geo, skin);
  mesh.castShadow = mesh.receiveShadow = true;
  HEAD.mesh = mesh;
  return mesh;
}

function buildEars(envMap) {
  const geo = earGeometry();
  const mat = new THREE.MeshPhysicalMaterial({
    color: hdr(.045, .043, .05), roughness: .68, metalness: 0, clearcoat: .04, clearcoatRoughness: .5,
    normalMap: poreMap(256), normalScale: new THREE.Vector2(1.1, 1.1),
    envMap: envMap, envMapIntensity: .2,
    side: THREE.DoubleSide
  });
  const g = new THREE.Group();
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(geo, mat);
    /* at eye level, standing out from the skull, the bowl turned forward */
    e.position.set(s * .98, .1, -.04);
    e.rotation.set(0, s * .55, s * -.12);
    e.scale.set(s * 1.05, 1.05, 1.05);
    e.castShadow = e.receiveShadow = true;
    g.add(e);
  });
  return g;
}

/* ---------------------------------------------------------- fur shells */
const FUR_VS = [
  'uniform float uLevel; uniform float uLen; uniform float uDroop; uniform sampler2D tFur;',
  'varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDens;',
  'void main(){',
  '  vUv = uv;',
  '  vec4 f = texture2D(tFur, uv);',
  '  float len = uLen * (0.25 + f.g);',
  '  vec3 p = position + normal * len * uLevel;',
  '  p.y -= len * uLevel * uLevel * uDroop;',                     /* the coat lies down */
  '  p.z -= len * uLevel * uLevel * uDroop * 0.45;',
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
  '  if (vDens < 0.02) discard;',
  '  vec2 g = vUv * uRep;',
  '  vec2 cell = floor(g); vec2 fr = fract(g) - 0.5;',
  '  fr += (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;',   /* break the lattice */
  '  if (hash(cell + 11.3) > vDens) discard;',                         /* sparse at the hairline */
  '  float h = hash(cell);',
  '  if (uGuard > 0.5) {',
  '    if (hash(cell + 23.1) < 0.86) discard;',                         /* one in seven is a guard hair */
  '    h = 0.45 + 0.55 * h;',
  '  } else {',
  '    h *= 0.6 + 0.4 * hash(floor(cell / 6.0) + 5.0);',                /* clumps */
  '  }',
  '  if (h < uLevel) discard;',                                        /* taller hairs survive */
  '  float rad = uRad * (1.0 - uLevel * 0.85) * mix(0.3, 1.0, smoothstep(0.0, 0.7, vDens));',  /* fine at the hairline */
  '  if (dot(fr, fr) > rad * rad) discard;',                           /* and taper */
  '  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);',
  '  float diff = pow(clamp(dot(N, uKeyDir) * 0.5 + 0.5, 0.0, 1.0), 2.0);',
  '  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);',
  '  vec3 base = mix(uRoot, uTip, pow(uLevel, 1.3));',
  '  vec3 c = base * (uAmb + uKey * diff) + uRim * rim * pow(uLevel, 1.4);',
  '  c *= mix(0.4, 1.0, uLevel);',                                     /* self-shadow in the coat */
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');

function shellGroup(NS, own, order) {
  const g = new THREE.Group();
  const shared = Object.assign({
    tFur: { value: HEAD.furTex },
    uKeyDir: { value: new THREE.Vector3(-.55, .7, .45).normalize() },
    uKey: { value: hdr(1.25, 1.25, 1.3) }, uAmb: { value: hdr(.07, .07, .08) }
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
    uLen: { value: .07 }, uDroop: { value: .45 }, uRep: { value: new THREE.Vector2(600, 300) },
    uGuard: { value: 0 }, uRad: { value: .62 },
    uRim: { value: hdr(.45, .45, .5) }, uRoot: { value: hdr(.006, .006, .007) }, uTip: { value: hdr(.045, .045, .05) }
  }, 1));
  g.add(shellGroup(26, {
    uLen: { value: .17 }, uDroop: { value: 1.15 }, uRep: { value: new THREE.Vector2(340, 170) },
    uGuard: { value: 1 }, uRad: { value: .2 },
    uRim: { value: hdr(1.3, 1.3, 1.4) }, uRoot: { value: hdr(.012, .012, .014) }, uTip: { value: hdr(.42, .42, .46) }
  }, 40));
  return g;
}

/* ------------------------------------------- wisps: the backlit strays */
/* The reference's tell: fine silver hairs standing proud of the coat, thick
   along the jaw and the edge of the face, lifting off the crown. Drawn as
   one-pixel lines, dark at the root and silver at the tip. */
function buildWisps() {
  const pos = HEAD.geo.attributes.position, nrm = HEAD.geo.attributes.normal;
  const rnd = mulberry32(41), pts = [], col = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3(), d = new THREE.Vector3(), flow = new THREE.Vector3();
  const counts = { beard: 0, cheek: 0, crown: 0 }, want = { beard: 360, cheek: 220, crown: 200 };
  for (let tries = 0; tries < 200000; tries++) {
    if (counts.beard >= want.beard && counts.cheek >= want.cheek && counts.crown >= want.crown) break;
    const i = (rnd() * pos.count) | 0;
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
    const m = skinMask(p.x, p.y, p.z);
    let kind = null;
    if (p.y < -.45 && p.y > -1.2 && p.z > -.2 && m < .3) kind = 'beard';
    else if (p.y > -.45 && p.y < .55 && p.z > .05 && m > .02 && m < .5) kind = 'cheek';
    else if (p.y > .55 && m < .2) kind = 'crown';
    if (!kind || counts[kind] >= want[kind]) continue;
    counts[kind]++;

    /* combed: along the surface, down and back, lifted off it a little */
    flow.set(0, -1, -.4); flow.addScaledVector(n, -flow.dot(n)).normalize();
    const lift = kind === 'crown' ? 1.1 : kind === 'cheek' ? .75 : .5;
    d.copy(flow).multiplyScalar(kind === 'crown' ? .3 : 1).addScaledVector(n, lift);
    d.x += (rnd() - .5) * .5; d.y += (rnd() - .5) * .3 + (kind === 'crown' ? .4 : 0); d.z += (rnd() - .5) * .4;
    d.normalize();
    const len = kind === 'beard' ? .14 + rnd() * .2 : kind === 'cheek' ? .08 + rnd() * .14 : .1 + rnd() * .18;
    const segs = 8, curl = (rnd() - .5) * .3;
    const q = p.clone().addScaledVector(n, .015);
    const silver = .45 + rnd() * .55;
    for (let s = 0; s < segs; s++) {
      const a = q.clone(), t0 = s / segs, t1 = (s + 1) / segs;
      d.y -= kind === 'crown' ? .045 : .07; d.x += curl * .12; d.normalize();
      q.addScaledVector(d, len / segs);
      pts.push(a.x, a.y, a.z, q.x, q.y, q.z);
      const c0 = lerp(.04, silver, t0 * t0), c1 = lerp(.04, silver, t1 * t1);
      col.push(c0, c0, c0 * 1.05, c1, c1, c1 * 1.05);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, depthWrite: false }));
}

/* ------------------------------------------------------------ the visor */
/* A rigid band, not a skin: its radius at each angle is the furthest the
   face reaches anywhere across the band's height, then smoothed, so it
   bridges the nose instead of following it. */
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
  const A = 1.42, NA = 112, yC = .11, HT = .24, DEP = .07, CZ = .1;
  const R = [];
  for (let i = 0; i <= NA; i++) {
    const a = -A + 2 * A * i / NA, sx = Math.sin(a), cz = Math.cos(a);
    let m = 0;
    for (const yy of [yC - HT * .3, yC, yC + HT * .3]) m = Math.max(m, rayHit(headSDF, 0, yy, CZ, sx, cz, 2.5));
    R.push(m);
  }
  /* close over the nose bridge, then smooth */
  const Rs = R.map((_, i) => { let m = 0; for (let k = -2; k <= 2; k++) m = Math.max(m, R[clamp(i + k, 0, NA)]); return m; });
  /* two box passes ≈ a gaussian: no kinks left for the clearcoat to find */
  const box = (arr, w) => arr.map((_, i) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { s += arr[clamp(i + k, 0, NA)]; n++; } return s / n; });
  const Rb = box(box(Rs, 6), 6);
  const Rf = Rb.map((r, i) => { const a = -A + 2 * A * i / NA; return r + .014 + .05 * smooth(.55, 1.15, Math.abs(a)); });

  const P = [], idx = [];
  /* the ends round over: the band thins in height and sinks toward the head */
  const endT = i => smooth(0, 9, i) * smooth(NA, NA - 9, i);
  const ring = (rOff, y) => Rf.map((r, i) => {
    const a = -A + 2 * A * i / NA, e = endT(i);
    const yy = yC + (y - yC) * (.35 + .65 * Math.sqrt(e)), rr = r + rOff - (1 - e) * .02;
    return [Math.sin(a) * rr, yy, CZ + Math.cos(a) * rr];
  });
  const quadStrip = (a, b) => {
    const base = P.length / 3;
    for (let i = 0; i <= NA; i++) { P.push(...a[i]); P.push(...b[i]); }
    for (let i = 0; i < NA; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  };
  const oT = ring(0, yC + HT / 2), oB = ring(0, yC - HT / 2), iT = ring(-DEP, yC + HT / 2), iB = ring(-DEP, yC - HT / 2);
  /* a slight chamfer reads as a moulded edge in the clearcoat */
  const cT = ring(-.012, yC + HT / 2 + .012), cB = ring(-.012, yC - HT / 2 - .012);
  quadStrip(cT, oT); quadStrip(oT, oB); quadStrip(oB, cB);
  quadStrip(iT, cT); quadStrip(cB, iB); quadStrip(iB, iT);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const shell = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({
    color: 0x07070a, roughness: .42, metalness: .5, clearcoat: 1, clearcoatRoughness: .34,
    envMap: envMap, envMapIntensity: .8, side: THREE.DoubleSide
  }));
  shell.castShadow = shell.receiveShadow = true;

  /* the bar: an HDR emitter inset in the face of the band */
  const GA = .82, G = [], gi = [];
  const gb = Math.round(NA * (A - GA) / (2 * A)), ge = NA - gb;
  for (let i = gb; i <= ge; i++) {
    const a = -A + 2 * A * i / NA, r = Rf[i] + .004;
    const e = clamp(Math.min(i - gb, ge - i) / 5, 0, 1), k = 1 - e;
    const h = .042 * Math.sqrt(Math.max(.02, 1 - k * k));
    G.push(Math.sin(a) * r, yC + h, CZ + Math.cos(a) * r, Math.sin(a) * r, yC - h, CZ + Math.cos(a) * r);
  }
  for (let i = 0; i < ge - gb; i++) { const k = i * 2; gi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(G, 3));
  gg.setIndex(gi);
  const bar = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: hdr(4.0, .03, .022), side: THREE.DoubleSide }));

  const v = new THREE.Group();
  v.add(shell, bar);
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

  scene.add(g);
  g.updateMatrixWorld(true);
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
  '  float alpha = smoothstep(0.5, 0.0, r) * smoothstep(0.32, 0.8, f) * vA * 0.13;',
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
    uniforms: { uT: { value: 0 }, uTip: { value: CIG.tip.clone() }, uPx: { value: 1000 } },
    vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS,
    transparent: true, depthWrite: false
  });
  const pts = new THREE.Points(g, CIG.smokeMat);
  pts.frustumCulled = false;
  pts.renderOrder = 100;
  return pts;
}
/* point sizes are in world units: scale by the buffer's pixels per unit at depth 1 */
function smokePx() {
  if (!CIG.smokeMat) return;
  const h = renderer.domElement.height;
  CIG.smokeMat.uniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}

/* ---------------------------------------------------- shirt, for framing */
function buildShirt() {
  const cloth = new THREE.MeshStandardMaterial({ color: hdr(.006, .006, .007), roughness: .9 });
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), cloth);
  torso.scale.set(1.6, .62, .82); torso.position.set(0, -1.92, -.12);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.6, .66, .24, 48, 1, true), cloth);
  band.position.set(0, -1.34, -.06); band.material.side = THREE.DoubleSide;
  g.add(torso, band);
  [-1, 1].forEach(s => {
    const pt = new THREE.Mesh(new THREE.BoxGeometry(.42, .03, .3), cloth);
    pt.position.set(s * .32, -1.38, .38); pt.rotation.set(.55, s * -.5, s * -.55);
    pt.castShadow = true; g.add(pt);
  });
  g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

/* ========================================================= 5 · lights */
function buildLights(visorZ) {
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2.8, 3.6, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = sc.bottom = -2.2; sc.right = sc.top = 2.2; sc.near = .5; sc.far = 12;
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc9d2ff, .32); fill.position.set(3, .2, 3); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 1.3); rimL.position.set(-3.2, 1.2, -3); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xffffff, 1.6); rimR.position.set(3.4, 2, -2.8); scene.add(rimR);
  scene.add(new THREE.HemisphereLight(0x2a2a30, 0x050505, .45));

  /* the bar lights what is right below it */
  const red = new THREE.PointLight(0xff2a24, 2.6, 1.6, 2);
  red.position.set(0, .06, visorZ + .18);
  scene.add(red);
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
const TARGET = new THREE.Vector3(0, -.22, .3);
const VIEWS = { front: [0, .02], three: [.55, .06], profile: [1.45, .02] };
const RIG = { yaw: VIEWS.three[0], pitch: VIEWS.three[1], tYaw: VIEWS.three[0], tPitch: VIEWS.three[1], dist: 5.6, tDist: 5.6, mx: 0, my: 0 };

function applyCamera(dt) {
  RIG.yaw = damp(RIG.yaw, RIG.tYaw, 6, dt);
  RIG.pitch = damp(RIG.pitch, RIG.tPitch, 6, dt);
  RIG.dist = damp(RIG.dist, RIG.tDist, 6, dt);
  const tall = clamp((1.2 - vpW() / vpH()) / .7, 0, 1);
  const r = RIG.dist + tall * 2.2;
  camera.position.set(
    TARGET.x + Math.sin(RIG.yaw) * Math.cos(RIG.pitch) * r,
    TARGET.y + Math.sin(RIG.pitch) * r,
    TARGET.z + Math.cos(RIG.yaw) * Math.cos(RIG.pitch) * r
  );
  camera.lookAt(TARGET);
}

function wireControls() {
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-drag'); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    RIG.tYaw -= (e.clientX - drag.x) * .006;
    RIG.tPitch = clamp(RIG.tPitch + (e.clientY - drag.y) * .004, -.5, .7);
    drag.x = e.clientX; drag.y = e.clientY;
    setPressed(null);
  });
  const end = () => { drag = null; canvas.classList.remove('is-drag'); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); RIG.tDist = clamp(RIG.tDist + e.deltaY * .003, 2.4, 7); }, { passive: false });

  const views = [].slice.call(document.querySelectorAll('[data-view]'));
  function setPressed(name) { views.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name))); }
  views.forEach(b => b.addEventListener('click', () => {
    const v = VIEWS[b.dataset.view];
    /* take the short way round */
    const turns = Math.round((RIG.tYaw - v[0]) / (Math.PI * 2));
    RIG.tYaw = v[0] + turns * Math.PI * 2; RIG.tPitch = v[1];
    setPressed(b.dataset.view);
  }));
  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    if (b.dataset.toggle === 'fur') { HEAD.fur.visible = on; HEAD.wisps.visible = on; }
    if (b.dataset.toggle === 'post') setFilm(on);
  }));
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
}

function start() {
  initGL();
  const env = buildEnvironment();
  const head = buildHead(env);
  scene.add(head);
  scene.add(buildEars(env));
  HEAD.fur = buildFur(); scene.add(HEAD.fur);
  HEAD.wisps = buildWisps(); scene.add(HEAD.wisps);
  const visor = buildVisor(env); scene.add(visor);
  scene.add(buildShirt());
  buildCigarette();
  scene.add(buildSmoke());
  smokePx();
  buildLights(visor.userData.frontZ);
  initPost();
  if (qs('post', '1') === '0') setFilm(false);
  if (qs('debug', '0') === '1') window.__face = { scene: scene, camera: camera, renderer: renderer, HEAD: HEAD, RIG: RIG };
  wireControls();
  addEventListener('resize', resize);

  let last = performance.now(), t0 = last;
  (function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!REDUCE) RIG.tYaw += Math.sin((now - t0) * .00025) * .00025;    /* breath of a drift */
    applyCamera(dt);
    const tt = (now - t0) / 1000;
    POST.comp.uniforms.uT.value = tt;
    /* the ember breathes: a slow draw, a quick flicker on top */
    const draw = .75 + .25 * Math.sin(tt * 1.3) + .08 * Math.sin(tt * 17.0 + Math.sin(tt * 5.0) * 2.0);
    CIG.emberMat.color.setRGB(3.2 * draw, .6 * draw, .12 * draw);
    CIG.light.intensity = .7 * draw;
    if (!REDUCE) CIG.smokeMat.uniforms.uT.value = tt;
    renderer.setRenderTarget(POST.scene);
    renderer.render(scene, camera);
    renderPost();
    requestAnimationFrame(frame);
  })(last);
  status.classList.add('is-done');
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
