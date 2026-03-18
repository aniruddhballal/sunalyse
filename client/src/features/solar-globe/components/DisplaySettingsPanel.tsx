import { useState, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FITSData {
  min: number;
  max: number;
  width: number;
  height: number;
  [key: string]: any;
}

interface CoronalData {
  fieldLines?: any[];
  [key: string]: any;
}

export interface DisplaySettingsPanelProps {
  // Photosphere
  useFixedScale: boolean;
  setUseFixedScale: (v: boolean) => void;
  fixedMin: string;
  setFixedMin: (v: string) => void;
  fixedMax: string;
  setFixedMax: (v: string) => void;
  fitsData: FITSData | null;
  // View
  show2DMap: boolean;
  setShow2DMap: (v: boolean) => void;
  isRotating: boolean;
  setIsRotating: (v: boolean) => void;
  showGeographicPoles: boolean;
  setShowGeographicPoles: (v: boolean) => void;
  showGraticule: boolean;
  setShowGraticule: (v: boolean) => void;
  // Corona
  coronalData: CoronalData | null;
  isLoadingCoronal: boolean;
  coronalError: string;
  showCoronalLines: boolean;
  showOpenLines: boolean;
  showClosedLines: boolean;
  showSourceSurface: boolean;
  onToggleCoronalLines: () => void;
  onFetchCoronalData: (cr: number) => void;
  setShowOpenLines: (v: boolean) => void;
  setShowClosedLines: (v: boolean) => void;
  setShowSourceSurface: (v: boolean) => void;
  currentCarringtonNumber?: number;
  fieldLineMaxStrength: number;
  setFieldLineMaxStrength: (v: number) => void;
  showPolarity: boolean;
  setShowPolarity: (v: boolean) => void;
  apexMinR: number;
  setApexMinR: (v: number) => void;
  apexMaxR: number;
  setApexMaxR: (v: number) => void;
  showFootpoints: boolean;
  setShowFootpoints: (v: boolean) => void;
  // Details
  dataSource: string;
}

// ─── Primitive UI components ──────────────────────────────────────────────────

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-8 h-[18px] rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-blue-500' : 'bg-gray-600'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-[3px] left-[3px] w-3 h-3 bg-white rounded-full transition-transform duration-200 ${on ? 'translate-x-[14px]' : 'translate-x-0'}`} />
    </button>
  );
}

function ToggleRow({ label, desc, on, onClick }: { label: string; desc?: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2 last:mb-0">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white leading-tight">{label}</div>
        {desc && <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{desc}</div>}
      </div>
      <Toggle on={on} onClick={onClick} />
    </div>
  );
}

function SliderRow({ label, hint, min, max, step, value, onChange, display }: {
  label: string; hint?: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className="text-[10px] text-white font-medium">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-400 cursor-pointer"
      />
      {hint && <div className="text-[10px] text-gray-500 mt-1 leading-snug">{hint}</div>}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-800 my-3" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-gray-500 font-medium mb-2 uppercase tracking-wider">{children}</div>;
}

// ─── Section content ──────────────────────────────────────────────────────────

function ViewSection(p: DisplaySettingsPanelProps) {
  return (
    <div>
      <ToggleRow label="Flat map" desc="See the full Sun at once instead of a 3D globe" on={p.show2DMap} onClick={() => p.setShow2DMap(!p.show2DMap)} />
      <ToggleRow label="Auto-rotate" desc="Slowly spins the globe" on={p.isRotating} onClick={() => p.setIsRotating(!p.isRotating)} />
      <ToggleRow label="Lat/lon grid" desc="30° orientation lines on the surface" on={p.showGraticule} onClick={() => p.setShowGraticule(!p.showGraticule)} />
      <ToggleRow label="Pole markers" desc="Blue/red axis lines at solar north and south poles" on={p.showGeographicPoles} onClick={() => p.setShowGeographicPoles(!p.showGeographicPoles)} />
    </div>
  );
}

function PhotoSection(p: DisplaySettingsPanelProps) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-3 leading-snug">
        Orange/red = field pointing outward · Green = inward · Grey = weak or no field
      </p>
      <ToggleRow
        label="Fixed colour range"
        desc="Lock min/max Gauss so colours stay consistent as you navigate rotations"
        on={p.useFixedScale}
        onClick={() => p.setUseFixedScale(!p.useFixedScale)}
      />
      {p.useFixedScale && (
        <div className="mt-3">
          <Divider />
          <SliderRow
            label="Min (Gauss)" hint="Lower = reveals weaker inward fields in green"
            min={-2000} max={0} step={50}
            value={parseFloat(p.fixedMin) || -500}
            onChange={(v) => p.setFixedMin(String(v))}
            display={p.fixedMin + ' G'}
          />
          <SliderRow
            label="Max (Gauss)" hint="Higher = reveals weaker outward fields in orange"
            min={0} max={2000} step={50}
            value={parseFloat(p.fixedMax) || 500}
            onChange={(v) => p.setFixedMax(String(v))}
            display={p.fixedMax + ' G'}
          />
          <div className="text-[10px] text-blue-400 mt-1">Tip: ±100G reveals subtle quiet-Sun patterns</div>
        </div>
      )}
    </div>
  );
}

