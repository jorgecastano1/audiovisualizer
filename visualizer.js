import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

let scene, camera, renderer, mesh, particles;
let analyser, dataArray;
let settings = {};
let audioCtx;
let clock;
let rings = [];
let orbs = [];
let bgLights = [];
let flashMesh;

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
    buildBackground();
}

function buildBackground() {
    // Clear old background elements
    rings.forEach(r => scene.remove(r));
    orbs.forEach(o => scene.remove(o));
    bgLights.forEach(l => scene.remove(l));
    if (flashMesh) scene.remove(flashMesh);
    rings = []; orbs = []; bgLights = [];

    const primary   = new THREE.Color(settings.colorPrimary);
    const secondary = new THREE.Color(settings.colorSecondary);

    // ── Pulse rings (subBass) ──────────────────────
    for (let i = 0; i < 4; i++) {
        const geo = new THREE.RingGeometry(2.5 + i * 1.2, 2.6 + i * 1.2, 64);
        const mat = new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.5;
        scene.add(ring);
        rings.push(ring);
    }

    // ── Point lights (bass) ────────────────────────
    const lightPositions = [
        [4, 2, -3], [-4, -2, -3], [0, 4, -5], [3, -3, -4]
    ];
    lightPositions.forEach(([x, y, z], i) => {
        const light = new THREE.PointLight(
            i % 2 === 0 ? primary : secondary,
            0, 12
        );
        light.position.set(x, y, z);
        scene.add(light);
        bgLights.push(light);
    });

    // ── Floating orbs (mid) ────────────────────────
    for (let i = 0; i < 6; i++) {
        const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.1, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? primary : secondary,
            transparent: true,
            opacity: 0.6,
        });
        const orb = new THREE.Mesh(geo, mat);
        orb.position.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 4 - 2
        );
        orb._basePosition = orb.position.clone();
        orb._phase = Math.random() * Math.PI * 2;
        scene.add(orb);
        orbs.push(orb);
    }

    // ── Full screen flash mesh (onset) ────────────
    const flashGeo = new THREE.PlaneGeometry(40, 40);
    const flashMat = new THREE.MeshBasicMaterial({
        color: primary,
        transparent: true,
        opacity: 0,
        depthWrite: false,
    });
    flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.z = -8;
    scene.add(flashMesh);
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

const energyHistory = new Array(43).fill(0);
let prevTreble = 0;

function getBand(low, high) {
    const nyquist = 24000;
    const binSize = nyquist / analyser.frequencyBinCount;
    const start = Math.floor(low / binSize);
    const end = Math.floor(high / binSize);
    let sum = 0;
    for (let i = start; i < end; i++) sum += dataArray[i];
    return (sum / (end - start) / 255) * settings.sensitivity;
}

function isBeat() {
    let energy = 0;
    for (let i = 0; i < 10; i++) energy += dataArray[i] ** 2;
    energy /= 10;

    const avgEnergy = energyHistory.reduce((a, b) => a + b) / energyHistory.length;
    energyHistory.shift();
    energyHistory.push(energy);

    return energy > avgEnergy * 1.4;
}

function getFrequencyBands() {
    if (!analyser) return { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, beat: false, onset: false };
    analyser.getByteFrequencyData(dataArray);

    const treble = getBand(4000, 16000);
    const onset = (treble - prevTreble) > 0.15;
    prevTreble = treble;

    return {
        subBass:  getBand(20, 60),
        bass:     getBand(60, 250),
        lowMid:   getBand(250, 500),
        mid:      getBand(500, 2000),
        highMid:  getBand(2000, 4000),
        treble,
        beat:     isBeat(),
        onset,
    };
}

function avg(arr, start, end) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += arr[i];
    return sum / (end - start);
}

function animateBackground(bands) {
    if (!flashMesh) return;
    const { subBass, bass, lowMid, mid, treble, onset } = bands;
    const time = Date.now() * 0.001;
    const primary   = new THREE.Color(settings.colorPrimary);
    const secondary = new THREE.Color(settings.colorSecondary);

    rings.forEach((ring, i) => {
        const delay = i * 0.15;
        const pulse = Math.max(0, subBass - delay * 0.3);
        ring.scale.setScalar(1 + pulse * 1.8);
        ring.material.opacity = pulse * 0.35;
        ring.material.color.lerpColors(primary, secondary, subBass);
    });

    bgLights.forEach((light, i) => {
        light.intensity = bass * 6 + 0.2;
        light.color.lerpColors(
            i % 2 === 0 ? primary : secondary,
            i % 2 === 0 ? secondary : primary,
            bass
        );
        const angle = time * 0.3 + (i * Math.PI / 2);
        light.position.x = Math.cos(angle) * 4;
        light.position.z = Math.sin(angle) * 4 - 2;
    });

    orbs.forEach((orb, i) => {
        const phase = orb._phase;
        orb.position.x = orb._basePosition.x + Math.sin(time * 0.4 + phase) * (0.3 + mid * 1.2);
        orb.position.y = orb._basePosition.y + Math.cos(time * 0.3 + phase) * (0.3 + mid * 0.8);
        orb.material.opacity = 0.3 + mid * 0.7;
        const scale = 1 + mid * 2 + treble * 0.5;
        orb.scale.setScalar(scale);
        orb.material.color.lerpColors(primary, secondary, (Math.sin(time + phase) + 1) / 2);
    });

    if (onset) flashMesh.material.opacity = 0.08;
    flashMesh.material.opacity *= 0.82;
    flashMesh.material.color.copy(primary);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const bands = getFrequencyBands();
    const { subBass, bass, lowMid, mid, highMid, treble, beat, onset } = bands;

    if (mesh) {
        if (settings.geometry === "sphere") {
            animateSphere(bass, mid, treble);
        } else if (settings.geometry === "torus") {
            mesh.rotation.x += delta * settings.rotationSpeed * (1 + mid);
            mesh.rotation.y += delta * settings.rotationSpeed * 1.3 * (1 + bass);
        } else if (settings.geometry === "icosahedron") {
            mesh.rotation.y += delta * settings.rotationSpeed * (1 + mid * 0.5);
            mesh.rotation.z += delta * settings.rotationSpeed * 0.5;
            animateVertices(mesh, bass, mid);
        }

        if (mesh.material && !settings.wireframe) {
            const primary = new THREE.Color(settings.colorPrimary);
            const secondary = new THREE.Color(settings.colorSecondary);
            mesh.material.emissive = primary.clone().lerp(secondary, bass).multiplyScalar(bass * 0.6);
        }

        if (beat) mesh.scale.setScalar(1.3);
        mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);
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

    animateBackground(bands);
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