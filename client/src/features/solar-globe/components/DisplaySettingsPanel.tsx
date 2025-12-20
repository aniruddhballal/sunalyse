import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import PhotospherePanel from './PhotospherePanel';
import CoronaPanel from './CoronaPanel';
import DetailsSubPanel from './DetailsSubPanel';

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
  dataSource: string;
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
  dataSource
}: DisplaySettingsPanelProps) {
  const [isMainOpen, setIsMainOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  const handleCloseSubPanel = () => {
    setActivePanel('none');
  };

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
        <PhotospherePanel
          useFixedScale={useFixedScale}
          setUseFixedScale={setUseFixedScale}
          fixedMin={fixedMin}
          setFixedMin={setFixedMin}
          fixedMax={fixedMax}
          setFixedMax={setFixedMax}
          fitsData={fitsData}
          onClose={handleCloseSubPanel}
        />
      )}

      {/* Corona Panel */}
      {activePanel === 'corona' && (
        <CoronaPanel
          coronalData={coronalData}
          isLoadingCoronal={isLoadingCoronal}
          coronalError={coronalError}
          showCoronalLines={showCoronalLines}
          showOpenLines={showOpenLines}
          showClosedLines={showClosedLines}
          showSourceSurface={showSourceSurface}
          onToggleCoronalLines={onToggleCoronalLines}
          onFetchCoronalData={onFetchCoronalData}
          setShowOpenLines={setShowOpenLines}
          setShowClosedLines={setShowClosedLines}
          setShowSourceSurface={setShowSourceSurface}
          currentCarringtonNumber={currentCarringtonNumber}
          onClose={handleCloseSubPanel}
        />
      )}

      {/* Details Panel */}
      {activePanel === 'details' && (
        <DetailsSubPanel
          fitsData={fitsData}
          dataSource={dataSource}
          onClose={handleCloseSubPanel}
        />
      )}
    </div>
  );
}