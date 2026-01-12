import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// --- Configuration ---
const API_URL = 'http://localhost:8000';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
// Add some fog for depth
scene.fog = new THREE.Fog(0x111111, 20, 1000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(50, 50, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(50, 50, 50);
dirLight.castShadow = true;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x00ff88, 0.5);
pointLight.position.set(-50, 50, -50);
scene.add(pointLight);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Material ---
const material = new THREE.MeshStandardMaterial({
    color: 0x0077ff,
    metalness: 0.5,
    roughness: 0.2,
});

// --- State ---
const params = {
    outer_diameter: 80.0,
    inner_diameter: 20.0,
    thickness: 8.0,
    tooth_height: 6.0,
    tooth_width: 4.0,
    num_teeth: 20,
    num_mounting_holes: 4,
    mounting_hole_diameter: 6.0
};

// --- Utils ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedUpdateModel = debounce(updateModel, 1000);

// --- UI Setup ---
function setupUI() {
    const inputs = [
        'outer_diameter', 'inner_diameter', 'thickness',
        'tooth_height', 'tooth_width', 'num_teeth',
        'num_mounting_holes', 'mounting_hole_diameter'
    ];

    inputs.forEach(key => {
        const input = document.getElementById(`inp-${key}`);
        const display = document.getElementById(`val-${key}`);

        // Init value
        input.value = params[key];
        display.innerText = params[key];

        // Listener
        input.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            params[key] = val;
            display.innerText = val;
            debouncedUpdateModel();
        });
    });

    document.getElementById('btn-download').addEventListener('click', downloadSTL);
}

setupUI();

// --- Logic ---
let currentMesh = null;
const loader = new STLLoader();
let abortController = null;

async function updateModel() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('api-error');
    loadingEl.classList.add('visible');
    errorEl.style.display = 'none';

    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();

    try {
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const geometry = loader.parse(arrayBuffer);

        // Center geometry
        geometry.center();
        geometry.computeVertexNormals();

        if (currentMesh) {
            scene.remove(currentMesh);
            currentMesh.geometry.dispose();
        }

        currentMesh = new THREE.Mesh(geometry, material);
        currentMesh.castShadow = true;
        currentMesh.receiveShadow = true;
        scene.add(currentMesh);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            errorEl.innerText = err.message;
            errorEl.style.display = 'block';
        }
    } finally {
        loadingEl.classList.remove('visible');
    }
}

async function downloadSTL() {
    try {
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gear_${params.num_teeth}t.stl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        alert('Failed to download STL');
    }
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- Resize Handler ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initial load
updateModel();
animate();
