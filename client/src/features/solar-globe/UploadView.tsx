interface __UploadViewProps__ {
  isUploading: boolean;
  isProcessing: boolean;
  fileName: string;
  uploadProgress: number;
  onUploadClick: () => void;
  carringtonNumber: string;
  onCarringtonChange: (value: string) => void;
  onCarringtonFetch: () => void;
  fetchError: string;
}

export default function UploadView({
  isUploading,
  isProcessing,
  fileName,
  uploadProgress,
  onUploadClick,
  carringtonNumber,
  onCarringtonChange,
  onCarringtonFetch,
  fetchError
}: __UploadViewProps__) {
  const handleCarringtonFetch = () => {
    console.log('🔍 [DEBUG] Fetch button clicked at:', new Date().toISOString());
    console.log('🔍 [DEBUG] Carrington number:', carringtonNumber);
    console.time('⏱️ Total Fetch Duration (UploadView)');
    onCarringtonFetch();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-center space-y-8 max-w-md px-6">
        <h1 className="text-3xl font-light text-white tracking-wide">
          Solar Magnetic Field Viewer
        </h1>
        
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-3">
            <p className="text-gray-400 text-sm font-light">
              Upload a FITS file to visualize solar magnetic field data
            </p>
            
            <button
              onClick={onUploadClick}
              disabled={isUploading || isProcessing}
              className="w-full px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-light rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
            >
              {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Choose FITS File'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black text-gray-500">or</span>
            </div>
          </div>

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
                onKeyDown={(e) => e.key === 'Enter' && handleCarringtonFetch()}
                placeholder="e.g., 2150"
                disabled={isUploading || isProcessing}
                className="flex-1 px-4 py-3 bg-white/10 text-white font-light rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
              />
              <button
                onClick={handleCarringtonFetch}
                disabled={isUploading || isProcessing || !carringtonNumber}
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

        {(isUploading || isProcessing) && (
          <div className="space-y-3 pt-4">
            {fileName && (
              <p className="text-gray-400 text-sm font-light">{fileName}</p>
            )}
            {isUploading && (
              <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-white h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
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