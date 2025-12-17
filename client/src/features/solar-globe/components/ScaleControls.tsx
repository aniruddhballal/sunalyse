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
  return (
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
  );
}