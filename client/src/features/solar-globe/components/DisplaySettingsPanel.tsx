import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

// Type definitions
interface FITSData {
  min: number;
  max: number;
  width: number;
  height: number;
  [key: string]: any;
}

interface CoronalData {
  [key: string]: any;
}

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

interface DisplaySettingsPanelProps {
  // Photosphere props
  useFixedScale: boolean;
  setUseFixedScale: (value: boolean) => void;
  fixedMin: string;
  setFixedMin: (value: string) => void;
  fixedMax: string;
  setFixedMax: (value: string) => void;
  fitsData: FITSData | null;
  
  // Corona props
  coronalData: CoronalData | null;
  isLoadingCoronal: boolean;
  coronalError: string;
  showCoronalLines: boolean;
  showOpenLines: boolean;
  showClosedLines: boolean;
  showSourceSurface: boolean;
  onToggleCoronalLines: () => void;
  onFetchCoronalData: (crNumber: number) => void;
  setShowOpenLines: (show: boolean) => void;
  setShowClosedLines: (show: boolean) => void;
  setShowSourceSurface: (show: boolean) => void;
  currentCarringtonNumber?: number;
  
  // Details props
  fileName: string;
}

type ActivePanel = 'none' | 'photosphere' | 'corona' | 'details';

export default function DisplaySettingsPanel({
  useFixedScale,
  setUseFixedScale,
  fixedMin,
  setFixedMin,
  fixedMax,
  setFixedMax,
  fitsData,
  coronalData,
  isLoadingCoronal,
  coronalError,
  showCoronalLines,
  showOpenLines,
  showClosedLines,
  showSourceSurface,
  onToggleCoronalLines,
  onFetchCoronalData,
  setShowOpenLines,
  setShowClosedLines,
  setShowSourceSurface,
  currentCarringtonNumber,
  fileName
}: DisplaySettingsPanelProps) {
  const [isMainOpen, setIsMainOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  const handleCoronalToggle = () => {
    if (!coronalData && !isLoadingCoronal && currentCarringtonNumber) {
      onFetchCoronalData(currentCarringtonNumber);
    } else {
      onToggleCoronalLines();
    }
  };

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  const crNumber = extractCarringtonNumber(fileName);
  const dates = crNumber ? getCarringtonDates(crNumber) : null;

  // Main collapsed button
  if (!isMainOpen) {
    return (
      <button
        onClick={() => setIsMainOpen(true)}
        className="absolute top-4 left-4 bg-black/70 backdrop-blur px-3 py-2 rounded-lg text-white z-20 pointer-events-auto hover:bg-black/90 transition-colors flex items-center gap-3"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium">Display Settings</span>
        <ChevronDown size={16} />
      </button>
    );
  }

  return (
    <div 
      className="absolute top-4 left-4 bg-black/80 border border-gray-800 rounded-lg backdrop-blur z-50 pointer-events-auto"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Main Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700 gap-4">
        <span className="text-sm font-medium text-white">Display Settings</span>
        <button
          onClick={() => {
            setIsMainOpen(false);
            setActivePanel('none');
          }}
          className="text-gray-400 hover:text-white"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Sub-panels list (shown when no specific panel is active) */}
      {activePanel === 'none' && (
        <div className="p-2">
          <button
            onClick={() => togglePanel('photosphere')}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700/50 rounded transition-colors flex items-center justify-between"
          >
            <span>Photosphere</span>
            <ChevronDown size={14} />
          </button>
          
          <button
            onClick={() => togglePanel('corona')}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700/50 rounded transition-colors flex items-center justify-between"
          >
            <span>Corona</span>
            <ChevronDown size={14} />
          </button>
          
          <button
            onClick={() => togglePanel('details')}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700/50 rounded transition-colors flex items-center justify-between"
          >
            <span>Details</span>
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {/* Photosphere Panel */}
      {activePanel === 'photosphere' && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-white">Photosphere</span>
            <button
              onClick={() => setActivePanel('none')}
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
      )}

      {/* Corona Panel */}
      {activePanel === 'corona' && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-white">Corona</span>
            <button
              onClick={() => setActivePanel('none')}
              className="text-gray-400 hover:text-white"
            >
              <ChevronUp size={16} />
            </button>
          </div>

          {/* Main Toggle Button */}
          <button
            onClick={handleCoronalToggle}
            disabled={isLoadingCoronal}
            className={`w-full text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded mb-3 ${
              showCoronalLines 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-800 hover:bg-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoadingCoronal 
              ? 'Loading Coronal Data...' 
              : showCoronalLines 
                ? 'Field Lines Active' 
                : 'Load Field Lines'}
          </button>

          {/* Error display */}
          {coronalError && (
            <div className="text-red-400 text-xs bg-red-900/30 backdrop-blur px-3 py-2 rounded mb-3">
              {coronalError}
            </div>
          )}

          {/* Line Type Controls */}
          {showCoronalLines && coronalData && (
            <div className="pt-3 border-t border-gray-800">
              <div className="text-xs text-gray-300 mb-2">Line Types</div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOpenLines(!showOpenLines)}
                  className={`flex-1 text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                    showOpenLines ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Open
                </button>
                
                <button
                  onClick={() => setShowClosedLines(!showClosedLines)}
                  className={`flex-1 text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                    showClosedLines ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Closed
                </button>
                
                <button
                  onClick={() => setShowSourceSurface(!showSourceSurface)}
                  className={`flex-1 text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                    showSourceSurface ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Surface
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Panel */}
      {activePanel === 'details' && fitsData && (
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-lg font-light text-white tracking-wide">Solar Magnetic Field</h2>
              <div className="text-gray-400 text-xs font-light mt-1">{fileName}</div>
            </div>
            <button
              onClick={() => setActivePanel('none')}
              className="text-gray-400 hover:text-white ml-4"
            >
              <ChevronUp size={16} />
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
      )}
    </div>
  );
}