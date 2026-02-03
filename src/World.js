import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Environment } from './components/Environment.js';
import { UIManager } from './managers/UIManager.js';
import { PointerLockControls } from './PointerLockControls.js';
import { LandmarkService } from './services/LandmarkService.js';

export class World {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Core Components
        // Core Components
        this.landmarkService = new LandmarkService();
        this.uiManager = new UIManager(
            this.onSearch.bind(this)
        );
        this.environment = new Environment(scene);
        
        // Physics & Controls
        this.objects = [];
        this.raycaster = null;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        
        this.prevTime = performance.now();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this._tempVec3 = new THREE.Vector3();
        this.controls = null;
        this.MOVESPEED = 3;
        this.JUMP_SPEED = 220;

        // Simple collision (capsule vs. static scene octree)
        this.worldOctree = new Octree();
        this.playerCollider = null;
        this.playerOnFloor = false;
        this.PLAYER_RADIUS = 5;
        this.PLAYER_EYE_Y = 17.5;
        this.spawnPoint = new THREE.Vector3(0, this.PLAYER_EYE_Y, 175);
        
        // Interaction
        this.searchMesh = null;
        this.mouseRaycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Dynamic Content Tracking
        this.previousMeshGroups = []; // Plaques
        this.previousImageGroups = []; // Images
        this.previousSpotLights = [];

