import { ChevronUp } from 'lucide-react';

interface FITSData {
  min: number;
  max: number;
  width: number;
  height: number;
  [key: string]: any;
}

interface PhotospherePanelProps {
  useFixedScale: boolean;
  setUseFixedScale: (value: boolean) => void;
  fixedMin: string;
  setFixedMin: (value: string) => void;
  fixedMax: string;
  setFixedMax: (value: string) => void;
  fitsData: FITSData | null;
  onClose: () => void;
}

export default function PhotospherePanel({
  useFixedScale,
  setUseFixedScale,
  fixedMin,
  setFixedMin,
  fixedMax,
  setFixedMax,
  fitsData,
  onClose
}: PhotospherePanelProps) {
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-medium text-white">Photosphere</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <ChevronUp size={16} />
        </button>
      </div>
      
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useFixedScale}
            onChange={(e) => setUseFixedScale(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-light text-white">Fixed Scale Mode</span>
        </label>
        
        {useFixedScale && (
          <div className="flex gap-3 items-center">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-300">Min (G)</label>
              <input
                type="number"
                value={fixedMin}
                onChange={(e) => setFixedMin(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white"
                step="100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-300">Max (G)</label>
              <input
                type="number"
                value={fixedMax}
                onChange={(e) => setFixedMax(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white"
                step="100"
              />
            </div>
          </div>
        )}
        
        {fitsData && (
          <div className="pt-3 border-t border-gray-800 text-xs text-gray-300">
            <div>Data range: {fitsData.min.toFixed(1)} to {fitsData.max.toFixed(1)} G</div>
          </div>
        )}
      </div>
    </div>
  );
}