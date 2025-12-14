import type { FITSData } from './fitsUtils';
import { Upload } from 'lucide-react';

export default function UploadSection({ isUploading, isProcessing, fitsData, fileName, uploadProgress, onUploadClick }: {
  isUploading: boolean;
  isProcessing: boolean;
  fitsData: FITSData | null;
  fileName: string;
  uploadProgress: number;
  onUploadClick: () => void;
}) {
  if (fitsData) return null;

  if (isProcessing) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-white text-sm font-light">Processing...</div>
      </div>
    );
  }

  if (isUploading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-80 space-y-3">
          <div className="text-white text-sm font-light text-center">{fileName}</div>
          <div className="w-full bg-gray-800 h-1">
            <div
              className="bg-white h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="text-white text-center text-sm font-light">
            {uploadProgress}%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-light text-white tracking-wide">
          Solar Magnetic Field
        </h1>
        <button
          onClick={onUploadClick}
          className="px-8 py-3 bg-white text-black font-medium tracking-wide hover:bg-gray-200 transition-colors flex items-center gap-3 mx-auto"
        >
          <Upload size={18} />
          Upload FITS File
        </button>
      </div>
    </div>
  );
}
