import * as THREE from 'three';

export interface ThreeSceneRef {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sphere: THREE.Mesh;
  fieldLineGroup: THREE.Group;
  oldFieldLineGroup: THREE.Group;
  sourceSurface: THREE.Mesh;
  polarityMesh: THREE.Mesh;
  polarityGroup: THREE.Group;
  poleAxesGroup: THREE.Group;
  graticuleGroup: THREE.Group;
  footpointGroup: THREE.Group;
  animationId: number;
  isDragging: boolean;
  pausedForTransition: boolean;
  cameraDistance: number;
}

export interface TransitionRef {
  isTransitioning: boolean;
  startTime: number;
  duration: number;
  oldFieldLines?: any[];
  newFieldLines?: any[];
}

export interface FieldLineTransitionRef {
  isTransitioning: boolean;
  startTime: number;
  duration: number;
}