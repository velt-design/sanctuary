import { extend } from '@react-three/fiber';
import {
  AmbientLight, BoxGeometry, Color, CubeCamera, CylinderGeometry, DirectionalLight,
  Group, InstancedMesh, Line, LineBasicMaterial, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, PointLight, RingGeometry, ShaderMaterial,
  SphereGeometry, SpotLight,
} from 'three';

// Current scene JSX plus the supported Html, Environment and Lightformer branches.
// Imperatively constructed objects and Drei's own named extensions remain theirs.
export const sceneCatalogue = {
  AmbientLight, BoxGeometry, Color, CubeCamera, CylinderGeometry, DirectionalLight,
  Group, InstancedMesh, Line, LineBasicMaterial, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, PointLight, RingGeometry, ShaderMaterial,
  SphereGeometry, SpotLight,
};

export function registerSceneCatalogue(): void {
  extend(sceneCatalogue);
}
