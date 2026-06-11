// 005 SIGNED — raymarched SDF composition. Smooth-min blended primitives,
// tetrahedral normals, penumbra soft shadows, AO, fresnel rim.
// MAX_STEPS / SHADOW_STEPS are #defined by the TS module (mobile vs desktop).

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uCursor;

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float map(vec3 p) {
  float t = uTime * 0.6;

  // Orbiting spheres around a slowly tumbling rounded box and torus.
  vec3 q = p;
  q.xz *= rot(t * 0.35);
  q.xy *= rot(t * 0.22);

  float box = sdRoundBox(q, vec3(0.45), 0.12);

  vec3 tq = p;
  tq.xy *= rot(t * 0.5);
  float torus = sdTorus(tq, vec2(1.15, 0.16));

  vec3 o1 = vec3(cos(t) * 1.1, sin(t * 1.3) * 0.6, sin(t) * 1.1);
  vec3 o2 = vec3(cos(t * 0.7 + 2.6) * 1.3, cos(t * 1.1) * 0.5, sin(t * 0.7 + 2.6) * 1.3);
  float s1 = sdSphere(p - o1, 0.34);
  float s2 = sdSphere(p - o2, 0.26);

  float d = smin(box, torus, 0.45);
  d = smin(d, s1, 0.55);
  d = smin(d, s2, 0.55);

  // Ground plane.
  float ground = p.y + 1.35;
  return min(d, ground);
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.0008, -0.0008);
  return normalize(
    e.xyy * map(p + e.xyy) +
    e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) +
    e.xxx * map(p + e.xxx)
  );
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float h = map(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.35);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.06 * float(i);
    occ += (h - map(p + n * h)) * w;
    w *= 0.65;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0) * 2.0;

  // Cursor orbits the camera; slow auto-drift keeps it alive untouched.
  float yaw = uCursor.x * 1.35 + uTime * 0.06;
  float pitch = clamp(uCursor.y * 0.6 + 0.25, -0.2, 1.0);
  float rad = 4.4;
  vec3 ro = vec3(sin(yaw) * rad * cos(pitch), sin(pitch) * 2.6, cos(yaw) * rad * cos(pitch));
  vec3 ta = vec3(0.0, -0.1, 0.0);

  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.7 + rt * uv.x + up * uv.y);

  // Sphere trace.
  float t = 0.0;
  float d = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    d = map(ro + rd * t);
    if (d < 0.001 || t > 24.0) break;
    t += d;
  }

  // Background — deep vertical gradient with a breath of warmth low down.
  vec3 col = mix(vec3(0.052, 0.05, 0.07), vec3(0.016, 0.016, 0.024), clamp(rd.y * 0.5 + 0.55, 0.0, 1.0));
  col += vec3(0.05, 0.025, 0.015) * pow(clamp(1.0 - abs(rd.y), 0.0, 1.0), 5.0);

  if (d < 0.001) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    bool isGround = p.y < -1.33;

    vec3 keyDir = normalize(vec3(0.65, 0.8, -0.35));
    vec3 fillDir = normalize(vec3(-0.6, 0.25, 0.7));

    float key = clamp(dot(n, keyDir), 0.0, 1.0);
    float shadow = softShadow(p + n * 0.02, keyDir, 0.04, 8.0, 11.0);
    float fill = clamp(dot(n, fillDir), 0.0, 1.0);
    float ao = calcAO(p, n);

    vec3 albedo = isGround ? vec3(0.10, 0.10, 0.125) : vec3(0.32, 0.33, 0.38);

    vec3 lit = vec3(0.0);
    lit += albedo * key * shadow * vec3(1.25, 1.05, 0.85) * 1.5;
    lit += albedo * fill * vec3(0.30, 0.42, 0.60) * 0.7;
    lit += albedo * vec3(0.16, 0.17, 0.22) * ao;

    // Specular + fresnel rim on the blend, not the floor.
    if (!isGround) {
      vec3 h = normalize(keyDir - rd);
      float spec = pow(clamp(dot(n, h), 0.0, 1.0), 48.0) * shadow;
      float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.5);
      lit += vec3(1.0, 0.95, 0.85) * spec * 0.9;
      lit += vec3(0.45, 0.65, 0.85) * fres * 0.55;
    }

    // Distance fog folds it back into the dark.
    float fog = 1.0 - exp(-t * 0.10);
    col = mix(lit, col, fog);
  }

  // Filmic-ish curve + grain.
  col = col / (col + 0.55);
  col = pow(col, vec3(0.85));
  float g = fract(sin(dot(vUv * uResolution + fract(uTime) * 71.3, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * 0.022;

  gl_FragColor = vec4(col, 1.0);
}
