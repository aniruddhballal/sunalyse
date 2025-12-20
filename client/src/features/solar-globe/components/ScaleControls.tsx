import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { FITSData } from '../fits/types';

interface ScaleControlsProps {
  useFixedScale: boolean;
  setUseFixedScale: (value: boolean) => void;
  fixedMin: string;
  setFixedMin: (value: string) => void;
  fixedMax: string;
  setFixedMax: (value: string) => void;
  fitsData: FITSData | null;
}

export default function ScaleControls({
  useFixedScale,
  setUseFixedScale,
  fixedMin,
  setFixedMin,
  fixedMax,
  setFixedMax,
  fitsData
}: ScaleControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 left-4 md:top-4 bg-black/70 backdrop-blur px-3 py-2 rounded-lg text-white z-20 pointer-events-auto hover:bg-black/90 transition-colors flex items-center gap-2"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium">Photosphere</span>
        <ChevronDown size={16} />
      </button>
    );
  }

  return (
    <div 
      className="absolute top-4 left-4 md:top-4 bg-black/80 border border-gray-800 rounded-lg backdrop-blur z-20 pointer-events-auto p-4"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="flex justify-end items-start">
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white -mt-1"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      <div className="space-y-3 -mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useFixedScale}
            onChange={(e) => setUseFixedScale(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-light">Fixed Scale Mode</span>
        </label>
        
        {useFixedScale && (
          <div className="flex gap-3 items-center">
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
        
        <div className="pt-3 border-t border-gray-800 text-xs text-gray-300">
          <div>Data range: {fitsData?.min.toFixed(1)} to {fitsData?.max.toFixed(1)} G</div>
        </div>
      </div>
    </div>
  );
}