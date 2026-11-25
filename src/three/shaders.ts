/**
 * Ink-on-paper shaders. Colours are passed as raw sRGB (vec3 0..1) and written
 * straight to the canvas so they match the CSS paper/ink exactly.
 */

const bend = /* glsl */ `
  uniform float uTime;
  vec3 bendWhale(vec3 p) {
  #ifdef BEND
    float t = clamp((0.7 - p.x) / 2.8, 0.0, 1.0);
    p.y += sin(uTime * 2.0 - p.x * 1.3) * 0.3 * t * t;
    p.z += sin(uTime * 1.1 - p.x * 0.7) * 0.05 * t;
  #endif
    return p;
  }
`

export const inkVertex = /* glsl */ `
  ${bend}
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(bendWhale(position), 1.0);
    vViewPos = mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`

/**
 * Before the split (x < uSplit): halftone dots shaded by light.
 * After the split: a flickering black redaction mosaic.
 */
export const inkFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSplit;
  uniform float uDpr;
  uniform float uDot;
  uniform vec3 uInkC;
  uniform vec3 uPaperC;
  uniform vec3 uRed;
  uniform float uDark;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // in the dark footer the page is ink, so ink and paper swap roles
    vec3 uInk = mix(uInkC, uPaperC, uDark);
    vec3 uPaper = mix(uPaperC, uInkC, uDark);
    vec2 px = gl_FragCoord.xy / uDpr;
    float d = uSplit - vLocal.x;

    if (d < 0.0) {
      vec2 cell = floor(px / 9.0);
      float r = hash(cell + floor(uTime * 1.5 + hash(cell) * 5.0));
      vec3 c = r > 0.1 ? uInk : uPaper;
      if (r > 0.985) c = uRed;
      gl_FragColor = vec4(c, 1.0);
      return;
    }

    vec3 n = normalize(vNormal + vec3(1e-5));
    vec3 v = normalize(-vViewPos);
    vec3 L = normalize(vec3(0.45, 0.85, 0.55));
    float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.0);
    float dark = clamp((1.0 - diff) * 1.15 + rim * 0.7 - 0.05, 0.0, 1.0);

    float a = 0.785398;
    mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 f = fract(rot * px / uDot) - 0.5;
    float radius = sqrt(dark) * 0.64;
    float ink = 1.0 - smoothstep(radius - 0.07, radius + 0.07, length(f));
    vec3 c = mix(uPaper, uInk, ink);

    // red seam where the ring is slicing through
    c = mix(c, uRed, 1.0 - smoothstep(0.0, 0.05, d));
    gl_FragColor = vec4(c, 1.0);
  }
`

/** Inverted-hull outline: back faces pushed out along the normal, drawn solid ink. */
export const outlineVertex = /* glsl */ `
  ${bend}
  uniform float uThick;
  void main() {
    vec3 p = bendWhale(position + normal * uThick);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

export const outlineFragment = /* glsl */ `
  uniform vec3 uInkC;
  uniform vec3 uPaperC;
  uniform float uDark;
  void main() { gl_FragColor = vec4(mix(uInkC, uPaperC, uDark), 1.0); }
`

/** Rising bubbles: ink rings, camera-facing points. */
export const bubbleVertex = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  uniform float uDpr;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uDpr * (10.0 / -mv.z) * smoothstep(0.0, 0.15, aLife);
  }
`

export const bubbleFragment = /* glsl */ `
  uniform vec3 uInkC;
  uniform vec3 uPaperC;
  uniform float uDark;
  varying float vLife;
  void main() {
    if (vLife <= 0.0) discard;
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float ring = smoothstep(0.5, 0.44, r) * smoothstep(0.30, 0.36, r);
    float shine = smoothstep(0.12, 0.05, length(c - vec2(-0.13, 0.13)));
    float a = max(ring, shine) * smoothstep(0.0, 0.3, vLife);
    if (a < 0.5) discard;
    gl_FragColor = vec4(mix(uInkC, uPaperC, uDark), 1.0);
  }
`
