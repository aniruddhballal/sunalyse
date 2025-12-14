import { useRef, useEffect, useState } from 'react';
import type { FITSData } from './fits/types';
import * as THREE from 'three';

export default function GlobeViewer({ fitsData, show2DMap, isRotating }: {
  fitsData: FITSData;
  show2DMap: boolean;
  isRotating: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sphere: THREE.Mesh;
    animationId: number;
    isDragging: boolean;
    pausedForTransition: boolean;
  } | null>(null);
  
  const isRotatingRef = useRef(isRotating);
  const currentFitsDataRef = useRef<FITSData | null>(null);
  const transitionRef = useRef<{
    isTransitioning: boolean;
    startTime: number;
    duration: number;
    oldImageData: ImageData | null;
    newImageData: ImageData | null;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } | null>(null);
  
  const transition2DRef = useRef<{
    isTransitioning: boolean;
    startTime: number;
    duration: number;
    oldImageData: ImageData | null;
    newImageData: ImageData | null;
    animationId: number;
  } | null>(null);
  
  const [useFixedScale, setUseFixedScale] = useState(false);
  const [fixedMin, setFixedMin] = useState('-500');
  const [fixedMax, setFixedMax] = useState('500');

  // Keep isRotatingRef in sync with isRotating prop
  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  const getColorForValue = (normalized: number): [number, number, number] => {
    let r, g, b;
    
    if (normalized < 0.4) {
      const t = normalized / 0.4;
      r = Math.floor(100 + t * 155);
      g = Math.floor(t * 200);
      b = 0;
    } else if (normalized < 0.48) {
      const t = (normalized - 0.4) / 0.08;
      r = Math.floor(255 - t * 55);
      g = Math.floor(200 - t * 50);
      b = Math.floor(t * 150);
    } else if (normalized < 0.52) {
      r = 150;
      g = 150;
      b = 150;
    } else if (normalized < 0.6) {
      const t = (normalized - 0.52) / 0.08;
      r = Math.floor(150 - t * 150);
      g = Math.floor(150 + t * 105);
      b = Math.floor(150 - t * 50);
    } else {
      const t = (normalized - 0.6) / 0.4;
      r = 0;
      g = Math.floor(255 - t * 255);
      b = Math.floor(100 + t * 155);
    }
    
    return [r, g, b];
  };

  const createMagneticFieldTexture = (fitsData: FITSData, useFixed: boolean, minVal: number, maxVal: number): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = fitsData.width;
    canvas.height = fitsData.height;
    const ctx = canvas.getContext('2d')!;
    
    const imageData = ctx.createImageData(fitsData.width, fitsData.height);
    
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
        
        const [r, g, b] = getColorForValue(normalized);
        
        const idx = (y * fitsData.width + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16;
    texture.needsUpdate = true;
    return texture;
  };

  const createImageDataFromFits = (fitsData: FITSData, useFixed: boolean, minVal: number, maxVal: number): ImageData => {
    const imageData = new ImageData(fitsData.width, fitsData.height);
    
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
        
        const [r, g, b] = getColorForValue(normalized);
        
        const idx = (y * fitsData.width + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    
    return imageData;
  };

  const animate2DTransition = () => {
    if (!transition2DRef.current?.isTransitioning || !canvas2DRef.current) return;
    
    const ctx = canvas2DRef.current.getContext('2d');
    if (!ctx) return;
    
    const elapsed = Date.now() - transition2DRef.current.startTime;
    const progress = Math.min(elapsed / transition2DRef.current.duration, 1);
    
    const oldData = transition2DRef.current.oldImageData!;
    const newData = transition2DRef.current.newImageData!;
    
    const interpolatedData = ctx.createImageData(canvas2DRef.current.width, canvas2DRef.current.height);
    
    for (let i = 0; i < oldData.data.length; i += 4) {
      interpolatedData.data[i] = oldData.data[i] + (newData.data[i] - oldData.data[i]) * progress;
      interpolatedData.data[i + 1] = oldData.data[i + 1] + (newData.data[i + 1] - oldData.data[i + 1]) * progress;
      interpolatedData.data[i + 2] = oldData.data[i + 2] + (newData.data[i + 2] - oldData.data[i + 2]) * progress;
      interpolatedData.data[i + 3] = 255;
    }
    
    ctx.putImageData(interpolatedData, 0, 0);
    
    if (progress < 1) {
      transition2DRef.current.animationId = requestAnimationFrame(animate2DTransition);
    } else {
      transition2DRef.current.isTransitioning = false;
    }
  };

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
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 3;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    
    const geometry = new THREE.SphereGeometry(1, 256, 256);
    const texture = createMagneticFieldTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    // Raycaster to detect if click is on the sphere
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
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
      if (sceneRef.current) {
        sceneRef.current.isDragging = false;
      }
      renderer.domElement.style.cursor = 'default';
    };
    
    // Touch event handlers for mobile
    let touchStartedOnCanvas = false;
    
    const onTouchStart = (e: TouchEvent) => {
      // Check if touch started on an interactive element
      const target = e.target as HTMLElement;
      if (target !== renderer.domElement) {
        touchStartedOnCanvas = false;
        return;
      }
      
      if (e.touches.length === 1) {
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
      if (!touchStartedOnCanvas || !isDragging || e.touches.length !== 1) return;
      
      // Only prevent default if we're actually rotating
      e.preventDefault();
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;
      
      sphere.rotation.y += deltaX * 0.01;
      sphere.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
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
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);
    renderer.domElement.addEventListener('touchcancel', onTouchEnd);
    
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      
      // Handle texture transition
      if (transitionRef.current?.isTransitioning) {
        const elapsed = Date.now() - transitionRef.current.startTime;
        const progress = Math.min(elapsed / transitionRef.current.duration, 1);
        
        // Interpolate between old and new image data
        const oldData = transitionRef.current.oldImageData!;
        const newData = transitionRef.current.newImageData!;
        const ctx = transitionRef.current.ctx;
        const canvas = transitionRef.current.canvas;
        
        const interpolatedData = ctx.createImageData(canvas.width, canvas.height);
        
        for (let i = 0; i < oldData.data.length; i += 4) {
          interpolatedData.data[i] = oldData.data[i] + (newData.data[i] - oldData.data[i]) * progress;
          interpolatedData.data[i + 1] = oldData.data[i + 1] + (newData.data[i + 1] - oldData.data[i + 1]) * progress;
          interpolatedData.data[i + 2] = oldData.data[i + 2] + (newData.data[i + 2] - oldData.data[i + 2]) * progress;
          interpolatedData.data[i + 3] = 255;
        }
        
        ctx.putImageData(interpolatedData, 0, 0);
        
        const material = sphere.material as THREE.MeshBasicMaterial;
        if (material.map) {
          material.map.needsUpdate = true;
        }
        
        if (progress >= 1) {
          transitionRef.current.isTransitioning = false;
          // Resume rotation after transition completes
          if (sceneRef.current) {
            sceneRef.current.pausedForTransition = false;
          }
        }
      }
      
      // Only auto-rotate if:
      // 1. isRotating is true
      // 2. user is not dragging
      // 3. not paused for transition
      const shouldRotate = !isDragging && 
                          isRotatingRef.current && 
                          !(sceneRef.current?.pausedForTransition);
      
      if (shouldRotate) {
        sphere.rotation.y += 0.0005;
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
      animationId: 0, 
      isDragging: false,
      pausedForTransition: false
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
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', onTouchEnd);
    };
  };

  // Initialize Three.js only when show2DMap changes or on first load
  useEffect(() => {
    if (fitsData && !show2DMap && !sceneRef.current) {
      // Only initialize if scene doesn't exist
      initThreeJS(fitsData);
      currentFitsDataRef.current = fitsData;
    } else if (!fitsData || show2DMap) {
      // Clean up if switching away
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

  // Update texture when fitsData changes (for navigation)
  useEffect(() => {
    if (sceneRef.current && fitsData && !show2DMap && currentFitsDataRef.current !== fitsData) {
      // DON'T pause rotation yet - let it continue while we prepare data
      
      // Get old and new image data (this takes time, but globe keeps rotating)
      const material = sceneRef.current.sphere.material as THREE.MeshBasicMaterial;
      const oldCanvas = (material.map as THREE.CanvasTexture)?.image as HTMLCanvasElement;
      let oldImageData: ImageData | null = null;
      
      if (oldCanvas) {
        const oldCtx = oldCanvas.getContext('2d')!;
        oldImageData = oldCtx.getImageData(0, 0, oldCanvas.width, oldCanvas.height);
      }
      
      // Prepare new image data (computation happens here while globe rotates)
      const newImageData = createImageDataFromFits(
        fitsData, 
        useFixedScale, 
        parseFloat(fixedMin), 
        parseFloat(fixedMax)
      );
      
      // Create canvas for transition
      const canvas = document.createElement('canvas');
      canvas.width = fitsData.width;
      canvas.height = fitsData.height;
      const ctx = canvas.getContext('2d')!;
      
      // If no old data (first load), create gray imageData
      if (!oldImageData) {
        oldImageData = ctx.createImageData(fitsData.width, fitsData.height);
        for (let i = 0; i < oldImageData.data.length; i += 4) {
          oldImageData.data[i] = 128;
          oldImageData.data[i + 1] = 128;
          oldImageData.data[i + 2] = 128;
          oldImageData.data[i + 3] = 255;
        }
      }
      
      // Put initial old data on canvas
      ctx.putImageData(oldImageData, 0, 0);
      
      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.minFilter = THREE.LinearFilter;
      newTexture.magFilter = THREE.LinearFilter;
      newTexture.anisotropy = 16;
      
      const oldTexture = material.map;
      material.map = newTexture;
      material.needsUpdate = true;
      
      // NOW pause rotation right before transition starts
      sceneRef.current.pausedForTransition = true;
      
      // Set up transition
      transitionRef.current = {
        isTransitioning: true,
        startTime: Date.now(),
        duration: 800, // 0.8 seconds transition (faster)
        oldImageData,
        newImageData,
        canvas,
        ctx
      };
      
      // Dispose old texture to free memory
      if (oldTexture) {
        oldTexture.dispose();
      }
      
      currentFitsDataRef.current = fitsData;
    }
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  // Update texture when scale settings change (without reinitializing the scene)
  useEffect(() => {
    if (sceneRef.current && fitsData && !show2DMap && currentFitsDataRef.current === fitsData) {
      // Get old image data
      const material = sceneRef.current.sphere.material as THREE.MeshBasicMaterial;
      const oldCanvas = (material.map as THREE.CanvasTexture)?.image as HTMLCanvasElement;
      let oldImageData: ImageData | null = null;
      
      if (oldCanvas) {
        const oldCtx = oldCanvas.getContext('2d')!;
        oldImageData = oldCtx.getImageData(0, 0, oldCanvas.width, oldCanvas.height);
      }
      
      // Create new image data with new scale settings
      const newImageData = createImageDataFromFits(
        fitsData, 
        useFixedScale, 
        parseFloat(fixedMin), 
        parseFloat(fixedMax)
      );
      
      // Create canvas for transition
      const canvas = document.createElement('canvas');
      canvas.width = fitsData.width;
      canvas.height = fitsData.height;
      const ctx = canvas.getContext('2d')!;
      
      // If no old data, create it from current state
      if (!oldImageData) {
        oldImageData = ctx.createImageData(fitsData.width, fitsData.height);
        for (let i = 0; i < oldImageData.data.length; i += 4) {
          oldImageData.data[i] = 128;
          oldImageData.data[i + 1] = 128;
          oldImageData.data[i + 2] = 128;
          oldImageData.data[i + 3] = 255;
        }
      }
      
      // Put initial old data on canvas
      ctx.putImageData(oldImageData, 0, 0);
      
      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.minFilter = THREE.LinearFilter;
      newTexture.magFilter = THREE.LinearFilter;
      newTexture.anisotropy = 16;
      
      const oldTexture = material.map;
      material.map = newTexture;
      material.needsUpdate = true;
      
      // Pause rotation during scale transition
      sceneRef.current.pausedForTransition = true;
      
      // Set up transition
      transitionRef.current = {
        isTransitioning: true,
        startTime: Date.now(),
        duration: 700, // Same 700ms transition for scale changes
        oldImageData,
        newImageData,
        canvas,
        ctx
      };
      
      // Dispose old texture to free memory
      if (oldTexture) {
        oldTexture.dispose();
      }
    }
  }, [useFixedScale, fixedMin, fixedMax]);

  // Draw 2D map whenever color settings change
  useEffect(() => {
    if (fitsData && canvas2DRef.current && show2DMap) {
      const ctx = canvas2DRef.current.getContext('2d');
      if (!ctx) return;
      
      // Get old image data if it exists
      let oldImageData: ImageData | null = null;
      if (canvas2DRef.current.width > 0 && canvas2DRef.current.height > 0) {
        try {
          oldImageData = ctx.getImageData(0, 0, canvas2DRef.current.width, canvas2DRef.current.height);
        } catch (e) {
          // If we can't get old data, that's okay
        }
      }
      
      // Set canvas size
      canvas2DRef.current.width = fitsData.width;
      canvas2DRef.current.height = fitsData.height;
      
      // Create new image data
      const newImageData = createImageDataFromFits(
        fitsData,
        useFixedScale,
        parseFloat(fixedMin),
        parseFloat(fixedMax)
      );
      
      // If no old data or dimensions changed, just draw immediately
      if (!oldImageData || 
          oldImageData.width !== newImageData.width || 
          oldImageData.height !== newImageData.height) {
        ctx.putImageData(newImageData, 0, 0);
        return;
      }
      
      // Cancel any existing transition
      if (transition2DRef.current?.animationId) {
        cancelAnimationFrame(transition2DRef.current.animationId);
      }
      
      // Put old data on canvas first
      ctx.putImageData(oldImageData, 0, 0);
      
      // Start transition
      transition2DRef.current = {
        isTransitioning: true,
        startTime: Date.now(),
        duration: 700,
        oldImageData,
        newImageData,
        animationId: 0
      };
      
      animate2DTransition();
    }
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  return (
    <>
      {/* Color Scale Controls */}
      <div 
        className="absolute top-4 left-4 bg-black/70 backdrop-blur p-4 rounded-lg text-white z-20 pointer-events-auto"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useFixedScale}
              onChange={(e) => setUseFixedScale(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Fixed Scale Mode</span>
          </label>
        </div>
        
        {useFixedScale && (
          <div className="flex gap-3 items-center mt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-300">Min (G)</label>
              <input
                type="number"
                value={fixedMin}
                onChange={(e) => setFixedMin(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
                step="100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-300">Max (G)</label>
              <input
                type="number"
                value={fixedMax}
                onChange={(e) => setFixedMax(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
                step="100"
              />
            </div>
          </div>
        )}
        
        <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-300">
          <div>Data range: {fitsData?.min.toFixed(1)} to {fitsData?.max.toFixed(1)} G</div>
        </div>
      </div>
      
      {/* 3D Globe Container */}
      <div 
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-300 ${show2DMap ? 'hidden' : 'block'}`}
        style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
      />
      
      {/* 2D Map Container */}
      {show2DMap && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-8">
          <canvas 
            ref={canvas2DRef}
            style={{ 
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              imageRendering: 'auto'
            }}
          />
        </div>
      )}
    </>
  );
}