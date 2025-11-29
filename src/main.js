import * as THREE from 'three';
import { World } from './World.js';

// Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// World
const world = new World(scene, camera, renderer);
world.init();

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pointer Lock Logic
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

const havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

if (havePointerLock) {
    const element = document.body;

    const pointerlockchange = function (event) {
        if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
            world.controls.enabled = true;
            blocker.style.display = 'none';
        } else {
            world.controls.enabled = false;
            blocker.style.display = 'flex';
            instructions.style.display = '';
        }
    };

    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    const onPointerLockClick = function (event) {
        // Ignore clicks on the UI container
        if (event.target.closest('#ui-container')) return;

        instructions.style.display = 'none';
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
        element.requestPointerLock();
    };

    instructions.addEventListener('click', onPointerLockClick, false);
    document.body.addEventListener('click', onPointerLockClick, false);

} else {
    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    world.update();
    renderer.render(scene, camera);
}

animate();
