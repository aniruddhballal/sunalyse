import { useRef, useEffect } from 'react';
import type { FITSData } from './fitsUtils';
import * as THREE from 'three';
import { X } from 'lucide-react';

export default function GlobeViewer({ fitsData, show2DMap, onToggle2DMap }: {
  fitsData: FITSData;
  show2DMap: boolean;
  onToggle2DMap: (show: boolean) => void;
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

  const createMagneticFieldTexture = (fitsData: FITSData): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = fitsData.width;
    canvas.height = fitsData.height;
    const ctx = canvas.getContext('2d')!;
    
    const imageData = ctx.createImageData(fitsData.width, fitsData.height);
    const range = fitsData.max - fitsData.min;
    
    for (let y = 0; y < fitsData.height; y++) {
      for (let x = 0; x < fitsData.width; x++) {
        const value = fitsData.data[y][x];
        const normalized = (value - fitsData.min) / range;
        
        let r, g, b;
        if (normalized < 0.5) {
          const t = normalized * 2;
          r = Math.floor(t * 255);
          g = Math.floor(t * 255);
          b = 255;
        } else {
          const t = (normalized - 0.5) * 2;
          r = 255;
          g = Math.floor((1 - t) * 255);
          b = Math.floor((1 - t) * 255);
        }
        
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
    
    canvas.width = fitsData.width;
    canvas.height = fitsData.height;
    
    const imageData = ctx.createImageData(fitsData.width, fitsData.height);
    const range = fitsData.max - fitsData.min;
    
    for (let y = 0; y < fitsData.height; y++) {
      for (let x = 0; x < fitsData.width; x++) {
        const value = fitsData.data[y][x];
        const normalized = (value - fitsData.min) / range;
        
        let r, g, b;
        if (normalized < 0.5) {
          const t = normalized * 2;
          r = Math.floor(t * 255);
          g = Math.floor(t * 255);
          b = 255;
        } else {
          const t = (normalized - 0.5) * 2;
          r = 255;
          g = Math.floor((1 - t) * 255);
          b = Math.floor((1 - t) * 255);
        }
        
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
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);
    
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
    };
  };

  useEffect(() => {
    if (fitsData) {
      initThreeJS(fitsData);
      if (canvas2DRef.current) {
        draw2DMap(canvas2DRef.current, fitsData);
      }
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
  }, [fitsData]);

  return (
    <>
      <div 
        ref={containerRef}
        className={`w-full h-full transition-opacity duration-300 ${show2DMap ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      />
      
      {show2DMap && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-8">
          <div className="relative max-w-full max-h-full">
            <canvas 
              ref={canvas2DRef}
              className="w-full h-auto max-h-[90vh] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            <button
              onClick={() => onToggle2DMap(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 p-2 backdrop-blur"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}