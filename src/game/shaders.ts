// ===== Shaders GLSL customizados =====

export const FLOOR_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const FLOOR_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uPlayer;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec4 uRipples[10];
uniform float uArena;
uniform float uPulse;
varying vec3 vWorld;

float gridLine(vec2 p, float w) {
  vec2 fw = max(fwidth(p), vec2(0.0001));
  vec2 g = abs(fract(p - 0.5) - 0.5) / fw;
  float l = min(g.x, g.y);
  return 1.0 - smoothstep(0.0, w, l);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 p = vWorld.xz;
  float d = length(p - uPlayer.xz);
  float small = gridLine(p * 0.5, 1.1);
  float big = gridLine(p * 0.1, 1.4);
  float fade = exp(-d * 0.028);
  float playerGlow = exp(-d * d * 0.015) * 0.9;
  float ripple = 0.0;
  for (int i = 0; i < 10; i++) {
    vec4 r = uRipples[i];
    if (r.w <= 0.0) continue;
    float age = uTime - r.z;
    float rad = age * 26.0;
    float dd = abs(length(p - r.xy) - rad);
    ripple += r.w * exp(-dd * dd * 0.35) * exp(-age * 1.8);
  }
  // tiles: faint glassy fill with hex-ish sparkle
  vec2 tile = floor(p * 0.5);
  float sparkle = hash(tile) ;
  float tilePulse = 0.5 + 0.5 * sin(uTime * 1.5 + sparkle * 6.283 + d * 0.15);
  float fill = 0.045 + 0.05 * tilePulse * fade;

  vec3 col = uColor * (small * 0.28 + big * 0.9) * (0.3 + fade * 1.1 + playerGlow * 1.5);
  col += uColor2 * fill * 1.3;
  col += mix(uColor, vec3(1.0), 0.5) * ripple * 2.2 * (small * 0.6 + big + 0.35);
  col += uColor * playerGlow * 0.35 * uPulse;

  float rim = 1.0 - smoothstep(uArena - 1.5, uArena, length(p));
  float alpha = (small * 0.45 + big * 0.7) * (0.28 + fade * 0.9) + fill + ripple * 0.6;
  alpha *= rim;
  col *= rim;

  // borda da arena
  float edge = exp(-abs(length(p) - uArena) * 0.9);
  float edgeDash = 0.6 + 0.4 * sin(atan(p.y, p.x) * 60.0 - uTime * 3.0);
  col += vec3(1.0, 0.25, 0.55) * edge * 2.0 * edgeDash;
  alpha += edge * 0.9;

  gl_FragColor = vec4(max(vec3(0.0), col), clamp(alpha, 0.0, 1.0));
}
`;

export const NEBULA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const NEBULA_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vUv * 7.0;
  float t = uTime * 0.018;
  float n1 = fbm(p + vec2(t, -t * 0.7));
  float n2 = fbm(p * 1.7 + n1 * 2.2 + vec2(-t * 0.5, t));
  float n3 = n1 * 0.6 + n2 * 0.4;
  vec3 c1 = vec3(0.32, 0.03, 0.55);
  vec3 c2 = vec3(0.0, 0.42, 0.75);
  vec3 c3 = vec3(0.85, 0.12, 0.45);
  vec3 col = vec3(0.005, 0.0, 0.02);
  col = mix(col, c1, smoothstep(0.35, 0.8, n1) * 0.55);
  col = mix(col, c2, smoothstep(0.5, 0.9, n2) * 0.45);
  col = mix(col, c3, pow(n1 * n2, 3.0) * 1.6);
  col += c2 * pow(n3, 4.0) * 0.6;
  // estrelas
  vec2 sp = vUv * 520.0;
  vec2 si = floor(sp);
  float h = hash(si);
  float star = step(0.982, h) * pow(max(0.0, 1.0 - length(fract(sp) - 0.5) * 2.0), 5.0);
  star *= 0.55 + 0.45 * sin(uTime * 2.5 + h * 60.0);
  col += vec3(0.8, 0.9, 1.0) * star * 1.4;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const STARS_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
varying float vTw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vTw = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
  gl_PointSize = aSize * (200.0 / -mv.z) * (0.7 + 0.3 * vTw);
  gl_Position = projectionMatrix * mv;
}
`;

export const STARS_FRAG = /* glsl */ `
varying float vTw;
uniform vec3 uColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, 2.0);
  gl_FragColor = vec4(uColor * (0.6 + vTw) * a, a * (0.5 + 0.5 * vTw));
}
`;

