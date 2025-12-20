interface InputViewProps {
  isFetching: boolean;
  isProcessing: boolean;
  dataSource: string;
  carringtonNumber: string;
  onCarringtonChange: (value: string) => void;
  onCarringtonFetch: () => void;
  fetchError: string;
}

export default function InputView({
  isFetching,
  isProcessing,
  dataSource,
  carringtonNumber,
  onCarringtonChange,
  onCarringtonFetch,
  fetchError
}: InputViewProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-center space-y-8 max-w-md px-6">
        <h1 className="text-3xl font-light text-white tracking-wide">
          Solar Magnetic Field Viewer
        </h1>
        
        <div className="space-y-6">
          {/* Carrington Rotation Input Section */}
          <div className="space-y-3">
            <p className="text-gray-400 text-sm font-light">
              Enter Carrington Rotation Number (2096 - 2285)
            </p>
            
            <div className="flex gap-2">
              <input
                type="number"
                value={carringtonNumber}
                onChange={(e) => onCarringtonChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCarringtonFetch()}
                placeholder="e.g., 2150"
                disabled={isFetching || isProcessing}
                className="flex-1 px-4 py-3 bg-white/10 text-white font-light rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
              />
              <button
                onClick={onCarringtonFetch}
                disabled={isFetching || isProcessing || !carringtonNumber}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-light rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fetch
              </button>
            </div>
            {fetchError && (
              <p className="text-red-400 text-xs font-light">{fetchError}</p>
            )}
          </div>
        </div>

        {(isFetching || isProcessing) && (
          <div className="space-y-3 pt-4">
            {dataSource && (
              <p className="text-gray-400 text-sm font-light">{dataSource}</p>
            )}
            {isFetching && (
              <p className="text-gray-400 text-sm font-light animate-pulse">
                Fetching data...
              </p>
            )}
            {isProcessing && (
              <p className="text-gray-400 text-sm font-light animate-pulse">
                Processing FITS data...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}