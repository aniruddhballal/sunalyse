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
          </div>
        </div>
      )}
    </div>
  );
}