import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface FieldLine {
  points: [number, number, number][];
  strengths: number[];
  polarity: 'open' | 'closed';
}

interface CoronalData {
  metadata: {
    lmax: number;
    r_source: number;
    n_field_lines: number;
  };
  fieldLines: FieldLine[];
}

export default function CoronaViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    animationId: number;
  } | null>(null);
  
  const [coronalData, setCoronalData] = useState<CoronalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [carringtonNumber, setCarringtonNumber] = useState('2240');
  const [currentCR, setCurrentCR] = useState<number | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [showOpen, setShowOpen] = useState(true);
  const [showClosed, setShowClosed] = useState(true);

  // Fetch coronal field data from backend
  const fetchCoronalData = async (crNumber: number) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://localhost:3001/api/coronal/${crNumber}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Coronal data for CR ${crNumber} not found. May need to be computed.`);
        }
        throw new Error(`Failed to fetch coronal data: ${response.statusText}`);
      }
      
      const data = await response.json() as CoronalData;
      setCoronalData(data);
      setCurrentCR(crNumber);
    } catch (err) {
      console.error('Error fetching coronal data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load coronal data');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClick = () => {
    const crNum = parseInt(carringtonNumber);
    if (isNaN(crNum) || crNum < 2096 || crNum > 2285) {
      setError('Please enter a valid Carrington rotation number (2096-2285)');
      return;
    }
    fetchCoronalData(crNum);
  };

  const handleNavigate = (direction: 'next' | 'prev') => {
    if (currentCR === null) return;
    
    const newCR = direction === 'next' ? currentCR + 1 : currentCR - 1;
    
    if (newCR < 2096 || newCR > 2285) return;
    
    setCarringtonNumber(newCR.toString());
    fetchCoronalData(newCR);
  };

  useEffect(() => {
    if (!containerRef.current || !coronalData) return;

    // Clean up previous scene
    if (sceneRef.current) {
      cancelAnimationFrame(sceneRef.current.animationId);
      sceneRef.current.renderer.dispose();
      if (containerRef.current.contains(sceneRef.current.renderer.domElement)) {
        containerRef.current.removeChild(sceneRef.current.renderer.domElement);
      }
    }

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);

    // Add photosphere (Sun surface) as reference
    const photosphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    const photosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3,
      wireframe: false
    });
    const photosphere = new THREE.Mesh(photosphereGeometry, photosphereMaterial);
    scene.add(photosphere);

    // Add source surface (transparent sphere at r=2.5)
    const sourceSurfaceGeometry = new THREE.SphereGeometry(
      coronalData.metadata.r_source,
      64,
      64
    );
    const sourceSurfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0x4444ff,
      transparent: true,
      opacity: 0.05,
      wireframe: true
    });
    const sourceSurface = new THREE.Mesh(sourceSurfaceGeometry, sourceSurfaceMaterial);
    scene.add(sourceSurface);

    // Create field line group
    const fieldLineGroup = new THREE.Group();
    scene.add(fieldLineGroup);

    // Add field lines
    coronalData.fieldLines.forEach((fieldLine) => {
      if (fieldLine.points.length < 2) return;

      const points = fieldLine.points.map(
        ([x, y, z]) => new THREE.Vector3(x, y, z)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      // Color based on polarity
      const color = fieldLine.polarity === 'open' 
        ? new THREE.Color(0x00ff00)  // Green for open
        : new THREE.Color(0xff0000); // Red for closed

      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        linewidth: 1
      });

      const line = new THREE.Line(geometry, material);
      line.userData = { polarity: fieldLine.polarity };
      fieldLineGroup.add(line);
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      scene.rotation.y += deltaX * 0.01;
      scene.rotation.x += deltaY * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Animation loop
    const animate = () => {
      const animationId = requestAnimationFrame(animate);

      if (isRotating && !isDragging) {
        scene.rotation.y += 0.001;
      }

      renderer.render(scene, camera);
      sceneRef.current = { scene, camera, renderer, animationId };
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
    };
  }, [coronalData, isRotating]);

  // Update field line visibility
  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.scene.traverse((obj) => {
      if (obj instanceof THREE.Line && obj.userData.polarity) {
        if (obj.userData.polarity === 'open') {
          obj.visible = showOpen;
        } else if (obj.userData.polarity === 'closed') {
          obj.visible = showClosed;
        }
      }
    });
  }, [showOpen, showClosed]);

  return (
    <div className="w-full h-screen bg-black relative">
      {!coronalData ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <h1 className="text-white text-3xl mb-4">Solar Coronal Magnetic Field</h1>
            <p className="text-gray-400 mb-8">
              Visualize PFSS extrapolation of coronal magnetic fields
            </p>
            
            <div className="bg-black/50 backdrop-blur p-6 rounded-lg">
              <label className="block text-white text-sm mb-2">
                Carrington Rotation Number (2096-2285)
              </label>
              <input
                type="number"
                value={carringtonNumber}
                onChange={(e) => setCarringtonNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFetchClick()}
                min={2096}
                max={2285}
                className="w-full px-4 py-2 bg-white/10 text-white rounded border border-white/20 focus:border-blue-500 focus:outline-none mb-4"
                placeholder="e.g., 2240"
              />
              
              <button
                onClick={handleFetchClick}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Coronal Field'}
              </button>
              
              {error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}
            </div>
            
            <p className="text-gray-500 text-xs mt-6">
              Potential Field Source Surface (PFSS) model
            </p>
          </div>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full h-full" />
          
          <div className="absolute top-6 left-6 bg-black/70 backdrop-blur text-white p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">
              CR {currentCR} - Coronal Field
            </h2>
            <p className="text-xs text-gray-300">lmax: {coronalData.metadata.lmax}</p>
            <p className="text-xs text-gray-300">
              Field lines: {coronalData.metadata.n_field_lines}
            </p>
            <p className="text-xs text-gray-300">
              Source surface: {coronalData.metadata.r_source} R☉
            </p>
          </div>

          <div className="absolute bottom-6 left-6 flex flex-col gap-2">
            {/* Navigation buttons */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={loading || currentCR === null || currentCR <= 2096}
                className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded text-sm hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Prev CR
              </button>
              <button
                onClick={() => handleNavigate('next')}
                disabled={loading || currentCR === null || currentCR >= 2285}
                className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded text-sm hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next CR →
              </button>
            </div>
            
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded text-sm hover:bg-black/90"
            >
              {isRotating ? 'Pause' : 'Rotate'}
            </button>
            <button
              onClick={() => setShowOpen(!showOpen)}
              className={`backdrop-blur text-white px-4 py-2 rounded text-sm ${
                showOpen ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              Open Field Lines
            </button>
            <button
              onClick={() => setShowClosed(!showClosed)}
              className={`backdrop-blur text-white px-4 py-2 rounded text-sm ${
                showClosed ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              Closed Field Lines
            </button>
            <button
              onClick={() => {
                setCoronalData(null);
                setCurrentCR(null);
                setError('');
              }}
              className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded text-sm hover:bg-black/90"
            >
              View Another
            </button>
          </div>

          <div className="absolute bottom-6 right-6 text-gray-400 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span>Open field lines</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span>Closed field lines</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}