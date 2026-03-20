import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { FITSData } from '../../fits/types';
import type { CoronalData } from '../data/useCoronalFieldLines';
import { createDataTexture, createShaderMaterial, createTransitionShaderMaterial } from '../../utils/textureCreation';

interface ThreeSceneRef {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sphere: THREE.Mesh;
  fieldLineGroup: THREE.Group;
  oldFieldLineGroup: THREE.Group;
  sourceSurface: THREE.Mesh;
  polarityMesh: THREE.Mesh;
  polarityGroup: THREE.Group;
  poleAxesGroup: THREE.Group;
  graticuleGroup: THREE.Group;
  footpointGroup: THREE.Group;
  animationId: number;
  isDragging: boolean;
  pausedForTransition: boolean;
  cameraDistance: number;
}

interface TransitionRef {
  isTransitioning: boolean;
  startTime: number;
  duration: number;
  oldFieldLines?: any[];
  newFieldLines?: any[];
}

interface FieldLineTransitionRef {
  isTransitioning: boolean;
  startTime: number;
  duration: number;
}

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const createStarField = (): THREE.Points => {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Random point on a large sphere (radius 400–500) using spherical coords
    const theta = Math.acos(2 * Math.random() - 1);
    const phi   = Math.random() * Math.PI * 2;
    const r     = 400 + Math.random() * 100;
    positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = r * Math.cos(theta);
    positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    sizes[i] = 0.4 + Math.random() * 1.2; // vary star sizes
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

const createGraticule = (): THREE.Group => {
  const group = new THREE.Group();
  const R = 1.002; // Slightly above surface to avoid z-fighting
  const mat = new THREE.LineBasicMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.35
  });
  const segments = 64;

  // Latitude lines (parallels) every 30°: -60, -30, 0, 30, 60
  // In Y-up Z-up convention: colatitude θ from Y axis
  // latitude = 90 - colatitude_deg
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
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts), mat
    ));
  }

  // Longitude lines (meridians) every 30°
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
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts), mat
    ));
  }

  return group;
};

const createPoleAxes = (): THREE.Group => {
  const group = new THREE.Group();
  
  const axisLength = 0.5; // Length extending from surface
  
  // North pole axis (blue with arrow)
  const northPoints = [
    new THREE.Vector3(0, 1, 0),           // Start at surface
    new THREE.Vector3(0, 1 + axisLength, 0) // Extend outward
  ];
  const northGeometry = new THREE.BufferGeometry().setFromPoints(northPoints);
  const northMaterial = new THREE.LineBasicMaterial({ 
    color: 0x4444ff, 
    linewidth: 2 
  });
  const northLine = new THREE.Line(northGeometry, northMaterial);
  group.add(northLine);
  
  // Arrow head for north pole
  const arrowLength = 0.1;
  const arrowWidth = 0.05;
  const arrowGeometry = new THREE.ConeGeometry(arrowWidth, arrowLength, 8);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x4444ff });
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow.position.set(0, 1 + axisLength, 0);
  arrow.rotation.x = 0; // Points up (default orientation)
  group.add(arrow);
  
  // South pole axis (red, no arrow)
  const southPoints = [
    new THREE.Vector3(0, -1, 0),           // Start at surface
    new THREE.Vector3(0, -1 - axisLength, 0) // Extend outward
  ];
  const southGeometry = new THREE.BufferGeometry().setFromPoints(southPoints);
  const southMaterial = new THREE.LineBasicMaterial({ 
    color: 0xff4444, 
    linewidth: 2 
  });
  const southLine = new THREE.Line(southGeometry, southMaterial);
  group.add(southLine);
  
  return group;
};

