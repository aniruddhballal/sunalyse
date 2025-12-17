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

export const createShaderMaterial = (dataTexture: THREE.DataTexture): THREE.ShaderMaterial => {
  return new THREE.ShaderMaterial({
    uniforms: {
      dataMap: { value: dataTexture }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D dataMap;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      ${getColorShaderCode()}
      
      void main() {
        float normalized = texture2D(dataMap, vUv).r;
        vec3 color = getColorForValue(normalized);
        
        // Add lighting
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
        
        gl_FragColor = vec4(color * diff, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
};

export const createTransitionShaderMaterial = (
  oldDataTexture: THREE.DataTexture, 
  newDataTexture: THREE.DataTexture
): THREE.ShaderMaterial => {
  return new THREE.ShaderMaterial({
    uniforms: {
      oldDataMap: { value: oldDataTexture },
      newDataMap: { value: newDataTexture },
      mixFactor: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D oldDataMap;
      uniform sampler2D newDataMap;
      uniform float mixFactor;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      ${getColorShaderCode()}
      
      void main() {
        // Interpolate the DATA values first
        float oldValue = texture2D(oldDataMap, vUv).r;
        float newValue = texture2D(newDataMap, vUv).r;
        float interpolatedValue = mix(oldValue, newValue, mixFactor);
        
        // THEN calculate the color from interpolated data
        vec3 color = getColorForValue(interpolatedValue);
        
        // Add lighting
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
        
        gl_FragColor = vec4(color * diff, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
};