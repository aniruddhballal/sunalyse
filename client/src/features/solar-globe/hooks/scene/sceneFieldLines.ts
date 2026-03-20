import * as THREE from 'three';
import type { CoronalData } from '../data/useCoronalFieldLines';
import type { ThreeSceneRef } from './sceneTypes';

// Clears all children from a THREE.Group, disposing geometry and materials
export function clearGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
    group.remove(child);
  }
}

export interface BuildFieldLinesParams {
  coronalData: CoronalData;
  sceneRef: React.MutableRefObject<ThreeSceneRef | null>;
  fieldLineMaxStrength: number;
  showCoronalLines: boolean;
  showOpenLines: boolean;
  showClosedLines: boolean;
  currentCoronalDataRef: React.MutableRefObject<CoronalData | null>;
  fieldLineTransitionRef: React.MutableRefObject<{ isTransitioning: boolean; startTime: number; duration: number } | null>;
}

export function buildFieldLines({
  coronalData,
  sceneRef,
  fieldLineMaxStrength,
  showCoronalLines,
  showOpenLines,
  showClosedLines,
  currentCoronalDataRef,
  fieldLineTransitionRef,
}: BuildFieldLinesParams): void {
  if (!sceneRef.current) return;

  const { fieldLineGroup, oldFieldLineGroup, sourceSurface } = sceneRef.current;
  const hasExistingLines = fieldLineGroup.children.length > 0;

  if (hasExistingLines && currentCoronalDataRef.current !== coronalData) {
    // Swap current → old for fade-out transition
    clearGroup(oldFieldLineGroup);
    while (fieldLineGroup.children.length > 0) {
      const child = fieldLineGroup.children[0];
      fieldLineGroup.remove(child);
      oldFieldLineGroup.add(child);
    }
    fieldLineTransitionRef.current = {
      isTransitioning: true,
      startTime: Date.now(),
      duration: 800,
    };
  } else {
    clearGroup(fieldLineGroup);
  }

  // Update source surface radius to match this CR's r_source
  sourceSurface.geometry.dispose();
  sourceSurface.geometry = new THREE.SphereGeometry(coronalData.metadata.r_source, 64, 64);

  const globalMaxStrength = fieldLineMaxStrength > 0 ? fieldLineMaxStrength : 500;

  coronalData.fieldLines.forEach((fieldLine) => {
    if (fieldLine.points.length < 2) return;

    const isOpen    = fieldLine.polarity === 'open';
    const pts       = fieldLine.points;
    const strengths = fieldLine.strengths;

    const positions = new Float32Array(pts.length * 3);
    const colors    = new Float32Array(pts.length * 3);

    pts.forEach(([x, y, z], i) => {
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const raw = strengths[Math.min(i, strengths.length - 1)] ?? 0;
      const t   = Math.min(raw / globalMaxStrength, 1.0);

      if (isOpen) {
        // dim green (weak) → bright yellow-green (strong)
        colors[i * 3]     = t * 0.5;
        colors[i * 3 + 1] = 0.4 + t * 0.6;
        colors[i * 3 + 2] = 0.0;
      } else {
        // deep red (weak) → bright orange-yellow (strong)
        colors[i * 3]     = 0.5 + t * 0.5;
        colors[i * 3 + 1] = t * 0.65;
        colors[i * 3 + 2] = t * 0.05;
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: hasExistingLines ? 0 : 0.75,
      linewidth: 1,
    });

    const line = new THREE.Line(geometry, material);
    line.userData = {
      polarity:      fieldLine.polarity,
      apexR:         fieldLine.apexR ?? 2.5,
      fieldLineData: fieldLine,
    };
    line.visible      = showCoronalLines && (isOpen ? showOpenLines : showClosedLines);
    line.rotation.y   = sceneRef.current!.sphere.rotation.y;
    line.rotation.x   = sceneRef.current!.sphere.rotation.x;

    fieldLineGroup.add(line);
  });
}

export function buildPolarityMesh({
  coronalData,
  sceneRef,
  showCoronalLines,
  showSourceSurface,
  showPolarity,
}: {
  coronalData: CoronalData;
  sceneRef: React.MutableRefObject<ThreeSceneRef | null>;
  showCoronalLines: boolean;
  showSourceSurface: boolean;
  showPolarity: boolean;
}): void {
  if (!sceneRef.current || !coronalData.polarityGrid) return;
  const { data, n_theta, n_phi } = coronalData.polarityGrid;
  if (data.length === 0) return;

  const { polarityMesh, polarityGroup, sourceSurface } = sceneRef.current;
  const maxVal = Math.max(...data.map(Math.abs)) || 1;

  const brFloat   = new Float32Array(data);
  const brTexture = new THREE.DataTexture(brFloat, n_phi, n_theta, THREE.RedFormat, THREE.FloatType);
  brTexture.minFilter  = THREE.LinearFilter;
  brTexture.magFilter  = THREE.LinearFilter;
  brTexture.flipY      = true;
  brTexture.needsUpdate = true;

  const polarityShader = new THREE.ShaderMaterial({
    uniforms: {
      brMap:       { value: brTexture },
      maxStrength: { value: maxVal },
    },
    vertexShader: [
      'varying vec3 vWorldPos;',
      'void main() {',
      '  vWorldPos = position;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D brMap;',
      'uniform float maxStrength;',
      'varying vec3 vWorldPos;',
      'void main() {',
      '  float r = length(vWorldPos);',
      '  float cosTheta = clamp(vWorldPos.z / r, -1.0, 1.0);',
      '  float theta = acos(cosTheta);',
      '  float phi = atan(vWorldPos.y, vWorldPos.x);',
      '  if (phi < 0.0) phi += 6.28318530718;',
      '  float u = phi / 6.28318530718;',
      '  float v = 1.0 - theta / 3.14159265359;',
      '  float br = texture2D(brMap, vec2(u, v)).r;',
      '  float t = clamp(abs(br) / maxStrength, 0.0, 1.0);',
      '  vec3 col;',
      '  if (br >= 0.0) {',
      '    col = vec3(0.5 + t*0.5, t*0.65, t*0.05);',
      '  } else {',
      '    col = vec3(t*0.5, 0.4 + t*0.6, 0.0);',
      '  }',
      '  gl_FragColor = vec4(col, 0.3 + t*0.5);',
      '}'
    ].join('\n'),
    transparent: true,
    side: THREE.FrontSide,
  });

  if (polarityMesh.material) {
    (polarityMesh.material as THREE.Material).dispose();
  }
  polarityMesh.material = polarityShader;

  polarityGroup.rotation.y = sceneRef.current.sphere.rotation.y;
  polarityGroup.rotation.x = sceneRef.current.sphere.rotation.x;
  polarityGroup.visible    = showPolarity;

  sourceSurface.visible = showCoronalLines && showSourceSurface && !showPolarity;
}

export function buildFootpoints({
  coronalData,
  sceneRef,
  showFootpoints,
}: {
  coronalData: CoronalData;
  sceneRef: React.MutableRefObject<ThreeSceneRef | null>;
  showFootpoints: boolean;
}): void {
  if (!sceneRef.current) return;
  const { footpointGroup, sphere } = sceneRef.current;

  while (footpointGroup.children.length > 0) {
    const child = footpointGroup.children[0];
    if (child instanceof THREE.Points) child.geometry.dispose();
    footpointGroup.remove(child);
  }

  const fpPositions: number[] = [];
  coronalData.fieldLines.forEach((fl) => {
    if (!fl.footpoints || fl.footpoints.length < 2) return;
    fl.footpoints.forEach(([theta, phi]: [number, number]) => {
      const r = 1.01;
      fpPositions.push(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(theta)
      );
    });
  });

  if (fpPositions.length > 0) {
    const fpGeometry = new THREE.BufferGeometry();
    fpGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fpPositions), 3));
    const fpMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.012,
      transparent: true,
      opacity: 0.7,
    });
    footpointGroup.add(new THREE.Points(fpGeometry, fpMaterial));
    footpointGroup.rotation.y = sphere.rotation.y;
    footpointGroup.rotation.x = sphere.rotation.x;
    footpointGroup.visible    = showFootpoints;
  }
}