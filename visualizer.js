import * as THREE from "three";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Lensflare, LensflareElement } from "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/objects/Lensflare.js";

let scene, camera, renderer, mesh, particles;
let composer, bloomPass, lensflare;
let analyser, dataArray;
let settings = {};
let audioCtx;
let clock;
let rings = [];
let orbs = [];
let bgLights = [];
let flashMesh;

// Playback: use HTML5 <audio> + MediaElementSource for reliable play/pause on Mac/Safari
let audioElement = null;
let objectUrl = null;
let mediaSource = null;

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
    addLensflare();
    setupBloom();

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.setPixelRatio(window.devicePixelRatio);
        }
    });

    animate();
}

function setupBloom() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        settings.bloomStrength ?? 1.5,
        0.4,
        0.2
    );
    composer.addPass(bloomPass);
}

function createFlareTexture(size = 64) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.2, "rgba(255,255,255,0.3)");
    g.addColorStop(0.5, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

function addLensflare() {
    const flareColor = new THREE.Color(0.7, 0.5, 1);
    lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(createFlareTexture(64), 120, 0, flareColor));
    lensflare.addElement(new LensflareElement(createFlareTexture(32), 60, 0.4, flareColor));
    lensflare.addElement(new LensflareElement(createFlareTexture(16), 30, 0.7, new THREE.Color(0.9, 0.8, 1)));
    lensflare.position.set(4, 3, -4);
    scene.add(lensflare);
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

    buildSphere(primary, secondary);
    buildBackground();

    // Pull camera back when sensitivity is higher so the enlarged sphere stays in frame
    const sens = settings.sensitivity ?? 1.2;
    camera.position.z = 4 + (sens - 1) * 3;
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
    for (let i = 0; i < 10; i++) {
        const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.1, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? primary : secondary,
            transparent: true,
            opacity: 0.4,
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

// ─── Audio (HTML5 <audio> + MediaElementSource for reliable play on Mac/Safari) ───

function ensureAudioGraph() {
    if (!audioElement || !audioCtx) return false;
    if (analyser) return true;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    window._analyserRef = analyser;
    return true;
}

export function getAudioCurrentTime() {
    return audioElement ? audioElement.currentTime : 0;
}

export function getAudioDuration() {
    return audioElement && isFinite(audioElement.duration) ? audioElement.duration : 0;
}

export function isAudioPlaying() {
    return audioElement ? !audioElement.paused : false;
}

export async function playAudio() {
    if (!audioElement) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    if (!ensureAudioGraph()) return;
    await audioElement.play();
}

export function pauseAudio() {
    if (audioElement) audioElement.pause();
}

export async function togglePlayPause() {
    if (isAudioPlaying()) pauseAudio();
    else await playAudio();
}

export function seekAudio(timeInSeconds) {
    if (!audioElement) return;
    const d = audioElement.duration;
    if (!isFinite(d)) return;
    const t = Math.max(0, Math.min(timeInSeconds, d));
    audioElement.currentTime = t;
}

/** @param {HTMLAudioElement} el */
export function setAudioElement(el) {
    audioElement = el;
}

export function clearAudioSource() {
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }
    if (audioElement) audioElement.src = "";
}

export function loadAudio(file) {
    return new Promise((resolve, reject) => {
        if (!audioElement) {
            reject(new Error("Audio element not set"));
            return;
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        audioElement.src = objectUrl;
        audioElement.load();
        audioElement.onloadedmetadata = () => {
            smoothedBands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, beat: false, onset: false };
            resolve(audioElement.duration);
        };
        audioElement.onerror = () => reject(new Error("Failed to load audio"));
        audioElement.onended = () => window.dispatchEvent(new CustomEvent("audioEnded"));
    });
}

// ─── Animate ─────────────────────────────────────────────────────────────────

const energyHistory = new Array(43).fill(0);
let prevTreble = 0;

// Smoothed frequency bands for cleaner, less jittery visuals
const SMOOTHING = 0.45; // lower = smoother, higher = more responsive
let smoothedBands = {
    subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0,
    beat: false, onset: false,
};

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
    if (!analyser) return smoothedBands;
    analyser.getByteFrequencyData(dataArray);

    const treble = getBand(4000, 16000);
    const onset = (treble - prevTreble) > 0.15;
    prevTreble = treble;

    const raw = {
        subBass:  getBand(20, 60),
        bass:     getBand(60, 250),
        lowMid:   getBand(250, 500),
        mid:      getBand(500, 2000),
        highMid:  getBand(2000, 4000),
        treble,
        beat:     isBeat(),
        onset,
    };

    // Lerp smoothed values toward raw for cleaner motion in tune with the music
    smoothedBands.subBass  = smoothedBands.subBass  * (1 - SMOOTHING) + raw.subBass  * SMOOTHING;
    smoothedBands.bass     = smoothedBands.bass     * (1 - SMOOTHING) + raw.bass     * SMOOTHING;
    smoothedBands.lowMid   = smoothedBands.lowMid   * (1 - SMOOTHING) + raw.lowMid   * SMOOTHING;
    smoothedBands.mid      = smoothedBands.mid      * (1 - SMOOTHING) + raw.mid      * SMOOTHING;
    smoothedBands.highMid  = smoothedBands.highMid  * (1 - SMOOTHING) + raw.highMid  * SMOOTHING;
    smoothedBands.treble   = smoothedBands.treble   * (1 - SMOOTHING) + raw.treble   * SMOOTHING;
    smoothedBands.beat     = raw.beat;
    smoothedBands.onset    = raw.onset;

    return smoothedBands;
}

