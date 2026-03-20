import * as THREE from 'three';
import type { ThreeSceneRef } from './sceneTypes';

type PointerInfo = { x: number; y: number; button: number };

export interface CameraState {
  distance: number;
  panX: number;
  panY: number;
}

export interface SceneControlsParams {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  sphere: THREE.Mesh;
  sceneRef: React.MutableRefObject<ThreeSceneRef | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  applyRotation: () => void;
}

export function attachSceneControls({
  renderer,
  camera,
  sphere,
  sceneRef,
  containerRef,
  applyRotation,
}: SceneControlsParams): () => void {
  const MIN_DISTANCE = 1.5;
  const MAX_DISTANCE = 500;

  let cameraDistance = 3;
  let panX = 0;
  let panY = 0;

  const applyCamera = () => {
    camera.position.set(panX, panY, cameraDistance);
  };

  const resetPan = () => {
    panX = 0;
    panY = 0;
    applyCamera();
  };

  const handleZoom = (delta: number) => {
    cameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, cameraDistance + delta * 0.1));
    applyCamera();
    if (sceneRef.current) sceneRef.current.cameraDistance = cameraDistance;
  };

  // Raycaster for sphere hit-test (cursor grab feedback)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const isOnSphere = (clientX: number, clientY: number): boolean => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObject(sphere).length > 0;
  };

  // Unified pointer map — handles mouse + touch with no finger-count races
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
      handleZoom((lastPinchDist - ps.dist) * 0.15);
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

  const handleResize = () => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  renderer.domElement.addEventListener('pointerdown',   onPointerDown);
  renderer.domElement.addEventListener('pointermove',   onPointerMove);
  renderer.domElement.addEventListener('pointermove',   onPointerHover);
  renderer.domElement.addEventListener('pointerup',     onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('contextmenu',   (e) => e.preventDefault());
  renderer.domElement.addEventListener('dblclick',      () => resetPan());
  renderer.domElement.addEventListener('wheel',         onWheel, { passive: false });
  window.addEventListener('resize', handleResize);

  // Returns a cleanup function for useEffect
  return () => {
    renderer.domElement.removeEventListener('pointerdown',   onPointerDown);
    renderer.domElement.removeEventListener('pointermove',   onPointerMove);
    renderer.domElement.removeEventListener('pointermove',   onPointerHover);
    renderer.domElement.removeEventListener('pointerup',     onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerUp);
    renderer.domElement.removeEventListener('wheel',         onWheel);
    window.removeEventListener('resize', handleResize);
  };
}

// Exposed so the animation loop can read pointer count without importing the map
export function getPointerCount(pointers: Map<number, PointerInfo>): number {
  return pointers.size;
}