function CoronaSection(p: DisplaySettingsPanelProps) {
  const handleLoad = () => {
    if (!p.coronalData && !p.isLoadingCoronal && p.currentCarringtonNumber) {
      p.onFetchCoronalData(p.currentCarringtonNumber);
    } else {
      p.onToggleCoronalLines();
    }
  };

  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-3 leading-snug">
        Magnetic field lines arch above the surface. Closed loops return to the Sun; open lines escape into space as the solar wind.
      </p>
      <button
        onClick={handleLoad}
        disabled={p.isLoadingCoronal}
        className={`w-full text-xs font-light transition-colors px-3 py-2 rounded mb-3 ${
          p.showCoronalLines ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {p.isLoadingCoronal ? 'Loading…' : p.showCoronalLines ? 'Field lines active' : 'Load field lines'}
      </button>
      {p.coronalError && (
        <div className="text-red-400 text-[10px] bg-red-900/20 px-2 py-1.5 rounded mb-3 leading-snug">{p.coronalError}</div>
      )}
      {p.showCoronalLines && p.coronalData && (
        <>
          <SectionLabel>Show / hide</SectionLabel>
          <ToggleRow label="Closed loops" desc="Arching loops rooted at both ends — active region structure" on={p.showClosedLines} onClick={() => p.setShowClosedLines(!p.showClosedLines)} />
          <ToggleRow label="Open field lines" desc="Lines reaching into the solar wind — source of fast wind streams" on={p.showOpenLines} onClick={() => p.setShowOpenLines(!p.showOpenLines)} />
          <ToggleRow label="Source surface" desc="Sphere at 2.5× solar radius where field becomes radial" on={p.showSourceSurface} onClick={() => p.setShowSourceSurface(!p.showSourceSurface)} />
          <ToggleRow label="Polarity surface" desc="Shows which hemisphere the solar wind flows outward vs inward" on={p.showPolarity} onClick={() => p.setShowPolarity(!p.showPolarity)} />
          <ToggleRow label="Loop footpoints" desc="Dots where each loop is anchored on the photosphere" on={p.showFootpoints} onClick={() => p.setShowFootpoints(!p.showFootpoints)} />
          <Divider />
          <SectionLabel>Colour scale</SectionLabel>
          <SliderRow
            label="Field strength ceiling"
            hint="Lower = brighter quiet regions · Higher = only the most intense active regions pop"
            min={50} max={2000} step={50}
            value={p.fieldLineMaxStrength}
            onChange={p.setFieldLineMaxStrength}
            display={p.fieldLineMaxStrength + ' G'}
          />
          <div className="flex items-center gap-2 mt-2 mb-1">
            <div className="flex-1 h-px rounded" style={{ background: 'linear-gradient(to right, #006600, #80ff00)' }} />
            <span className="text-[10px] text-gray-500">Open</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px rounded" style={{ background: 'linear-gradient(to right, #800000, #ff9900)' }} />
            <span className="text-[10px] text-gray-500">Closed</span>
          </div>
          <Divider />
          <SectionLabel>Loop height filter</SectionLabel>
          <SliderRow
            label="Min height"
            min={1.0} max={2.5} step={0.05}
            value={p.apexMinR}
            onChange={(v) => p.setApexMinR(Math.min(v, p.apexMaxR - 0.05))}
            display={p.apexMinR.toFixed(2) + ' Rs'}
          />
          <SliderRow
            label="Max height"
            hint="Rs = solar radii · Min 1.5 Rs = large arches only · Max 1.3 Rs = small active region loops only"
            min={1.0} max={2.5} step={0.05}
            value={p.apexMaxR}
            onChange={(v) => p.setApexMaxR(Math.max(v, p.apexMinR + 0.05))}
            display={p.apexMaxR.toFixed(2) + ' Rs'}
          />
        </>
      )}
    </div>
  );
}

function DetailsSection(p: DisplaySettingsPanelProps) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let dateStr = '—';
  if (p.currentCarringtonNumber !== undefined) {
    const ms = (p.currentCarringtonNumber - 2097) * 27.3 * 24 * 3600 * 1000;
    const d = new Date(Date.UTC(2010, 4, 19) + ms);
    dateStr = `${MONTHS[d.getUTCMonth()]} – ${MONTHS[(d.getUTCMonth() + 1) % 12]} ${d.getUTCFullYear()}`;
  }
  const openCount  = p.coronalData?.fieldLines?.filter((f: any) => f.polarity === 'open').length ?? 0;
  const totalCount = p.coronalData?.fieldLines?.length ?? 0;

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between items-baseline py-1 border-b border-gray-800 last:border-0">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] text-white">{value}</span>
      </div>
    );
  }

  return (
    <div>
      {p.currentCarringtonNumber !== undefined && <Row label="Carrington rotation" value={`CR ${p.currentCarringtonNumber}`} />}
      <Row label="Period" value={dateStr} />
      {p.coronalData && <Row label="Field lines" value={`${totalCount} total · ${openCount} open`} />}
      {p.coronalData && <Row label="lmax" value="85" />}
      {p.fitsData && <Row label="Map size" value={`${p.fitsData.width} × ${p.fitsData.height} px`} />}
      {p.fitsData && <Row label="Br range" value={`${p.fitsData.min.toFixed(0)} – ${p.fitsData.max.toFixed(0)} G`} />}
      <Row label="Data source" value={p.dataSource || 'HMI Synoptic'} />
    </div>
  );
}

// ─── Desktop accordion ────────────────────────────────────────────────────────

type SectionId = 'view' | 'photo' | 'corona' | 'details';

const DOT_COLORS: Record<SectionId, string> = {
  view:    'bg-blue-500',
  photo:   'bg-orange-500',
  corona:  'bg-purple-500',
  details: 'bg-gray-500',
};

function AccordionSection({ id, label, hint, open, onToggle, children }: {
  id: SectionId; label: string; hint: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-800 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[id]}`} />
        <span className="text-xs text-white flex-1">{label}</span>
        <span className="text-[10px] text-gray-500 mr-1">{hint}</span>
        <span className={`text-gray-500 text-[10px] transition-transform duration-200 inline-block ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-3 pb-3 bg-white/[0.02]">{children}</div>}
    </div>
  );
}

function DesktopPanel(p: DisplaySettingsPanelProps) {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({ view: true, photo: false, corona: false, details: false });
  const tog = (id: SectionId) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const viewHint   = p.show2DMap ? 'flat map' : '3D globe';
  const photoHint  = p.useFixedScale ? 'fixed scale' : 'auto scale';
  const coronaHint = p.coronalData ? (p.showCoronalLines ? 'active' : 'loaded') : 'not loaded';
  const crHint     = p.currentCarringtonNumber ? `CR ${p.currentCarringtonNumber}` : '—';

  return (
    <div
      className="absolute top-4 left-4 z-30 pointer-events-auto"
      style={{ width: 224 }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="bg-black/85 border border-gray-800 rounded-xl backdrop-blur overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        <div className="px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
          <span className="text-xs font-medium text-white">Display settings</span>
        </div>
        <div className="overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <AccordionSection id="view"    label="View"         hint={viewHint}   open={open.view}    onToggle={() => tog('view')}>    <ViewSection    {...p} /></AccordionSection>
          <AccordionSection id="photo"   label="Photosphere"  hint={photoHint}  open={open.photo}   onToggle={() => tog('photo')}>   <PhotoSection   {...p} /></AccordionSection>
          <AccordionSection id="corona"  label="Corona"       hint={coronaHint} open={open.corona}  onToggle={() => tog('corona')}>  <CoronaSection  {...p} /></AccordionSection>
          <AccordionSection id="details" label="Details"      hint={crHint}     open={open.details} onToggle={() => tog('details')}> <DetailsSection {...p} /></AccordionSection>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile bottom sheet ──────────────────────────────────────────────────────

// Snap heights — collapsed is 88px to keep the handle above the OS gesture zone
const SNAPS = [88, 216, 376];
type TabId = SectionId;

function MobileSheet(p: DisplaySettingsPanelProps) {
  const [height,   setHeight]   = useState(SNAPS[0]);
  const [snapIdx,  setSnapIdx]  = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('view');
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef(SNAPS[0]);
  const isAnimating = useRef(false);

  const snapTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(2, idx));
    setSnapIdx(clamped);
    isAnimating.current = true;
    setHeight(SNAPS[clamped]);
    setTimeout(() => { isAnimating.current = false; }, 320);
  }, []);

  const onStart = (y: number) => { dragStartY.current = y; dragStartH.current = height; };
  const onMove  = (y: number) => {
    if (dragStartY.current === null) return;
    const delta = dragStartY.current - y;
    setHeight(Math.max(SNAPS[0] - 10, Math.min(SNAPS[2] + 20, dragStartH.current + delta)));
  };
  const onEnd = (y: number) => {
    if (dragStartY.current === null) return;
    const delta = dragStartY.current - y;
    const cur = dragStartH.current + delta;
    let target = snapIdx;
    if (delta >  40) target = Math.min(2, snapIdx + 1);
    else if (delta < -40) target = Math.max(0, snapIdx - 1);
    else target = SNAPS.reduce((best, s, i) => Math.abs(s - cur) < Math.abs(SNAPS[best] - cur) ? i : best, 0);
    dragStartY.current = null;
    snapTo(target);
  };

  const isOpen = snapIdx > 0;

  const TABS: { id: TabId; label: string; dot: string }[] = [
    { id: 'view',    label: 'View',        dot: 'bg-blue-500'   },
    { id: 'photo',   label: 'Photosphere', dot: 'bg-orange-500' },
    { id: 'corona',  label: 'Corona',      dot: 'bg-purple-500' },
    { id: 'details', label: 'Details',     dot: 'bg-gray-500'   },
  ];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto bg-black/90 border-t border-gray-800 backdrop-blur flex flex-col"
      style={{
        height,
        borderRadius: '14px 14px 0 0',
        transition: isAnimating.current ? 'none' : 'height 0.28s cubic-bezier(0.32,0.72,0,1)',
        touchAction: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Drag handle zone */}
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
        onMouseDown={(e) => onStart(e.clientY)}
        onMouseMove={(e) => { if (dragStartY.current !== null) onMove(e.clientY); }}
        onMouseUp={(e)   => onEnd(e.clientY)}
        onMouseLeave={(e) => { if (dragStartY.current !== null) onEnd(e.clientY); }}
        onTouchStart={(e) => onStart(e.touches[0].clientY)}
        onTouchMove={(e)  => onMove(e.touches[0].clientY)}
        onTouchEnd={(e)   => onEnd(e.changedTouches[0].clientY)}
      >
        {/* Pill */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-0.5 rounded-full bg-gray-600" />
        </div>
        {/* Snap position dots */}
        <div className="flex justify-center gap-1 mb-1.5">
          {[0,1,2].map(i => (
            <div key={i} className={`w-1 h-1 rounded-full transition-colors ${i === snapIdx ? 'bg-gray-400' : 'bg-gray-700'}`} />
          ))}
        </div>
        {/* Tab chips */}
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (snapIdx === 0) snapTo(1); }}
              className={`flex items-center gap-1.5 flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                activeTab === tab.id && isOpen
                  ? 'bg-white/10 border-gray-600 text-white'
                  : 'border-gray-700 text-gray-500 bg-transparent'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tab.dot}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1" style={{ scrollbarWidth: 'thin' }}>
          {activeTab === 'view'    && <ViewSection    {...p} />}
          {activeTab === 'photo'   && <PhotoSection   {...p} />}
          {activeTab === 'corona'  && <CoronaSection  {...p} />}
          {activeTab === 'details' && <DetailsSection {...p} />}
        </div>
      )}
    </div>
  );
}

// ─── Root export — picks layout by screen width ───────────────────────────────

export default function DisplaySettingsPanel(p: DisplaySettingsPanelProps) {
  // Read window width directly — avoids a useEffect/useState flash on load
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return isMobile ? <MobileSheet {...p} /> : <DesktopPanel {...p} />;
}