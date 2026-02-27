const API_BASE = "https://your-app.onrender.com"; // Replace with your Render URL

export async function savePreset(preset) {
    const resp = await fetch(`${API_BASE}/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
    });
    if (!resp.ok) throw new Error("Failed to save preset");
    return resp.json(); // { id: "abc123" }
}

export async function fetchPreset(id) {
    const resp = await fetch(`${API_BASE}/presets/${id}`);
    if (!resp.ok) throw new Error("Preset not found");
    return resp.json();
}

export async function listPresets() {
    const resp = await fetch(`${API_BASE}/presets`);
    if (!resp.ok) throw new Error("Failed to fetch presets");
    return resp.json();
}

export function getShareURL(id) {
    return `${window.location.origin}${window.location.pathname}?preset=${id}`;
}

export function getPresetIdFromURL() {
    return new URLSearchParams(window.location.search).get("preset");
}