import { X } from 'lucide-react';
import type { FITSData } from './fitsUtils';

export default function DetailsPanel({ fitsData, onClose }: {
  fitsData: FITSData;
  onClose: () => void;
}) {
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
          <div className="text-gray-500 text-xs mb-2">Color Scale</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 bg-gradient-to-r from-red-900 via-orange-500 to-yellow-500"></div>
              <span className="text-gray-400 text-xs">Negative (Strong → Weak)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 bg-gray-400"></div>
              <span className="text-gray-400 text-xs">Near Zero</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 bg-gradient-to-r from-green-500 to-blue-900"></div>
              <span className="text-gray-400 text-xs">Positive (Weak → Strong)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}