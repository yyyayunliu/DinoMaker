import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// Browser choice: use a procedural Three.js dinosaur instead of running Blender
// logic in the browser. This keeps sliders responsive and makes OBJ export match
// the current settings. The Blender-generated GLB remains in public/models as
// the rigged reference/export asset.

export class DinoGenerator {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Procedural_DinoMaker_Dinosaur';
    this.parts = new Map();
    this.materials = {};
    this.currentParams = null;
    this.meshMode = 'smooth';
    this.rig = null;
  }

  update(params) {
    this.currentParams = { ...params };
    this.root.clear();
    this.parts.clear();
    this.rig = null;
    this.materials = this.createMaterials(params);
    this.createBody(params);
    this.createDetails(params);
    this.root.updateMatrixWorld(true);
  }

  getObject3D() {
    return this.root;
  }

  getParts() {
    return this.parts;
  }

  getRig() {
    return this.rig;
  }

  getMeshMode() {
    return this.meshMode;
  }

  setMeshMode(mode) {
    this.meshMode = mode === 'voxel' ? 'voxel' : 'smooth';
    if (this.currentParams) this.update(this.currentParams);
  }

  createMaterials(params) {
    const scaleTexture = createScaleTexture(params.scale_texture_strength);
    scaleTexture.wrapS = THREE.RepeatWrapping;
    scaleTexture.wrapT = THREE.RepeatWrapping;
    scaleTexture.repeat.set(6, 3);

    const skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.skin_color),
      roughness: 0.86,
      metalness: 0.02,
      bumpMap: scaleTexture,
      bumpScale: params.bump_strength,
    });

    return {
      skin,
      belly: new THREE.MeshStandardMaterial({
        color: new THREE.Color(params.belly_color),
        roughness: 0.9,
        metalness: 0.015,
        bumpMap: scaleTexture,
        bumpScale: params.bump_strength * 0.45,
      }),
      ivory: new THREE.MeshStandardMaterial({ color: 0xe4d4a6, roughness: 0.72, metalness: 0.01 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xf3a32b, roughness: 0.32, metalness: 0.02 }),
      pupil: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x090503, roughness: 0.92 }),
    };
  }

  createBody(params) {
    const bodyGroup = this.partGroup('body');
    bodyGroup.userData.singleSurface = true;
    const pivot = this.p(params, [-0.2, 0, 1.4]);
    bodyGroup.userData.basePosition.copy(pivot);
    bodyGroup.position.copy(pivot);

    const rig = this.createArmature(params, pivot);
    this.rig = rig;
    bodyGroup.userData.rig = rig;
    bodyGroup.add(rig.root);

    if (this.meshMode === 'voxel') {
      bodyGroup.add(this.createVoxelBody(params, pivot, rig));
    } else {
      const skin = this.createShrinkWrappedSkin(params, pivot, rig);
      bodyGroup.add(skin);
      bodyGroup.updateWorldMatrix(true, true);
      skin.bind(rig.skeleton);
    }
  }

  createShrinkWrappedSkin(params, pivot, rig) {
    const primitives = this.createBodyImplicitPrimitives(params);
    const bounds = new THREE.Box3();
    primitives.forEach((primitive) => bounds.union(primitive.bounds));
    const margin = 0.18 * Math.max(params.body_width, params.body_height / 3);
    bounds.expandByScalar(margin);

    const size = bounds.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = bounds.getCenter(new THREE.Vector3());
    const surface = new MarchingCubes(58, this.materials.skin, false, false, 260000);
    surface.name = 'single_shrinkwrapped_dinosaur_body';
    surface.isolation = 0;
    surface.reset();

    // Fill the Marching Cubes field from real primitive distance fields.
    // This is a much tighter shrink-wrap than reciprocal metaballs because
    // each ellipsoid/capsule/cone contributes its actual surface boundary.
    const fieldPoint = new THREE.Vector3();
    const scale = maxDim / 2;
    const blend = 0.055 * Math.max(params.body_width, params.body_height / 3);
    const fieldReach = 0.34 * Math.max(params.body_width, params.body_height / 3);
    primitives.forEach((primitive) => {
      primitive.queryBounds = primitive.bounds.clone().expandByScalar(fieldReach);
    });
    for (let z = 0; z < surface.size; z += 1) {
      fieldPoint.z = center.z + ((z - surface.halfsize) / surface.halfsize) * scale;
      const zOffset = surface.size2 * z;
      for (let y = 0; y < surface.size; y += 1) {
      fieldPoint.y = center.y + ((y - surface.halfsize) / surface.halfsize) * scale;
      const yOffset = zOffset + surface.size * y;
      if (fieldPoint.y < 0.035) {
        for (let x = 0; x < surface.size; x += 1) {
          surface.field[yOffset + x] = -1000;
        }
        continue;
      }
      for (let x = 0; x < surface.size; x += 1) {
          fieldPoint.x = center.x + ((x - surface.halfsize) / surface.halfsize) * scale;
          let value = -1000;
          for (let i = 0; i < primitives.length; i += 1) {
            const primitive = primitives[i];
            const query = primitive.queryBounds;
            if (
              fieldPoint.x < query.min.x || fieldPoint.x > query.max.x ||
              fieldPoint.y < query.min.y || fieldPoint.y > query.max.y ||
              fieldPoint.z < query.min.z || fieldPoint.z > query.max.z
            ) {
              continue;
            }
            const next = primitive.value(fieldPoint);
            value = value <= -999 ? next : smoothMax(value, next, blend);
          }
          surface.field[yOffset + x] = value;
        }
      }
    }

    surface.update();
    const geometry = this.createSkinnedGeometryFromSurface(surface, scale, center, pivot, params, rig);

    const mesh = new THREE.SkinnedMesh(geometry, this.materials.skin);
    mesh.name = 'smooth_rigged_dinosaur_body';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.userData.isSingleShrinkWrappedBody = true;
    return mesh;
  }

  createVoxelBody(params, pivot, rig) {
    const voxelRoot = new THREE.Group();
    voxelRoot.name = 'voxel_box_dinosaur_body';

    const primitives = this.createBodyImplicitPrimitives(params);
    const bounds = new THREE.Box3();
    primitives.forEach((primitive) => bounds.union(primitive.bounds));
    const size = bounds.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = bounds.getCenter(new THREE.Vector3());
    const requested = Number(params.voxel_size) || 0.095;
    const cell = THREE.MathUtils.clamp(maxDim * requested * 0.62, maxDim / 58, maxDim / 28);
    const half = cell * 0.5;
    const blend = 0.035 * Math.max(params.body_width, params.body_height / 3);
    const fieldReach = cell * 1.2;
    primitives.forEach((primitive) => {
      primitive.queryBounds = primitive.bounds.clone().expandByScalar(fieldReach);
    });

    const matricesByBone = new Map();
    const point = new THREE.Vector3();
    for (let x = bounds.min.x; x <= bounds.max.x; x += cell) {
      for (let y = bounds.min.y; y <= bounds.max.y; y += cell) {
        if (y - half < 0.03) continue;
        for (let z = bounds.min.z; z <= bounds.max.z; z += cell) {
          point.set(x, y, z);
          const value = evaluatePrimitiveField(point, primitives, blend);
          if (value < -cell * 0.08) continue;
          if (!this.isSurfaceVoxel(point, primitives, blend, cell)) continue;
          const weights = this.getSkinWeightsForPoint(params, rig, point);
          const boneName = rig.boneList[weights.indices[0]]?.name || 'root';
          const bone = rig.bones[boneName] || rig.root;
          bone.updateWorldMatrix(true, false);
          const matrix = new THREE.Matrix4().makeTranslation(point.x, point.y, point.z);
          matrix.premultiply(new THREE.Matrix4().copy(bone.matrixWorld).invert());
          matrix.scale(new THREE.Vector3(cell * 0.94, cell * 0.94, cell * 0.94));
          if (!matricesByBone.has(bone.name)) matricesByBone.set(bone.name, []);
          matricesByBone.get(bone.name).push(matrix);
        }
      }
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = this.materials.skin.clone();
    material.flatShading = true;
    matricesByBone.forEach((matrices, boneName) => {
      if (matrices.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      mesh.name = `voxel_${boneName}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.isVoxel = true;
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      (rig.bones[boneName] || rig.root).add(mesh);
    });

    voxelRoot.userData.voxelCellSize = cell;
    voxelRoot.userData.voxelCenter = center;
    return voxelRoot;
  }

  isSurfaceVoxel(point, primitives, blend, cell) {
    const offsets = [
      [cell, 0, 0],
      [-cell, 0, 0],
      [0, cell, 0],
      [0, -cell, 0],
      [0, 0, cell],
      [0, 0, -cell],
    ];
    for (let i = 0; i < offsets.length; i += 1) {
      const [x, y, z] = offsets[i];
      const neighbor = new THREE.Vector3(point.x + x, point.y + y, point.z + z);
      if (evaluatePrimitiveField(neighbor, primitives, blend) < 0) return true;
    }
    return false;
  }

  createSkinnedGeometryFromSurface(surface, scale, center, pivot, params, rig) {
    const sourcePosition = surface.geometry.getAttribute('position');
    const sourceNormal = surface.geometry.getAttribute('normal');
    const count = surface.geometry.drawRange.count > 0 ? surface.geometry.drawRange.count : surface.count;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);
    const worldPoint = new THREE.Vector3();

    for (let i = 0; i < count; i += 1) {
      worldPoint
        .fromBufferAttribute(sourcePosition, i)
        .multiplyScalar(scale)
        .add(center);
      positions[i * 3] = worldPoint.x - pivot.x;
      positions[i * 3 + 1] = worldPoint.y - pivot.y;
      positions[i * 3 + 2] = worldPoint.z - pivot.z;

      normals[i * 3] = sourceNormal.getX(i);
      normals[i * 3 + 1] = sourceNormal.getY(i);
      normals[i * 3 + 2] = sourceNormal.getZ(i);

      const weights = this.getSkinWeightsForPoint(params, rig, worldPoint);
      for (let j = 0; j < 4; j += 1) {
        skinIndices[i * 4 + j] = weights.indices[j] || 0;
        skinWeights[i * 4 + j] = weights.weights[j] || 0;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  getSkinWeightsForPoint(params, rig, worldPoint) {
    const sculpt = this.toSculpt(params, worldPoint);
    const side = sculpt.y < 0 ? 'left' : 'right';
    const absSide = Math.abs(sculpt.y);
    let boneNames;

    if (sculpt.x < -2.75) boneNames = ['tail_03'];
    else if (sculpt.x < -1.9) boneNames = ['tail_02', 'tail_03'];
    else if (sculpt.x < -1.16) boneNames = ['tail_01', 'tail_02'];
    else if (sculpt.z < 0.34 && absSide > 0.16) boneNames = sculpt.x > 0.08 ? [`${side}_toe`, `${side}_foot`] : [`${side}_foot`, `${side}_shin`];
    else if (sculpt.z < 0.76 && absSide > 0.2) boneNames = [`${side}_shin`, `${side}_thigh`];
    else if (sculpt.z < 1.22 && absSide > 0.2 && sculpt.x < 0.0) boneNames = sculpt.z > 0.82 ? [`${side}_thigh`, 'root'] : [`${side}_thigh`, `${side}_shin`];
    else if (absSide > 0.36 && sculpt.x > 0.54 && sculpt.x < 1.82 && sculpt.z > 0.82 && sculpt.z < 1.78) {
      boneNames = sculpt.x > 1.2 ? [`${side}_hand`, `${side}_forearm`] : [`${side}_forearm`, `${side}_upper_arm`];
    } else if (sculpt.x > 2.1 && sculpt.z < 2.38) boneNames = ['jaw', 'head'];
    else if (sculpt.x > 1.68) boneNames = ['head', 'neck'];
    else if (sculpt.x > 0.74 && sculpt.z > 1.55) boneNames = ['neck', 'chest'];
    else if (sculpt.x > 0.42) boneNames = ['chest', 'spine_02'];
    else if (sculpt.x > -0.42) boneNames = ['spine_02', 'spine_01'];
    else boneNames = ['root', 'spine_01'];

    const indices = boneNames.map((name) => rig.boneIndex[name] ?? 0);
    const weights = indices.length > 1 ? [0.72, 0.28, 0, 0] : [1, 0, 0, 0];
    return {
      indices: [indices[0] || 0, indices[1] || indices[0] || 0, 0, 0],
      weights,
    };
  }

  createArmature(params, pivot) {
    const bones = {};
    const worldPositions = {};
    const boneList = [];
    const addBone = (name, sculptPosition, parentName = null) => {
      const bone = new THREE.Bone();
      bone.name = name;
      const world = this.p(params, sculptPosition);
      worldPositions[name] = world;
      const parentWorld = parentName ? worldPositions[parentName] : pivot;
      bone.position.copy(world).sub(parentWorld);
      bone.userData.restPosition = bone.position.clone();
      bone.userData.restQuaternion = bone.quaternion.clone();
      bones[name] = bone;
      boneList.push(bone);
      if (parentName) bones[parentName].add(bone);
      return bone;
    };

    const root = addBone('root', [-0.58, 0, 1.2]);
    addBone('spine_01', [-0.1, 0, 1.38], 'root');
    addBone('spine_02', [0.42, 0, 1.55], 'spine_01');
    addBone('chest', [0.82, 0, 1.68], 'spine_02');
    addBone('neck', [1.38, 0, 2.1], 'chest');
    addBone('head', [2.12, 0, 2.48], 'neck');
    addBone('jaw', [2.24, 0, 2.32], 'head');
    addBone('tail_01', [-1.28, 0, 1.14], 'root');
    addBone('tail_02', [-2.32, 0, 0.98], 'tail_01');
    addBone('tail_03', [-3.56, 0, 0.84], 'tail_02');

    [
      ['left', -0.33, -0.56, 0.18],
      ['right', 0.33, -0.96, -0.12],
    ].forEach(([side, sideY, hipX, footShift]) => {
      addBone(`${side}_thigh`, [hipX, sideY, 1.0], 'root');
      addBone(`${side}_shin`, [hipX + 0.2, sideY, 0.58], `${side}_thigh`);
      addBone(`${side}_foot`, [hipX + 0.5, sideY, 0.22], `${side}_shin`);
      addBone(`${side}_toe`, [hipX + 1.3 + footShift, sideY, 0.1], `${side}_foot`);
    });

    [-1, 1].forEach((sideSign) => {
      const side = sideSign < 0 ? 'left' : 'right';
      addBone(`${side}_upper_arm`, [0.72, sideSign * 0.55, 1.48], 'chest');
      addBone(`${side}_forearm`, [1.08, sideSign * 0.62, 1.16], `${side}_upper_arm`);
      addBone(`${side}_hand`, [1.48, sideSign * 0.66, 0.98], `${side}_forearm`);
    });

    const skeleton = new THREE.Skeleton(boneList);
    const boneIndex = Object.fromEntries(boneList.map((bone, index) => [bone.name, index]));
    return { root, bones, boneList, boneIndex, skeleton, worldPositions };
  }

  createBodyImplicitPrimitives(params) {
    const primitives = [];
    const torso = params.torso_length;
    const pelvis = params.pelvis_size;
    const head = params.head_size;
    const jaw = params.jaw_length;
    const tail = params.tail_length;
    const leg = params.leg_length;
    const thigh = params.thigh_thickness;
    const foot = params.foot_size;
    const armLength = params.arm_length;
    const armThickness = params.arm_thickness;

    const addBox = (name, center, size) => {
      const c = this.p(params, center);
      const r = this.s(params, size);
      const bounds = new THREE.Box3(c.clone().sub(r), c.clone().add(r));
      const roundness = Math.min(r.x, r.y, r.z) * 0.08;
      primitives.push({
        name,
        bounds,
        value: (point) => boxField(point, c, r, roundness),
      });
    };

    const addCapsule = (name, start, end, radiusStart, radiusEnd = radiusStart) => {
      const a = this.p(params, start);
      const b = this.p(params, end);
      const r0 = this.scalarRadius(params, radiusStart);
      const r1 = this.scalarRadius(params, radiusEnd);
      const distance = a.distanceTo(b);
      const steps = Math.max(2, Math.ceil(distance / Math.max(r0, r1, 0.05)));
      for (let i = 0; i < steps; i += 1) {
        const t = steps === 1 ? 0 : i / (steps - 1);
        const center = [
          THREE.MathUtils.lerp(start[0], end[0], t),
          THREE.MathUtils.lerp(start[1], end[1], t),
          THREE.MathUtils.lerp(start[2], end[2], t),
        ];
        const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
        addBox(`${name}_block_${i}`, center, [radius, radius, radius]);
      }
    };

    const addCone = (name, start, end, radiusStart, radiusEnd) => {
      const a = this.p(params, start);
      const b = this.p(params, end);
      const r0 = this.scalarRadius(params, radiusStart);
      const r1 = this.scalarRadius(params, radiusEnd);
      const radius = Math.max(r0, r1);
      const bounds = new THREE.Box3().setFromPoints([a, b]).expandByScalar(radius);
      primitives.push({
        name,
        bounds,
        value: (point) => taperedConeField(point, a, b, r0, r1),
      });
    };

    addBox('pelvis_block', [-0.96, 0, 1.26], [0.68 * pelvis, 0.54 * pelvis, 0.52 * pelvis]);
    addBox('torso_block', [-0.12, 0, 1.42], [0.42 * torso, 0.58, 0.6]);
    addBox('chest_block', [0.64, 0, 1.58], [0.68, 0.5, 0.58]);
    addBox('belly_block', [-0.18, 0, 1.12], [0.82, 0.43, 0.34]);
    addCone('tail_cone', [-1.42, 0, 1.24], [-1.42 - 3.1 * tail, 0, 0.82], 0.38 * params.tail_thickness, 0.018);
    addCapsule('neck_bridge', [0.72, 0, 1.74], [1.68, 0, 2.32], 0.31, 0.23);
    addBox('head_block', [2.2, 0, 2.54], [0.62 * head, 0.42 * head, 0.38 * head]);
    addBox('brow_and_cheek_block', [2.42, 0, 2.55], [0.48 * head, 0.38 * head, 0.28 * head]);
    addCapsule('upper_snout', [2.36, 0, 2.48], [3.12, 0, 2.42], 0.28 * jaw, 0.16 * jaw);
    addCapsule('lower_jaw', this.openJawPoint(params, [2.28, 0, 2.27]), this.openJawPoint(params, [3.02, 0, 2.23]), 0.18 * jaw, 0.09 * jaw);
    addCapsule('mouth_corner_bridge', [2.1, 0, 2.36], [2.38, 0, 2.28], 0.2, 0.15);
    [-1, 1].forEach((side) => {
      addCapsule('upper_gum_socket', [2.28, side * 0.2, 2.39], [3.08, side * 0.2, 2.38], 0.052, 0.036);
      addCapsule('lower_gum_socket', this.openJawPoint(params, [2.42, side * 0.2, 2.27]), this.openJawPoint(params, [2.96, side * 0.2, 2.25]), 0.044, 0.032);
      addBox('eye_socket_pad', [2.35, side * 0.38, 2.6], [0.12 * head, 0.042, 0.085 * head]);
    });

    [
      [-0.56, -0.33, 1.08, 0.18],
      [-0.96, 0.33, 1.06, -0.12],
    ].forEach(([hipX, sideY, hipZ, shift]) => {
      addCapsule('thigh', [hipX, sideY, hipZ], [hipX + 0.2, sideY, 0.58], 0.29 * thigh, 0.2 * thigh);
      addCapsule('shin', [hipX + 0.18, sideY, 0.6], [hipX + 0.5, sideY, 0.22], 0.18 * thigh, 0.12);
      addBox('knee_ankle_block', [hipX + 0.16, sideY, 0.58], [0.24 * thigh, 0.2 * thigh, 0.18]);
      const footX = hipX + 0.82 + shift;
      addCapsule('foot_mass', [footX - 0.22, sideY, 0.14], [footX + 0.5 * foot, sideY, 0.11], 0.14 * foot, 0.1 * foot);
      [-0.13, 0, 0.13].forEach((offset) => {
        addCapsule('toe', [footX + 0.34, sideY + offset, 0.12], [footX + 0.67, sideY + offset, 0.09], 0.062 * foot, 0.04 * foot);
        addCapsule('toe_claw_socket', [footX + 0.58, sideY + offset, 0.1], [footX + 0.7, sideY + offset, 0.085], 0.045 * foot, 0.03 * foot);
      });
    });

    [-1, 1].forEach((side) => {
      addBox('shoulder_block', [0.66, side * 0.48, 1.54], [0.22 * armThickness, 0.14 * armThickness, 0.18 * armThickness]);
      addCapsule('upper_arm', [0.66, side * 0.5, 1.5], [0.82 + 0.42 * armLength, side * 0.6, 1.2], 0.16 * armThickness, 0.105 * armThickness);
      addCapsule('forearm', [1.12, side * 0.61, 1.2], [1.44 + 0.16 * armLength, side * 0.66, 0.98], 0.11 * armThickness, 0.072 * armThickness);
      addBox('hand_palm_block', [1.5, side * 0.66, 0.98], [0.13 * armThickness, 0.075 * armThickness, 0.075 * armThickness]);
      [-0.035, 0.035].forEach((offset) => {
        addCapsule('finger', [1.49, side * (0.66 + offset), 0.98], [1.67, side * (0.675 + offset), 0.91], 0.042 * armThickness, 0.028 * armThickness);
        addCapsule('finger_claw_socket', [1.62, side * (0.672 + offset), 0.92], [1.72, side * (0.68 + offset), 0.88], 0.03 * armThickness, 0.018 * armThickness);
      });
    });

    return primitives;
  }

  scalarRadius(params, value) {
    return value * (params.body_width + params.body_height / 3) * 0.5;
  }

  createLeg(params, group, sideName, y, hipX, footShift, leg, thigh, foot) {
    group.add(this.ellipsoid(`${sideName}_thigh`, params, [hipX, y, 0.98], [0.42 * thigh, 0.28 * thigh, 0.66 * leg], this.materials.skin, [0, -22, 0]));
    group.add(this.ellipsoid(`${sideName}_knee`, params, [hipX + 0.18, y, 0.58], [0.28 * thigh, 0.22 * thigh, 0.22 * leg], this.materials.skin));
    group.add(this.cylinderBetween(`${sideName}_shin`, params, [hipX + 0.1, y, 0.66], [hipX + 0.48, y, 0.22], 0.18 * thigh, this.materials.skin, 18));
    group.add(this.ellipsoid(`${sideName}_ankle`, params, [hipX + 0.48, y, 0.24], [0.2, 0.18, 0.15], this.materials.skin));
    const footX = hipX + 0.82 + footShift;
    group.add(this.ellipsoid(`${sideName}_foot`, params, [footX, y, 0.14], [0.58 * foot, 0.22 * foot, 0.13], this.materials.skin));
    [-0.13, 0, 0.13].forEach((offset, index) => {
      group.add(this.ellipsoid(`${sideName}_toe_${index + 1}`, params, [footX + 0.4 * foot, y + offset, 0.12], [0.25 * foot, 0.075 * foot, 0.065], this.materials.skin, [0, -4, 0], 16, 8));
    });
  }

  createArm(params, group, side, armLength, armThickness) {
    const y = side * 0.43;
    group.add(this.cylinderBetween(`upperArm_${side}`, params, [0.72, y, 1.66], [0.72 + 0.36 * armLength, side * 0.48, 1.42], 0.105 * armThickness, this.materials.skin, 14));
    group.add(this.cylinderBetween(`forearm_${side}`, params, [1.08, side * 0.48, 1.42], [1.08 + 0.24 * armLength, side * 0.5, 1.25], 0.075 * armThickness, this.materials.skin, 12));
    [-0.035, 0.035].forEach((offset, index) => {
      group.add(this.cylinderBetween(`finger_${side}_${index + 1}`, params, [1.3, side * (0.5 + offset), 1.25], [1.3 + 0.14 * armLength, side * (0.51 + offset), 1.16], 0.027 * armThickness, this.materials.skin, 10));
    });
  }

  createDetails(params) {
    const body = this.parts.get('body');
    const rig = this.rig;
    const details = new THREE.Group();
    details.name = 'unrigged_detail_fallback';
    if (body) {
      details.position.copy(body.userData.basePosition).multiplyScalar(-1);
      body.add(details);
    } else {
      this.root.add(details);
    }
    const addDetail = (mesh, boneName) => {
      mesh.userData.detailMesh = true;
      mesh.userData.attachedBone = boneName;
      const bone = rig?.bones?.[boneName];
      if (bone && body) {
        this.attachMeshToBone(mesh, bone);
      } else {
        details.add(mesh);
      }
    };
    const toothSize = params.tooth_size;
    const clawSize = params.claw_size;
    const eyeSize = params.eye_size;

    [-1, 1].forEach((side) => {
      const toothY = side * 0.14;
      [2.38, 2.54, 2.7, 2.86, 3.02].forEach((x, index) => {
        addDetail(this.coneBetween(
          `upperTooth_${side}_${index}`,
          params,
          [x, toothY, 2.37],
          [x + 0.03, side * 0.16, 2.2],
          0.034 * toothSize,
          0.002,
          this.materials.ivory,
          10,
        ), 'head');
      });
      [2.48, 2.66, 2.84].forEach((x, index) => {
        addDetail(this.coneBetween(
          `lowerTooth_${side}_${index}`,
          params,
          this.openJawPoint(params, [x, toothY, 2.27]),
          this.openJawPoint(params, [x + 0.02, side * 0.16, 2.39]),
          0.026 * toothSize,
          0.002,
          this.materials.ivory,
          10,
        ), 'jaw');
      });
      addDetail(this.ellipsoid(`eye_${side}`, params, [2.36, side * 0.37, 2.6], [0.092 * eyeSize, 0.04 * eyeSize, 0.068 * eyeSize], this.materials.eye, [0, 0, 0], 16, 8), 'head');
      addDetail(this.ellipsoid(`pupil_${side}`, params, [2.4, side * 0.402, 2.6], [0.034 * eyeSize, 0.014 * eyeSize, 0.04 * eyeSize], this.materials.pupil, [0, 0, 0], 12, 6), 'head');
      addDetail(this.ellipsoid(`nostril_${side}`, params, [3.03, side * 0.168, 2.45], [0.04, 0.014, 0.023], this.materials.dark, [0, 0, 0], 12, 6), 'head');
    });

    [
      ['left', -0.33, -0.56 + 0.82 + 0.18],
      ['right', 0.33, -0.96 + 0.82 - 0.12],
    ].forEach(([name, y, footX]) => {
      [-0.13, 0, 0.13].forEach((offset, index) => {
        addDetail(this.coneBetween(`${name}_toeClaw_${index + 1}`, params, [footX + 0.6, y + offset, 0.1], [footX + 0.83, y + offset, 0.06], 0.048 * clawSize, 0.002, this.materials.ivory, 10), `${name}_toe`);
      });
    });

    [-1, 1].forEach((side) => {
      const sideName = side < 0 ? 'left' : 'right';
      [-0.035, 0.035].forEach((offset, index) => {
        addDetail(this.coneBetween(`fingerClaw_${side}_${index + 1}`, params, [1.62, side * (0.672 + offset), 0.92], [1.78, side * (0.684 + offset), 0.87], 0.028 * clawSize, 0.002, this.materials.ivory, 8), `${sideName}_hand`);
      });
    });
  }

  attachMeshToBone(mesh, bone) {
    this.root.updateWorldMatrix(true, false);
    mesh.updateMatrix();
    bone.updateWorldMatrix(true, false);
    const desiredWorldMatrix = new THREE.Matrix4().multiplyMatrices(this.root.matrixWorld, mesh.matrix);
    const localMatrix = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(desiredWorldMatrix);
    localMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    bone.add(mesh);
  }

  partGroup(name) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.basePosition = new THREE.Vector3();
    this.parts.set(name, group);
    this.root.add(group);
    return group;
  }

  setPivot(group, params, pivot) {
    const worldPivot = this.p(params, pivot);
    group.userData.basePosition.copy(worldPivot);
    group.position.copy(worldPivot);
    group.children.forEach((child) => {
      child.position.sub(worldPivot);
    });
  }

  ellipsoid(name, params, center, size, material, rotation = [0, 0, 0], width = 28, height = 14) {
    const geometry = new THREE.SphereGeometry(1, width, height);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(this.p(params, center));
    mesh.scale.copy(this.s(params, size));
    mesh.rotation.copy(this.eulerFromBlender(rotation));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  cylinderBetween(name, params, start, end, radius, material, radialSegments = 18) {
    const startV = this.p(params, start);
    const endV = this.p(params, end);
    const length = startV.distanceTo(endV);
    const geometry = new THREE.CylinderGeometry(radius * params.body_width, radius * params.body_width, length, radialSegments, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(startV).add(endV).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endV.clone().sub(startV).normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  coneBetween(name, params, start, end, radiusStart, radiusEnd, material, radialSegments = 12) {
    const startV = this.p(params, start);
    const endV = this.p(params, end);
    const length = startV.distanceTo(endV);
    const geometry = new THREE.CylinderGeometry(radiusEnd * params.body_width, radiusStart * params.body_width, length, radialSegments, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(startV).add(endV).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endV.clone().sub(startV).normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  curveTube(name, params, points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map((item) => this.p(params, item)));
    const geometry = new THREE.TubeGeometry(curve, 16, radius * Math.max(params.body_width, 0.8), 8, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    return mesh;
  }

  p(params, [x, y, z]) {
    const sx = params.dinosaur_length / 7;
    const sy = params.body_width;
    const sz = params.body_height / 3;
    return new THREE.Vector3(x * sx, z * sz, y * sy);
  }

  toSculpt(params, point) {
    const sx = params.dinosaur_length / 7;
    const sy = params.body_width;
    const sz = params.body_height / 3;
    return {
      x: point.x / sx,
      y: point.z / sy,
      z: point.y / sz,
    };
  }

  openJawPoint(params, [x, y, z]) {
    const hingeX = 2.22;
    const hingeZ = 2.34;
    const angle = THREE.MathUtils.degToRad(params.jaw_open_angle || 0);
    const dx = x - hingeX;
    const dz = z - hingeZ;
    return [
      hingeX + dx * Math.cos(angle) + dz * Math.sin(angle),
      y,
      hingeZ + dz * Math.cos(angle) - dx * Math.sin(angle),
    ];
  }

  s(params, [x, y, z]) {
    const sx = params.dinosaur_length / 7;
    const sy = params.body_width;
    const sz = params.body_height / 3;
    return new THREE.Vector3(x * sx, z * sz, y * sy);
  }

  eulerFromBlender([x, y, z]) {
    // Blender sculpt coordinates are [forward X, side Y, up Z].
    // Three.js uses Y-up, so Blender rotations map as X -> X, Y -> Z, Z -> Y.
    return new THREE.Euler(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(z),
      THREE.MathUtils.degToRad(y),
      'XYZ',
    );
  }
}

function createScaleTexture(strength) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#777';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const count = 280 + Math.floor(strength * 280);
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(35, 35, 30, ${0.10 + strength * 0.18})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function evaluatePrimitiveField(point, primitives, blend) {
  let value = -1000;
  for (let i = 0; i < primitives.length; i += 1) {
    const primitive = primitives[i];
    const query = primitive.queryBounds;
    if (
      query &&
      (point.x < query.min.x || point.x > query.max.x ||
        point.y < query.min.y || point.y > query.max.y ||
        point.z < query.min.z || point.z > query.max.z)
    ) {
      continue;
    }
    const next = primitive.value(point);
    value = value <= -999 ? next : smoothMax(value, next, blend);
  }
  return value;
}

function boxField(point, center, halfSize, roundness) {
  const qx = Math.abs(point.x - center.x) - Math.max(halfSize.x - roundness, 0.0001);
  const qy = Math.abs(point.y - center.y) - Math.max(halfSize.y - roundness, 0.0001);
  const qz = Math.abs(point.z - center.z) - Math.max(halfSize.z - roundness, 0.0001);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideZ = Math.max(qz, 0);
  const outside = Math.sqrt(outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ);
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return -(outside + inside - roundness);
}

function taperedCapsuleField(point, start, axis, lengthSq, radiusStart, radiusEnd) {
  const px = point.x - start.x;
  const py = point.y - start.y;
  const pz = point.z - start.z;
  const t = THREE.MathUtils.clamp((px * axis.x + py * axis.y + pz * axis.z) / lengthSq, 0, 1);
  const closestX = start.x + axis.x * t;
  const closestY = start.y + axis.y * t;
  const closestZ = start.z + axis.z * t;
  const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  const dz = point.z - closestZ;
  return radius - Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function taperedConeField(point, start, end, radiusStart, radiusEnd) {
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (length <= 0.0001) return -1000;
  const direction = axis.multiplyScalar(1 / length);
  const px = point.x - start.x;
  const py = point.y - start.y;
  const pz = point.z - start.z;
  const along = THREE.MathUtils.clamp(px * direction.x + py * direction.y + pz * direction.z, 0, length);
  const t = along / length;
  const closestX = start.x + direction.x * along;
  const closestY = start.y + direction.y * along;
  const closestZ = start.z + direction.z * along;
  const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  const dz = point.z - closestZ;
  const sideDistance = radius - Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.min(sideDistance, along, length - along);
}

function smoothMax(a, b, k) {
  if (k <= 0) return Math.max(a, b);
  const h = THREE.MathUtils.clamp(0.5 + (b - a) / (2 * k), 0, 1);
  return THREE.MathUtils.lerp(a, b, h) + k * h * (1 - h);
}
