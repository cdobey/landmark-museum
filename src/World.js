import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { PointerLockControls } from './PointerLockControls.js';

export class World {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
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
        
        this.previousMesh1 = [];
        this.previousMesh2 = [];
        this.previousMesh3 = [];
        this.previousMesh4 = [];
        
        // Track images and lights for cleanup
        this.previousImageGroups = [];
        this.previousSpotLights = [];

        this.MOVESPEED = 3;
        
        // 3D Search Interface
        this.searchMesh = null;
        this.searchCanvas = null;
        this.searchTexture = null;
        this.mouseRaycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // API Configuration
        this.openaiURL = "https://api.openai.com/v1/chat/completions";
        this.ai_model = import.meta.env.VITE_OPENAI_AI_MODEL || "gpt-4o-mini";
        this.apikey = ""; // Will be set from UI
        
        this.cors_proxy = 'https://corsproxy.io/?';
        this.search_url = 'https://www.googleapis.com/customsearch/v1';
        this.googleApiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || "";
        this.googleCx = import.meta.env.VITE_GOOGLE_SEARCH_CX || "";
    }

    init() {
        // Lighting
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

        // Fog
        this.scene.fog = new THREE.Fog(0xf0f0f0, 0, 1000);
        this.renderer.setClearColor(0xf0f0f0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        this.controls = new PointerLockControls(this.camera);
        this.scene.add(this.controls.getObject());
        
        // Set initial position outside museum facing entrance
        this.controls.getObject().position.set(0, 17.5, 175);

        // Event Listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        document.addEventListener('click', this.onMouseClick.bind(this), false);

        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

        // Initial Scene Setup
        this.createEnvironment();
        
        // UI Setup
        this.setupUI();
    }

    createEnvironment() {
        // Gallery Dimensions
        const width = 100;
        const length = 200;
        const height = 60;

        const textureLoader = new THREE.TextureLoader();

        // Floor - Rich Hardwood
        const floorGeometry = new THREE.PlaneGeometry(width, length, 50, 50);
        floorGeometry.rotateX(-Math.PI / 2);
        
        const floorTexture = textureLoader.load('/textures/marble_floor.png');
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(10, 20);
        
        // Dark wood floor material
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            map: floorTexture,
            color: 0x5c4033, // Rich brown wood tone
            roughness: 0.6, 
            metalness: 0.05 
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(0, 0, 0);
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Flat Decorated Ceiling
        this.createFlatCeiling(width, length, height);

        // Walls - Textured Stone/Plaster
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xe8dcc8, // Warm cream/beige
            roughness: 0.95,
            normalScale: new THREE.Vector2(0.5, 0.5)
        });
        
        // Left Wall with molding
        const leftWallGeo = new THREE.BoxGeometry(12, height, length);
        const leftWall = new THREE.Mesh(leftWallGeo, wallMaterial);
        leftWall.position.set(-width/2 - 1, height/2, 0);
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);

        // Right Wall with molding
        const rightWallGeo = new THREE.BoxGeometry(12, height, length);
        const rightWall = new THREE.Mesh(rightWallGeo, wallMaterial);
        rightWall.position.set(width/2 + 1, height/2, 0);
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);

        // Back Wall - solid wall
        const backWallGeo = new THREE.BoxGeometry(width, height, 12);
        const backWall = new THREE.Mesh(backWallGeo, wallMaterial);
        backWall.position.set(0, height/2, -length/2);
        backWall.receiveShadow = true;
        this.scene.add(backWall);

        // Front Wall with Arch (End)
        this.createArchedWall(0, length/2, width, height, wallMaterial);

        // Simple Columns - positioned throughout museum
        const columnGeo = new THREE.CylinderGeometry(5, 5.5, height, 8);
        const columnMat = new THREE.MeshStandardMaterial({ 
            color: 0xc9b896,
            roughness: 0.7,
            metalness: 0.1
        });
        
        // Place columns at front, center, and back
        const columnPositions = [-85, 0, 85];
        
        columnPositions.forEach(z => {
            // Left Column
            const colL = new THREE.Mesh(columnGeo, columnMat);
            colL.position.set(-width/2 + 12, height/2, z);
            colL.castShadow = true;
            colL.receiveShadow = true;
            this.scene.add(colL);

            // Right Column
            const colR = new THREE.Mesh(columnGeo, columnMat);
            colR.position.set(width/2 - 12, height/2, z);
            colR.castShadow = true;
            colR.receiveShadow = true;
            this.scene.add(colR);
        });

        // Create exterior architecture
        this.createExteriorArchitecture(width, length, height);
        
        // Create 3D Search Interface on back wall
        this.create3DSearchInterface(width, length, height);
    }
    
    createExteriorArchitecture(width, length, height) {
        const entranceZ = length/2;
        
        // Create outdoor ground plane with grass texture - very large for infinite appearance
        const groundGeo = new THREE.PlaneGeometry(5000, 5000);
        groundGeo.rotateX(-Math.PI / 2);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a5f3a, // Dark green grass
            roughness: 0.9,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.position.set(0, -0.1, 0);
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Add a simple path leading to entrance
        const pathGeo = new THREE.PlaneGeometry(30, 100);
        pathGeo.rotateX(-Math.PI / 2);
        const pathMat = new THREE.MeshStandardMaterial({ 
            color: 0x8b8680, // Gray stone path
            roughness: 0.7,
            metalness: 0.1
        });
        const path = new THREE.Mesh(pathGeo, pathMat);
        path.position.set(0, 0, entranceZ + 50);
        path.receiveShadow = true;
        this.scene.add(path);
        
        // Sky backdrop with fog for infinite ground appearance
        const skyColor = 0x87ceeb; // Sky blue
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.Fog(skyColor, 300, 1500);
        
        // "LANDMARK MUSEUM" text
        this.createMuseumSignage(entranceZ, height);
    }
    
    createMuseumSignage(entranceZ, height) {
        const loader = new FontLoader();
        loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
            // "LANDMARK MUSEUM" text
            const textGeo = new TextGeometry('LANDMARK MUSEUM', {
                font: font,
                size: 6,
                height: 1,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.15,
                bevelSize: 0.1,
                bevelSegments: 3
            });
            
            const textMat = new THREE.MeshStandardMaterial({ 
                color: 0x2c1810, // Dark bronze/brown
                roughness: 0.4,
                metalness: 0.6
            });
            
            const textMesh = new THREE.Mesh(textGeo, textMat);
            
            // Center the text
            textGeo.computeBoundingBox();
            const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
            
            textMesh.position.set(-textWidth/2, 42, entranceZ + 7);
            textMesh.castShadow = true;
            this.scene.add(textMesh);
            
            // Add decorative backing panel
            const panelGeo = new THREE.BoxGeometry(textWidth + 6, 24, 2);
            const panelMat = new THREE.MeshStandardMaterial({ 
                color: 0xe8dcc8,
                roughness: 0.7
            });
            const panel = new THREE.Mesh(panelGeo, panelMat);
            panel.position.set(0, 42, entranceZ + 6);
            this.scene.add(panel);
            
            // Decorative border around text panel
            const borderMat = new THREE.MeshStandardMaterial({ 
                color: 0xb8860B,
                roughness: 0.3,
                metalness: 0.7
            });
            
            const borderThick = 1;
            const borderH = new THREE.BoxGeometry(textWidth + 8, borderThick, 1);
            const borderV = new THREE.BoxGeometry(borderThick, 17, 1);
            
            // Top border
            const topBorder = new THREE.Mesh(borderH, borderMat);
            topBorder.position.set(0, 54, entranceZ + 7);
            this.scene.add(topBorder);
            
            // Bottom border
            const bottomBorder = new THREE.Mesh(borderH, borderMat);
            bottomBorder.position.set(0, 37, entranceZ + 7);
            this.scene.add(bottomBorder);
            
            // Left border
            const leftBorder = new THREE.Mesh(borderV, borderMat);
            leftBorder.position.set(-textWidth/2 - 4, 45.5, entranceZ + 7);
            this.scene.add(leftBorder);
            
            // Right border
            const rightBorder = new THREE.Mesh(borderV, borderMat);
            rightBorder.position.set(textWidth/2 + 4, 45.5, entranceZ + 7);
            this.scene.add(rightBorder);
        });
    }
    

    

    


    createFlatCeiling(width, length, height) {
        // Create flat ceiling
        const ceilingGeo = new THREE.PlaneGeometry(width, length);
        ceilingGeo.rotateX(Math.PI / 2);
        
        const ceilingMat = new THREE.MeshStandardMaterial({ 
            color: 0xf5ebe0, // Warm off-white
            roughness: 0.9
        });
        
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.position.set(0, height, 0);
        ceiling.receiveShadow = true;
        this.scene.add(ceiling);

        // Add decorative beams
        const beamMat = new THREE.MeshStandardMaterial({ 
            color: 0xd4c5a9,
            roughness: 0.6
        });
        
        for (let z = -75; z <= 75; z += 75) {
            const beamGeo = new THREE.BoxGeometry(width, 3, 6);
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(0, height - 1.5, z);
            beam.castShadow = true;
            this.scene.add(beam);
        }
        
        // Add simple lighting
        this.createChandeliers(length, height);
    }
    

    
    createChandeliers(length, height) {
        // Simple lighting fixtures
        const positions = [-60, 0, 60];
        
        positions.forEach((z, index) => {
            // Simple point light with visible fixture
            const fixtureGeo = new THREE.SphereGeometry(2, 8, 8);
            const fixtureMat = new THREE.MeshStandardMaterial({ 
                color: 0xfff8dc,
                emissive: 0xffdd88,
                emissiveIntensity: 0.5,
                roughness: 0.3
            });
            const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixture.position.set(0, height - 5, z);
            this.scene.add(fixture);
            
            // Point light
            const light = new THREE.PointLight(0xffd699, 2, 80);
            light.position.set(0, height - 5, z);
            if (index === 1) { // Only center light casts shadows
                light.castShadow = true;
                light.shadow.mapSize.width = 512;
                light.shadow.mapSize.height = 512;
            }
            this.scene.add(light);
        });
    }
    


    createArchedWall(x, z, width, height, wallMaterial) {
        // Simple solid wall with opening
        const openingWidth = 40;
        const openingHeight = 35;
        const sideWidth = (width - openingWidth) / 2;
        
        // Left section
        const leftSection = new THREE.BoxGeometry(sideWidth, height, 12);
        const leftMesh = new THREE.Mesh(leftSection, wallMaterial);
        leftMesh.position.set(x - (openingWidth/2 + sideWidth/2), height/2, z);
        leftMesh.receiveShadow = true;
        this.scene.add(leftMesh);
        
        // Right section
        const rightSection = new THREE.BoxGeometry(sideWidth, height, 12);
        const rightMesh = new THREE.Mesh(rightSection, wallMaterial);
        rightMesh.position.set(x + (openingWidth/2 + sideWidth/2), height/2, z);
        rightMesh.receiveShadow = true;
        this.scene.add(rightMesh);
        
        // Top section above opening
        const topSection = new THREE.BoxGeometry(openingWidth, height - openingHeight, 12);
        const topMesh = new THREE.Mesh(topSection, wallMaterial);
        topMesh.position.set(x, height - (height - openingHeight)/2, z);
        topMesh.receiveShadow = true;
        this.scene.add(topMesh);
    }





    onKeyDown(event) {
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                this.moveForward = true;
                break;
            case 37: // left
            case 65: // a
                this.moveLeft = true;
                break;
            case 40: // down
            case 83: // s
                this.moveBackward = true;
                break;
            case 39: // right
            case 68: // d
                this.moveRight = true;
                break;
            case 32: // space
                if (this.canJump === true) this.velocity.y += 350;
                this.canJump = false;
                break;
        }
    }

    onKeyUp(event) {
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                this.moveForward = false;
                break;
            case 37: // left
            case 65: // a
                this.moveLeft = false;
                break;
            case 40: // down
            case 83: // s
                this.moveBackward = false;
                break;
            case 39: // right
            case 68: // d
                this.moveRight = false;
                break;
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

    create3DSearchInterface(width, length, height) {
        // Create canvas for search interface
        this.searchCanvas = document.createElement('canvas');
        this.searchCanvas.width = 1024;
        this.searchCanvas.height = 512;
        
        // Draw search interface on canvas
        this.drawSearchCanvas();
        
        // Create texture from canvas
        this.searchTexture = new THREE.CanvasTexture(this.searchCanvas);
        this.searchTexture.needsUpdate = true;
        
        // Create plane for search interface
        const searchGeo = new THREE.PlaneGeometry(40, 20);
        const searchMat = new THREE.MeshBasicMaterial({ 
            map: this.searchTexture,
            transparent: true
        });
        
        // Add frame around search interface first (behind the search panel)
        const frameGeo = new THREE.BoxGeometry(44, 24, 2);
        const frameMat = new THREE.MeshStandardMaterial({ 
            color: 0x3e2723,
            roughness: 0.5,
            metalness: 0.1
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(0, 25, -length/2 + 12.5);
        this.scene.add(frame);
        
        this.searchMesh = new THREE.Mesh(searchGeo, searchMat);
        this.searchMesh.position.set(0, 25, -length/2 + 14.5); // Clearly in front of frame
        this.searchMesh.userData.isSearchInterface = true;
        this.searchMesh.renderOrder = 1; // Render after frame to avoid z-fighting
        this.scene.add(this.searchMesh);
        
        // Add spotlight for the search interface
        const spotLight = new THREE.SpotLight(0xffffff, 2);
        spotLight.position.set(0, 40, -length/2 + 15);
        spotLight.angle = 0.5;
        spotLight.penumbra = 0.3;
        spotLight.target = this.searchMesh;
        this.scene.add(spotLight);
    }
    
    drawSearchCanvas() {
        const ctx = this.searchCanvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, this.searchCanvas.width, this.searchCanvas.height);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LANDMARK SEARCH', this.searchCanvas.width / 2, 80);
        
        // Subtitle
        ctx.font = '24px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Click here to search for a country', this.searchCanvas.width / 2, 130);
        
        // Search box visual
        const boxX = this.searchCanvas.width / 2 - 300;
        const boxY = 180;
        const boxWidth = 600;
        const boxHeight = 80;
        
        // Search box background
        ctx.fillStyle = '#2a2a2a';
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();
        
        // Placeholder text
        ctx.fillStyle = '#888888';
        ctx.font = '32px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Enter a country name...', boxX + 30, boxY + 52);
        
        // Search icon
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(boxX + boxWidth - 60, boxY + 40, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(boxX + boxWidth - 45, boxY + 55);
        ctx.lineTo(boxX + boxWidth - 35, boxY + 65);
        ctx.stroke();
        
        // Instructions
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Walk up and click to activate search', this.searchCanvas.width / 2, 350);
        
        // Decorative border
        ctx.strokeStyle = '#b8860B';
        ctx.lineWidth = 8;
        ctx.strokeRect(20, 20, this.searchCanvas.width - 40, this.searchCanvas.height - 40);
    }
    
    onMouseClick(event) {
        // Don't process clicks if search overlay is visible
        const overlay = document.getElementById('search-overlay');
        if (overlay && overlay.style.display === 'flex') return;
        
        // Only process clicks when pointer lock is active
        if (!this.controls || !this.controls.enabled) return;
        
        // Get center of screen (where camera is pointing)
        this.mouse.x = 0;
        this.mouse.y = 0;
        
        // Update raycaster from camera center
        this.mouseRaycaster.setFromCamera(this.mouse, this.camera);
        
        // Check for intersection with search mesh
        if (this.searchMesh) {
            const intersects = this.mouseRaycaster.intersectObject(this.searchMesh);
            
            if (intersects.length > 0) {
                // Check distance - only activate if close enough
                const distance = intersects[0].distance;
                if (distance < 50) { // Within 50 units
                    this.activateSearchInput();
                }
            }
        }
    }
    
    activateSearchInput() {
        // Show overlay input immediately (before exiting pointer lock)
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        // Exit pointer lock to show cursor
        document.exitPointerLock();
        
        // Focus input after a short delay
        const input = document.getElementById('search-input-field');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }

    setupUI() {
        // Setup overlay search
        const overlaySubmit = document.getElementById('search-overlay-submit');
        const overlayInput = document.getElementById('search-input-field');
        const overlayClose = document.getElementById('search-overlay-close');
        const overlay = document.getElementById('search-overlay');
        
        // Stop clicks on overlay from propagating to the world
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        if (overlaySubmit && overlayInput) {
            const submitSearch = () => {
                const country = overlayInput.value;
                if (country) {
                    this.logText(country);
                    overlayInput.value = '';
                    if (overlay) overlay.style.display = 'none';
                    // Re-request pointer lock
                    setTimeout(() => {
                        document.body.requestPointerLock = document.body.requestPointerLock || 
                                                          document.body.mozRequestPointerLock || 
                                                          document.body.webkitRequestPointerLock;
                        document.body.requestPointerLock();
                    }, 100);
                }
            };
            
            overlaySubmit.addEventListener('click', (e) => {
                e.stopPropagation();
                submitSearch();
            });
            overlayInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitSearch();
            });
        }
        
        if (overlayClose && overlay) {
            overlayClose.addEventListener('click', (e) => {
                e.stopPropagation();
                overlay.style.display = 'none';
                overlayInput.value = '';
                // Re-request pointer lock
                setTimeout(() => {
                    document.body.requestPointerLock = document.body.requestPointerLock || 
                                                      document.body.mozRequestPointerLock || 
                                                      document.body.webkitRequestPointerLock;
                    document.body.requestPointerLock();
                }, 100);
            });
        }
    }

    async logText(country) {
        // Show loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('visible');
        }
        
        // Use test data when "test123" is entered
        if (country.toLowerCase() === 'test123') {
            const sampleText = `Eiffel Tower: An iconic wrought-iron lattice tower on the Champ de Mars in Paris, built in 1889 for the World's Fair. Standing at 324 meters tall, it was the world's tallest structure until 1930 and remains France's most visited paid monument with millions of tourists annually. / Statue of Liberty: A colossal neoclassical sculpture on Liberty Island in New York Harbor, gifted by France to the United States in 1886. The copper statue represents Libertas, the Roman goddess of liberty, and has become an enduring symbol of freedom and democracy welcoming immigrants to America. / Great Wall of China: An ancient series of fortifications built across northern China to protect against invasions, stretching over 13,000 miles. Construction began in the 7th century BC and continued through various dynasties. It's one of the most impressive architectural feats in human history and a UNESCO World Heritage site. / Taj Mahal: An ivory-white marble mausoleum on the right bank of the Yamuna river in Agra, India, commissioned by Mughal emperor Shah Jahan in 1632 for his beloved wife. This stunning monument to love combines Persian, Islamic, and Indian architectural styles and is considered the jewel of Muslim art.`;
            
            console.log("Using sample data:", sampleText);
            this.processText(sampleText);
            
            // Hide loading indicator
            if (loadingIndicator) {
                loadingIndicator.classList.remove('visible');
            }
            return;
        }
        
        // Real API code for actual searches
        if (!this.apikey) {
            if (loadingIndicator) {
                loadingIndicator.classList.remove('visible');
            }
            alert("Please set VITE_OPENAI_API_KEY in .env");
            return;
        }

        try {
            const response = await fetch(this.openaiURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apikey}`,
                },
                body: JSON.stringify({
                    model: this.ai_model,
                    messages: [{
                        role: "user",
                        content: `For the country of ${country}, I want you to return a brief description of each of this country's 4 most famous landmarks. Each description should be aproximately 45 words in length. Give your response in the following format: "Insert name of landmark 1 here: Insert Description 1 here (delimit with "/" symbol) Insert name of landmark 2 here: Insert Description 2 here (delimit with "/" symbol) Insert name of landmark 3 here: Insert Description 3 here (delimit with "/" symbol) Insert name of landmark 4 here: Insert Description 4 here"." It is vitally important that you delimit between each landmark with a / symbol`,
                    }],
                    max_completion_tokens: 10000,
                }),
            });

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                const generatedText = data.choices[0].message.content;
                console.log(generatedText);
                this.processText(generatedText);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            // Hide loading indicator
            if (loadingIndicator) {
                loadingIndicator.classList.remove('visible');
            }
        }
    }

    processText(generatedText) {
        try {
            const parts = generatedText.split('/');
            const landmarks = [];
            
            for (let i = 0; i < 4; i++) {
                if (parts[i]) {
                    const [name, desc] = parts[i].split(':');
                    landmarks.push({
                        name: name ? name.trim() : "",
                        desc: desc ? desc.trim() : ""
                    });
                }
            }

            this.placeText(landmarks);
            this.logImage(landmarks);

        } catch (error) {
            console.error("Error processing text", error);
        }
    }

    createStandingPlaque(x, y, z, rotationY, width = 18, height = 13) {
        const group = new THREE.Group();

        // Simple base
        const baseGeo = new THREE.CylinderGeometry(2, 2.5, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ 
            color: 0x3e2723,
            roughness: 0.6
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.25;
        group.add(base);

        // Thin pole - shortened to stop well below plaque
        const poleGeo = new THREE.CylinderGeometry(0.4, 0.4, 5.5, 6);
        const pole = new THREE.Mesh(poleGeo, baseMat);
        pole.position.y = 3.25;
        group.add(pole);

        // Simple plaque board
        const plaqueGeo = new THREE.BoxGeometry(width, height, 0.5);
        const plaqueMat = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5dc,
            roughness: 0.7
        });
        const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
        plaque.position.y = 7.5;
        plaque.rotation.x = -0.1;
        group.add(plaque);

        // Simple dark border
        const borderGeo = new THREE.BoxGeometry(width + 0.5, height + 0.5, 0.4);
        const borderMat = new THREE.MeshStandardMaterial({ 
            color: 0x3e2723,
            roughness: 0.6
        });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.y = 7.5;
        border.position.z = -0.2;
        border.rotation.x = -0.1;
        group.add(border);

        group.position.set(x, y, z);
        group.rotation.y = rotationY;
        
        this.scene.add(group);
        return { group, plaque };
    }

    placeText(landmarks) {
        // Clear previous meshes with proper disposal
        [this.previousMesh1, this.previousMesh2, this.previousMesh3, this.previousMesh4].forEach(meshArray => {
            meshArray.forEach(mesh => {
                this.scene.remove(mesh);
                // Dispose of all children geometries and materials
                mesh.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            });
            meshArray.length = 0;
        });

        const loader = new FontLoader();
        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
            const maxCharCount = 35; 
            const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black text on gold plaque

            landmarks.forEach((landmark, index) => {
                if (!landmark.name) return;
                
                const fullText = landmark.name + '\n\n' + landmark.desc;
                const lines = fullText.match(new RegExp('.{1,' + maxCharCount + '}', 'g')) || [];
                
                const meshArray = [this.previousMesh1, this.previousMesh2, this.previousMesh3, this.previousMesh4][index];
                
                let x, y, z, rotY;
                
                // Position standing plaque to the side of artwork on floor
                // Images are at x=±38, z=±40, plaques offset more to the side and closer
                
                if (index === 0) {
                    x = -35; y = 0; z = 60; rotY = Math.PI / 2; // Left wall, to the side of image 1
                } else if (index === 1) {
                    x = 35; y = 0; z = 60; rotY = -Math.PI / 2; // Right wall, to the side of image 2
                } else if (index === 2) {
                    x = -35; y = 0; z = -60; rotY = Math.PI / 2; // Left wall, to the side of image 3
                } else if (index === 3) {
                    x = 35; y = 0; z = -60; rotY = -Math.PI / 2; // Right wall, to the side of image 4
                }
                
                // Create standing plaque
                const { group: plaqueGroup, plaque } = this.createStandingPlaque(x, y, z, rotY);
                meshArray.push(plaqueGroup); // Track for cleanup

                // Add Text to Plaque
                const lineHeight = 1.0;
                const startY = 7.5 + (lines.length * lineHeight) / 2 - 0.5;
                const plaqueAngle = -0.1;
                
                lines.forEach((line, lineIndex) => {
                    const textGeometry = new TextGeometry(line, {
                        font: font,
                        size: 0.75,
                        height: 0.05,
                        curveSegments: 6,
                        bevelEnabled: false
                    });

                    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                    
                    // Center text on plaque
                    textGeometry.computeBoundingBox();
                    const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
                    
                    const currentY = startY - (lineIndex * lineHeight);
                    const yOffset = currentY - 7.5; // Distance from plaque center
                    // Flip direction: as Y decreases (going down), Z should increase (come forward)
                    const zOffset = -yOffset * Math.tan(Math.abs(plaqueAngle));
                    
                    // Position text to follow the angled plaque surface
                    textMesh.position.set(
                        -textWidth / 2,
                        currentY,
                        0.3 + zOffset // Close to plaque surface
                    );
                    textMesh.rotation.x = plaqueAngle; // Match plaque angle

                    plaqueGroup.add(textMesh);
                });
            });
        });
    }

    async logImage(landmarks) {
        // Check if we're in test mode (based on landmark names)
        const isTestMode = landmarks.some(l => l.name && (l.name.includes('Eiffel Tower') || l.name.includes('Statue of Liberty')));
        
        if (isTestMode) {
            const sampleImageUrls = [
                'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800', // Eiffel Tower
                'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=800', // Statue of Liberty
                'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800', // Great Wall
                'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800'  // Taj Mahal
            ];
            
            console.log("Using sample images");
            this.placeImage(sampleImageUrls);
            return;
        }
        
        // Original API code:
        if (!this.googleApiKey || !this.googleCx) {
            console.warn("Google API keys missing");
            return;
        }

        const fetchImage = async (landmarkName) => {
            const url = `${this.search_url}?key=${this.googleApiKey}&cx=${this.googleCx}&searchType=image&q=${encodeURIComponent(landmarkName)}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    return this.cors_proxy + data.items[0].link;
                }
            } catch (error) {
                console.error("Error fetching image", error);
            }
            return null;
        };

        const imagePromises = landmarks.map(l => fetchImage(l.name));
        const imageUrls = await Promise.all(imagePromises);
        
        this.placeImage(imageUrls);
    }

    cleanupPreviousImages() {
        // Remove and dispose previous image groups
        this.previousImageGroups.forEach(group => {
            this.scene.remove(group);
            group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        this.previousImageGroups = [];
        
        // Remove and dispose spotlights
        this.previousSpotLights.forEach(light => {
            this.scene.remove(light);
            if (light.dispose) light.dispose();
        });
        this.previousSpotLights = [];
    }

    placeImage(imageUrls) {
        // Clean up previous images before adding new ones
        this.cleanupPreviousImages();
        
        const imageLoader = new THREE.TextureLoader();
        const geometry = new THREE.PlaneGeometry(37, 37);
        
        // Simple wooden frame
        this.createWoodenFrame = (x, y, z, rotY, group) => {
            // Single frame layer
            const frameGeo = new THREE.BoxGeometry(42, 42, 2);
            const frameMat = new THREE.MeshStandardMaterial({ 
                color: 0x3e2723,
                roughness: 0.5,
                metalness: 0.1
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.z = 0;
            group.add(frame);
        };
        
        const frameGeometry = new THREE.BoxGeometry(46, 46, 2);
        const frameMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3e2723, // Placeholder, will be replaced by wooden frame
            roughness: 0.4,
            metalness: 0.1
        });
        
        imageUrls.forEach((url, index) => {
            if (!url) {
                console.log(`Image ${index} has no URL`);
                return;
            }
            
            console.log(`Loading image ${index}:`, url);
            
            imageLoader.load(
                url,
                (texture) => {
                    console.log(`Successfully loaded image ${index}`);
                    const material = new THREE.MeshBasicMaterial({ map: texture });
                    const mesh = new THREE.Mesh(geometry, material);
                    
                    const group = new THREE.Group();
                    
                    // Create elaborate wooden frame
                    this.createWoodenFrame(0, 0, 0, 0, group);
                    
                    group.add(mesh);
                    mesh.position.z = 2; // In front of frame

                // Add a spotlight for this art (only first two cast shadows)
                const spotLight = new THREE.SpotLight(0xffffff, 1.5);
                spotLight.angle = 0.6;
                spotLight.penumbra = 0.3;
                spotLight.decay = 1;
                spotLight.distance = 100;
                if (index < 2) {
                    spotLight.castShadow = true;
                    spotLight.shadow.mapSize.width = 512;
                    spotLight.shadow.mapSize.height = 512;
                }
                spotLight.target = group;
                
                let x, y, z, rotY;
                
                if (index === 0) {
                    x = -45; y = 27; z = 40; rotY = Math.PI / 2;
                    spotLight.position.set(x - 10, 40, z);
                } else if (index === 1) {
                    x = 45; y = 27; z = 40; rotY = -Math.PI / 2;
                    spotLight.position.set(x + 10, 40, z);
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
                
                // Track for cleanup
                this.previousImageGroups.push(group);
                this.previousSpotLights.push(spotLight);
                },
                undefined,
                (error) => {
                    console.error(`Error loading image ${index}:`, error);
                }
            );
        });
    }
}
