import { useRef, useEffect } from 'react';
import type { FITSData } from './fitsUtils';
import { X } from 'lucide-react';

export default function DetailsPanel({ fitsData, onClose, onOpen2DMap }: {
  fitsData: FITSData;
  onClose: () => void;
  onOpen2DMap: () => void;
}) {
  const canvas2DRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvas2DRef.current && fitsData) {
      const ctx = canvas2DRef.current.getContext('2d');
      if (!ctx) return;
      
      canvas2DRef.current.width = fitsData.width;
      canvas2DRef.current.height = fitsData.height;
      
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
    }
  }, [fitsData]);

  return (
    <div className="absolute top-6 right-6 bg-black/80 border border-gray-800 p-4 space-y-3 backdrop-blur">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-white"
      >
        <X size={16} />
      </button>
      <div className="space-y-2 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Dimensions</div>
          <div className="text-white font-light">{fitsData.width} × {fitsData.height}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Value Range</div>
          <div className="text-white font-light">{fitsData.min.toFixed(2)} to {fitsData.max.toFixed(2)}</div>
        </div>
        <div className="pt-2 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-3 bg-gradient-to-r from-blue-500 to-white"></div>
            <span className="text-gray-400 text-xs">Negative</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 bg-gradient-to-r from-white to-red-500"></div>
            <span className="text-gray-400 text-xs">Positive</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-gray-800">
          <div className="text-gray-500 text-xs mb-2">2D Map</div>
          <div 
            className="relative group cursor-pointer"
            onClick={onOpen2DMap}
          >
            <canvas 
              ref={canvas2DRef}
              className="w-full h-auto border border-gray-700 group-hover:border-white transition-colors"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 text-white text-xs font-light transition-opacity">
                Click to expand
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
