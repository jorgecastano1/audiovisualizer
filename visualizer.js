import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

let scene, camera, renderer, mesh, particles;
let analyser, dataArray;
let settings = {};
let audioCtx;
let clock;

// ─── Scene Init ──────────────────────────────────────────────────────────────

export function initScene() {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.035);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 4;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    addLights();

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambient);

    const point1 = new THREE.PointLight(0xa855f7, 2, 20);
    point1.position.set(3, 3, 3);
    scene.add(point1);

    const point2 = new THREE.PointLight(0x06b6d4, 2, 20);
    point2.position.set(-3, -3, -3);
    scene.add(point2);
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

export function buildScene(newSettings) {
    settings = { ...newSettings };

    // Clear old mesh/particles
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh = null; }
    if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); particles = null; }

    const primary = new THREE.Color(settings.colorPrimary);
    const secondary = new THREE.Color(settings.colorSecondary);

    if (settings.geometry === "sphere") {
        buildSphere(primary, secondary);
    } else if (settings.geometry === "torus") {
        buildTorus(primary, secondary);
    } else if (settings.geometry === "icosahedron") {
        buildIcosahedron(primary, secondary);
    } else if (settings.geometry === "particles") {
        buildParticles(primary);
    }
}

function buildSphere(primary) {
    const geo = new THREE.SphereGeometry(1.5, 64, 64);
    const mat = new THREE.MeshPhongMaterial({
        color: primary,
        emissive: primary.clone().multiplyScalar(0.2),
        shininess: 80,
        wireframe: settings.wireframe,
    });
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
}

function buildTorus(primary) {
    const geo = new THREE.TorusKnotGeometry(1.2, 0.35, 150, 20);
    const mat = new THREE.MeshPhongMaterial({
        color: primary,
        emissive: primary.clone().multiplyScalar(0.15),
        shininess: 100,
        wireframe: settings.wireframe,
    });
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
}

function buildIcosahedron(primary) {
    const geo = new THREE.IcosahedronGeometry(1.6, 4);
    const mat = new THREE.MeshPhongMaterial({
        color: primary,
        emissive: primary.clone().multiplyScalar(0.2),
        flatShading: true,
        wireframe: settings.wireframe,
    });
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
}

function buildParticles(primary) {
    const count = 4000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 8;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: primary, size: 0.04, sizeAttenuation: true });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export async function loadAudio(file) {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Stop previous source if any
    if (window._audioSource) {
        try { window._audioSource.stop(); } catch {}
    }

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    source.start();
    window._audioSource = source;
    window._analyserRef = analyser; // exposed for freq bars canvas in index.html

    return audioBuffer.duration;
}

// ─── Animate ─────────────────────────────────────────────────────────────────

function getFrequencyBands() {
    if (!analyser) return { bass: 0, mid: 0, treble: 0, avg: 0 };
    analyser.getByteFrequencyData(dataArray);

    const len = dataArray.length;
    const bass   = avg(dataArray, 0,              Math.floor(len * 0.06));
    const mid    = avg(dataArray, Math.floor(len * 0.06), Math.floor(len * 0.35));
    const treble = avg(dataArray, Math.floor(len * 0.35), len);
    const total  = avg(dataArray, 0, len);

    return {
        bass:   (bass   / 255) * settings.sensitivity,
        mid:    (mid    / 255) * settings.sensitivity,
        treble: (treble / 255) * settings.sensitivity,
        avg:    (total  / 255) * settings.sensitivity,
    };
}

function avg(arr, start, end) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += arr[i];
    return sum / (end - start);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const { bass, mid, treble, avg } = getFrequencyBands();

    if (mesh) {
        if (settings.geometry === "sphere") {
            animateSphere(bass, mid, treble);
        } else if (settings.geometry === "torus") {
            mesh.rotation.x += delta * settings.rotationSpeed * (1 + mid);
            mesh.rotation.y += delta * settings.rotationSpeed * 1.3 * (1 + bass);
            mesh.scale.setScalar(1 + bass * 0.4);
        } else if (settings.geometry === "icosahedron") {
            mesh.rotation.y += delta * settings.rotationSpeed * (1 + mid * 0.5);
            mesh.rotation.z += delta * settings.rotationSpeed * 0.5;
            animateVertices(mesh, bass, mid);
        }

        // Color pulse
        if (mesh.material && !settings.wireframe) {
            const primary = new THREE.Color(settings.colorPrimary);
            const secondary = new THREE.Color(settings.colorSecondary);
            mesh.material.emissive = primary.clone().lerp(secondary, bass).multiplyScalar(bass * 0.6);
        }
    }

    if (particles) {
        particles.rotation.y += delta * settings.rotationSpeed * 0.3 * (1 + mid);
        particles.rotation.x += delta * settings.rotationSpeed * 0.15 * (1 + bass);
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * bass * 0.02;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.material.size = 0.04 + bass * 0.06;
    }

    renderer.render(scene, camera);
}

function animateSphere(bass, mid, treble) {
    const pos = mesh.geometry.attributes.position;
    const originalPos = mesh.geometry._originalPositions;

    if (!originalPos) {
        mesh.geometry._originalPositions = pos.array.slice();
    }

    const orig = mesh.geometry._originalPositions;
    const time = Date.now() * 0.001;

    for (let i = 0; i < pos.count; i++) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        const x = orig[ix], y = orig[iy], z = orig[iz];

        const noise = Math.sin(x * 2 + time) * Math.cos(y * 2 + time) * Math.sin(z * 2 + time);
        const displacement = 1 + bass * 0.5 + noise * mid * 0.3 + treble * 0.08 * Math.sin(time * 3 + i);

        pos.array[ix] = x * displacement;
        pos.array[iy] = y * displacement;
        pos.array[iz] = z * displacement;
    }

    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.rotation.y += 0.002 + mid * settings.rotationSpeed * 0.02;
}

function animateVertices(mesh, bass, mid) {
    const pos = mesh.geometry.attributes.position;
    if (!mesh.geometry._originalPositions) {
        mesh.geometry._originalPositions = pos.array.slice();
    }
    const orig = mesh.geometry._originalPositions;
    const time = Date.now() * 0.001;

    for (let i = 0; i < pos.count; i++) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        const displacement = 1 + bass * 0.6 + mid * 0.2 * Math.sin(time + i * 0.5);
        pos.array[ix] = orig[ix] * displacement;
        pos.array[iy] = orig[iy] * displacement;
        pos.array[iz] = orig[iz] * displacement;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
}