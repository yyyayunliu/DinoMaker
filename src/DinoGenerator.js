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
    this.disposeCurrentModel();
    this.root.clear();
    this.parts.clear();
    this.rig = null;
    this.materials = this.createMaterials(params);
    this.createBody(params);
    this.createDetails(params);
    this.root.updateMatrixWorld(true);
  }

  disposeCurrentModel() {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    this.root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.filter(Boolean).forEach((material) => {
        materials.add(material);
        if (material.map) textures.add(material.map);
        if (material.bumpMap) textures.add(material.bumpMap);
        if (material.normalMap) textures.add(material.normalMap);
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
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
    const bodySkin = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
      bumpMap: scaleTexture,
      bumpScale: params.bump_strength,
    });

    return {
      skin,
      bodySkin,
      belly: new THREE.MeshStandardMaterial({
        color: new THREE.Color(params.belly_color),
        roughness: 0.9,
        metalness: 0.015,
        bumpMap: scaleTexture,
        bumpScale: params.bump_strength * 0.45,
      }),
      ivory: new THREE.MeshStandardMaterial({ color: 0xe4d4a6, roughness: 0.72, metalness: 0.01 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.02 }),
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
    this.validateImplicitConnections(params, primitives);
    const bounds = new THREE.Box3();
    primitives.forEach((primitive) => bounds.union(primitive.bounds));
    const margin = 0.3 * Math.max(params.body_width, params.body_height / 3);
    bounds.expandByScalar(margin);

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fieldScale = size.clone().multiplyScalar(0.5);
    const surface = new MarchingCubes(58, this.materials.skin, false, false, 300000);
    surface.name = 'single_shrinkwrapped_dinosaur_body';
    surface.isolation = 0;
    surface.reset();

    // Fill the Marching Cubes field from real primitive distance fields.
    // This is a much tighter shrink-wrap than reciprocal metaballs because
    // each ellipsoid/capsule/cone contributes its actual surface boundary.
    const fieldPoint = new THREE.Vector3();
    const blend = 0.055 * Math.max(params.body_width, params.body_height / 3);
    const fieldReach = 0.34 * Math.max(params.body_width, params.body_height / 3);
    primitives.forEach((primitive) => {
      primitive.queryBounds = primitive.bounds.clone().expandByScalar(fieldReach);
    });
    const additivePrimitives = primitives.additivePrimitives;
    const subtractivePrimitives = primitives.subtractivePrimitives;
    for (let z = 0; z < surface.size; z += 1) {
      fieldPoint.z = center.z + ((z - surface.halfsize) / surface.halfsize) * fieldScale.z;
      const zOffset = surface.size2 * z;
      for (let y = 0; y < surface.size; y += 1) {
      fieldPoint.y = center.y + ((y - surface.halfsize) / surface.halfsize) * fieldScale.y;
      const yOffset = zOffset + surface.size * y;
      if (fieldPoint.y < 0.035) {
        for (let x = 0; x < surface.size; x += 1) {
          surface.field[yOffset + x] = -1000;
        }
        continue;
      }
      for (let x = 0; x < surface.size; x += 1) {
          fieldPoint.x = center.x + ((x - surface.halfsize) / surface.halfsize) * fieldScale.x;
          let value = -1000;
          for (let i = 0; i < additivePrimitives.length; i += 1) {
            const primitive = additivePrimitives[i];
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
          for (let i = 0; i < subtractivePrimitives.length; i += 1) {
            const primitive = subtractivePrimitives[i];
            const query = primitive.queryBounds;
            if (
              fieldPoint.x < query.min.x || fieldPoint.x > query.max.x ||
              fieldPoint.y < query.min.y || fieldPoint.y > query.max.y ||
              fieldPoint.z < query.min.z || fieldPoint.z > query.max.z
            ) {
              continue;
            }
            value = smoothMin(value, -primitive.value(fieldPoint), blend * 0.35);
          }
          surface.field[yOffset + x] = value;
        }
      }
    }

    surface.update();
    const geometry = this.createSkinnedGeometryFromSurface(surface, fieldScale, center, pivot, params, rig);

    const mesh = new THREE.SkinnedMesh(geometry, this.materials.bodySkin);
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
    this.validateImplicitConnections(params, primitives);
    const bounds = new THREE.Box3();
    primitives.forEach((primitive) => bounds.union(primitive.bounds));
    const size = bounds.getSize(new THREE.Vector3());
    const voxelReferenceDim = Math.max(size.y, size.z, 5.5 * (params.dinosaur_length / 7));
    const center = bounds.getCenter(new THREE.Vector3());
    const requested = Number(params.voxel_size) || 0.095;
    const cell = THREE.MathUtils.clamp(
      voxelReferenceDim * requested * 0.62,
      voxelReferenceDim / 58,
      voxelReferenceDim / 28,
    );
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
          // `point` is in root-local procedural coordinates. Convert it to
          // body-local space and then to the selected bone's rest-local space.
          // Using matrixWorld here would bake the slowly rotating scene root
          // into every voxel and make the voxel body drift away from details.
          const pointInBodySpace = point.clone().sub(pivot);
          const boneInBodySpace = rig.worldPositions[bone.name].clone().sub(pivot);
          const pointInBoneSpace = pointInBodySpace.sub(boneInBodySpace);
          const matrix = new THREE.Matrix4().makeTranslation(
            pointInBoneSpace.x,
            pointInBoneSpace.y,
            pointInBoneSpace.z,
          );
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

    // The very small toe and finger primitives can fall between voxel cells.
    // Add a few body-colored voxel pads on their bones so the appendages stay
    // connected at fine resolutions and claws always have a surface to enter.
    const addBoneVoxelBox = (name, boneName, center, size) => {
      const bone = rig.bones[boneName];
      if (!bone) return;
      const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      block.name = name;
      block.position.copy(this.p(params, center)).sub(rig.worldPositions[boneName]);
      block.scale.copy(this.s(params, size));
      block.castShadow = true;
      block.receiveShadow = true;
      block.userData.isVoxel = true;
      bone.add(block);
    };

    [
      ['left', -0.52, -0.06],
      ['right', 0.52, -0.46],
    ].forEach(([sideName, sideY, footBoneX]) => {
      addBoneVoxelBox(
        `voxel_${sideName}_foot_connector`,
        `${sideName}_foot`,
        [footBoneX, sideY, 0.32],
        [0.55, 0.3, 0.4],
      );
      [-0.13, 0, 0.13].forEach((offset, index) => {
        const padLayout = [
          [0.1, 0.7],
          [0.55, 0.6],
          [0.95, 0.42],
        ][index];
        addBoneVoxelBox(
          `voxel_${sideName}_toe_pad_${index + 1}`,
          `${sideName}_toe`,
          [footBoneX + padLayout[0], sideY + offset, 0.12],
          [padLayout[1], 0.14, 0.12],
        );
      });
    });

    [-1, 1].forEach((side) => {
      const sideName = side < 0 ? 'left' : 'right';
      [-0.035, 0.035].forEach((offset, index) => {
        addBoneVoxelBox(
          `voxel_${sideName}_finger_pad_${index + 1}`,
          `${sideName}_hand`,
          [1.42, side * (0.665 + offset), 0.94],
          [0.32, 0.1, 0.1],
        );
      });
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

  createSkinnedGeometryFromSurface(surface, fieldScale, center, pivot, params, rig) {
    const sourcePosition = surface.geometry.getAttribute('position');
    const sourceNormal = surface.geometry.getAttribute('normal');
    const count = surface.geometry.drawRange.count > 0 ? surface.geometry.drawRange.count : surface.count;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);
    const worldPoint = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const skinColor = new THREE.Color(params.skin_color);
    const bellyColor = new THREE.Color(params.belly_color);
    const vertexColor = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      worldPoint
        .fromBufferAttribute(sourcePosition, i)
        .multiply(fieldScale)
        .add(center);
      positions[i * 3] = worldPoint.x - pivot.x;
      positions[i * 3 + 1] = worldPoint.y - pivot.y;
      positions[i * 3 + 2] = worldPoint.z - pivot.z;

      worldNormal
        .fromBufferAttribute(sourceNormal, i)
        .set(
          worldNormal.x / fieldScale.x,
          worldNormal.y / fieldScale.y,
          worldNormal.z / fieldScale.z,
        )
        .normalize();
      normals[i * 3] = worldNormal.x;
      normals[i * 3 + 1] = worldNormal.y;
      normals[i * 3 + 2] = worldNormal.z;

      const sculpt = this.toSculpt(params, worldPoint);
      const verticalBlend = 1 - THREE.MathUtils.smoothstep(sculpt.z, 0.82, 1.38);
      const centerBlend = 1 - THREE.MathUtils.smoothstep(Math.abs(sculpt.y), 0.34, 0.68);
      const lengthBlend = THREE.MathUtils.smoothstep(sculpt.x, -1.3, 1.1);
      const bellyWeight = THREE.MathUtils.clamp(verticalBlend * centerBlend * lengthBlend, 0, 1);
      vertexColor.copy(skinColor).lerp(bellyColor, bellyWeight);
      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;

      const weights = this.getSkinWeightsForPoint(params, rig, worldPoint);
      for (let j = 0; j < 4; j += 1) {
        skinIndices[i * 4 + j] = weights.indices[j] || 0;
        skinWeights[i * 4 + j] = weights.weights[j] || 0;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  getSkinWeightsForPoint(params, rig, worldPoint) {
    const sculpt = this.toSculpt(params, worldPoint);
    const headLayout = this.headLayout(params);
    const closedJaw = this.closeJawPoint(params, [sculpt.x, sculpt.y, sculpt.z]);
    const side = sculpt.y < 0 ? 'left' : 'right';
    const absSide = Math.abs(sculpt.y);
    const hipX = side === 'left' ? -0.56 : -0.96;
    const inJawRegion = (
      closedJaw[0] > headLayout.rearX - 0.12 * params.head_size &&
      closedJaw[0] < headLayout.frontX + 0.12 * params.head_size &&
      Math.abs(closedJaw[1]) < headLayout.jawHalfWidth + 0.08 * params.head_size &&
      Math.abs(closedJaw[2] - headLayout.jawCenterZ) < headLayout.jawHalfHeight + 0.1 * params.head_size
    );
    const inUpperHeadRegion = (
      sculpt.x > headLayout.rearX - 0.12 * params.head_size &&
      sculpt.x < headLayout.frontX + 0.12 * params.head_size &&
      absSide < headLayout.upperHalfWidth + 0.1 * params.head_size &&
      sculpt.z > headLayout.upperBottomZ - 0.1 * params.head_size &&
      sculpt.z < headLayout.neckTopZ + 0.1 * params.head_size
    );
    const inLegRegion = (
      absSide > 0.2 &&
      sculpt.x > hipX - 0.68 &&
      sculpt.x < hipX + 1.55 &&
      sculpt.z < 1.38
    );
    let boneNames;

    // The two skull boxes use one rigid bone each. Classifying the lower jaw
    // in its closed local frame prevents a wide-open jaw from being mistaken
    // for a foot simply because its vertices have moved near the ground.
    if (inJawRegion) boneNames = ['jaw'];
    else if (inUpperHeadRegion) boneNames = ['head'];
    else if (sculpt.z < 0.34 && inLegRegion) boneNames = sculpt.x > hipX + 0.62 ? [`${side}_toe`, `${side}_foot`] : [`${side}_foot`, `${side}_shin`];
    else if (sculpt.z < 0.78 && inLegRegion) boneNames = [`${side}_shin`, `${side}_thigh`];
    else if (inLegRegion) boneNames = sculpt.z > 0.82 ? [`${side}_thigh`, 'root'] : [`${side}_thigh`, `${side}_shin`];
    else if (absSide > 0.36 && sculpt.x > 0.54 && sculpt.x < 1.82 && sculpt.z > 0.82 && sculpt.z < 1.78) {
      boneNames = sculpt.x > 1.2 ? [`${side}_hand`, `${side}_forearm`] : [`${side}_forearm`, `${side}_upper_arm`];
    } else if (sculpt.x < -2.75) boneNames = ['tail_03'];
    else if (sculpt.x < -1.9) boneNames = ['tail_02', 'tail_03'];
    else if (sculpt.x < -1.55) boneNames = ['tail_01', 'tail_02'];
    else if (sculpt.x < -1.12) boneNames = ['root', 'tail_01'];
    else if (sculpt.x > 1.68) boneNames = ['head', 'neck'];
    else if (sculpt.x > 0.74 && sculpt.z > 1.55) boneNames = ['neck', 'chest'];
    else if (sculpt.x > 0.42) boneNames = ['chest', 'spine_02'];
    else if (sculpt.x > -0.42) boneNames = ['spine_02', 'spine_01'];
    else boneNames = ['root', 'spine_01'];

    const indices = boneNames.map((name) => rig.boneIndex[name] ?? 0);
    const weights = indices.length > 1 ? [0.72, 0.28, 0, 0] : [1, 0, 0, 0];
    const primaryIndex = indices[0] ?? 0;
    const secondaryIndex = indices.length > 1 ? indices[1] : primaryIndex;
    return {
      indices: [primaryIndex, secondaryIndex, 0, 0],
      weights,
    };
  }

  createArmature(params, pivot) {
    const headLayout = this.headLayout(params);
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
    addBone('head', [headLayout.eyeX, 0, headLayout.upperCenterZ], 'neck');
    addBone('jaw', [headLayout.jawHingeX, 0, headLayout.jawHingeZ], 'head');
    addBone('tail_01', [-1.28, 0, 1.14], 'root');
    addBone('tail_02', [-2.32, 0, 0.98], 'tail_01');
    addBone('tail_03', [-3.56, 0, 0.84], 'tail_02');

    [
      ['left', -0.52, -0.56, 0.18],
      ['right', 0.52, -0.96, -0.12],
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
    const torso = params.torso_length * 1.35;
    const pelvis = params.pelvis_size;
    const head = params.head_size;
    const headLayout = this.headLayout(params);
    const jaw = params.jaw_length;
    const tail = params.tail_length;
    const neckFactor = this.neckFactor(params);
    const leg = params.leg_length;
    const thigh = params.thigh_thickness * 1.2;
    const foot = params.foot_size * 1.2;
    const armLength = params.arm_length;
    const armThickness = params.arm_thickness * 0.8;

    const addBox = (name, center, size, roundnessRatio = 0.08) => {
      const c = this.p(params, center);
      const r = this.s(params, size);
      const bounds = new THREE.Box3(c.clone().sub(r), c.clone().add(r));
      const roundness = Math.min(r.x, r.y, r.z) * roundnessRatio;
      primitives.push({
        name,
        bounds,
        value: (point) => boxField(point, c, r, roundness),
      });
    };

    const addEllipsoid = (name, center, radii) => {
      const c = this.p(params, center);
      const r = this.s(params, radii);
      const bounds = new THREE.Box3(c.clone().sub(r), c.clone().add(r));
      primitives.push({
        name,
        bounds,
        value: (point) => ellipsoidField(point, c, r),
      });
    };

    const addSubtractiveEllipsoid = (name, center, radii) => {
      const c = this.p(params, center);
      const r = this.s(params, radii);
      const bounds = new THREE.Box3(c.clone().sub(r), c.clone().add(r));
      primitives.push({
        name,
        operation: 'subtract',
        bounds,
        value: (point) => ellipsoidField(point, c, r),
      });
    };

    const addOrientedBoxBetween = (name, start, end, halfWidth, halfHeight, roundnessRatio = 0.2) => {
      const a = this.p(params, start);
      const b = this.p(params, end);
      const center = a.clone().add(b).multiplyScalar(0.5);
      const forward = b.clone().sub(a).normalize();
      const side = new THREE.Vector3(0, 0, 1);
      const up = side.clone().cross(forward).normalize();
      const halfSize = new THREE.Vector3(
        a.distanceTo(b) * 0.5,
        halfHeight * (params.body_height / 3),
        halfWidth * params.body_width,
      );
      const roundness = Math.min(halfSize.x, halfSize.y, halfSize.z) * roundnessRatio;
      const radius = Math.max(halfSize.y, halfSize.z) + roundness;
      const bounds = new THREE.Box3().setFromPoints([a, b]).expandByScalar(radius);
      primitives.push({
        name,
        bounds,
        value: (point) => orientedBoxField(point, center, forward, up, side, halfSize, roundness),
      });
    };

    // Limb and body volumes use overlapping sphere fields. This keeps the
    // shrinkwrap organic instead of preserving box corners.
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
        addEllipsoid(`${name}_sphere_${i}`, center, [radius, radius, radius]);
      }
    };

    // The neck is a real cylinder-style field with capped ends, rather than
    // a stack of boxes. It still blends into the sphere-based torso and head.
    const addCylinder = (name, start, end, radiusStart, radiusEnd = radiusStart) => {
      const a = this.p(params, start);
      const b = this.p(params, end);
      const axis = new THREE.Vector3().subVectors(b, a);
      const length = axis.length();
      const r0 = this.scalarRadius(params, radiusStart);
      const r1 = this.scalarRadius(params, radiusEnd);
      const radius = Math.max(r0, r1);
      const bounds = new THREE.Box3().setFromPoints([a, b]).expandByScalar(radius);
      primitives.push({
        name,
        bounds,
        value: (point) => taperedCapsuleField(point, a, axis, length * length, r0, r1),
      });
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

    addEllipsoid('pelvis_sphere', [-0.96, 0, 1.26], [0.68 * pelvis, 0.54 * pelvis, 0.52 * pelvis]);
    addEllipsoid('torso_sphere', [-0.12, 0, 1.42], [0.42 * torso, 0.58, 0.6]);
    addEllipsoid('chest_sphere', [0.64, 0, 1.58], [0.68, 0.5, 0.58]);
    addEllipsoid('belly_sphere', [-0.18, 0, 1.12], [0.82, 0.43, 0.34]);
    // One tapered, rounded base begins inside the pelvis and exits behind it.
    // This avoids the layered filler surfaces that made the junction messy.
    addCylinder(
      'tail_base',
      [-0.98, 0, 1.27],
      [-2.16, 0, 1.12],
      0.58 * params.tail_thickness,
      0.35 * params.tail_thickness,
    );
    addCone(
      'tail_cone',
      [-1.98, 0, 1.15],
      [-1.42 - 4.9 * tail, 0, 0.72],
      0.37 * params.tail_thickness,
      0.004,
    );
    addCylinder(
      'neck_cylinder',
      [0.72, 0, 1.74],
      [0.72 + 0.96 * neckFactor, 0, 1.74 + 0.58 * neckFactor],
      0.465,
      0.345,
    );
    // The skull is deliberately built from two main boxes: a single rounded
    // upper head and a substantial lower jaw. Both enter the same implicit
    // surface, while the jaw endpoints rotate around the rig hinge.
    addBox(
      'upper_head_box',
      [headLayout.upperCenterX, 0, headLayout.upperCenterZ],
      [headLayout.upperHalfLength, headLayout.upperHalfWidth, headLayout.upperHalfHeight],
      0.34,
    );
    addOrientedBoxBetween(
      'lower_jaw_box',
      this.openJawPoint(params, [headLayout.rearX, 0, headLayout.jawCenterZ]),
      this.openJawPoint(params, [headLayout.frontX, 0, headLayout.jawCenterZ]),
      headLayout.jawHalfWidth,
      headLayout.jawHalfHeight,
      0.28,
    );
    if (this.meshMode !== 'voxel') {
      addCapsule(
        'mouth_corner_bridge',
        [headLayout.jawHingeX - 0.16 * head, 0, headLayout.jawHingeZ],
        this.openJawPoint(params, [headLayout.jawHingeX + 0.1 * head, 0, headLayout.jawCenterZ]),
        0.14,
        0.11,
      );
    }
    [-1, 1].forEach((side) => {
      addCapsule(
        'jaw_hinge_bridge',
        [headLayout.jawHingeX - 0.14 * head, side * 0.26 * head, headLayout.jawHingeZ],
        this.openJawPoint(params, [headLayout.jawHingeX + 0.14 * head, side * 0.26 * head, headLayout.jawCenterZ]),
        0.12 * jaw,
        0.085 * jaw,
      );
      if (this.meshMode !== 'voxel') {
        addCapsule('upper_gum_socket', [headLayout.toothStartX, side * 0.245 * head, headLayout.upperBottomZ], [headLayout.toothEndX, side * 0.245 * head, headLayout.upperBottomZ], 0.03, 0.022);
        addCapsule('lower_gum_socket', this.openJawPoint(params, [headLayout.toothStartX, side * 0.245 * head, headLayout.jawTopZ]), this.openJawPoint(params, [headLayout.toothEndX, side * 0.245 * head, headLayout.jawTopZ]), 0.026, 0.018);
      }
      addBox('eye_brow_pad', [headLayout.eyeX, side * 0.335 * head, headLayout.eyeZ], [0.18 * head, 0.04, 0.11 * head], 0.35);
      addSubtractiveEllipsoid('eye_recess', [headLayout.eyeX, side * 0.365 * head, headLayout.eyeZ], [0.16 * head, 0.1 * head, 0.09 * head]);
      addSubtractiveEllipsoid(
        'nostril_recess',
        [headLayout.nostrilX, side * 0.345 * head, headLayout.nostrilZ],
        [0.095 * head, 0.075 * head, 0.07 * head],
      );
    });

    [
      [-0.56, -0.52, 1.08, 0.18],
      [-0.96, 0.52, 1.06, -0.12],
    ].forEach(([hipX, sideY, hipZ, shift]) => {
      // Start every leg well inside the pelvis, then flare outward to the
      // side. This leaves a thick connected hip even at minimum slider sizes.
      addCapsule('hip_bridge', [hipX, sideY * 0.35, hipZ + 0.12], [hipX, sideY, hipZ], 0.42 * thigh, 0.34 * thigh);
      addEllipsoid('hip_socket', [hipX, sideY * 0.72, hipZ + 0.03], [0.4 * thigh, 0.36 * thigh, 0.38 * thigh]);
      addCapsule('thigh', [hipX, sideY, hipZ], [hipX + 0.2, sideY, 0.58], 0.35 * thigh, 0.22 * thigh);
      addCapsule('shin', [hipX + 0.18, sideY, 0.6], [hipX + 0.5, sideY, 0.22], 0.18 * thigh, 0.12);
      addBox('knee_ankle_block', [hipX + 0.16, sideY, 0.58], [0.24 * thigh, 0.2 * thigh, 0.18]);
      const footX = hipX + 0.82 + shift;
      addCapsule(
        'ankle_foot_bridge',
        [hipX + 0.42, sideY, 0.3],
        [footX + 0.08, sideY, 0.14],
        0.18 * thigh,
        0.15 * foot,
      );
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

    primitives.additivePrimitives = primitives.filter((primitive) => primitive.operation !== 'subtract');
    primitives.subtractivePrimitives = primitives.filter((primitive) => primitive.operation === 'subtract');
    return primitives;
  }

  validateImplicitConnections(params, primitives) {
    const headLayout = this.headLayout(params);
    const tailNearTipX = -1.42 - 4.9 * params.tail_length + 0.18;
    const checks = [
      ['left hip', [-0.56, -0.36, 1.14]],
      ['right hip', [-0.96, 0.36, 1.12]],
      ['left ankle bridge', [0.19, -0.52, 0.22]],
      ['right ankle bridge', [-0.36, 0.52, 0.22]],
      ['tail root', [-1.48, 0, 1.25]],
      ['left tail shoulder', [-1.38, -0.3 * params.tail_thickness, 1.24]],
      ['right tail shoulder', [-1.38, 0.3 * params.tail_thickness, 1.24]],
      ['upper tail shoulder', [-1.38, 0, 1.27 + 0.24 * params.tail_thickness]],
      ['neck root', [0.78, 0, 1.78]],
      ['head front', [headLayout.frontX - 0.1 * params.head_size, 0, headLayout.upperCenterZ]],
      ['lower jaw center', this.openJawPoint(params, [
        (headLayout.rearX + headLayout.frontX) * 0.5,
        0,
        headLayout.jawCenterZ,
      ])],
      ['tail near tip', [tailNearTipX, 0, 0.73]],
    ];
    const failed = checks
      .filter(([, sculptPoint]) => evaluatePrimitiveField(this.p(params, sculptPoint), primitives, 0) < 0)
      .map(([name]) => name);
    const recessFailed = [-1, 1]
      .filter((side) => evaluatePrimitiveField(this.p(params, [headLayout.eyeX, side * 0.365 * params.head_size, headLayout.eyeZ]), primitives, 0) >= 0)
      .map((side) => side < 0 ? 'left eye recess' : 'right eye recess');
    const nostrilFailed = [-1, 1]
      .filter((side) => evaluatePrimitiveField(
        this.p(params, [headLayout.nostrilX, side * 0.345 * params.head_size, headLayout.nostrilZ]),
        primitives,
        0,
      ) >= 0)
      .map((side) => side < 0 ? 'left nostril recess' : 'right nostril recess');
    const headTopDelta = Math.abs(
      headLayout.neckTopZ - (headLayout.upperCenterZ + headLayout.upperHalfHeight)
    );
    const lowerJawStart = this.p(params, this.openJawPoint(params, [
      headLayout.rearX,
      0,
      headLayout.jawCenterZ,
    ]));
    const lowerJawEnd = this.p(params, this.openJawPoint(params, [
      headLayout.frontX,
      0,
      headLayout.jawCenterZ,
    ]));
    const upperHeadLength = (headLayout.frontX - headLayout.rearX) * (params.dinosaur_length / 7);
    const jawLengthDelta = Math.abs(lowerJawStart.distanceTo(lowerJawEnd) - upperHeadLength);
    const result = {
      passed: failed.length === 0 && recessFailed.length === 0 && nostrilFailed.length === 0 && headTopDelta < 0.0001 && jawLengthDelta < 0.0001,
      failed,
      recessFailed,
      nostrilFailed,
      headTopDelta,
      jawLengthDelta,
    };
    this.root.userData.connectionValidation = result;
    if (!result.passed) console.warn('DinoMaker geometry validation failed:', result);
    return result;
  }

  scalarRadius(params, value) {
    return value * (params.body_width + params.body_height / 3) * 0.5;
  }

  headLayout(params) {
    const head = Math.max(Number(params.head_size) || 1, 0.1);
    const jaw = Math.max(Number(params.jaw_length) || 1, 0.1);
    const rearX = 1.42;
    // The previous head was 1.96 sculpt units long. A 2.94-unit baseline is
    // exactly 1.5 times longer; jaw length gently adjusts only the snout.
    const length = 2.94 * head * (0.78 + 0.22 * jaw);
    const frontX = rearX + length;
    const neckFactor = this.neckFactor(params);
    const verticalScale = Math.max(params.body_height / 3, 0.001);
    const neckTopZ = 1.74 + 0.58 * neckFactor + this.scalarRadius(params, 0.345) / verticalScale;
    const upperHalfHeight = 0.235 * head * 1.2;
    const upperBottomZ = neckTopZ - upperHalfHeight * 2;
    const jawHalfHeight = 0.145 * head * jaw * 0.8;
    const jawTopZ = upperBottomZ + 0.04 * head;
    return {
      rearX,
      frontX,
      eyeX: rearX + length * 0.25,
      nostrilX: rearX + length * 0.82,
      jawHingeX: rearX + length * 0.08,
      jawHingeZ: upperBottomZ + 0.06 * head,
      toothStartX: rearX + length * 0.48,
      toothEndX: rearX + length * 0.9,
      upperCenterX: (rearX + frontX) * 0.5,
      upperHalfLength: length * 0.5,
      upperHalfWidth: 0.36 * head,
      neckTopZ,
      upperCenterZ: neckTopZ - upperHalfHeight,
      upperHalfHeight,
      upperBottomZ,
      eyeZ: neckTopZ - 0.14 * head,
      nostrilZ: neckTopZ - 0.23 * head,
      jawCenterZ: jawTopZ - jawHalfHeight,
      jawHalfHeight,
      jawHalfWidth: 0.255 * head,
      jawTopZ,
    };
  }

  neckFactor(params) {
    const normalized = Math.max(Number(params.neck_length) || 0.95, 0.1) / 0.95;
    // The control spans 0.1 to 10, but the visible anatomy stays editable
    // instead of becoming impossibly long at the upper end of the range.
    return THREE.MathUtils.clamp(Math.pow(normalized, 0.25), 0.75, 1.8);
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
    const head = params.head_size;
    const headLayout = this.headLayout(params);
    const detailConeBetween = (...args) => (
      this.meshMode === 'voxel' ? this.voxelTaperBetween(...args) : this.coneBetween(...args)
    );
    const addVoxelSocket = (name, center, size, boneName) => {
      if (this.meshMode !== 'voxel') return;
      addDetail(this.boxDetail(name, params, center, size, this.materials.skin), boneName);
    };

    [-1, 1].forEach((side) => {
      // Roots are inset toward the mouth centerline. The crowns remain visible
      // through the opening, but no longer hang from the outer cheek surface.
      const toothY = side * 0.255 * head;
      evenlySpaced(headLayout.toothStartX, headLayout.toothEndX, 7).forEach((x, index) => {
        addDetail(detailConeBetween(
          `upperTooth_${side}_${index}`,
          params,
          [x, toothY, headLayout.upperBottomZ + 0.035 * head],
          [x + 0.02, side * 0.265 * head, headLayout.upperBottomZ - 0.13 * toothSize],
          0.038 * toothSize,
          0.002,
          this.materials.ivory,
          10,
        ), 'head');
      });
      evenlySpaced(headLayout.toothStartX + 0.08 * head, headLayout.toothEndX - 0.04 * head, 5).forEach((x, index) => {
        addDetail(detailConeBetween(
          `lowerTooth_${side}_${index}`,
          params,
          this.openJawPoint(params, [x, toothY, headLayout.jawTopZ - 0.025 * head]),
          this.openJawPoint(params, [x + 0.02, side * 0.265 * head, headLayout.jawTopZ + 0.1 * toothSize]),
          0.026 * toothSize,
          0.002,
          this.materials.ivory,
          10,
        ), 'jaw');
      });
      // Smooth mode uses true world-space spheres, so body proportions cannot
      // stretch the white of the eye or its circular black pupil.
      if (this.meshMode === 'voxel') {
        addDetail(this.boxDetail(`eye_${side}`, params, [headLayout.eyeX, side * 0.345 * head, headLayout.eyeZ], [0.11 * eyeSize, 0.055 * eyeSize, 0.075 * eyeSize], this.materials.eye), 'head');
        addDetail(this.boxDetail(`pupil_${side}`, params, [headLayout.eyeX + 0.03, side * 0.405 * head, headLayout.eyeZ], [0.045 * eyeSize, 0.018 * eyeSize, 0.04 * eyeSize], this.materials.pupil), 'head');
      } else {
        addDetail(this.sphereDetail(`eye_${side}`, params, [headLayout.eyeX, side * 0.345 * head, headLayout.eyeZ], 0.068 * eyeSize, this.materials.eye, 24), 'head');
        addDetail(this.sphereDetail(`pupil_${side}`, params, [headLayout.eyeX + 0.03, side * 0.405 * head, headLayout.eyeZ], 0.028 * eyeSize, this.materials.pupil, 20), 'head');
      }
    });

    [
      ['left', -0.52, -0.56 + 0.82 + 0.18],
      ['right', 0.52, -0.96 + 0.82 - 0.12],
    ].forEach(([name, y, footX]) => {
      [-0.13, 0, 0.13].forEach((offset, index) => {
        addVoxelSocket(`${name}_toe_socket_${index + 1}`, [footX + 0.53, y + offset, 0.12], [0.18, 0.11, 0.075], `${name}_toe`);
        addDetail(detailConeBetween(`${name}_toeClaw_${index + 1}`, params, [footX + 0.56, y + offset, 0.12], [footX + 1.04, y + offset, 0.035], 0.062 * clawSize, 0.002, this.materials.ivory, 10), `${name}_toe`);
      });
    });

    [-1, 1].forEach((side) => {
      const sideName = side < 0 ? 'left' : 'right';
      [-0.035, 0.035].forEach((offset, index) => {
        addVoxelSocket(`finger_socket_${side}_${index + 1}`, [1.55, side * (0.64 + offset), 0.95], [0.14, 0.1, 0.09], `${sideName}_hand`);
        addDetail(detailConeBetween(`fingerClaw_${side}_${index + 1}`, params, [1.62, side * (0.66 + offset), 0.93], [2.02, side * (0.705 + offset), 0.82], 0.045 * clawSize, 0.002, this.materials.ivory, 8), `${sideName}_hand`);
      });
    });
  }

  attachMeshToBone(mesh, bone) {
    // All procedural coordinates are root-local [forward, up, side] values.
    // The rig is created in the same rest space, so subtracting the bone's
    // rest position avoids mixing body-pivot and world matrices. Once parented,
    // the detail follows that bone during every walk pose in both mesh modes.
    const boneRestPosition = this.rig?.worldPositions?.[bone.name];
    if (boneRestPosition) {
      mesh.position.sub(boneRestPosition);
    }
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

  sphereDetail(name, params, center, radius, material, segments = 24) {
    const worldRadius = this.scalarRadius(params, radius);
    const geometry = new THREE.SphereGeometry(worldRadius, segments, Math.max(12, Math.floor(segments / 2)));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(this.p(params, center));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  boxDetail(name, params, center, size, material, rotation = [0, 0, 0]) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
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

  voxelTaperBetween(name, params, start, end, radiusStart, radiusEnd, material) {
    const startV = this.p(params, start);
    const endV = this.p(params, end);
    const length = startV.distanceTo(endV);
    const group = new THREE.Group();
    group.name = name;
    group.position.copy(startV).add(endV).multiplyScalar(0.5);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endV.clone().sub(startV).normalize());

    const steps = 3;
    const minWidth = Math.max(params.body_width, params.body_height / 3) * 0.025;
    for (let i = 0; i < steps; i += 1) {
      const t = steps === 1 ? 0.5 : i / (steps - 1);
      const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t) * params.body_width;
      const width = Math.max(radius * 1.75, minWidth * (1 - t * 0.45));
      const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      block.name = `${name}_block_${i + 1}`;
      block.position.y = (t - 0.5) * length;
      block.scale.set(width, (length / steps) * 0.9, width);
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);
    }

    return group;
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
    const layout = this.headLayout(params);
    const hingeX = layout.jawHingeX;
    const hingeZ = layout.jawHingeZ;
    const angle = -THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(params.jaw_open_angle || 0, 0, 60),
    );
    const dx = x - hingeX;
    const dz = z - hingeZ;
    const scaleX = params.dinosaur_length / 7;
    const scaleZ = params.body_height / 3;
    const worldX = dx * scaleX;
    const worldZ = dz * scaleZ;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      hingeX + (worldX * cos - worldZ * sin) / scaleX,
      y,
      hingeZ + (worldX * sin + worldZ * cos) / scaleZ,
    ];
  }

  closeJawPoint(params, [x, y, z]) {
    const layout = this.headLayout(params);
    const angle = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(params.jaw_open_angle || 0, 0, 60),
    );
    const dx = x - layout.jawHingeX;
    const dz = z - layout.jawHingeZ;
    const scaleX = params.dinosaur_length / 7;
    const scaleZ = params.body_height / 3;
    const worldX = dx * scaleX;
    const worldZ = dz * scaleZ;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      layout.jawHingeX + (worldX * cos - worldZ * sin) / scaleX,
      y,
      layout.jawHingeZ + (worldX * sin + worldZ * cos) / scaleZ,
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
  const additivePrimitives = primitives.additivePrimitives || primitives;
  const subtractivePrimitives = primitives.subtractivePrimitives || [];
  let value = -1000;
  for (let i = 0; i < additivePrimitives.length; i += 1) {
    const primitive = additivePrimitives[i];
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
  for (let i = 0; i < subtractivePrimitives.length; i += 1) {
    const primitive = subtractivePrimitives[i];
    const query = primitive.queryBounds;
    if (
      query &&
      (point.x < query.min.x || point.x > query.max.x ||
        point.y < query.min.y || point.y > query.max.y ||
        point.z < query.min.z || point.z > query.max.z)
    ) {
      continue;
    }
    value = smoothMin(value, -primitive.value(point), blend * 0.35);
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

function orientedBoxField(point, center, forward, up, side, halfSize, roundness) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dz = point.z - center.z;
  const localX = dx * forward.x + dy * forward.y + dz * forward.z;
  const localY = dx * up.x + dy * up.y + dz * up.z;
  const localZ = dx * side.x + dy * side.y + dz * side.z;
  const qx = Math.abs(localX) - Math.max(halfSize.x - roundness, 0.0001);
  const qy = Math.abs(localY) - Math.max(halfSize.y - roundness, 0.0001);
  const qz = Math.abs(localZ) - Math.max(halfSize.z - roundness, 0.0001);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideZ = Math.max(qz, 0);
  const outside = Math.sqrt(outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ);
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return -(outside + inside - roundness);
}

function ellipsoidField(point, center, radii) {
  const dx = (point.x - center.x) / Math.max(radii.x, 0.0001);
  const dy = (point.y - center.y) / Math.max(radii.y, 0.0001);
  const dz = (point.z - center.z) / Math.max(radii.z, 0.0001);
  const normalizedDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.min(radii.x, radii.y, radii.z) * (1 - normalizedDistance);
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

function smoothMin(a, b, k) {
  return -smoothMax(-a, -b, k);
}

function evenlySpaced(start, end, count) {
  if (count <= 1) return [(start + end) * 0.5];
  return Array.from({ length: count }, (_, index) => (
    THREE.MathUtils.lerp(start, end, index / (count - 1))
  ));
}
