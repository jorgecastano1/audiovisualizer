================================================================================
WAVFORM — Audio Visualizer
================================================================================

A web-based audio visualizer that reacts to music in real time. Upload audio or
video files, customize the look (shape, colors, bloom, sensitivity), and save
or load presets. Includes a playlist and optional backend for storing presets
in a SQLite database.


FEATURES
--------
• Real-time 3D sphere visualization driven by frequency data (bass, mid, treble)
• Support for MP3, WAV, FLAC, OGG, and MP4
• Playlist: add multiple tracks, play/pause, seek, next track, loop, clear
• Customizable controls: geometry (sphere), primary/secondary colors, bloom
  strength, sensitivity, rotation speed, wireframe
• Save presets to a backend and get a shareable link (?preset=id)
• Load presets from the sidebar or by opening a shared URL
• Rename presets from the sidebar (pencil button next to each preset)
• 2D frequency bar display and background effects (rings, orbs, flash on beat)


TECH STACK
----------
• Frontend: HTML, CSS, JavaScript (ES modules). No build step.
• 3D: Three.js (scene, sphere geometry, materials, bloom, lens flare)
• Audio: HTML5 <audio> for playback; Web Audio API (AudioContext,
  createMediaElementSource, AnalyserNode, getByteFrequencyData) for
  real-time frequency analysis that drives the visualizer
• Backend: FastAPI (Python), SQLite (presets.db), Pydantic for request/response
  validation. Endpoints: GET /, POST /presets, GET /presets, GET /presets/{id},
  PATCH /presets/{id}, DELETE /presets/{id}


PROJECT STRUCTURE
-----------------
• index.html     — Main page, upload/playlist UI, controls sidebar, script entry
• visualizer.js  — Three.js scene, sphere animation, Web Audio setup, buildScene
• controls.js     — Slider/color/checkbox bindings, preset save/load/rename UI,
                    applyPreset, currentSettings
• api.js          — API client: savePreset, fetchPreset, listPresets,
                    renamePreset, getShareURL, getPresetIdFromURL (uses API_BASE)
• backend/
  • main.py       — FastAPI app, CORS, get_db(), Preset/PresetNameUpdate models,
                    CRUD + PATCH for presets (SQLite table: id, name, data JSON,
                    created_at)
  • requirements.txt — fastapi, uvicorn, pydantic


HOW TO RUN
----------
1. Frontend (visualizer)
   • Serve the project over HTTP (required for ES modules). For example:
     - Python:  python -m http.server 8000
     - Node:    npx serve .
     Then open http://localhost:8000 (or the port shown) in a browser.
   • Or open index.html via a local server you already use.

2. Backend (preset API)
   • cd backend
   • pip install -r requirements.txt
   • uvicorn main:app --reload
   • API runs at http://localhost:8000 (or the port uvicorn prints).
   • For the frontend to use this backend, set API_BASE in api.js to that URL
     (e.g. http://localhost:8000). The repo may point api.js at a deployed
     Railway URL for production.


USAGE
-----
• Drop or select an audio/video file to start. Add more for a playlist.
• Use the CONTROLS sidebar to change shape (sphere), colors, bloom, sensitivity,
  rotation speed, and wireframe. Changes apply immediately.
• Save: enter a preset name and click Save. The share link is copied to the
  clipboard. Anyone opening that link will load that preset.
• Load: click a preset in the sidebar, or open a URL that ends with ?preset=ID.
• Rename: click the pencil (✎) next to a preset in the sidebar, enter the new
  name, and confirm. The list refreshes after a successful rename.


NOTES
-----
• The backend stores presets in presets.db (SQLite) in the backend directory.
  The full preset (geometry, colors, sliders, etc.) is stored as JSON in the
  data column; name and id are separate columns for listing and lookup.
• Audio must be started by a user gesture (e.g. click Play); the Web Audio
  context may stay suspended until then on some browsers.

================================================================================
End of README — copy from this file as needed.
================================================================================