export const NEON_VERT = /* glsl */ `
attribute vec3 aTint;
attribute float aFlash;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vTint;
varying float vFlash;
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  vTint = aTint;
  vFlash = aFlash;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const NEON_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uBase;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vTint;
varying float vFlash;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
  float diff = max(dot(n, normalize(vec3(0.4, 1.0, 0.3))), 0.0);
  float spec = pow(max(dot(reflect(-normalize(vec3(0.4, 1.0, 0.3)), n), v), 0.0), 24.0);
  vec3 col = uBase * (0.3 + diff * 0.7) + vTint * 0.12;
  col += vTint * fres * 2.4;
  col += vec3(1.0) * spec * 0.4;
  float pulse = 0.85 + 0.15 * sin(uTime * 6.0 + vWorldPos.x * 0.6 + vWorldPos.z * 0.6);
  col *= pulse;
  col = mix(col, vec3(3.5, 3.5, 3.5), clamp(vFlash, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

export const SHIELD_VERT = /* glsl */ `
uniform vec3 uImpact;
uniform float uImpactAge;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocal;
varying float vWave;
void main() {
  vec3 pn = normalize(position);
  float d = distance(pn, normalize(uImpact + vec3(0.0001)));
  float wave = sin(d * 18.0 - uImpactAge * 16.0) * exp(-uImpactAge * 3.5) * exp(-d * 1.6) * 0.18;
  vWave = wave;
  vec3 pos = position + normal * wave;
  vLocal = pn;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SHIELD_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uImpactAge;
uniform vec3 uImpact;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocal;
varying float vWave;
float hexDist(vec2 p) {
  p = abs(p);
  float c = dot(p, normalize(vec2(1.0, 1.73)));
  return max(c, p.x);
}
vec4 hexCoords(vec2 uv) {
  vec2 r = vec2(1.0, 1.73);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  float y = 0.5 - hexDist(gv);
  vec2 id = uv - gv;
  return vec4(gv.x, y, id);
}
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.5);
  vec2 uv = vec2(atan(vLocal.z, vLocal.x) * 3.0, vLocal.y * 5.0 + uTime * 0.15);
  vec4 hc = hexCoords(uv * 1.6);
  float edge = smoothstep(0.0, 0.1, hc.y);
  float cells = 0.5 + 0.5 * sin(uTime * 3.0 + hc.z * 2.0 + hc.w * 3.0);
  float d = distance(vLocal, normalize(uImpact + vec3(0.0001)));
  float impact = exp(-d * 3.0) * exp(-uImpactAge * 3.0) * 2.0;
  float ring = smoothstep(0.08, 0.0, abs(d - uImpactAge * 1.6)) * exp(-uImpactAge * 2.5);
  float a = fres * 0.9 + (1.0 - edge) * 0.55 + cells * 0.08 + impact + ring * 1.5 + abs(vWave) * 4.0;
  vec3 col = uColor * (1.2 + impact * 2.0 + ring * 2.0);
  gl_FragColor = vec4(col * a, a * uOpacity);
}
`;

export const TELEGRAPH_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TELEGRAPH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uType;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float alpha = 0.0;
  if (uType < 0.5) {
    // círculo de bombardeio
    float r = length(p);
    float outer = smoothstep(0.05, 0.0, abs(r - 0.96));
    float fill = step(r, uProgress) * 0.32 * (0.75 + 0.25 * sin(uTime * 12.0));
    float inner = smoothstep(0.04, 0.0, abs(r - uProgress)) * 1.2;
    float cross = (smoothstep(0.03, 0.0, abs(p.x)) + smoothstep(0.03, 0.0, abs(p.y))) * 0.35 * step(r, 0.9);
    float spin = 0.5 + 0.5 * sin(atan(p.y, p.x) * 8.0 + uTime * 6.0);
    alpha = (outer * (0.6 + 0.4 * spin) + fill + inner + cross) * step(r, 1.0);
  } else if (uType < 1.5) {
    // anel de choque / fenda
    float r = length(p);
    float w = 0.1;
    float ring = smoothstep(w, 0.0, abs(r - 0.8)) * (0.6 + 0.4 * sin(uTime * 10.0 - r * 40.0));
    float glow = exp(-abs(r - 0.8) * 6.0) * 0.5;
    float core = exp(-r * 3.0) * uProgress * 0.8;
    alpha = (ring + glow + core) * step(r, 1.0);
  } else {
    // linha de mira / carga de feixe
    float across = abs(vUv.y - 0.5) * 2.0;
    float core = pow(smoothstep(1.0, 0.0, across), 2.0);
    float dash = 0.55 + 0.45 * step(0.5, fract(vUv.x * 24.0 - uTime * 5.0));
    float head = smoothstep(0.0, 0.05, vUv.x);
    alpha = core * dash * head * (0.4 + uProgress * 0.9);
  }
  gl_FragColor = vec4(uColor * (1.2 + uProgress * 1.5), alpha * uAlpha);
}
`;

