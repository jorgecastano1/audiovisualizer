import { savePreset, fetchPreset, listPresets, renamePreset, getShareURL, getPresetIdFromURL } from "./api.js";

export const defaults = {
    geometry: "sphere",
    colorPrimary: "#a855f7",
    colorSecondary: "#06b6d4",
    bloomStrength: 1.5,
    sensitivity: 1.2,
    rotationSpeed: 0.3,
    wireframe: false,
};

export let currentSettings = { ...defaults };

export function initControls(onSettingsChange) {
    // Bind all control inputs
    const bindings = [
        { id: "geometrySelect",    key: "geometry",       parse: v => v },
        { id: "colorPrimary",      key: "colorPrimary",   parse: v => v },
        { id: "colorSecondary",    key: "colorSecondary", parse: v => v },
        { id: "bloomStrength",     key: "bloomStrength",  parse: parseFloat },
        { id: "sensitivity",       key: "sensitivity",    parse: parseFloat },
        { id: "rotationSpeed",     key: "rotationSpeed",  parse: parseFloat },
        { id: "wireframeToggle",   key: "wireframe",      parse: v => v === "true" || v === true },
    ];

    bindings.forEach(({ id, key, parse }) => {
        const el = document.getElementById(id);
        if (!el) return;

        // Set initial value
        if (el.type === "checkbox") {
            el.checked = currentSettings[key];
        } else {
            el.value = currentSettings[key];
        }

        // Update display labels
        updateLabel(id, currentSettings[key]);

        el.addEventListener("input", (e) => {
            const raw = el.type === "checkbox" ? el.checked : e.target.value;
            currentSettings[key] = parse(raw);
            updateLabel(id, currentSettings[key]);
            onSettingsChange(currentSettings);
        });
    });

    // Save preset button
    document.getElementById("saveBtn").addEventListener("click", async () => {
        const name = document.getElementById("presetName").value.trim() || "Untitled";
        try {
            const { id } = await savePreset({ name, ...currentSettings });
            const url = getShareURL(id);
            await navigator.clipboard.writeText(url);
            showToast(`✓ Copied link for "${name}"`);
            loadPresetList();
        } catch (e) {
            showToast("✗ Failed to save preset", true);
        }
    });

    // Load preset list in sidebar
    loadPresetList();

    // Check URL for shared preset
    const presetId = getPresetIdFromURL();
    if (presetId) {
        fetchPreset(presetId)
            .then(preset => {
                applyPreset(preset, onSettingsChange);
                showToast(`Loaded preset: "${preset.name}"`);
            })
            .catch(() => showToast("✗ Preset not found", true));
    }
}

export function applyPreset(preset, onSettingsChange) {
    const keys = ["geometry", "colorPrimary", "colorSecondary", "bloomStrength", "sensitivity", "rotationSpeed", "wireframe"];
    keys.forEach(key => {
        if (preset[key] !== undefined) currentSettings[key] = preset[key];
    });

    // Sync DOM
    const elMap = {
        geometry: "geometrySelect",
        colorPrimary: "colorPrimary",
        colorSecondary: "colorSecondary",
        bloomStrength: "bloomStrength",
        sensitivity: "sensitivity",
        rotationSpeed: "rotationSpeed",
        wireframe: "wireframeToggle",
    };

    Object.entries(elMap).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") el.checked = currentSettings[key];
        else el.value = currentSettings[key];
        updateLabel(id, currentSettings[key]);
    });

    onSettingsChange(currentSettings);
}

async function loadPresetList() {
    try {
        const presets = await listPresets();
        const list = document.getElementById("presetList");
        list.innerHTML = "";
        presets.forEach(p => {
            const item = document.createElement("div");
            item.className = "preset-item";
            item.innerHTML = `<span class="preset-name">${p.name}</span><span class="preset-id">#${p.id}</span><button type="button" class="preset-rename-btn" title="Rename preset" aria-label="Rename preset">✎</button>`;
            const renameBtn = item.querySelector(".preset-rename-btn");
            renameBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const newName = prompt("New preset name:", p.name);
                if (newName == null || newName.trim() === "") return;
                try {
                    await renamePreset(p.id, newName.trim());
                    await loadPresetList();
                    showToast(`Renamed to "${newName.trim()}"`);
                } catch {
                    showToast("✗ Failed to rename preset", true);
                }
            });
            item.addEventListener("click", async (e) => {
                if (e.target.closest(".preset-rename-btn")) return;
                try {
                    const full = await fetchPreset(p.id);
                    document.dispatchEvent(new CustomEvent("loadPreset", { detail: full }));
                    showToast(`Loaded: "${full.name}"`);
                } catch {
                    showToast("✗ Failed to load preset", true);
                }
            });
            list.appendChild(item);
        });
    } catch {
        // silently fail if backend not yet connected
    }
}

function updateLabel(id, value) {
    const label = document.querySelector(`label[for="${id}"] .value`);
    if (label) {
        if (typeof value === "number") label.textContent = parseFloat(value).toFixed(2);
        else label.textContent = value;
    }
}

export function showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = `toast ${isError ? "error" : "success"} show`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}