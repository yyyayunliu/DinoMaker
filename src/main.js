import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DinoGenerator } from './DinoGenerator.js';
import { DinoRigControls } from './DinoRigControls.js';
import { DinoUI } from './UI.js';
import { defaultsFromSchema, loadParameterPayload } from './ParameterSchema.js';
import { downloadCurrentDinoAsOBJ } from './Exporter.js';

const canvas = document.querySelector('#dino-canvas');
const viewport = document.querySelector('.viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.background = null;
scene.fog = null;

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
camera.position.set(4.7, 3.1, 6.1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.55, 0);
controls.minDistance = 1.6;
controls.maxDistance = 44;
controls.maxPolarAngle = Math.PI * 0.54;

const hemi = new THREE.HemisphereLight(0xffffff, 0x53534a, 2.25);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffead1, 3.25);
key.position.set(2.7, 6.3, 3.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 18;
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -3;
scene.add(key);

const rim = new THREE.DirectionalLight(0x9ad7ff, 1.1);
rim.position.set(-5, 3, -4);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.28, transparent: true }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const generator = new DinoGenerator();
scene.add(generator.getObject3D());
const rig = new DinoRigControls(generator);

let params;
let schema;
let glbPreview = null;

init();

async function init() {
  schema = await loadParameterPayload();
  params = defaultsFromSchema(schema);
  generator.update(params);
  fitCamera();

  new DinoUI(schema, params, {
    onChange: (next) => {
      params = { ...next };
      generator.update(params);
      rig.applyRestPose();
    },
    onPlayToggle: (active) => rig.setPlaying(active),
    onModeToggle: (mode) => {
      generator.setMeshMode(mode);
      rig.applyRestPose();
    },
    onDownloadObj: () => downloadCurrentDinoAsOBJ(generator.getObject3D(), 'DinoMaker_custom_dinosaur.obj'),
  });

  loadRiggedReferenceGLB();
  console.info('DinoMaker ready. Sliders update procedural geometry; exported GLB is available as a rigged reference.');
}

function loadRiggedReferenceGLB() {
  const loader = new GLTFLoader();
  loader.load(
    '/models/trex_rigged_walk.glb',
    (gltf) => {
      glbPreview = gltf;
      console.info('Loaded rigged Blender GLB reference:', gltf.animations.map((clip) => clip.name));
    },
    undefined,
    (error) => {
      console.warn('Rigged GLB reference was not loaded; procedural DinoMaker still works.', error);
    },
  );
}

const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta();
  generator.getObject3D().rotation.y += delta * 0.08;
  if (params) rig.update(delta, params);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

const resizeObserver = new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  fitCamera();
});
resizeObserver.observe(viewport);

function fitCamera() {
  const root = generator.getObject3D();
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  controls.target.copy(center);
  controls.target.y = Math.max(center.y, 1.3);

  const direction = new THREE.Vector3(0.62, 0.34, 0.71).normalize();
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const fittingFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max(7.2, sphere.radius / Math.sin(fittingFov / 2) * 1.34);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = 0.01;
  camera.far = 200;
  camera.updateProjectionMatrix();
}

window.dinoMaker = {
  get params() {
    return params;
  },
  get schema() {
    return schema;
  },
  get generator() {
    return generator;
  },
  get riggedReference() {
    return glbPreview;
  },
};
