import * as THREE from 'three';
import type { FITSData } from '../../fits/types';
import type { ThreeSceneRef, TransitionRef, FieldLineTransitionRef } from './sceneTypes';
import {
  createStarField,
  createGraticule,
  createPoleAxes,
  createGlowSphere,
} from './sceneObjects';
import { attachSceneControls } from './sceneControls';
import { startAnimationLoop } from './sceneAnimationLoop';
import { createDataTexture, createShaderMaterial } from '../../utils/textureCreation';

export interface SceneInitParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  fitsData: FITSData;
  useFixedScale: boolean;
  fixedMin: string;
  fixedMax: string;
  visibleLight: boolean;
  showGeographicPoles: boolean;
  showGraticule: boolean;
  showFootpoints: boolean;
  sceneRef: React.MutableRefObject<ThreeSceneRef | null>;
  transitionRef: React.MutableRefObject<TransitionRef | null>;
  fieldLineTransitionRef: React.MutableRefObject<FieldLineTransitionRef | null>;
  isRotatingRef: React.MutableRefObject<boolean>;
  visibleLightRef: React.MutableRefObject<boolean>;
}

export function initThreeScene(params: SceneInitParams): (() => void) | undefined {
  const {
    containerRef,
    fitsData,
    useFixedScale,
    fixedMin,
    fixedMax,
    visibleLight,
    showGeographicPoles,
    showGraticule,
    showFootpoints,
    sceneRef,
    transitionRef,
    fieldLineTransitionRef,
    isRotatingRef,
    visibleLightRef,
  } = params;

  if (!containerRef.current) return;

  // Tear down any existing scene first
  if (sceneRef.current) {
    cancelAnimationFrame(sceneRef.current.animationId);
    if (sceneRef.current.renderer.domElement.parentNode === containerRef.current) {
      containerRef.current.removeChild(sceneRef.current.renderer.domElement);
    }
    sceneRef.current.renderer.dispose();
  }

  const width  = containerRef.current.clientWidth;
  const height = containerRef.current.clientHeight;

  // ── Core Three.js objects ─────────────────────────────────────────────────
  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
  camera.position.z = 3;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.domElement.style.touchAction = 'none';
  containerRef.current.appendChild(renderer.domElement);

  // ── Solar sphere ─────────────────────────────────────────────────────────
  const geometry    = new THREE.SphereGeometry(1, 256, 256);
  const dataTexture = createDataTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
  const material    = createShaderMaterial(dataTexture, visibleLight);
  const sphere      = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // ── Decorative objects ────────────────────────────────────────────────────
  scene.add(createGlowSphere());
  scene.add(createStarField());

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 0.5);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  // ── Coronal overlay groups ────────────────────────────────────────────────
  const fieldLineGroup    = new THREE.Group();
  const oldFieldLineGroup = new THREE.Group();
  scene.add(fieldLineGroup);
  scene.add(oldFieldLineGroup);

  const polarityGeometry = new THREE.SphereGeometry(2.48, 60, 60);
  const polarityMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, side: THREE.FrontSide });
  const polarityMesh     = new THREE.Mesh(polarityGeometry, polarityMaterial);
  const polarityGroup    = new THREE.Group();
  polarityGroup.add(polarityMesh);
  polarityGroup.visible = false;
  scene.add(polarityGroup);

  const sourceSurface = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.05, wireframe: true })
  );
  sourceSurface.visible = false;
  scene.add(sourceSurface);

  // ── Navigation overlays ───────────────────────────────────────────────────
  const poleAxesGroup = createPoleAxes();
  poleAxesGroup.visible = showGeographicPoles;
  scene.add(poleAxesGroup);

  const graticuleGroup = createGraticule();
  graticuleGroup.visible = showGraticule;
  scene.add(graticuleGroup);

  const footpointGroup = new THREE.Group();
  footpointGroup.visible = showFootpoints;
  scene.add(footpointGroup);

  // ── Rotation sync helper ──────────────────────────────────────────────────
  const applyRotation = () => {
    const rx = sphere.rotation.x;
    const ry = sphere.rotation.y;
    for (const obj of [
      fieldLineGroup, oldFieldLineGroup, sourceSurface,
      polarityGroup, poleAxesGroup, graticuleGroup, footpointGroup,
    ]) {
      obj.rotation.x = rx;
      obj.rotation.y = ry;
    }
  };

  // ── Controls + animation loop ─────────────────────────────────────────────
  let pointerCount = 0;

  const detachControls = attachSceneControls({
    renderer,
    camera,
    sphere,
    sceneRef,
    containerRef,
    applyRotation,
  });

  startAnimationLoop({
    sceneRef,
    transitionRef,
    fieldLineTransitionRef,
    isRotatingRef,
    visibleLightRef,
    sphere,
    scene,
    camera,
    renderer,
    applyRotation,
    getPointerCount: () => pointerCount,
  });

  // ── Commit to ref ─────────────────────────────────────────────────────────
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
    cameraDistance: 3,
  };

  return detachControls;
}