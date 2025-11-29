import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
    }

    build(width, length, height) {
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

    create3DSearchInterface(width, length, height, searchTexture) {
        // Create plane for search interface
        const searchGeo = new THREE.PlaneGeometry(40, 20);
        const searchMat = new THREE.MeshBasicMaterial({ 
            map: searchTexture,
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
        
        const searchMesh = new THREE.Mesh(searchGeo, searchMat);
        searchMesh.position.set(0, 25, -length/2 + 14.5); // Clearly in front of frame
        searchMesh.userData.isSearchInterface = true;
        searchMesh.renderOrder = 1; // Render after frame to avoid z-fighting
        this.scene.add(searchMesh);
        
        // Add spotlight for the search interface
        const spotLight = new THREE.SpotLight(0xffffff, 2);
        spotLight.position.set(0, 40, -length/2 + 15);
        spotLight.angle = 0.5;
        spotLight.penumbra = 0.3;
        spotLight.target = searchMesh;
        this.scene.add(spotLight);

        return searchMesh;
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

    createWoodenFrame(x, y, z, rotY, group) {
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
    }
}
