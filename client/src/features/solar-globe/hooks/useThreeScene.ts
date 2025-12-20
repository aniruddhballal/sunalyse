import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { FITSData } from '../fits/types';
import type { CoronalData } from './useCoronalFieldLines';
import { createDataTexture, createShaderMaterial, createTransitionShaderMaterial } from '../utils/textureCreation';

interface ThreeSceneRef {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sphere: THREE.Mesh;
  fieldLineGroup: THREE.Group;
  oldFieldLineGroup: THREE.Group;
  sourceSurface: THREE.Mesh;
  animationId: number;
  isDragging: boolean;
  pausedForTransition: boolean;
  cameraDistance: number; // Track current zoom level
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
  showSourceSurface: boolean
) => {
  const sceneRef = useRef<ThreeSceneRef | null>(null);
  const currentFitsDataRef = useRef<FITSData | null>(null);
  const transitionRef = useRef<TransitionRef | null>(null);
  const fieldLineTransitionRef = useRef<FieldLineTransitionRef | null>(null);
  const isRotatingRef = useRef(isRotating);
  const currentCoronalDataRef = useRef<CoronalData | null>(null);

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

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
    
    const geometry = new THREE.SphereGeometry(1, 256, 256);
    const dataTexture = createDataTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
    const material = createShaderMaterial(dataTexture);
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
    // Create field line group for coronal field lines
    const fieldLineGroup = new THREE.Group();
    scene.add(fieldLineGroup);
    
    // Create old field line group for transitions
    const oldFieldLineGroup = new THREE.Group();
    scene.add(oldFieldLineGroup);
    
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
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraDistance = 3; // Initial camera distance
    
    const MIN_DISTANCE = 1.5; // Minimum zoom (closest)
    const MAX_DISTANCE = 500; // Maximum zoom (farthest) - allows sun to become a tiny dot
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const isClickOnSphere = (clientX: number, clientY: number): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(sphere);
      return intersects.length > 0;
    };
    
    const updateCursor = (clientX: number, clientY: number) => {
      if (isClickOnSphere(clientX, clientY)) {
        renderer.domElement.style.cursor = 'grab';
      } else {
        renderer.domElement.style.cursor = 'default';
      }
    };
    
    // Zoom function
    const handleZoom = (delta: number) => {
      const zoomSpeed = 0.1;
      cameraDistance += delta * zoomSpeed;
      cameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, cameraDistance));
      
      // Update camera position
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const position = direction.multiplyScalar(-cameraDistance);
      camera.position.copy(position);
      
      if (sceneRef.current) {
        sceneRef.current.cameraDistance = cameraDistance;
      }
    };
    
    // Mouse wheel zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleZoom(e.deltaY * 0.01);
    };
    
    // Touch pinch zoom
    let lastTouchDistance = 0;
    
    const getTouchDistance = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    const onMouseDown = (e: MouseEvent) => {
      if (isClickOnSphere(e.clientX, e.clientY)) {
        isDragging = true;
        if (sceneRef.current) {
          sceneRef.current.isDragging = true;
        }
        previousMousePosition = { x: e.clientX, y: e.clientY };
        renderer.domElement.style.cursor = 'grabbing';
      }
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        updateCursor(e.clientX, e.clientY);
        return;
      }
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      sphere.rotation.y += deltaX * 0.01;
      sphere.rotation.x += deltaY * 0.01;
      
      // Rotate field lines and source surface with the sphere
      fieldLineGroup.rotation.y = sphere.rotation.y;
      fieldLineGroup.rotation.x = sphere.rotation.x;
      oldFieldLineGroup.rotation.y = sphere.rotation.y;
      oldFieldLineGroup.rotation.x = sphere.rotation.x;
      sourceSurface.rotation.y = sphere.rotation.y;
      sourceSurface.rotation.x = sphere.rotation.x;
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
      if (sceneRef.current) {
        sceneRef.current.isDragging = false;
      }
      renderer.domElement.style.cursor = 'default';
    };
    
    let touchStartedOnCanvas = false;
    
    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target !== renderer.domElement) {
        touchStartedOnCanvas = false;
        return;
      }
      
      if (e.touches.length === 2) {
        // Pinch zoom
        touchStartedOnCanvas = true;
        lastTouchDistance = getTouchDistance(e.touches);
      } else if (e.touches.length === 1) {
        if (isClickOnSphere(e.touches[0].clientX, e.touches[0].clientY)) {
          touchStartedOnCanvas = true;
          isDragging = true;
          if (sceneRef.current) {
            sceneRef.current.isDragging = true;
          }
          previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }
    };
    
    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartedOnCanvas) return;
      
      if (e.touches.length === 2) {
        // Pinch zoom
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const delta = lastTouchDistance - currentDistance;
        handleZoom(delta * 0.1);
        lastTouchDistance = currentDistance;
      } else if (isDragging && e.touches.length === 1) {
        // Rotation
        e.preventDefault();
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        
        sphere.rotation.y += deltaX * 0.01;
        sphere.rotation.x += deltaY * 0.01;
        
        // Rotate field lines and source surface with the sphere
        fieldLineGroup.rotation.y = sphere.rotation.y;
        fieldLineGroup.rotation.x = sphere.rotation.x;
        oldFieldLineGroup.rotation.y = sphere.rotation.y;
        oldFieldLineGroup.rotation.x = sphere.rotation.x;
        sourceSurface.rotation.y = sphere.rotation.y;
        sourceSurface.rotation.x = sphere.rotation.x;
        
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    
    const onTouchEnd = () => {
      isDragging = false;
      if (sceneRef.current) {
        sceneRef.current.isDragging = false;
      }
      touchStartedOnCanvas = false;
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);
    renderer.domElement.addEventListener('touchcancel', onTouchEnd);
    
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
          
          const newMaterial = createShaderMaterial(newDataTexture);
          
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
      
      const shouldRotate = !isDragging && 
                          isRotatingRef.current && 
                          !(sceneRef.current?.pausedForTransition);
      
      if (shouldRotate) {
        sphere.rotation.y += 0.0005;
        // Rotate field lines and source surface with the sphere
        fieldLineGroup.rotation.y = sphere.rotation.y;
        fieldLineGroup.rotation.x = sphere.rotation.x;
        oldFieldLineGroup.rotation.y = sphere.rotation.y;
        oldFieldLineGroup.rotation.x = sphere.rotation.x;
        sourceSurface.rotation.y = sphere.rotation.y;
        sourceSurface.rotation.x = sphere.rotation.x;
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
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mouseleave', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', onTouchEnd);
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
        const transitionMaterial = createTransitionShaderMaterial(oldDataTexture, newDataTexture);
        
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
        const material = createShaderMaterial(newDataTexture);
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
        const transitionMaterial = createTransitionShaderMaterial(oldDataTexture, newDataTexture);
        
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
        const material = createShaderMaterial(newDataTexture);
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

    // Add new field lines
    coronalData.fieldLines.forEach((fieldLine) => {
      if (fieldLine.points.length < 2) return;

      const points = fieldLine.points.map(
        ([x, y, z]) => new THREE.Vector3(x, y, z)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      // Color based on polarity
      const color = fieldLine.polarity === 'open' 
        ? new THREE.Color(0x00ff00)  // Green for open
        : new THREE.Color(0xff0000); // Red for closed

      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: hasExistingLines ? 0 : 0.6, // Start at 0 if transitioning
        linewidth: 1
      });

      const line = new THREE.Line(geometry, material);
      line.userData = { 
        polarity: fieldLine.polarity,
        fieldLineData: fieldLine
      };
      line.visible = showCoronalLines && (fieldLine.polarity === 'open' ? showOpenLines : showClosedLines);
      
      // Match rotation with sphere
      line.rotation.y = sceneRef.current!.sphere.rotation.y;
      line.rotation.x = sceneRef.current!.sphere.rotation.x;
      
      fieldLineGroup.add(line);
    });

    currentCoronalDataRef.current = coronalData;

  }, [coronalData]);

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
};