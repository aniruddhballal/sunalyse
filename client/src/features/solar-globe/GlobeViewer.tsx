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

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

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

  // Create a data texture from FITS (single channel, raw normalized values)
  const createDataTexture = (fitsData: FITSData, useFixed: boolean, minVal: number, maxVal: number): THREE.DataTexture => {
    const dataArray = new Float32Array(fitsData.width * fitsData.height);
    
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
        dataArray[y * fitsData.width + x] = normalized;
      }
    }
    
    const texture = new THREE.DataTexture(
      dataArray,
      fitsData.width,
      fitsData.height,
      THREE.RedFormat,
      THREE.FloatType
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };

  // Create shader material that colors data on-the-fly
  const createShaderMaterial = (dataTexture: THREE.DataTexture): THREE.ShaderMaterial => {
    return new THREE.ShaderMaterial({
      uniforms: {
        dataMap: { value: dataTexture }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dataMap;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        vec3 getColorForValue(float normalized) {
          float r, g, b;
          
          if (normalized < 0.4) {
            float t = normalized / 0.4;
            r = (100.0 + t * 155.0) / 255.0;
            g = (t * 200.0) / 255.0;
            b = 0.0;
          } else if (normalized < 0.48) {
            float t = (normalized - 0.4) / 0.08;
            r = (255.0 - t * 55.0) / 255.0;
            g = (200.0 - t * 50.0) / 255.0;
            b = (t * 150.0) / 255.0;
          } else if (normalized < 0.52) {
            r = 150.0 / 255.0;
            g = 150.0 / 255.0;
            b = 150.0 / 255.0;
          } else if (normalized < 0.6) {
            float t = (normalized - 0.52) / 0.08;
            r = (150.0 - t * 150.0) / 255.0;
            g = (150.0 + t * 105.0) / 255.0;
            b = (150.0 - t * 50.0) / 255.0;
          } else {
            float t = (normalized - 0.6) / 0.4;
            r = 0.0;
            g = (255.0 - t * 255.0) / 255.0;
            b = (100.0 + t * 155.0) / 255.0;
          }
          
          return vec3(r, g, b);
        }
        
        void main() {
          float normalized = texture2D(dataMap, vUv).r;
          vec3 color = getColorForValue(normalized);
          
          // Add lighting
          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
          
          gl_FragColor = vec4(color * diff, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });
  };

  // Create transition shader that interpolates DATA, then colors
  const createTransitionShaderMaterial = (oldDataTexture: THREE.DataTexture, newDataTexture: THREE.DataTexture): THREE.ShaderMaterial => {
    return new THREE.ShaderMaterial({
      uniforms: {
        oldDataMap: { value: oldDataTexture },
        newDataMap: { value: newDataTexture },
        mixFactor: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D oldDataMap;
        uniform sampler2D newDataMap;
        uniform float mixFactor;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        vec3 getColorForValue(float normalized) {
          float r, g, b;
          
          if (normalized < 0.4) {
            float t = normalized / 0.4;
            r = (100.0 + t * 155.0) / 255.0;
            g = (t * 200.0) / 255.0;
            b = 0.0;
          } else if (normalized < 0.48) {
            float t = (normalized - 0.4) / 0.08;
            r = (255.0 - t * 55.0) / 255.0;
            g = (200.0 - t * 50.0) / 255.0;
            b = (t * 150.0) / 255.0;
          } else if (normalized < 0.52) {
            r = 150.0 / 255.0;
            g = 150.0 / 255.0;
            b = 150.0 / 255.0;
          } else if (normalized < 0.6) {
            float t = (normalized - 0.52) / 0.08;
            r = (150.0 - t * 150.0) / 255.0;
            g = (150.0 + t * 105.0) / 255.0;
            b = (150.0 - t * 50.0) / 255.0;
          } else {
            float t = (normalized - 0.6) / 0.4;
            r = 0.0;
            g = (255.0 - t * 255.0) / 255.0;
            b = (100.0 + t * 155.0) / 255.0;
          }
          
          return vec3(r, g, b);
        }
        
        void main() {
          // Interpolate the DATA values first
          float oldValue = texture2D(oldDataMap, vUv).r;
          float newValue = texture2D(newDataMap, vUv).r;
          float interpolatedValue = mix(oldValue, newValue, mixFactor);
          
          // THEN calculate the color from interpolated data
          vec3 color = getColorForValue(interpolatedValue);
          
          // Add lighting
          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
          
          gl_FragColor = vec4(color * diff, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });
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
    const rawProgress = Math.min(elapsed / transition2DRef.current.duration, 1);
    const progress = easeInOutCubic(rawProgress);
    
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
    
    if (rawProgress < 1) {
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
    const dataTexture = createDataTexture(fitsData, useFixedScale, parseFloat(fixedMin), parseFloat(fixedMax));
    const material = createShaderMaterial(dataTexture);
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
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
    
    let touchStartedOnCanvas = false;
    
    const onTouchStart = (e: TouchEvent) => {
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
      
      // Handle smooth shader-based transition
      if (transitionRef.current?.isTransitioning && sphere.material instanceof THREE.ShaderMaterial) {
        const elapsed = Date.now() - transitionRef.current.startTime;
        const rawProgress = Math.min(elapsed / transitionRef.current.duration, 1);
        const progress = easeInOutCubic(rawProgress);
        
        sphere.material.uniforms.mixFactor.value = progress;
        
        if (rawProgress >= 1) {
          // Transition complete - switch to single data map shader
          const newDataTexture = sphere.material.uniforms.newDataMap.value;
          const oldDataTexture = sphere.material.uniforms.oldDataMap.value;
          
          const newMaterial = createShaderMaterial(newDataTexture);
          
          sphere.material.dispose();
          sphere.material = newMaterial;
          
          // Clean up old texture
          if (oldDataTexture) {
            oldDataTexture.dispose();
          }
          
          transitionRef.current.isTransitioning = false;
          if (sceneRef.current) {
            sceneRef.current.pausedForTransition = false;
          }
        }
      }
      
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

  // Smooth transition when fitsData changes
  useEffect(() => {
    if (sceneRef.current && fitsData && !show2DMap && currentFitsDataRef.current !== fitsData) {
      // Pause rotation
      sceneRef.current.pausedForTransition = true;
      
      // Get current material
      const currentMaterial = sceneRef.current.sphere.material;
      let oldDataTexture: THREE.DataTexture | null = null;
      
      if (currentMaterial instanceof THREE.ShaderMaterial) {
        oldDataTexture = currentMaterial.uniforms.dataMap?.value || null;
      }
      
      // Create new data texture
      const newDataTexture = createDataTexture(
        fitsData, 
        useFixedScale, 
        parseFloat(fixedMin), 
        parseFloat(fixedMax)
      );
      
      if (oldDataTexture) {
        // Create transition material with both data textures
        const transitionMaterial = createTransitionShaderMaterial(oldDataTexture, newDataTexture);
        
        // Replace material
        if (currentMaterial instanceof THREE.Material) {
          currentMaterial.dispose();
        }
        sceneRef.current.sphere.material = transitionMaterial;
        
        // Start transition
        transitionRef.current = {
          isTransitioning: true,
          startTime: Date.now(),
          duration: 800
        };
      } else {
        // First load - just set the data texture
        const material = createShaderMaterial(newDataTexture);
        sceneRef.current.sphere.material = material;
      }
      
      currentFitsDataRef.current = fitsData;
    }
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  // Update when scale settings change
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

  useEffect(() => {
    if (fitsData && canvas2DRef.current && show2DMap) {
      const ctx = canvas2DRef.current.getContext('2d');
      if (!ctx) return;
      
      let oldImageData: ImageData | null = null;
      if (canvas2DRef.current.width > 0 && canvas2DRef.current.height > 0) {
        try {
          oldImageData = ctx.getImageData(0, 0, canvas2DRef.current.width, canvas2DRef.current.height);
        } catch (e) {
          // Ignore
        }
      }
      
      canvas2DRef.current.width = fitsData.width;
      canvas2DRef.current.height = fitsData.height;
      
      const newImageData = createImageDataFromFits(
        fitsData,
        useFixedScale,
        parseFloat(fixedMin),
        parseFloat(fixedMax)
      );
      
      if (!oldImageData || 
          oldImageData.width !== newImageData.width || 
          oldImageData.height !== newImageData.height) {
        ctx.putImageData(newImageData, 0, 0);
        return;
      }
      
      if (transition2DRef.current?.animationId) {
        cancelAnimationFrame(transition2DRef.current.animationId);
      }
      
      ctx.putImageData(oldImageData, 0, 0);
      
      transition2DRef.current = {
        isTransitioning: true,
        startTime: Date.now(),
        duration: 600,
        oldImageData,
        newImageData,
        animationId: 0
      };
      
      animate2DTransition();
    }
  }, [fitsData, show2DMap, useFixedScale, fixedMin, fixedMax]);

  return (
    <>
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
      
      <div 
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-300 ${show2DMap ? 'hidden' : 'block'}`}
        style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
      />
      
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