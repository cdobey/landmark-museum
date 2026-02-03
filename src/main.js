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

// API Key Management + Free Trial
const apiKeyInput = document.getElementById('api-key-input');
const validateKeyBtn = document.getElementById('validate-key-btn');
const apiStatus = document.getElementById('api-status');
const enterMuseumBtn = document.getElementById('enter-museum-btn');
const providerSelect = document.getElementById('api-provider-select');
const freeTrialBtn = document.getElementById('free-trial-btn');
const freeCounter = document.getElementById('free-search-counter');

const PROVIDER_KEY = 'lm_provider';
const FREE_REMAINING_KEY = 'lm_free_remaining';
const FREE_ACTIVE_KEY = 'lm_use_free';
const FREE_RESET_KEY = 'lm_free_reset_at';
const FREE_TRIAL_TOTAL = 3;

const PROVIDER_LABELS = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
};

const KEY_STORAGE = {
    openai: 'openai_api_key',
    anthropic: 'anthropic_api_key',
    google: 'google_api_key',
};

const normalizeProvider = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'anthropic' || v === 'google') return v;
    return 'openai';
};

const getStoredKey = (provider) => {
    const key = KEY_STORAGE[provider] || KEY_STORAGE.openai;
    return localStorage.getItem(key) || '';
};

const setStoredKey = (provider, key) => {
    const storageKey = KEY_STORAGE[provider] || KEY_STORAGE.openai;
    if (key) {
        localStorage.setItem(storageKey, key);
    } else {
        localStorage.removeItem(storageKey);
    }
};

const storedRemainingRaw = localStorage.getItem(FREE_REMAINING_KEY);
let freeRemaining =
    storedRemainingRaw === null ? FREE_TRIAL_TOTAL : Number(storedRemainingRaw);
if (!Number.isFinite(freeRemaining)) freeRemaining = FREE_TRIAL_TOTAL;
if (storedRemainingRaw === null) {
    localStorage.setItem(FREE_REMAINING_KEY, String(freeRemaining));
}

let freeResetAt = Number(localStorage.getItem(FREE_RESET_KEY));
if (!Number.isFinite(freeResetAt)) freeResetAt = null;
if (freeResetAt && Date.now() >= freeResetAt) {
    freeResetAt = null;
    freeRemaining = FREE_TRIAL_TOTAL;
    localStorage.setItem(FREE_REMAINING_KEY, String(freeRemaining));
    localStorage.removeItem(FREE_RESET_KEY);
}

let useFreeTrial = localStorage.getItem(FREE_ACTIVE_KEY) === 'true';
if (freeRemaining <= 0) useFreeTrial = false;

const updateFreeCounter = () => {
    if (!freeCounter) return;
    if (useFreeTrial && freeRemaining > 0) {
        freeCounter.textContent = `Free searches left: ${freeRemaining}`;
        freeCounter.classList.add('visible');
    } else {
        freeCounter.classList.remove('visible');
    }
};

const updateEntryState = () => {
    const provider = normalizeProvider(providerSelect?.value);
    const storedKey = getStoredKey(provider);
    const canEnter = (useFreeTrial && freeRemaining > 0) || Boolean(storedKey);
    if (enterMuseumBtn) enterMuseumBtn.disabled = !canEnter;
};

const setStatus = (message, statusClass) => {
    if (!apiStatus) return;
    apiStatus.className = statusClass;
    apiStatus.textContent = message;
};

const applyProvider = (provider) => {
    const normalized = normalizeProvider(provider);
    if (providerSelect) providerSelect.value = normalized;
    localStorage.setItem(PROVIDER_KEY, normalized);
    world.landmarkService?.setProvider(normalized);

    const storedKey = getStoredKey(normalized);
    if (apiKeyInput) apiKeyInput.value = storedKey;
    world.landmarkService?.setApiKey(storedKey);

    updateEntryState();
};

const storedProvider = normalizeProvider(localStorage.getItem(PROVIDER_KEY));
applyProvider(storedProvider);

world.landmarkService?.setFreeTrialState(useFreeTrial, freeRemaining);
world.landmarkService?.setFreeTrialResetAt(freeResetAt);
world.landmarkService.onFreeTrialChange = (remaining, resetAt) => {
    freeRemaining = remaining;
    localStorage.setItem(FREE_REMAINING_KEY, String(remaining));
    if (Number.isFinite(resetAt)) {
        freeResetAt = resetAt;
        localStorage.setItem(FREE_RESET_KEY, String(resetAt));
    }
    if (freeRemaining <= 0) {
        useFreeTrial = false;
        localStorage.setItem(FREE_ACTIVE_KEY, 'false');
        world.landmarkService?.setUseFreeTrial(false);
        setStatus('Free trial used up. Add your own API key to continue.', 'error');
    }
    updateFreeCounter();
    updateEntryState();
};

const showInitialStatus = () => {
    const provider = normalizeProvider(providerSelect?.value);
    const storedKey = getStoredKey(provider);
    if (useFreeTrial && freeRemaining > 0) {
        setStatus(`Free trial enabled (${freeRemaining} searches left)`, 'success');
    } else if (storedKey) {
        const label = PROVIDER_LABELS[provider] || 'OpenAI';
        setStatus(`✓ ${label} API key loaded from storage`, 'success');
    } else {
        setStatus('Add your API key or try free search (3 total).', 'validating');
    }
};

if (providerSelect) {
    providerSelect.addEventListener('change', (event) => {
        const nextProvider = normalizeProvider(event.target.value);
        applyProvider(nextProvider);
        showInitialStatus();
    });
}

if (validateKeyBtn && apiKeyInput) {
    validateKeyBtn.addEventListener('click', () => {
        const provider = normalizeProvider(providerSelect?.value);
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            setStatus('✗ Please enter an API key', 'error');
            updateEntryState();
            return;
        }

        setStoredKey(provider, apiKey);
        world.landmarkService?.setProvider(provider);
        world.landmarkService?.setApiKey(apiKey);

        useFreeTrial = false;
        localStorage.setItem(FREE_ACTIVE_KEY, 'false');
        world.landmarkService?.setUseFreeTrial(false);

        const label = PROVIDER_LABELS[provider] || 'OpenAI';
        setStatus(`✓ ${label} API key saved`, 'success');
        updateFreeCounter();
        updateEntryState();
    });

    apiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateKeyBtn.click();
        }
    });
}

if (freeTrialBtn) {
    freeTrialBtn.addEventListener('click', () => {
        if (freeRemaining <= 0) {
            setStatus('Free trial already used up. Add your own API key.', 'error');
            return;
        }
        useFreeTrial = true;
        localStorage.setItem(FREE_ACTIVE_KEY, 'true');
        world.landmarkService?.setUseFreeTrial(true);
        setStatus(`Free trial enabled (${freeRemaining} searches left)`, 'success');
        updateFreeCounter();
        updateEntryState();
    });
}

updateFreeCounter();
updateEntryState();
showInitialStatus();

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
