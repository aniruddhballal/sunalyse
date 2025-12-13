import { useRef, useEffect, useState } from 'react';
import type { FITSData } from './fitsUtils';
import * as THREE from 'three';

export default function GlobeViewer({ fitsData, show2DMap }: {
  fitsData: FITSData;
  show2DMap: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sphere: THREE.Mesh;
    animationId: number;
  } | null>(null);
  
  const [useFixedScale, setUseFixedScale] = useState(false);
  const [fixedMin, setFixedMin] = useState('-500');
  const [fixedMax, setFixedMax] = useState('500');

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

  const createMagneticFieldTexture = (fitsData: FITSData): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = fitsData.width;
    canvas.height = fitsData.height;
    const ctx = canvas.getContext('2d')!;
    
    const imageData = ctx.createImageData(fitsData.width, fitsData.height);
    
    let minVal, maxVal;
    if (useFixedScale) {
      minVal = parseFloat(fixedMin);
      maxVal = parseFloat(fixedMax);
    } else {
      minVal = fitsData.min;
      maxVal = fitsData.max;
    }
    const range = maxVal - minVal;
    
    for (let y = 0; y < fitsData.height; y++) {
      for (let x = 0; x < fitsData.width; x++) {
        const value = fitsData.data[y][x];
        const clampedValue = Math.max(minVal, Math.min(maxVal, value));
        const normalized = (clampedValue - minVal) / range;
        
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

  const draw2DMap = (canvas: HTMLCanvasElement, fitsData: FITSData) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dataWidth = fitsData.width;
    const dataHeight = fitsData.height;
    canvas.width = dataWidth;
    canvas.height = dataHeight;
    
    const imageData = ctx.createImageData(dataWidth, dataHeight);
    
    let minVal, maxVal;
    if (useFixedScale) {
      minVal = parseFloat(fixedMin);
      maxVal = parseFloat(fixedMax);
    } else {
      minVal = fitsData.min;
      maxVal = fitsData.max;
    }
    const range = maxVal - minVal;
    
    for (let y = 0; y < fitsData.height; y++) {
      for (let x = 0; x < fitsData.width; x++) {
        const value = fitsData.data[y][x];
        const clampedValue = Math.max(minVal, Math.min(maxVal, value));
        const normalized = (clampedValue - minVal) / range;
        
        const [r, g, b] = getColorForValue(normalized);
        
        const idx = (y * fitsData.width + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
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
    const texture = createMagneticFieldTexture(fitsData);
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
    
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      sphere.rotation.y += deltaX * 0.01;
      sphere.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
    };
    
    // Touch event handlers for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      
      e.preventDefault();
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;
      
      sphere.rotation.y += deltaX * 0.01;
      sphere.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    
    const onTouchEnd = () => {
      isDragging = false;
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);
    renderer.domElement.addEventListener('touchcancel', onTouchEnd);
    
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      
      if (!isDragging) {
        sphere.rotation.y += 0.002;
      }
      
      renderer.render(scene, camera);
      
      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
    };
    
    animate();
    
    sceneRef.current = { scene, camera, renderer, sphere, animationId: 0 };
    
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

  // Initialize Three.js when not showing 2D map
  useEffect(() => {
    if (fitsData && !show2DMap) {
      initThreeJS(fitsData);
    }
    
    return () => {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        if (sceneRef.current.renderer.domElement.parentNode === containerRef.current) {
          containerRef.current?.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current.renderer.dispose();
      }
    };
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  // Draw 2D map whenever color settings change
  useEffect(() => {
    if (fitsData && canvas2DRef.current && show2DMap) {
      draw2DMap(canvas2DRef.current, fitsData);
    }
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  return (
    <>
      {/* Color Scale Controls */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur p-4 rounded-lg text-white z-10">
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
        className={`w-full h-full transition-opacity duration-300 ${show2DMap ? 'hidden' : 'block'}`}
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