export const PARTICLE_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(72.0, aSize * (620.0 / -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor * vAlpha * a * 2.2, vAlpha * a);
}
`;

export const TEXT_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
attribute float aCell;
uniform float uCells;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vUv = vec2((uv.x + aCell) / uCells, uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const TEXT_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.15) discard;
  gl_FragColor = vec4(vColor * 1.8 * t.rgb, t.a * vAlpha);
}
`;

export const GLYPH_VERT = /* glsl */ `
attribute float aCell;
uniform float uCells;
varying vec2 vUv;
varying vec3 vColor;
void main() {
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(1.0);
#endif
  vUv = vec2((uv.x + aCell) / uCells, uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const GLYPH_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.2) discard;
  float pulse = 0.8 + 0.2 * sin(uTime * 14.0);
  gl_FragColor = vec4(vColor * 2.4 * pulse, t.a);
}
`;

export const RIBBON_VERT = /* glsl */ `
attribute float aAlpha;
attribute float aSide;
varying float vAlpha;
varying float vSide;
void main() {
  vAlpha = aAlpha;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RIBBON_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vSide;
void main() {
  float edge = 1.0 - smoothstep(0.1, 1.0, abs(vSide));
  float core = pow(edge, 8.0) * vAlpha;
  gl_FragColor = vec4(mix(uColor * (0.8 + vAlpha * 1.8), vec3(2.0), core * 0.35), vAlpha * edge * 0.9);
}
`;

export const CORE_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  vPos = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CORE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uRage;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPos;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i), n100 = hash(i + vec3(1, 0, 0)), n010 = hash(i + vec3(0, 1, 0)), n110 = hash(i + vec3(1, 1, 0));
  float n001 = hash(i + vec3(0, 0, 1)), n101 = hash(i + vec3(1, 0, 1)), n011 = hash(i + vec3(0, 1, 1)), n111 = hash(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
void main() {
  vec3 n = normalize(vNormal);
  float fres = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 2.0);
  float t = uTime * (0.6 + uRage * 1.5);
  float nz = noise(vPos * 1.4 + vec3(t, -t * 0.7, t * 0.4));
  nz += 0.5 * noise(vPos * 3.0 - vec3(t * 0.8));
  float veins = smoothstep(0.55, 0.75, nz);
  float pulse = 0.7 + 0.3 * sin(uTime * (3.0 + uRage * 6.0));
  vec3 col = mix(uColorA, uColorB, veins) * (0.9 + pulse * 0.8);
  col += uColorB * fres * 2.5;
  col += vec3(1.0, 0.9, 0.7) * pow(veins, 3.0) * pulse * 1.5;
  gl_FragColor = vec4(col * (1.0 + uRage * 0.6), 1.0);
}
`;

export const FX_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FX_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uChroma;
uniform float uVignette;
uniform float uGrain;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uDesat;
uniform vec2 uResolution;
uniform vec4 uShock[4];
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 distortion = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 shock = uShock[i];
    vec2 delta = (vUv - shock.xy) * aspect;
    float distanceToBlast = length(delta);
    float ring = exp(-pow((distanceToBlast - shock.z * 0.7) * 42.0, 2.0));
    distortion += delta / max(distanceToBlast, 0.001) / aspect * ring * shock.w * (1.0 - shock.z) * 0.008;
  }
  uv = clamp(uv + clamp(distortion, vec2(-0.012), vec2(0.012)), vec2(0.001), vec2(0.999));
  vec2 dir = uv - 0.5;
  float dist = length(dir);
  float ca = uChroma * (0.0015 + dist * 0.02);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir * ca).b;
  float vig = 1.0 - smoothstep(0.35, 1.05, dist * 1.45) * uVignette;
  col *= max(0.0, vig);
  float g = fract(sin(dot(uv * uResolution + vec2(uTime * 131.0, uTime * 71.0), vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * uGrain;
  col = max(vec3(0.0), col);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), uDesat);
  col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
  gl_FragColor = vec4(max(vec3(0.0), col), 1.0);
}
`;
