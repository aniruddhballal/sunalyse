import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { CoronalData } from '../hooks/useCoronalFieldLines';

interface CoronalControlsProps {
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
}

export default function CoronalControls({
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
  currentCarringtonNumber
}: CoronalControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCoronalToggle = () => {
    if (!coronalData && !isLoadingCoronal && currentCarringtonNumber) {
      // Fetch coronal data if not already loaded
      onFetchCoronalData(currentCarringtonNumber);
    } else {
      // Just toggle visibility
      onToggleCoronalLines();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 left-1/2 -translate-x-1/2 md:top-4 bg-black/70 backdrop-blur px-3 py-2 rounded-lg text-white z-20 pointer-events-auto hover:bg-black/90 transition-colors flex items-center gap-2"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium">Corona</span>
        <ChevronDown size={16} />
      </button>
    );
  }

  return (
    <div 
      className="absolute top-4 left-1/2 -translate-x-1/2 md:top-4 bg-black/80 border border-gray-800 rounded-lg backdrop-blur z-20 pointer-events-auto p-4"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="flex justify-end items-start mb-3">
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Main Toggle Button */}
        <button
          onClick={handleCoronalToggle}
          disabled={isLoadingCoronal}
          className={`w-full text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
            showCoronalLines 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-gray-800 hover:bg-gray-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoadingCoronal 
            ? 'Loading Coronal Data...' 
            : showCoronalLines 
              ? '✓ Field Lines Active' 
              : 'Load Field Lines'}
        </button>

        {/* Error display */}
        {coronalError && (
          <div className="text-red-400 text-xs bg-red-900/30 backdrop-blur px-3 py-2 rounded">
            {coronalError}
          </div>
        )}

        {/* Line Type Controls - Show when coronal lines are visible */}
        {showCoronalLines && coronalData && (
          <div className="space-y-2 pt-3 border-t border-gray-800">
            <div className="text-xs text-gray-300 mb-2">Line Types</div>
            
            <button
              onClick={() => setShowOpenLines(!showOpenLines)}
              className={`w-full text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                showOpenLines ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {showOpenLines ? '✓' : ''} Open Lines
            </button>
            
            <button
              onClick={() => setShowClosedLines(!showClosedLines)}
              className={`w-full text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                showClosedLines ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {showClosedLines ? '✓' : ''} Closed Lines
            </button>
            
            <button
              onClick={() => setShowSourceSurface(!showSourceSurface)}
              className={`w-full text-white text-sm font-light transition-colors backdrop-blur px-3 py-2 rounded ${
                showSourceSurface ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {showSourceSurface ? '✓' : ''} Source Surface
            </button>
          </div>
        )}
      </div>
    </div>
  );
}