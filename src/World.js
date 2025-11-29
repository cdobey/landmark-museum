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

        this.MOVESPEED = 3;
        
        // API Configuration
        this.openaiURL = "https://api.openai.com/v1/chat/completions";
        this.ai_model = "gpt-3.5-turbo";
        this.apikey = import.meta.env.VITE_OPENAI_API_KEY || "";
        
        this.cors_proxy = 'https://corsproxy.io/?';
        this.search_url = 'https://www.googleapis.com/customsearch/v1';
        this.googleApiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || "";
        this.googleCx = import.meta.env.VITE_GOOGLE_SEARCH_CX || "";
    }

    init() {
        // Lights
        const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
        light.position.set(0.5, 1, 0.75);
        this.scene.add(light);
        
        this.scene.fog = new THREE.Fog(0xffffff, 0, 1500);

        // Controls
        this.controls = new PointerLockControls(this.camera);
        this.scene.add(this.controls.getObject());

        // Event Listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);

        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

        // Initial Scene Setup
        this.createEnvironment();
        
        // UI Setup
        this.setupUI();
    }

    createEnvironment() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
        floorGeometry.rotateX(-Math.PI / 2);
        
        // Local texture
        const textureLoader = new THREE.TextureLoader();
        const floorTexture = textureLoader.load('/textures/wooden_floor.png');
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(40, 40);
        
        const floor = new THREE.Mesh(floorGeometry, new THREE.MeshBasicMaterial({ map: floorTexture }));
        floor.position.set(0, -20, 0);
        this.scene.add(floor);

        // Walls
        const wallGeometry = new THREE.BoxGeometry(500, 500, 1);
        const wallTexture = textureLoader.load('/textures/brick_wall.jpg');
        const wallMaterial = new THREE.MeshBasicMaterial({ map: wallTexture });

        const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
        const wall2 = new THREE.Mesh(wallGeometry, wallMaterial);
        const wall3 = new THREE.Mesh(wallGeometry, wallMaterial);
        const wall4 = new THREE.Mesh(wallGeometry, wallMaterial);

        wall1.position.set(0, 5, -250);
        wall2.position.set(0, 5, 250);
        wall3.position.set(-250, 5, 0);
        wall4.position.set(250, 5, 0);

        wall3.rotation.y = Math.PI / 2;
        wall4.rotation.y = Math.PI / 2;

        this.scene.add(wall1);
        this.scene.add(wall2);
        this.scene.add(wall3);
        this.scene.add(wall4);
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

            if (this.controls.getObject().position.y < 10) {
                this.velocity.y = 0;
                this.controls.getObject().position.y = 10;
                this.canJump = true;
            }

            this.prevTime = time;
        } else {
            this.prevTime = performance.now();
        }
    }

    setupUI() {
        const submitBtn = document.getElementById('countrySubmit');
        const input = document.getElementById('countryInput');
        
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const country = input.value;
                if (country) this.logText(country);
            });
        }
    }

    async logText(country) {
        if (!this.apikey) {
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
                    max_tokens: 300,
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

    placeText(landmarks) {
        // Clear previous meshes
        [this.previousMesh1, this.previousMesh2, this.previousMesh3, this.previousMesh4].forEach(meshArray => {
            meshArray.forEach(mesh => this.scene.remove(mesh));
            meshArray.length = 0;
        });

        const loader = new FontLoader();
        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
            const maxCharCount = 28;
            const textMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

            landmarks.forEach((landmark, index) => {
                if (!landmark.name) return;
                
                const fullText = landmark.name + '\n' + landmark.desc;
                const lines = fullText.match(new RegExp('.{1,' + maxCharCount + '}', 'g')) || [];
                
                const meshArray = [this.previousMesh1, this.previousMesh2, this.previousMesh3, this.previousMesh4][index];
                
                lines.forEach((line, lineIndex) => {
                    const textGeometry = new TextGeometry(line, {
                        font: font,
                        size: 15,
                        height: 0.1,
                        curveSegments: 12,
                        bevelEnabled: true,
                        bevelThickness: 0.01,
                        bevelSize: 0.01,
                        bevelOffset: 0,
                        bevelSegments: 5
                    });

                    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                    
                    // Positioning logic from original code
                    if (index === 0) {
                        textMesh.position.set(-225, 210 - lineIndex * 20, -249);
                    } else if (index === 1) {
                        textMesh.position.set(249, 210 - lineIndex * 20, -225);
                        textMesh.rotation.set(0, -Math.PI / 2, 0);
                    } else if (index === 2) {
                        textMesh.position.set(225, 210 - lineIndex * 20, 249);
                        textMesh.rotation.set(0, Math.PI, 0);
                    } else if (index === 3) {
                        textMesh.position.set(-249, 210 - lineIndex * 20, 225);
                        textMesh.rotation.set(0, Math.PI / 2, 0);
                    }

                    this.scene.add(textMesh);
                    meshArray.push(textMesh);
                });
            });
        });
    }

    async logImage(landmarks) {
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

    placeImage(imageUrls) {
        const imageLoader = new THREE.TextureLoader();
        const geometry = new THREE.PlaneGeometry(150, 200);
        
        imageUrls.forEach((url, index) => {
            if (!url) return;
            
            imageLoader.load(url, (texture) => {
                const material = new THREE.MeshBasicMaterial({ map: texture });
                const mesh = new THREE.Mesh(geometry, material);
                
                if (index === 0) {
                    mesh.position.set(150, 120, -249);
                } else if (index === 1) {
                    mesh.position.set(249, 120, 150);
                    mesh.rotation.set(0, -Math.PI / 2, 0);
                } else if (index === 2) {
                    mesh.position.set(-150, 120, 249);
                    mesh.rotation.set(0, Math.PI, 0);
                } else if (index === 3) {
                    mesh.position.set(-249, 120, -150);
                    mesh.rotation.set(0, Math.PI / 2, 0);
                }
                
                this.scene.add(mesh);
            });
        });
    }
}
