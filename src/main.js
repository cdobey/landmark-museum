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

// API Key Management
const apiKeyInput = document.getElementById('api-key-input');
const validateKeyBtn = document.getElementById('validate-key-btn');
const apiStatus = document.getElementById('api-status');
const enterMuseumBtn = document.getElementById('enter-museum-btn');

// Check if API key is already stored
const storedApiKey = localStorage.getItem('openai_api_key');
if (storedApiKey) {
    apiKeyInput.value = storedApiKey;
    world.apikey = storedApiKey;
    apiStatus.className = 'success';
    apiStatus.innerHTML = '✓ API key loaded from storage';
    enterMuseumBtn.disabled = false;
}

validateKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        apiStatus.className = 'error';
        apiStatus.innerHTML = '✗ Please enter an API key';
        return;
    }
    
    // Show validating status
    apiStatus.className = 'validating';
    apiStatus.innerHTML = '⟳ Validating API key...';
    validateKeyBtn.disabled = true;
    
    try {
        // Test the API key with a minimal request
        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });
        
        if (response.ok) {
            // API key is valid
            apiStatus.className = 'success';
            apiStatus.innerHTML = '✓ API key validated successfully!';
            enterMuseumBtn.disabled = false;
            
            // Store the API key
            localStorage.setItem('openai_api_key', apiKey);
            world.apikey = apiKey;
        } else {
            // API key is invalid
            apiStatus.className = 'error';
            apiStatus.innerHTML = '✗ Invalid API key. Please check and try again.';
            enterMuseumBtn.disabled = true;
        }
    } catch (error) {
        apiStatus.className = 'error';
        apiStatus.innerHTML = '✗ Error validating API key. Check your connection.';
        enterMuseumBtn.disabled = true;
    } finally {
        validateKeyBtn.disabled = false;
    }
});

// Allow Enter key to validate
apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        validateKeyBtn.click();
    }
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
            // Check if search overlay is visible
            const searchOverlay = document.getElementById('search-overlay');
            const isSearchOverlayVisible = searchOverlay && searchOverlay.style.display === 'flex';
            
            world.controls.enabled = false;
            // Only show blocker if search overlay is not visible
            if (!isSearchOverlayVisible) {
                blocker.style.display = 'flex';
                instructions.style.display = '';
            }
        }
    };

    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    const onPointerLockClick = function (event) {
        // Don't start if clicked on API input area or if museum not ready
        if (event.target.closest('#api-key-section') || enterMuseumBtn.disabled) return;

        // Hide API section after first entry
        const apiSection = document.getElementById('api-key-section');
        if (apiSection) {
            apiSection.style.display = 'none';
        }
        enterMuseumBtn.style.display = 'none';
        
        instructions.style.display = 'none';
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
        element.requestPointerLock();
    };

    enterMuseumBtn.addEventListener('click', onPointerLockClick);
    
    // Re-enable click to re-enter after API is validated
    instructions.addEventListener('click', (event) => {
        // Only allow re-entry if API key is validated and not clicking on API section
        if (!enterMuseumBtn.disabled && !event.target.closest('#api-key-section')) {
            onPointerLockClick(event);
        }
    });

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
