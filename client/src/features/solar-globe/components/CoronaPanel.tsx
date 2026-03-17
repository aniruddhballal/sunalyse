import { ChevronUp } from 'lucide-react';

interface CoronalData {
  [key: string]: any;
}

interface CoronaPanelProps {
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
  fieldLineMaxStrength: number;
  setFieldLineMaxStrength: (value: number) => void;
  showPolarity: boolean;
  setShowPolarity: (value: boolean) => void;
  onClose: () => void;
}

export default function CoronaPanel({
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
  fieldLineMaxStrength,
  setFieldLineMaxStrength,
  showPolarity,
  setShowPolarity,
  onClose
}: CoronaPanelProps) {
  const handleCoronalToggle = () => {
    if (!coronalData && !isLoadingCoronal && currentCarringtonNumber) {
      onFetchCoronalData(currentCarringtonNumber);
    } else {
      onToggleCoronalLines();
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-medium text-white">Corona</span>
        <button
          onClick={onClose}
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

<button
              onClick={() => setShowPolarity(!showPolarity)}
              className={`flex-1 text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                showPolarity ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Polarity
            </button>
          </div>

          {/* Field line colour scale */}
          <div className="mt-4 pt-3 border-t border-gray-800">
            <div className="text-xs text-gray-300 mb-2">Field Line Colour Scale</div>
            <div className="text-xs text-gray-500 mb-2">
              Strength ceiling: <span className="text-gray-300">{fieldLineMaxStrength} G</span>
            </div>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={fieldLineMaxStrength}
              onChange={(e) => setFieldLineMaxStrength(Number(e.target.value))}
              className="w-full accent-orange-400"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>50 G</span>
              <span>2000 G</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded" style={{background: 'linear-gradient(to right, #006600, #80ff00)'}}></div>
              <span className="text-xs text-gray-500">Open</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 rounded" style={{background: 'linear-gradient(to right, #800000, #ff9900)'}}></div>
              <span className="text-xs text-gray-500">Closed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}