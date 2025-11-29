import * as THREE from 'three';

export class PointerLockControls {
    constructor(camera) {
        this.camera = camera;
        this.scope = this;

        this.camera.rotation.set(0, 0, 0);

        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(this.camera);

        this.yawObject = new THREE.Object3D();
        this.yawObject.position.y = 10;
        this.yawObject.add(this.pitchObject);

        this.PI_2 = Math.PI / 2;
        this.enabled = false;

        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    }

    onMouseMove(event) {
        if (this.enabled === false) return;

        var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        this.yawObject.rotation.y -= movementX * 0.002;
        this.pitchObject.rotation.x -= movementY * 0.002;

        this.pitchObject.rotation.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.pitchObject.rotation.x));
    }

    dispose() {
        document.removeEventListener('mousemove', this.onMouseMove.bind(this), false);
    }

    getObject() {
        return this.yawObject;
    }

    getDirection() {
        // assumes the camera itself is not rotated
        var direction = new THREE.Vector3(0, 0, -1);
        var rotation = new THREE.Euler(0, 0, 0, 'YXZ');

        return (v) => {
            rotation.set(this.pitchObject.rotation.x, this.yawObject.rotation.y, 0);
            v.copy(direction).applyEuler(rotation);
            return v;
        };
    }
}
