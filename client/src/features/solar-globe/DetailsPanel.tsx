import { X } from 'lucide-react';
import type { FITSData } from './fits/types';

// Carrington Rotation 1 started on November 9, 1853
const CR1_START = new Date('1853-11-09');
const ROTATION_PERIOD_DAYS = 27.2753;

function getCarringtonDates(crNumber: number): { start: Date; end: Date } | null {
  if (crNumber < 1) return null;
  
  const daysFromCR1 = (crNumber - 1) * ROTATION_PERIOD_DAYS;
  const startDate = new Date(CR1_START.getTime() + daysFromCR1 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + ROTATION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  
  return { start: startDate, end: endDate };
}

function extractCarringtonNumber(fileName: string): number | null {
  // Try to extract CR number from filename like "CR2150.fits"
  const match = fileName.match(/CR(\d+)/i);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function DetailsPanel({ fitsData, fileName, onClose }: {
  fitsData: FITSData;
  fileName: string;
  onClose: () => void;
}) {
  const crNumber = extractCarringtonNumber(fileName);
  const dates = crNumber ? getCarringtonDates(crNumber) : null;

  return (
    <div 
      className="absolute top-24 right-6 md:top-6 bg-black/80 border border-gray-800 p-4 space-y-3 backdrop-blur z-20 pointer-events-auto"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-lg font-light text-white tracking-wide">Solar Magnetic Field</h2>
          <div className="text-gray-400 text-xs font-light mt-1">{fileName}</div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white ml-4"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="space-y-2 text-sm border-t border-gray-800 pt-3">
        {crNumber && dates && (
          <>
            <div>
              <div className="text-gray-500 text-xs">Carrington Rotation</div>
              <div className="text-white font-light">CR {crNumber}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Time Period</div>
              <div className="text-white font-light text-xs">
                {formatDate(dates.start)} - {formatDate(dates.end)}
              </div>
              <div className="text-gray-400 text-[10px] mt-0.5">
                (~27.3 day rotation period)
              </div>
            </div>
            <div className="border-t border-gray-800 pt-2"></div>
          </>
        )}
        <div>
          <div className="text-gray-500 text-xs">Dimensions</div>
          <div className="text-white font-light">{fitsData.width} × {fitsData.height}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Value Range</div>
          <div className="text-white font-light">{fitsData.min.toFixed(2)} to {fitsData.max.toFixed(2)} G</div>
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