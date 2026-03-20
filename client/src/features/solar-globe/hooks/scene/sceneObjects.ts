import * as THREE from 'three';

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const createStarField = (): THREE.Points => {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi   = Math.random() * Math.PI * 2;
    const r     = 400 + Math.random() * 100;
    positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = r * Math.cos(theta);
    positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    sizes[i] = 0.4 + Math.random() * 1.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
  });

  return new THREE.Points(geometry, material);
};

export const createGraticule = (): THREE.Group => {
  const group = new THREE.Group();
  const R = 1.002;
  const mat = new THREE.LineBasicMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.35,
  });
  const segments = 64;

  for (const lat of [-60, -30, 0, 30, 60]) {
    const colatRad = (90 - lat) * Math.PI / 180;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const phi = (i / segments) * 2 * Math.PI;
      pts.push(new THREE.Vector3(
        R * Math.sin(colatRad) * Math.cos(phi),
        R * Math.cos(colatRad),
        R * Math.sin(colatRad) * Math.sin(phi)
      ));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }

  for (let lon = 0; lon < 360; lon += 30) {
    const phi = lon * Math.PI / 180;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const colatRad = (i / segments) * Math.PI;
      pts.push(new THREE.Vector3(
        R * Math.sin(colatRad) * Math.cos(phi),
        R * Math.cos(colatRad),
        R * Math.sin(colatRad) * Math.sin(phi)
      ));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }

  return group;
};

export const createPoleAxes = (): THREE.Group => {
  const group = new THREE.Group();
  const axisLength = 0.5;

  const northPoints = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1 + axisLength, 0),
  ];
  group.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(northPoints),
    new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 })
  ));

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.1, 8),
    new THREE.MeshBasicMaterial({ color: 0x4444ff })
  );
  arrow.position.set(0, 1 + axisLength, 0);
  group.add(arrow);

  const southPoints = [
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, -1 - axisLength, 0),
  ];
  group.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(southPoints),
    new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 })
  ));

  return group;
};

export const createGlowSphere = (): THREE.Mesh => {
  const geometry = new THREE.SphereGeometry(1.22, 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xff6020) },
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'varying vec3 vViewDir;',
      'void main() {',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 worldPos = modelViewMatrix * vec4(position, 1.0);',
      '  vViewDir = normalize(-worldPos.xyz);',
      '  gl_Position = projectionMatrix * worldPos;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 glowColor;',
      'varying vec3 vNormal;',
      'varying vec3 vViewDir;',
      'void main() {',
      '  float fresnel = 1.0 - abs(dot(vNormal, vViewDir));',
      '  fresnel = pow(fresnel, 2.8);',
      '  gl_FragColor = vec4(glowColor, fresnel * 0.55);',
      '}'
    ].join('\n'),
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
};