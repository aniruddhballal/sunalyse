import * as THREE from 'three';
import type { ThreeSceneRef, TransitionRef, FieldLineTransitionRef } from './sceneTypes';
import { easeInOutCubic } from './sceneObjects';
import { createShaderMaterial } from '../../utils/textureCreation';

export interface AnimateParams {
  sceneRef: React.MutableRefObject<ThreeSceneRef | null>;
  transitionRef: React.MutableRefObject<TransitionRef | null>;
  fieldLineTransitionRef: React.MutableRefObject<FieldLineTransitionRef | null>;
  isRotatingRef: React.MutableRefObject<boolean>;
  visibleLightRef: React.MutableRefObject<boolean>;
  sphere: THREE.Mesh;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  applyRotation: () => void;
  getPointerCount: () => number;
}

export function startAnimationLoop(params: AnimateParams): () => void {
  const {
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
    getPointerCount,
  } = params;

  const animate = () => {
    const animationId = requestAnimationFrame(animate);

    // ── Texture transition tick ──────────────────────────────────────────────
    if (transitionRef.current?.isTransitioning && sphere.material instanceof THREE.ShaderMaterial) {
      const elapsed     = Date.now() - transitionRef.current.startTime;
      const rawProgress = Math.min(elapsed / transitionRef.current.duration, 1);
      const progress    = easeInOutCubic(rawProgress);

      // Guard: if mixFactor is missing the material is not a transition material —
      // abort the transition cleanly rather than crashing every frame.
      if (!sphere.material.uniforms.mixFactor) {
        transitionRef.current.isTransitioning = false;
        if (sceneRef.current) sceneRef.current.pausedForTransition = false;
      } else {
        sphere.material.uniforms.mixFactor.value = progress;

        if (rawProgress >= 1) {
          const newDataTexture = sphere.material.uniforms.newDataMap?.value;
          const oldDataTexture = sphere.material.uniforms.oldDataMap?.value;

          const newMaterial = createShaderMaterial(newDataTexture, visibleLightRef.current);
          sphere.material.dispose();
          sphere.material = newMaterial;
          if (oldDataTexture) oldDataTexture.dispose();

          transitionRef.current.isTransitioning = false;
          if (sceneRef.current) sceneRef.current.pausedForTransition = false;
        }
      }
    }

    // ── Field line fade transition tick ─────────────────────────────────────
    if (fieldLineTransitionRef.current?.isTransitioning && sceneRef.current) {
      const elapsed     = Date.now() - fieldLineTransitionRef.current.startTime;
      const rawProgress = Math.min(elapsed / fieldLineTransitionRef.current.duration, 1);
      const progress    = easeInOutCubic(rawProgress);

      sceneRef.current.oldFieldLineGroup.traverse((obj) => {
        if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
          obj.material.opacity = 0.6 * (1 - progress);
        }
      });

      sceneRef.current.fieldLineGroup.traverse((obj) => {
        if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
          obj.material.opacity = 0.6 * progress;
        }
      });

      if (rawProgress >= 1) {
        const old = sceneRef.current.oldFieldLineGroup;
        while (old.children.length > 0) {
          const child = old.children[0];
          if (child instanceof THREE.Line) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
          old.remove(child);
        }
        fieldLineTransitionRef.current.isTransitioning = false;
      }
    }

    // ── Auto-rotation ────────────────────────────────────────────────────────
    const shouldRotate =
      getPointerCount() === 0 &&
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

  // Returns a cancel function
  return () => {
    if (sceneRef.current) cancelAnimationFrame(sceneRef.current.animationId);
  };
}