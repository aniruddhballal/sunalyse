import { useRef, useEffect } from 'react';
import type { FITSData } from '../fits/types';
import { getColorForValue } from '../utils/colorMapping';

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const createImageDataFromFits = (
  fitsData: FITSData, 
  useFixed: boolean, 
  minVal: number, 
  maxVal: number
): ImageData => {
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

export const use2DRenderer = (
  canvas2DRef: React.RefObject<HTMLCanvasElement | null>,
  fitsData: FITSData | null,
  show2DMap: boolean,
  useFixedScale: boolean,
  fixedMin: string,
  fixedMax: string
) => {
  const transition2DRef = useRef<{
    isTransitioning: boolean;
    startTime: number;
    duration: number;
    oldImageData: ImageData | null;
    newImageData: ImageData | null;
    animationId: number;
  } | null>(null);

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
};