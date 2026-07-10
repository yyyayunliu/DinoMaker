import * as THREE from 'three';

export class DinoRigControls {
  constructor(generator) {
    this.generator = generator;
    this.playing = false;
    this.phase = 0;
  }

  setPlaying(isPlaying) {
    this.playing = isPlaying;
    if (!isPlaying) this.applyRestPose();
  }

  update(delta, params) {
    if (!this.playing) return;
    this.phase += delta * params.walk_speed * Math.PI;
    this.applyWalkPose(params);
  }

  applyRestPose() {
    const rig = this.generator.getRig?.();
    if (rig) {
      rig.boneList.forEach((bone) => {
        bone.position.copy(bone.userData.restPosition);
        bone.quaternion.copy(bone.userData.restQuaternion);
      });
    }
    const parts = this.generator.getParts();
    parts.forEach((group) => {
      group.position.copy(group.userData.basePosition || new THREE.Vector3());
      group.rotation.set(0, 0, 0);
    });
  }

  applyWalkPose(params) {
    const rig = this.generator.getRig?.();
    if (rig) {
      this.applyRigWalkPose(rig, params);
      return;
    }

    const parts = this.generator.getParts();
    const walk = Math.sin(this.phase);
    const counter = Math.sin(this.phase + Math.PI);
    const liftLeft = Math.max(0, walk);
    const liftRight = Math.max(0, counter);

    const body = parts.get('body');
    const tail = parts.get('tail');
    const head = parts.get('head');
    const leftLeg = parts.get('leftLeg');
    const rightLeg = parts.get('rightLeg');
    const leftArm = parts.get('leftArm');
    const rightArm = parts.get('rightArm');

    this.resetGroup(body);
    this.resetGroup(tail);
    this.resetGroup(head);
    this.resetGroup(leftLeg);
    this.resetGroup(rightLeg);
    this.resetGroup(leftArm);
    this.resetGroup(rightArm);

    if (body) {
      body.position.y += Math.abs(walk) * params.walk_bob;
      body.rotation.y = walk * 0.025;
    }
    if (tail) {
      tail.rotation.y = -walk * params.tail_swing;
      tail.rotation.z = -walk * params.tail_swing * 0.18;
    }
    if (head) {
      head.rotation.z = walk * params.head_bob * 0.45;
      head.position.y += Math.cos(this.phase) * params.head_bob * 0.08;
    }
    if (leftLeg) {
      leftLeg.rotation.z = walk * params.walk_stride;
      leftLeg.position.y += liftLeft * params.walk_bob * 1.8;
    }
    if (rightLeg) {
      rightLeg.rotation.z = counter * params.walk_stride;
      rightLeg.position.y += liftRight * params.walk_bob * 1.8;
    }
    if (leftArm) leftArm.rotation.z = -counter * 0.16;
    if (rightArm) rightArm.rotation.z = -walk * 0.16;
  }

  applyRigWalkPose(rig, params) {
    this.applyRestPose();

    const walk = Math.sin(this.phase);
    const counter = Math.sin(this.phase + Math.PI);
    const double = Math.sin(this.phase * 2);
    const stride = params.walk_stride;
    const bones = rig.bones;

    bones.root.rotation.z = double * 0.01;
    bones.spine_01.rotation.z = -double * 0.012;
    bones.spine_02.rotation.z = double * 0.009;
    bones.chest.rotation.z = -double * 0.007;

    bones.left_thigh.rotation.z = walk * stride * 0.5;
    bones.left_shin.rotation.z = -walk * stride * 0.22;
    bones.left_foot.rotation.z = -walk * stride * 0.12;
    bones.left_toe.rotation.z = -walk * stride * 0.04;

    bones.right_thigh.rotation.z = counter * stride * 0.5;
    bones.right_shin.rotation.z = -counter * stride * 0.22;
    bones.right_foot.rotation.z = -counter * stride * 0.12;
    bones.right_toe.rotation.z = -counter * stride * 0.04;

    bones.tail_01.rotation.y = -walk * params.tail_swing * 0.7;
    bones.tail_02.rotation.y = -walk * params.tail_swing;
    bones.tail_03.rotation.y = -walk * params.tail_swing * 1.2;
    bones.tail_02.rotation.z = double * 0.04;

    bones.neck.rotation.z = -double * params.head_bob * 0.55;
    bones.head.rotation.z = double * params.head_bob * 0.38;
    bones.head.rotation.y = -walk * 0.04;
    bones.jaw.rotation.z = -Math.max(0, Math.sin(this.phase * 1.5)) * 0.045;

    bones.left_upper_arm.rotation.z = -counter * 0.12;
    bones.left_forearm.rotation.z = counter * 0.08;
    bones.left_hand.rotation.z = counter * 0.04;
    bones.right_upper_arm.rotation.z = -walk * 0.12;
    bones.right_forearm.rotation.z = walk * 0.08;
    bones.right_hand.rotation.z = walk * 0.04;
  }

  resetGroup(group) {
    if (!group) return;
    group.position.copy(group.userData.basePosition || new THREE.Vector3());
    group.rotation.set(0, 0, 0);
  }
}
