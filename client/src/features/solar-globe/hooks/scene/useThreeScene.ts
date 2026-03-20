import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { FITSData } from '../../fits/types';
import type { CoronalData } from '../data/useCoronalFieldLines';
import type { ThreeSceneRef, TransitionRef, FieldLineTransitionRef } from './sceneTypes';
import { initThreeScene } from './sceneInit';
import { buildFieldLines, buildPolarityMesh, buildFootpoints } from './sceneFieldLines.ts';
import { createDataTexture, createShaderMaterial, createTransitionShaderMaterial } from '../../utils/textureCreation';

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
  const sceneRef               = useRef<ThreeSceneRef | null>(null);
  const currentFitsDataRef     = useRef<FITSData | null>(null);
  const transitionRef          = useRef<TransitionRef | null>(null);
  const fieldLineTransitionRef = useRef<FieldLineTransitionRef | null>(null);
  const isRotatingRef          = useRef(isRotating);
  const visibleLightRef        = useRef(visibleLight);
  const currentCoronalDataRef  = useRef<CoronalData | null>(null);

  useEffect(() => { isRotatingRef.current   = isRotating;   }, [isRotating]);
  useEffect(() => { visibleLightRef.current = visibleLight; }, [visibleLight]);

  // ── Scene init / teardown ────────────────────────────────────────────────
  useEffect(() => {
    if (fitsData && !show2DMap && !sceneRef.current) {
      initThreeScene({
        containerRef, fitsData, useFixedScale, fixedMin, fixedMax,
        visibleLight, showGeographicPoles, showGraticule, showFootpoints,
        sceneRef, transitionRef, fieldLineTransitionRef,
        isRotatingRef, visibleLightRef,
      });
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

  // ── FITS data change → texture transition ────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !fitsData || show2DMap || currentFitsDataRef.current === fitsData) return;
    sceneRef.current.pausedForTransition = true;
    applyTextureTransition();
    currentFitsDataRef.current = fitsData;
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  // ── Scale change → texture transition ───────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !fitsData || show2DMap || currentFitsDataRef.current !== fitsData) return;
    sceneRef.current.pausedForTransition = true;
    applyTextureTransition();
  }, [useFixedScale, fixedMin, fixedMax]);

  function applyTextureTransition() {
    if (!sceneRef.current || !fitsData) return;
    const currentMaterial = sceneRef.current.sphere.material;
    let oldDataTexture: THREE.DataTexture | null = null;
    if (currentMaterial instanceof THREE.ShaderMaterial) {
      oldDataTexture = currentMaterial.uniforms.dataMap?.value || null;
    }
    const newDataTexture = createDataTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
    if (oldDataTexture) {
      const transitionMaterial = createTransitionShaderMaterial(oldDataTexture, newDataTexture, visibleLight);
      if (currentMaterial instanceof THREE.Material) currentMaterial.dispose();
      sceneRef.current.sphere.material = transitionMaterial;
      transitionRef.current = { isTransitioning: true, startTime: Date.now(), duration: 800 };
    } else {
      sceneRef.current.sphere.material = createShaderMaterial(newDataTexture, visibleLight);
    }
  }

  // ── Visible light toggle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !fitsData || show2DMap) return;
    const sphere          = sceneRef.current.sphere;
    const currentMaterial = sphere.material;
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

  // ── Coronal data → rebuild field lines, polarity, footpoints ────────────
  useEffect(() => {
    if (!sceneRef.current || !coronalData) return;
    buildFieldLines({
      coronalData, sceneRef, fieldLineMaxStrength,
      showCoronalLines, showOpenLines, showClosedLines,
      currentCoronalDataRef, fieldLineTransitionRef,
    });
    buildPolarityMesh({ coronalData, sceneRef, showCoronalLines, showSourceSurface, showPolarity });
    buildFootpoints({ coronalData, sceneRef, showFootpoints });
    // Reset pan when a new CR is loaded
    if (sceneRef.current) {
      sceneRef.current.camera.position.x = 0;
      sceneRef.current.camera.position.y = 0;
    }
    currentCoronalDataRef.current = coronalData;
  }, [coronalData]);

  // ── Field line colour scale ──────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !coronalData) return;
    const globalMaxStrength = fieldLineMaxStrength > 0 ? fieldLineMaxStrength : 500;
    sceneRef.current.fieldLineGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Line)) return;
      const fieldLine  = obj.userData.fieldLineData;
      if (!fieldLine) return;
      const isOpen     = fieldLine.polarity === 'open';
      const pts        = fieldLine.points as [number, number, number][];
      const strengths  = fieldLine.strengths as number[];
      const colorAttr  = obj.geometry.getAttribute('color') as THREE.BufferAttribute;
      if (!colorAttr) return;
      pts.forEach((_pt, i) => {
        const raw = strengths[Math.min(i, strengths.length - 1)] ?? 0;
        const t   = Math.min(raw / globalMaxStrength, 1.0);
        if (isOpen) colorAttr.setXYZ(i, t * 0.5, 0.4 + t * 0.6, 0.0);
        else        colorAttr.setXYZ(i, 0.5 + t * 0.5, t * 0.65, t * 0.05);
      });
      colorAttr.needsUpdate = true;
    });
  }, [fieldLineMaxStrength]);

  // ── Visibility toggles ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.fieldLineGroup.traverse((obj) => {
      if (obj instanceof THREE.Line && obj.userData.polarity) {
        obj.visible = showCoronalLines && (
          obj.userData.polarity === 'open' ? showOpenLines : showClosedLines
        );
      }
    });
  }, [showCoronalLines, showOpenLines, showClosedLines]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.sourceSurface.visible = showCoronalLines && showSourceSurface;
  }, [showCoronalLines, showSourceSurface]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.poleAxesGroup.visible = showGeographicPoles;
  }, [showGeographicPoles]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.graticuleGroup.visible = showGraticule;
  }, [showGraticule]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.fieldLineGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Line) || !obj.userData.polarity) return;
      const apex           = obj.userData.apexR ?? 2.5;
      const withinRange    = apex >= apexMinR && apex <= apexMaxR;
      const polarityVisible = obj.userData.polarity === 'open' ? showOpenLines : showClosedLines;
      obj.visible = showCoronalLines && polarityVisible && withinRange;
    });
  }, [apexMinR, apexMaxR, showCoronalLines, showOpenLines, showClosedLines]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.footpointGroup.visible = showFootpoints;
  }, [showFootpoints]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.polarityGroup.visible  = showPolarity;
    sceneRef.current.sourceSurface.visible  = showCoronalLines && showSourceSurface && !showPolarity;
  }, [showPolarity, showSourceSurface, showCoronalLines]);
};