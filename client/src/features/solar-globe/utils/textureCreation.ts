import * as THREE from 'three';
import type { FITSData } from '../fits/types';
import { getColorShaderCode } from './colorMapping';

export const createDataTexture = (
  fitsData: FITSData,
  useFixed: boolean,
  minVal: number,
  maxVal: number
): THREE.DataTexture => {
  const dataArray = new Float32Array(fitsData.width * fitsData.height);

  let min, max;
  if (useFixed) {
    min = minVal;
    max = maxVal;
  } else {
    min = fitsData.min;
    max = fitsData.max;
  }
  const range = max - min;

  for (let y = 0; y < fitsData.height; y++) {
    for (let x = 0; x < fitsData.width; x++) {
      const value = fitsData.data[y][x];
      const clampedValue = Math.max(min, Math.min(max, value));
      const normalized = (clampedValue - min) / range;
      dataArray[y * fitsData.width + x] = normalized;
    }
  }

  const texture = new THREE.DataTexture(
    dataArray,
    fitsData.width,
    fitsData.height,
    THREE.RedFormat,
    THREE.FloatType
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

// ─── Shared GLSL ─────────────────────────────────────────────────────────────

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

// Visible-light mode fragment — orange-yellow Sun with dark sunspots at high |Br|
// normalized = 0.5 → Br = 0 (quiet sun, full orange)
// normalized near 0 or 1 → high |Br| (active region, dark sunspot)
const visibleLightFragBody = `
  vec3 getVisibleColor(float normalized, vec3 normal, vec3 viewDir) {
    // Limb darkening: cos(angle) between normal and view direction
    float limbCos = abs(dot(normal, viewDir));
    float limb = 0.4 + 0.6 * pow(limbCos, 0.6);

    // Base solar colour — orange-yellow photosphere
    vec3 sunColor = vec3(1.0, 0.75, 0.18) * limb;

    // Sunspot darkness: how far from zero field (0.5)?
    // |normalized - 0.5| / 0.5 gives 0 at quiet sun, 1 at max field
    float fieldStrength = abs(normalized - 0.5) * 2.0;

    // Smooth darkening: sunspots appear above ~30% field strength
    float spotBlend = smoothstep(0.25, 0.75, fieldStrength);
    vec3 spotColor = vec3(0.06, 0.04, 0.02); // very dark brown-black

    return mix(sunColor, spotColor, spotBlend);
  }
`;

// Lighting helper shared by both modes
const lightingGlsl = `
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
`;

// ─── createShaderMaterial ─────────────────────────────────────────────────────

export const createShaderMaterial = (
  dataTexture: THREE.DataTexture,
  visibleLight: boolean = false
): THREE.ShaderMaterial => {
  if (visibleLight) {
    return new THREE.ShaderMaterial({
      uniforms: { dataMap: { value: dataTexture } },
      vertexShader,
      fragmentShader: `
        uniform sampler2D dataMap;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        ${visibleLightFragBody}

        void main() {
          float normalized = texture2D(dataMap, vUv).r;
          ${lightingGlsl}
          vec3 color = getVisibleColor(normalized, vNormal, vViewDir) * diff;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }

  return new THREE.ShaderMaterial({
    uniforms: { dataMap: { value: dataTexture } },
    vertexShader,
    fragmentShader: `
      uniform sampler2D dataMap;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      ${getColorShaderCode()}

      void main() {
        float normalized = texture2D(dataMap, vUv).r;
        vec3 color = getColorForValue(normalized);
        ${lightingGlsl}
        gl_FragColor = vec4(color * diff, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
};

// ─── createTransitionShaderMaterial ──────────────────────────────────────────

export const createTransitionShaderMaterial = (
  oldDataTexture: THREE.DataTexture,
  newDataTexture: THREE.DataTexture,
  visibleLight: boolean = false
): THREE.ShaderMaterial => {
  if (visibleLight) {
    return new THREE.ShaderMaterial({
      uniforms: {
        oldDataMap: { value: oldDataTexture },
        newDataMap:  { value: newDataTexture },
        mixFactor:   { value: 0.0 },
      },
      vertexShader,
      fragmentShader: `
        uniform sampler2D oldDataMap;
        uniform sampler2D newDataMap;
        uniform float mixFactor;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        ${visibleLightFragBody}

        void main() {
          float oldVal = texture2D(oldDataMap, vUv).r;
          float newVal = texture2D(newDataMap, vUv).r;
          float normalized = mix(oldVal, newVal, mixFactor);
          ${lightingGlsl}
          vec3 color = getVisibleColor(normalized, vNormal, vViewDir) * diff;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }

  return new THREE.ShaderMaterial({
    uniforms: {
      oldDataMap: { value: oldDataTexture },
      newDataMap:  { value: newDataTexture },
      mixFactor:   { value: 0.0 },
    },
    vertexShader,
    fragmentShader: `
      uniform sampler2D oldDataMap;
      uniform sampler2D newDataMap;
      uniform float mixFactor;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      ${getColorShaderCode()}

      void main() {
        float oldValue = texture2D(oldDataMap, vUv).r;
        float newValue = texture2D(newDataMap, vUv).r;
        float interpolatedValue = mix(oldValue, newValue, mixFactor);
        vec3 color = getColorForValue(interpolatedValue);
        ${lightingGlsl}
        gl_FragColor = vec4(color * diff, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
};