import { useState } from 'react';
import SolarMagneticFieldGlobe from "../features/solar-globe/SolarMagneticFieldGlobe";
import CoronaViewer from "../features/corona-viewer/CoronaViewer";

function App() {
  const [view, setView] = useState<'photosphere' | 'corona'>('photosphere');

  return (
    <div className="relative w-full h-screen">
      {/* Toggle buttons */}
      <div className="absolute top-6 right-6 z-30 flex gap-2">
        <button
          onClick={() => setView('photosphere')}
          className={`px-4 py-2 rounded text-sm ${
            view === 'photosphere' 
              ? 'bg-blue-600 text-white' 
              : 'bg-black/70 text-white hover:bg-black/90'
          }`}
        >
          Photosphere
        </button>
        <button
          onClick={() => setView('corona')}
          className={`px-4 py-2 rounded text-sm ${
            view === 'corona' 
              ? 'bg-blue-600 text-white' 
              : 'bg-black/70 text-white hover:bg-black/90'
          }`}
        >
          Corona
        </button>
      </div>

      {/* Render selected view */}
      {view === 'photosphere' ? (
        <SolarMagneticFieldGlobe />
      ) : (
        <CoronaViewer />
      )}
    </div>
  );
}

export default App;