        // Assets
        this._plaqueFontUrl = 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';
        this._plaqueFont = null;
        this._plaqueFontPromise = null;
    }

    init() {
        // Lighting (Global)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0, 200, 0);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -300;
        dirLight.shadow.camera.right = 300;
        dirLight.shadow.camera.top = 300;
        dirLight.shadow.camera.bottom = -300;
        this.scene.add(dirLight);

        // Fog & Renderer Settings
        this.scene.fog = new THREE.Fog(0xf0f0f0, 0, 1000);
        this.renderer.setClearColor(0xf0f0f0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        this.controls = new PointerLockControls(this.camera);
        this.scene.add(this.controls.getObject());
        this.controls.getObject().position.set(0, 17.5, 175);
        {
            const spawn = this.controls.getObject().position;
            this.spawnPoint.copy(spawn);
            this.playerCollider = new Capsule(
                new THREE.Vector3(spawn.x, this.PLAYER_RADIUS, spawn.z),
                new THREE.Vector3(spawn.x, this.PLAYER_EYE_Y, spawn.z),
                this.PLAYER_RADIUS
            );
        }

        // Event Listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        document.addEventListener('click', this.onMouseClick.bind(this), false);
        
        // Pointer Lock Event Listeners
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this), false);
        document.addEventListener('mozpointerlockchange', this.onPointerLockChange.bind(this), false);
        document.addEventListener('webkitpointerlockchange', this.onPointerLockChange.bind(this), false);

        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

        // Build Scene
        this.buildScene();
        
        // Setup UI
        this.uiManager.setup();

        // Warm up the plaque font so the first search doesn't wait on it.
        this.getPlaqueFont().catch(() => {});
    }

    getPlaqueFont() {
        if (this._plaqueFont) return Promise.resolve(this._plaqueFont);
        if (this._plaqueFontPromise) return this._plaqueFontPromise;

        const loader = new FontLoader();
        this._plaqueFontPromise = new Promise((resolve, reject) => {
            loader.load(
                this._plaqueFontUrl,
                (font) => {
                    this._plaqueFont = font;
                    resolve(font);
                },
                undefined,
                (err) => reject(err)
            );
        });

        return this._plaqueFontPromise;
    }

    buildScene() {
        // Gallery Dimensions
        const width = 100;
        const length = 200;
        const height = 60;

        // Build static environment
        this.environment.build(width, length, height);
        
        // Create 3D Search Interface
        const searchCanvas = this.uiManager.createSearchCanvas();
        const searchTexture = new THREE.CanvasTexture(searchCanvas);
        searchTexture.needsUpdate = true;
        
        this.searchMesh = this.environment.create3DSearchInterface(width, length, height, searchTexture);

        // Build collision data from static scene geometry.
        // This is intentionally done once; dynamic exhibit content isn't included.
        this.worldOctree = new Octree();
        this.worldOctree.fromGraphNode(this.scene);
    }

    async onSearch(country) {
        this.uiManager.setLoading(true);
        
        try {
            const landmarks = await this.landmarkService.fetchLandmarkData(country);
            if (landmarks.length > 0) {
                // Start image fetching ASAP; text placement does async font loading anyway.
                const imagePromise = this.landmarkService.fetchImages(landmarks);
                this.placeText(landmarks);
                
                const imageUrls = await imagePromise;
                this.placeImage(imageUrls);
            }
        } catch (error) {
            console.error("Search failed:", error);
            alert(error.message);
        } finally {
            this.uiManager.setLoading(false);
        }
    }

    placeText(landmarks) {
        // Cleanup
        this.previousMeshGroups.forEach(group => {
            this.scene.remove(group);
            group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        });
        this.previousMeshGroups = [];

        this.getPlaqueFont().then((font) => {
            const maxCharCount = 35; 
            const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

            landmarks.forEach((landmark, index) => {
                if (!landmark.name) return;
                
                let x, y, z, rotY;
                if (index === 0) { x = -35; y = 0; z = 60; rotY = Math.PI / 2; }
                else if (index === 1) { x = 35; y = 0; z = 60; rotY = -Math.PI / 2; }
                else if (index === 2) { x = -35; y = 0; z = -60; rotY = Math.PI / 2; }
                else if (index === 3) { x = 35; y = 0; z = -60; rotY = -Math.PI / 2; }
                
                const { group: plaqueGroup } = this.environment.createStandingPlaque(x, y, z, rotY);
                this.previousMeshGroups.push(plaqueGroup);

                // Add Text
                const fullText = landmark.name + '\n\n' + landmark.desc;
                const lines = fullText.match(new RegExp('.{1,' + maxCharCount + '}', 'g')) || [];
                
                const lineHeight = 1.0;
                const startY = 7.5 + (lines.length * lineHeight) / 2 - 0.5;
                const plaqueAngle = -0.1;
                
                lines.forEach((line, lineIndex) => {
                    const textGeometry = new TextGeometry(line, {
                        font: font, size: 0.75, height: 0.05, curveSegments: 6, bevelEnabled: false
                    });
                    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                    
                    textGeometry.computeBoundingBox();
                    const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
                    const currentY = startY - (lineIndex * lineHeight);
                    const yOffset = currentY - 7.5;
                    const zOffset = -yOffset * Math.tan(Math.abs(plaqueAngle));
                    
                    textMesh.position.set(-textWidth / 2, currentY, 0.3 + zOffset);
                    textMesh.rotation.x = plaqueAngle;
                    plaqueGroup.add(textMesh);
                });
            });
        }).catch((err) => {
            console.error("Failed to load font:", err);
        });
    }

    placeImage(imageUrls) {
        // Cleanup
        this.previousImageGroups.forEach(group => {
            this.scene.remove(group);
            group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        });
        this.previousImageGroups = [];
        
        this.previousSpotLights.forEach(light => {
            this.scene.remove(light);
            if (light.dispose) light.dispose();
        });
        this.previousSpotLights = [];

        const imageLoader = new THREE.TextureLoader();
        imageLoader.setCrossOrigin('anonymous');
        const geometry = new THREE.PlaneGeometry(37, 37);

        const makePlaceholderTexture = (label) => {
            const size = 512;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#e6e6e6';
            ctx.fillRect(0, 0, size, size);
            ctx.strokeStyle = '#b0b0b0';
            ctx.lineWidth = 12;
            ctx.strokeRect(18, 18, size - 36, size - 36);
            ctx.fillStyle = '#2b2b2b';
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, size / 2, size / 2);
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        };

        const loadTextureWithFallback = (candidates, onLoad) => {
            const list = Array.isArray(candidates) ? candidates : [candidates];
            const urls = list.filter(Boolean);
            if (urls.length === 0) {
                onLoad(makePlaceholderTexture('No image'));
                return;
            }

            const tryIndex = (i) => {
                imageLoader.load(
                    urls[i],
                    (texture) => onLoad(texture),
                    undefined,
                    () => {
                        if (i + 1 < urls.length) return tryIndex(i + 1);
                        onLoad(makePlaceholderTexture('Image unavailable'));
                    }
                );
            };

            tryIndex(0);
        };

        imageUrls.forEach((urlOrCandidates, index) => {
            if (!urlOrCandidates) return;

            loadTextureWithFallback(urlOrCandidates, (texture) => {
                const material = new THREE.MeshBasicMaterial({ map: texture });
                const mesh = new THREE.Mesh(geometry, material);
                const group = new THREE.Group();
                
                this.environment.createWoodenFrame(0, 0, 0, 0, group);
                group.add(mesh);
                mesh.position.z = 2;

                // Spotlight
                const spotLight = new THREE.SpotLight(0xffffff, 1.5);
                spotLight.angle = 0.6;
                spotLight.penumbra = 0.3;
                spotLight.decay = 1;
                spotLight.distance = 100;
                spotLight.target = group;

                let x, y, z, rotY;
                if (index === 0) {
                    x = -45; y = 27; z = 40; rotY = Math.PI / 2;
                    spotLight.position.set(x - 10, 40, z);
                    spotLight.castShadow = true;
                } else if (index === 1) {
                    x = 45; y = 27; z = 40; rotY = -Math.PI / 2;
                    spotLight.position.set(x + 10, 40, z);
                    spotLight.castShadow = true;
                } else if (index === 2) {
                    x = -45; y = 27; z = -40; rotY = Math.PI / 2;
                    spotLight.position.set(x - 10, 40, z);
                } else if (index === 3) {
                    x = 45; y = 27; z = -40; rotY = -Math.PI / 2;
                    spotLight.position.set(x + 10, 40, z);
                }
                
                group.position.set(x, y, z);
                group.rotation.set(0, rotY, 0);
                
                this.scene.add(group);
                this.scene.add(spotLight);
                
                this.previousImageGroups.push(group);
                this.previousSpotLights.push(spotLight);
            });
        });
    }

    onKeyDown(event) {
        // Ignore movement keys while the search UI is open. Otherwise typing a space in
        // "United States", etc. would trigger a jump that applies after pointer lock resumes.
        if (this.uiManager?.isOverlayVisible?.()) return;

        switch (event.keyCode) {
            case 38: case 87: this.moveForward = true; break;
            case 37: case 65: this.moveLeft = true; break;
            case 40: case 83: this.moveBackward = true; break;
            case 39: case 68: this.moveRight = true; break;
            case 32: 
                event.preventDefault();
                if (this.canJump === true) this.velocity.y += this.JUMP_SPEED;
                this.canJump = false;
                break;
        }
    }

    onKeyUp(event) {
        switch (event.keyCode) {
            case 38: case 87: this.moveForward = false; break;
            case 37: case 65: this.moveLeft = false; break;
            case 40: case 83: this.moveBackward = false; break;
            case 39: case 68: this.moveRight = false; break;
        }
    }

    onPointerLockChange(event) {
        if (document.pointerLockElement === document.body || 
            document.mozPointerLockElement === document.body || 
            document.webkitPointerLockElement === document.body) {
            this.controls.enabled = true;
        } else {
            this.controls.enabled = false;
        }
    }

    onMouseClick(event) {
        if (this.uiManager.isOverlayVisible()) return;
        
        // If not locked, request lock
        if (!this.controls || !this.controls.enabled) {
            // Only allow locking if API key is set
            if (this.landmarkService.apikey || this.landmarkService.useFreeTrial) {
                this.uiManager.requestPointerLock();
            }
            return;
        }
        
        this.mouse.x = 0;
        this.mouse.y = 0;
        this.mouseRaycaster.setFromCamera(this.mouse, this.camera);
        
        if (this.searchMesh) {
            const intersects = this.mouseRaycaster.intersectObject(this.searchMesh);
            if (intersects.length > 0 && intersects[0].distance < 50) {
                this.uiManager.activateSearchInput();
            }
        }
    }

    update() {
        if (!this.controls || !this.playerCollider) return;

        if (this.controls.enabled === true) {
            const time = performance.now();
            // Prevent large frame hitches (e.g. during asset creation/loading) from
            // causing the capsule to "tunnel" through the floor in one step.
            const delta = Math.min(0.05, (time - this.prevTime) / 1000);

            const STEPS = 5;
            const stepDelta = delta / STEPS;

            // Compute intended movement direction once per frame.
            const moveDir = this.direction.set(
                Number(this.moveRight) - Number(this.moveLeft),
                0,
                Number(this.moveBackward) - Number(this.moveForward)
            );
            if (moveDir.lengthSq() > 0) {
                moveDir.normalize();
                moveDir.applyQuaternion(this.controls.getObject().quaternion);
            }

            for (let i = 0; i < STEPS; i++) {
                // Damping (horizontal) + gravity.
                this.velocity.x -= this.velocity.x * 10.0 * stepDelta;
                this.velocity.z -= this.velocity.z * 10.0 * stepDelta;
                this.velocity.y -= 9.8 * 100.0 * stepDelta;

                if (moveDir.lengthSq() > 0) {
                    this.velocity.addScaledVector(moveDir, 400.0 * this.MOVESPEED * stepDelta);
                }

                // Integrate movement with collisions (capsule vs. static scene octree).
                this._tempVec3.copy(this.velocity).multiplyScalar(stepDelta);
                this.playerCollider.translate(this._tempVec3);

                this.playerOnFloor = false;
                const result = this.worldOctree?.capsuleIntersect(this.playerCollider);
                if (result) {
                    this.playerOnFloor = result.normal.y > 0;

                    // Slide along surfaces instead of sticking.
                    this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));

                    // Resolve penetration.
                    this.playerCollider.translate(result.normal.multiplyScalar(result.depth));

                    if (this.playerOnFloor) {
                        this.velocity.y = Math.max(0, this.velocity.y);
                    }
                }
            }

            this.canJump = this.playerOnFloor;
            this.controls.getObject().position.copy(this.playerCollider.end);

            // Safety net: if we ever end up far below the level (usually due to a hitch),
            // snap back to spawn instead of falling forever.
            if (!Number.isFinite(this.playerCollider.end.y) || this.playerCollider.end.y < -100) {
                this.velocity.set(0, 0, 0);
                this.playerCollider.start.set(this.spawnPoint.x, this.PLAYER_RADIUS, this.spawnPoint.z);
                this.playerCollider.end.set(this.spawnPoint.x, this.PLAYER_EYE_Y, this.spawnPoint.z);
                this.controls.getObject().position.copy(this.playerCollider.end);
            }

            this.prevTime = time;
        } else {
            this.prevTime = performance.now();
        }
    }
}