export const useThreeScene = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  fitsData: FITSData | null,
  show2DMap: boolean,
  isRotating: boolean,
  useFixedScale: boolean,
  fixedMin: string,
  fixedMax: string,
  coronalData: CoronalData | null,
  showCoronalLines: boolean,
  showOpenLines: boolean,
  showClosedLines: boolean,
  showSourceSurface: boolean,
  showGeographicPoles: boolean,
  fieldLineMaxStrength: number = 500,
  showPolarity: boolean = false,
  showGraticule: boolean = false,
  apexMinR: number = 1.0,
  apexMaxR: number = 2.5,
  showFootpoints: boolean = false,
  visibleLight: boolean = false
) => {
  const sceneRef = useRef<ThreeSceneRef | null>(null);
  const currentFitsDataRef = useRef<FITSData | null>(null);
  const transitionRef = useRef<TransitionRef | null>(null);
  const fieldLineTransitionRef = useRef<FieldLineTransitionRef | null>(null);
  const isRotatingRef   = useRef(isRotating);
  const visibleLightRef = useRef(visibleLight);
  const currentCoronalDataRef = useRef<CoronalData | null>(null);

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    visibleLightRef.current = visibleLight;
  }, [visibleLight]);

  const initThreeJS = (fitsData: FITSData) => {
    if (!containerRef.current) return;
    
    if (sceneRef.current) {
      cancelAnimationFrame(sceneRef.current.animationId);
      if (sceneRef.current.renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(sceneRef.current.renderer.domElement);
      }
      sceneRef.current.renderer.dispose();
    }
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.z = 3;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none'; // hand all touch control to pointer events
    
    const geometry = new THREE.SphereGeometry(1, 256, 256);
    const dataTexture = createDataTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
    const material = createShaderMaterial(dataTexture, visibleLight);
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Coronal glow — larger sphere behind the Sun with radial fade shader
    const glowGeometry = new THREE.SphereGeometry(1.22, 64, 64);
    const glowMaterial = new THREE.ShaderMaterial({
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
        // Fresnel: bright at limb, transparent at centre
        '  float fresnel = 1.0 - abs(dot(vNormal, vViewDir));',
        '  fresnel = pow(fresnel, 2.8);',
        '  gl_FragColor = vec4(glowColor, fresnel * 0.55);',
        '}'
      ].join('\n'),
      transparent: true,
      side: THREE.BackSide,  // render inside-out so it shows behind the sphere
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowSphere);
    
    // Create field line group for coronal field lines
    const fieldLineGroup = new THREE.Group();
    scene.add(fieldLineGroup);
    
    // Create old field line group for transitions
    const oldFieldLineGroup = new THREE.Group();
    scene.add(oldFieldLineGroup);

    // Create polarity mesh wrapped in a group.
    // The mesh has a fixed -PI/2 X rotation to correct the UV coordinate
    // convention difference between our br_grid (theta=0 at north pole) and
    // Three.js SphereGeometry (V=0 at south, pole along Y axis).
    // The GROUP gets the same rotation as the sphere — so it tracks correctly.
    // The mesh inside never has its rotation changed after init.
    const polarityGeometry = new THREE.SphereGeometry(2.48, 60, 60);
    const polarityMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      side: THREE.FrontSide
    });
    const polarityMesh = new THREE.Mesh(polarityGeometry, polarityMaterial);
    const polarityGroup = new THREE.Group();
    polarityGroup.add(polarityMesh);
    polarityGroup.visible = false;
    scene.add(polarityGroup);
    
    // Create source surface sphere (initially hidden)
    const sourceSurfaceGeometry = new THREE.SphereGeometry(2.5, 64, 64);
    const sourceSurfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0x4444ff,
      transparent: true,
      opacity: 0.05,
      wireframe: true
    });
    const sourceSurface = new THREE.Mesh(sourceSurfaceGeometry, sourceSurfaceMaterial);
    sourceSurface.visible = false;
    scene.add(sourceSurface);
    
    // Create geographic pole axes
    const poleAxesGroup = createPoleAxes();
    poleAxesGroup.visible = showGeographicPoles;
    scene.add(poleAxesGroup);

    const graticuleGroup = createGraticule();
    graticuleGroup.visible = showGraticule;
    scene.add(graticuleGroup);

    const footpointGroup = new THREE.Group();
    footpointGroup.visible = showFootpoints;
    scene.add(footpointGroup);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Star field background — follows camera position so it acts as a skybox
    const stars = createStarField();
    scene.add(stars);
    
    // ── Camera state ─────────────────────────────────────────────────────────
    let cameraDistance = 3;
    let panX = 0;
    let panY = 0;

    const MIN_DISTANCE = 1.5;
    const MAX_DISTANCE = 500;

    const applyCamera = () => {
      camera.position.set(panX, panY, cameraDistance);
    };

    const resetPan = () => {
      panX = 0; panY = 0;
      applyCamera();
    };

    const handleZoom = (delta: number) => {
      cameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, cameraDistance + delta * 0.1));
      applyCamera();
      if (sceneRef.current) sceneRef.current.cameraDistance = cameraDistance;
    };

    // ── Raycaster ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const isOnSphere = (clientX: number, clientY: number): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObject(sphere).length > 0;
    };

    // ── Apply rotation to all scene objects ───────────────────────────────
    const applyRotation = () => {
      const rx = sphere.rotation.x;
      const ry = sphere.rotation.y;
      for (const obj of [fieldLineGroup, oldFieldLineGroup, sourceSurface,
                         polarityGroup, poleAxesGroup, graticuleGroup, footpointGroup, stars]) {
        obj.rotation.x = rx;
        obj.rotation.y = ry;
      }
    };

    // ── Pointer Events API ────────────────────────────────────────────────
    // One unified handler for mouse + touch. Each finger/cursor gets its own
    // entry in the pointers map keyed by pointerId — no finger-count race conditions.
    // 1 pointer  → rotate (left button) or pan (right button)
    // 2 pointers → pinch-zoom + pan simultaneously
    type PointerInfo = { x: number; y: number; button: number };
    const pointers = new Map<number, PointerInfo>();
    let lastPinchDist = 0;
    let lastPinchMid  = { x: 0, y: 0 };

    const getPinchState = () => {
      const [a, b] = [...pointers.values()];
      return {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement) !== renderer.domElement) return;
      renderer.domElement.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });

      if (pointers.size === 2) {
        const ps = getPinchState();
        lastPinchDist = ps.dist;
        lastPinchMid  = { x: ps.midX, y: ps.midY };
        if (sceneRef.current) sceneRef.current.isDragging = false;
      } else if (pointers.size === 1) {
        if (sceneRef.current) sceneRef.current.isDragging = e.button !== 2;
        if (e.button === 2) renderer.domElement.style.cursor = 'move';
        else if (isOnSphere(e.clientX, e.clientY)) renderer.domElement.style.cursor = 'grabbing';
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button });

      if (pointers.size === 2) {
        const ps = getPinchState();
        // Zoom from distance change
        handleZoom((lastPinchDist - ps.dist) * 0.15);
        // Pan from midpoint change
        const panSpeed = cameraDistance * 0.001;
        panX -= (ps.midX - lastPinchMid.x) * panSpeed;
        panY += (ps.midY - lastPinchMid.y) * panSpeed;
        applyCamera();
        lastPinchDist = ps.dist;
        lastPinchMid  = { x: ps.midX, y: ps.midY };
      } else if (pointers.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        if (prev.button === 2) {
          const panSpeed = cameraDistance * 0.001;
          panX -= dx * panSpeed;
          panY += dy * panSpeed;
          applyCamera();
        } else {
          sphere.rotation.y += dx * 0.01;
          sphere.rotation.x += dy * 0.01;
          applyRotation();
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 0) {
        if (sceneRef.current) sceneRef.current.isDragging = false;
        renderer.domElement.style.cursor = 'default';
      } else if (pointers.size === 1) {
        // One finger lifted — re-init so remaining finger doesn't jump
        const [rem] = [...pointers.values()];
        lastPinchDist = 0;
        lastPinchMid  = { x: rem.x, y: rem.y };
      }
    };

    const onPointerHover = (e: PointerEvent) => {
      if (pointers.size === 0) {
        renderer.domElement.style.cursor = isOnSphere(e.clientX, e.clientY) ? 'grab' : 'default';
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleZoom(e.deltaY * 0.01);
    };

    renderer.domElement.addEventListener('pointerdown',   onPointerDown);
    renderer.domElement.addEventListener('pointermove',   onPointerMove);
    renderer.domElement.addEventListener('pointermove',   onPointerHover);
    renderer.domElement.addEventListener('pointerup',     onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('contextmenu',   (e) => e.preventDefault());
    renderer.domElement.addEventListener('dblclick',      () => resetPan());
    renderer.domElement.addEventListener('wheel',         onWheel, { passive: false });

    
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      
      // Handle texture transition
      if (transitionRef.current?.isTransitioning && sphere.material instanceof THREE.ShaderMaterial) {
        const elapsed = Date.now() - transitionRef.current.startTime;
        const rawProgress = Math.min(elapsed / transitionRef.current.duration, 1);
        const progress = easeInOutCubic(rawProgress);
        
        sphere.material.uniforms.mixFactor.value = progress;
        
        if (rawProgress >= 1) {
          const newDataTexture = sphere.material.uniforms.newDataMap.value;
          const oldDataTexture = sphere.material.uniforms.oldDataMap.value;
          
          const newMaterial = createShaderMaterial(newDataTexture, visibleLightRef.current);
          
          sphere.material.dispose();
          sphere.material = newMaterial;
          
          if (oldDataTexture) {
            oldDataTexture.dispose();
          }
          
          transitionRef.current.isTransitioning = false;
          if (sceneRef.current) {
            sceneRef.current.pausedForTransition = false;
          }
        }
      }
      
      // Handle field line transition
      if (fieldLineTransitionRef.current?.isTransitioning && sceneRef.current) {
        const elapsed = Date.now() - fieldLineTransitionRef.current.startTime;
        const rawProgress = Math.min(elapsed / fieldLineTransitionRef.current.duration, 1);
        const progress = easeInOutCubic(rawProgress);
        
        // Fade out old field lines
        sceneRef.current.oldFieldLineGroup.traverse((obj) => {
          if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
            obj.material.opacity = 0.6 * (1 - progress);
          }
        });
        
        // Fade in new field lines
        sceneRef.current.fieldLineGroup.traverse((obj) => {
          if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
            obj.material.opacity = 0.6 * progress;
          }
        });
        
        if (rawProgress >= 1) {
          // Clean up old field lines
          while (sceneRef.current.oldFieldLineGroup.children.length > 0) {
            const child = sceneRef.current.oldFieldLineGroup.children[0];
            if (child instanceof THREE.Line) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
            sceneRef.current.oldFieldLineGroup.remove(child);
          }
          
          fieldLineTransitionRef.current.isTransitioning = false;
        }
      }
      
      const shouldRotate = pointers.size === 0 && 
                          isRotatingRef.current && 
                          !(sceneRef.current?.pausedForTransition);
      
      if (shouldRotate) {
        sphere.rotation.y += 0.0005;
        applyRotation();
      }
      
      renderer.render(scene, camera);
      
      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
    };
    
    animate();
    
    sceneRef.current = { 
      scene, 
      camera, 
      renderer, 
      sphere, 
      fieldLineGroup,
      oldFieldLineGroup,
      sourceSurface,
      polarityMesh,
      polarityGroup,
      poleAxesGroup,
      graticuleGroup,
      footpointGroup,
      animationId: 0, 
      isDragging: false,
      pausedForTransition: false,
      cameraDistance: cameraDistance
    };
    
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown',   onPointerDown);
      renderer.domElement.removeEventListener('pointermove',   onPointerMove);
      renderer.domElement.removeEventListener('pointermove',   onPointerHover);
      renderer.domElement.removeEventListener('pointerup',     onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel',         onWheel);
    };
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (fitsData && !show2DMap && !sceneRef.current) {
      initThreeJS(fitsData);
      currentFitsDataRef.current = fitsData;
    } else if (!fitsData || show2DMap) {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        if (sceneRef.current.renderer.domElement.parentNode === containerRef.current) {
          containerRef.current?.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current.renderer.dispose();
        sceneRef.current = null;
      }
    }
    
    return () => {
      if (show2DMap && sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        if (sceneRef.current.renderer.domElement.parentNode === containerRef.current) {
          containerRef.current?.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current.renderer.dispose();
        sceneRef.current = null;
      }
    };
  }, [show2DMap]);

  // Handle FITS data changes
  useEffect(() => {
    if (sceneRef.current && fitsData && !show2DMap && currentFitsDataRef.current !== fitsData) {
      sceneRef.current.pausedForTransition = true;
      
      const currentMaterial = sceneRef.current.sphere.material;
      let oldDataTexture: THREE.DataTexture | null = null;
      
      if (currentMaterial instanceof THREE.ShaderMaterial) {
        oldDataTexture = currentMaterial.uniforms.dataMap?.value || null;
      }
      
      const newDataTexture = createDataTexture(
        fitsData, 
        useFixedScale, 
        parseFloat(fixedMin), 
        parseFloat(fixedMax)
      );
      
      if (oldDataTexture) {
        const transitionMaterial = createTransitionShaderMaterial(oldDataTexture, newDataTexture, visibleLight);
        
        if (currentMaterial instanceof THREE.Material) {
          currentMaterial.dispose();
        }
        sceneRef.current.sphere.material = transitionMaterial;
        
        transitionRef.current = {
          isTransitioning: true,
          startTime: Date.now(),
          duration: 800
        };
      } else {
        const material = createShaderMaterial(newDataTexture, visibleLight);
        sceneRef.current.sphere.material = material;
      }
      
      currentFitsDataRef.current = fitsData;
    }
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  // Handle scale changes
  useEffect(() => {
    if (sceneRef.current && fitsData && !show2DMap && currentFitsDataRef.current === fitsData) {
      sceneRef.current.pausedForTransition = true;
      
      const currentMaterial = sceneRef.current.sphere.material;
      let oldDataTexture: THREE.DataTexture | null = null;
      
      if (currentMaterial instanceof THREE.ShaderMaterial) {
        oldDataTexture = currentMaterial.uniforms.dataMap?.value || null;
      }
      
      const newDataTexture = createDataTexture(
        fitsData, 
        useFixedScale, 
        parseFloat(fixedMin), 
        parseFloat(fixedMax)
      );
      
      if (oldDataTexture) {
        const transitionMaterial = createTransitionShaderMaterial(oldDataTexture, newDataTexture, visibleLight);
        
        if (currentMaterial instanceof THREE.Material) {
          currentMaterial.dispose();
        }
        sceneRef.current.sphere.material = transitionMaterial;
        
        transitionRef.current = {
          isTransitioning: true,
          startTime: Date.now(),
          duration: 800
        };
      } else {
        const material = createShaderMaterial(newDataTexture, visibleLight);
        sceneRef.current.sphere.material = material;
      }
    }
  }, [useFixedScale, fixedMin, fixedMax]);

  // Handle coronal field lines updates with transitions
  useEffect(() => {
    if (!sceneRef.current || !coronalData) return;

    const { fieldLineGroup, oldFieldLineGroup, sourceSurface } = sceneRef.current;

    // Move current field lines to old group if they exist
    const hasExistingLines = fieldLineGroup.children.length > 0;
    if (hasExistingLines && currentCoronalDataRef.current !== coronalData) {
      // Clear old group first
      while (oldFieldLineGroup.children.length > 0) {
        const child = oldFieldLineGroup.children[0];
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        oldFieldLineGroup.remove(child);
      }
      
      // Move current lines to old group
      while (fieldLineGroup.children.length > 0) {
        const child = fieldLineGroup.children[0];
        fieldLineGroup.remove(child);
        oldFieldLineGroup.add(child);
      }
      
      // Start transition
      fieldLineTransitionRef.current = {
        isTransitioning: true,
        startTime: Date.now(),
        duration: 800
      };
    } else {
      // Clear existing field lines (initial load case)
      while (fieldLineGroup.children.length > 0) {
        const child = fieldLineGroup.children[0];
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        fieldLineGroup.remove(child);
      }
    }

    // Update source surface radius
    sourceSurface.geometry.dispose();
    sourceSurface.geometry = new THREE.SphereGeometry(coronalData.metadata.r_source, 64, 64);

    // Use user-supplied max strength for colour normalisation.
    // t = strength / globalMaxStrength, clamped to [0, 1].
    // Values above the ceiling clip to full brightness.
    const globalMaxStrength = fieldLineMaxStrength > 0 ? fieldLineMaxStrength : 500;

    // Add new field lines with per-vertex colour gradient based on field strength
    coronalData.fieldLines.forEach((fieldLine) => {
      if (fieldLine.points.length < 2) return;

      const isOpen = fieldLine.polarity === 'open';
      const pts = fieldLine.points;
      const strengths = fieldLine.strengths;

      // Build flat position and colour arrays for BufferGeometry
      const positions = new Float32Array(pts.length * 3);
      const colors    = new Float32Array(pts.length * 3);

      pts.forEach(([x, y, z], i) => {
        positions[i * 3]     = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // strength at vertex i — strengths array is 1 shorter than points
        // (first point has no incoming step), so clamp index
        const raw = strengths[Math.min(i, strengths.length - 1)] ?? 0;
        const t   = Math.min(raw / globalMaxStrength, 1.0); // 0 = weak, 1 = strong

        if (isOpen) {
          // Open lines: dim green (weak) → bright yellow-green (strong)
          colors[i * 3]     = t * 0.5;           // R: zero at weak, warm yellow tint at strong
          colors[i * 3 + 1] = 0.4 + t * 0.6;    // G: always dominant, full brightness at strong
          colors[i * 3 + 2] = 0.0;               // B: zero — keeps it firmly in green family
        } else {
          // Closed lines: deep red (weak) → bright orange-yellow (strong)
          colors[i * 3]     = 0.5 + t * 0.5;    // R: always red, saturates to full
          colors[i * 3 + 1] = t * 0.65;          // G: 0 at weak, orange-yellow at strong
          colors[i * 3 + 2] = t * 0.05;          // B: near zero, tiny warm highlight
        }
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: hasExistingLines ? 0 : 0.75,
        linewidth: 1
      });

      const line = new THREE.Line(geometry, material);
      line.userData = {
        polarity: fieldLine.polarity,
        apexR: fieldLine.apexR ?? 2.5,
        fieldLineData: fieldLine
      };
      line.visible = showCoronalLines && (isOpen ? showOpenLines : showClosedLines);

      // Match rotation with sphere
      line.rotation.y = sceneRef.current!.sphere.rotation.y;
      line.rotation.x = sceneRef.current!.sphere.rotation.x;

      fieldLineGroup.add(line);
    });

    // Build polarity texture from polarityGrid
    const { polarityMesh } = sceneRef.current;
    if (coronalData.polarityGrid && coronalData.polarityGrid.data.length > 0) {
      const { data, n_theta, n_phi } = coronalData.polarityGrid;
      const maxVal = Math.max(...data.map(Math.abs)) || 1;

      // by 3D position in Z-up spherical coords — bypasses UV mapping entirely.
      // The shader computes theta/phi from the vertex position directly,
      // so there's no coordinate system mismatch to worry about.
      const brFloat = new Float32Array(data);
      const brTexture = new THREE.DataTexture(
        brFloat, n_phi, n_theta, THREE.RedFormat, THREE.FloatType
      );
      brTexture.minFilter = THREE.LinearFilter;
      brTexture.magFilter = THREE.LinearFilter;
      brTexture.flipY = true;
      brTexture.needsUpdate = true;

      const polarityShader = new THREE.ShaderMaterial({
        uniforms: {
          brMap:       { value: brTexture },
          maxStrength: { value: maxVal }
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
        side: THREE.FrontSide
      });

      if (polarityMesh.material) {
        (polarityMesh.material as THREE.Material).dispose();
      }
      polarityMesh.material = polarityShader;

      sceneRef.current.polarityGroup.rotation.y = sceneRef.current.sphere.rotation.y;
      sceneRef.current.polarityGroup.rotation.x = sceneRef.current.sphere.rotation.x;
      sceneRef.current.polarityGroup.visible = showPolarity;

      // Swap wireframe / polarity visibility
      sceneRef.current.sourceSurface.visible = showCoronalLines && showSourceSurface && !showPolarity;
    }

    // Build footpoint markers on photosphere
    const { footpointGroup } = sceneRef.current;
    while (footpointGroup.children.length > 0) {
      const child = footpointGroup.children[0];
      if (child instanceof THREE.Points) child.geometry.dispose();
      footpointGroup.remove(child);
    }

    const fpPositions: number[] = [];
    coronalData.fieldLines.forEach((fl) => {
      if (!fl.footpoints || fl.footpoints.length < 2) return;
      fl.footpoints.forEach(([theta, phi]: [number, number]) => {
        // Z-up spherical to Cartesian at r=1.01 (just above surface)
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
        opacity: 0.7
      });
      footpointGroup.add(new THREE.Points(fpGeometry, fpMaterial));
      footpointGroup.rotation.y = sceneRef.current.sphere.rotation.y;
      footpointGroup.rotation.x = sceneRef.current.sphere.rotation.x;
      footpointGroup.visible = showFootpoints;
    }

    // Reset pan when a new CR is loaded
    if (sceneRef.current) {
      sceneRef.current.camera.position.x = 0;
      sceneRef.current.camera.position.y = 0;
    }

    currentCoronalDataRef.current = coronalData;

  }, [coronalData]);

  // Handle visible light toggle — rebuild sphere material with current texture
  useEffect(() => {
    if (!sceneRef.current || !fitsData || show2DMap) return;
    const sphere = sceneRef.current.sphere;
    const currentMaterial = sphere.material;
    // Extract the current data texture so we don't need to rebuild it
    let dataTexture: THREE.DataTexture | null = null;
    if (currentMaterial instanceof THREE.ShaderMaterial) {
      dataTexture = currentMaterial.uniforms.dataMap?.value
        || currentMaterial.uniforms.newDataMap?.value
        || null;
    }
    if (!dataTexture) {
      dataTexture = createDataTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
    }
    const newMaterial = createShaderMaterial(dataTexture, visibleLight);
    if (currentMaterial instanceof THREE.Material) currentMaterial.dispose();
    sphere.material = newMaterial;
  }, [visibleLight]);

  // Handle field line colour scale changes — update vertex colours in place
  // without rebuilding geometry or triggering transitions
  useEffect(() => {
    if (!sceneRef.current || !coronalData) return;

    const globalMaxStrength = fieldLineMaxStrength > 0 ? fieldLineMaxStrength : 500;

    sceneRef.current.fieldLineGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Line)) return;
      const fieldLine = obj.userData.fieldLineData;
      if (!fieldLine) return;

      const isOpen = fieldLine.polarity === 'open';
      const pts = fieldLine.points as [number, number, number][];
      const strengths = fieldLine.strengths as number[];
      const colorAttr = obj.geometry.getAttribute('color') as THREE.BufferAttribute;
      if (!colorAttr) return;

      pts.forEach((_pt, i) => {
        const raw = strengths[Math.min(i, strengths.length - 1)] ?? 0;
        const t   = Math.min(raw / globalMaxStrength, 1.0);

        if (isOpen) {
          colorAttr.setXYZ(i, t * 0.5, 0.4 + t * 0.6, 0.0);
        } else {
          colorAttr.setXYZ(i, 0.5 + t * 0.5, t * 0.65, t * 0.05);
        }
      });

      colorAttr.needsUpdate = true;
    });
  }, [fieldLineMaxStrength]);


  // Handle field line visibility changes
  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.fieldLineGroup.traverse((obj) => {
      if (obj instanceof THREE.Line && obj.userData.polarity) {
        if (obj.userData.polarity === 'open') {
          obj.visible = showCoronalLines && showOpenLines;
        } else if (obj.userData.polarity === 'closed') {
          obj.visible = showCoronalLines && showClosedLines;
        }
      }
    });
  }, [showCoronalLines, showOpenLines, showClosedLines]);

  // Handle source surface visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.sourceSurface.visible = showCoronalLines && showSourceSurface;
  }, [showCoronalLines, showSourceSurface]);

  // Handle geographic pole axes visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.poleAxesGroup.visible = showGeographicPoles;
  }, [showGeographicPoles]);

  // Handle graticule visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.graticuleGroup.visible = showGraticule;
  }, [showGraticule]);

  // Handle apex height filter
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.fieldLineGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Line) || !obj.userData.polarity) return;
      const apex = obj.userData.apexR ?? 2.5;
      const withinRange = apex >= apexMinR && apex <= apexMaxR;
      const polarityVisible = obj.userData.polarity === 'open' ? showOpenLines : showClosedLines;
      obj.visible = showCoronalLines && polarityVisible && withinRange;
    });
  }, [apexMinR, apexMaxR, showCoronalLines, showOpenLines, showClosedLines]);

  // Handle footpoint visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.footpointGroup.visible = showFootpoints;
  }, [showFootpoints]);

  // Handle polarity surface visibility — swaps with wireframe
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.polarityGroup.visible = showPolarity;
    sceneRef.current.sourceSurface.visible = showCoronalLines && showSourceSurface && !showPolarity;
  }, [showPolarity, showSourceSurface, showCoronalLines]);
};