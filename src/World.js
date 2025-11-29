import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
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
            this.onSearch.bind(this),
            (key) => this.landmarkService.setApiKey(key)
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
        this.controls = null;
        this.MOVESPEED = 3;
        
        // Interaction
        this.searchMesh = null;
        this.mouseRaycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Dynamic Content Tracking
        this.previousMeshGroups = []; // Plaques
        this.previousImageGroups = []; // Images
        this.previousSpotLights = [];
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
        
        // Setup UI
        this.uiManager.setup();
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
    }

    async onSearch(country) {
        this.uiManager.setLoading(true);
        
        try {
            const landmarks = await this.landmarkService.fetchLandmarkData(country);
            if (landmarks.length > 0) {
                this.placeText(landmarks);
                
                const imageUrls = await this.landmarkService.fetchImages(landmarks);
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

        const loader = new FontLoader();
        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
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
        const geometry = new THREE.PlaneGeometry(37, 37);

        imageUrls.forEach((url, index) => {
            if (!url) return;
            
            imageLoader.load(url, (texture) => {
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
        switch (event.keyCode) {
            case 38: case 87: this.moveForward = true; break;
            case 37: case 65: this.moveLeft = true; break;
            case 40: case 83: this.moveBackward = true; break;
            case 39: case 68: this.moveRight = true; break;
            case 32: 
                if (this.canJump === true) this.velocity.y += 350;
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
            if (this.landmarkService.apikey) {
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
        if (this.controls.enabled === true) {
            this.raycaster.ray.origin.copy(this.controls.getObject().position);
            this.raycaster.ray.origin.y -= 10;

            const intersections = this.raycaster.intersectObjects(this.objects);
            const onObject = intersections.length > 0;

            const time = performance.now();
            const delta = (time - this.prevTime) / 1000;

            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;
            this.velocity.y -= 9.8 * 100.0 * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveLeft) - Number(this.moveRight);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 400.0 * this.MOVESPEED * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 400.0 * this.MOVESPEED * delta;

            if (onObject === true) {
                this.velocity.y = Math.max(0, this.velocity.y);
                this.canJump = true;
            }

            this.controls.getObject().translateX(this.velocity.x * delta);
            this.controls.getObject().translateY(this.velocity.y * delta);
            this.controls.getObject().translateZ(this.velocity.z * delta);

            if (this.controls.getObject().position.y < 17.5) {
                this.velocity.y = 0;
                this.controls.getObject().position.y = 17.5;
                this.canJump = true;
            }

            this.prevTime = time;
        } else {
            this.prevTime = performance.now();
        }
    }
}