function avg(arr, start, end) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += arr[i];
    return sum / (end - start);
}

function animateBackground(bands) {
    if (!flashMesh) return;
    const { subBass, bass, lowMid, mid, treble, beat, onset } = bands;
    const time = Date.now() * 0.001;
    const primary   = new THREE.Color(settings.colorPrimary);
    const secondary = new THREE.Color(settings.colorSecondary);

    rings.forEach((ring, i) => {
        const delay = i * 0.15;
        const pulse = Math.max(0, subBass - delay * 0.3);
        ring.scale.setScalar(1 + pulse * 1.8);
        ring.material.opacity = pulse * 0.62; // 0.35 = subtle, 0.6–0.8 = vibrant
        ring.material.color.lerpColors(primary, secondary, subBass);
    });

    bgLights.forEach((light, i) => {
        const baseIntensity = bass * 6 + 0.2;
        light.intensity = beat ? baseIntensity + 3 : baseIntensity;
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

    // Softer, shorter flash on onset so it doesn’t overpower
    if (onset) flashMesh.material.opacity = Math.max(flashMesh.material.opacity, 0.05);
    flashMesh.material.opacity *= 0.88;
    flashMesh.material.color.copy(primary);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const bands = getFrequencyBands();
    const { subBass, bass, lowMid, mid, highMid, treble, beat, onset } = bands;

    if (mesh) {
        animateSphere(bass, mid, treble);

        if (mesh.material && !settings.wireframe) {
            const primary = new THREE.Color(settings.colorPrimary);
            const secondary = new THREE.Color(settings.colorSecondary);
            mesh.material.emissive = primary.clone().lerp(secondary, bass).multiplyScalar(bass * 0.6);
        }

        // Beat pulse: snap up on beat, decay back so it feels in tune with tempo
        const beatLerpSpeed = beat ? 0.35 : 0.12; // faster decay after beat for tighter feel
        if (beat) mesh.scale.setScalar(1.25);
        mesh.scale.lerp(new THREE.Vector3(1, 1, 1), beatLerpSpeed);
    }

    animateBackground(bands);
    if (composer) {
        if (bloomPass) bloomPass.strength = settings.bloomStrength ?? 1.5;
        composer.render(delta);
    } else {
        renderer.render(scene, camera);
    }
}



function animateSphere(bass, mid, treble) {
    const pos = mesh.geometry.attributes.position;
    const originalPos = mesh.geometry._originalPositions;

    if (!originalPos) {
        mesh.geometry._originalPositions = pos.array.slice();
    }

    const orig = mesh.geometry._originalPositions;
    const time = Date.now() * 0.001;
    const sharpness = 1.9;

    for (let i = 0; i < pos.count; i++) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        const x = orig[ix], y = orig[iy], z = orig[iz];
        const r = Math.sqrt(x * x + y * y + z * z) || 1;
        const theta = Math.atan2(x, z);
        const phi = Math.acos(Math.max(-1, Math.min(1, y / r)));
        const noise = Math.sin(theta * 2 + time) * Math.cos(phi * 2 + time) * Math.sin(phi * 3 + time * 0.7);
        const raw = 1 + bass * 0.5 + noise * mid * 0.35 + treble * 0.1 * Math.sin(time * 3 + theta);
        const displacement = raw >= 1
            ? 1 + Math.pow(raw - 1, sharpness)
            : 1 - Math.pow(1 - raw, sharpness);

        pos.array[ix] = x * displacement;
        pos.array[iy] = y * displacement;
        pos.array[iz] = z * displacement;
    }

    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.rotation.y += 0.002 + mid * settings.rotationSpeed * 0.02;
}
