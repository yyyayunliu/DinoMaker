import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

export function downloadCurrentDinoAsOBJ(root, filename = 'DinoMaker_custom_dinosaur.obj') {
  // OBJ is intentionally static: it preserves the current customized geometry,
  // but not rigging, bones, animation, or procedural material nodes.
  const exporter = new OBJExporter();
  const exportRoot = new THREE.Group();
  exportRoot.name = 'DinoMaker_OBJ_static_export';

  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const mesh = new THREE.Mesh(child.geometry.clone(), child.material);
    mesh.name = child.name || 'dinosaur_part';
    mesh.applyMatrix4(child.matrixWorld);
    exportRoot.add(mesh);
  });

  const objText = exporter.parse(exportRoot);
  exportRoot.traverse((child) => {
    if (child.isMesh) child.geometry.dispose();
  });

  const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
