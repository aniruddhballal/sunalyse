import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const ColorShiftingGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    containerRef.current.appendChild(renderer.domElement);

    // Create globe
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Custom shader material for color shifting
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          // Create multiple sine waves for smooth color transitions
          float r = 0.5 + 0.5 * sin(vPosition.y * 3.0 + time * 0.5);
          float g = 0.5 + 0.5 * sin(vPosition.x * 3.0 + time * 0.7 + 2.094);
          float b = 0.5 + 0.5 * sin(vPosition.z * 3.0 + time * 0.3 + 4.189);
          
          // Add some variation based on latitude
          float lat = asin(vPosition.y);
          r += 0.2 * sin(lat * 5.0 + time * 0.4);
          g += 0.2 * sin(lat * 7.0 + time * 0.6);
          b += 0.2 * sin(lat * 6.0 + time * 0.5);
          
          // Normalize colors
          r = clamp(r, 0.0, 1.0);
          g = clamp(g, 0.0, 1.0);
          b = clamp(b, 0.0, 1.0);
          
          // Add subtle lighting effect
          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
          
          gl_FragColor = vec4(r * diff, g * diff, b * diff, 1.0);
        }
      `
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);
      
      timeRef.current += 0.01;
      
      // Slow rotation around Y axis
      globe.rotation.y += 0.001;
      
      // Update shader time uniform for color animation
      material.uniforms.time.value = timeRef.current;
      
      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
        margin: 0,
        padding: 0
      }} 
    />
  );
};

export default ColorShiftingGlobe;