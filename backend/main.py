from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import uuid
import json

app = FastAPI(title="Visualizer Presets API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "presets.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS presets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


class Preset(BaseModel):
    name: str
    geometry: str
    colorPrimary: str
    colorSecondary: str
    bloomStrength: float
    sensitivity: float
    rotationSpeed: float
    wireframe: bool


@app.get("/")
def root():
    return {"status": "ok", "message": "Visualizer Presets API is running"}


@app.post("/presets")
def save_preset(preset: Preset):
    db = get_db()
    preset_id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO presets (id, name, data) VALUES (?, ?, ?)",
        (preset_id, preset.name, preset.model_dump_json())
    )
    db.commit()
    db.close()
    return {"id": preset_id}


@app.get("/presets/{preset_id}")
def get_preset(preset_id: str):
    db = get_db()
    row = db.execute(
        "SELECT name, data, created_at FROM presets WHERE id = ?",
        (preset_id,)
    ).fetchone()
    db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Preset not found")

    return {"id": preset_id, "name": row[0], "created_at": row[2], **json.loads(row[1])}


@app.get("/presets")
def list_presets(limit: int = 20):
    db = get_db()
    rows = db.execute(
        "SELECT id, name, created_at FROM presets ORDER BY created_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    db.close()
    return [{"id": r[0], "name": r[1], "created_at": r[2]} for r in rows]


@app.delete("/presets/{preset_id}")
def delete_preset(preset_id: str):
    db = get_db()
    result = db.execute("DELETE FROM presets WHERE id = ?", (preset_id,))
    db.commit()
    db.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"deleted": preset_id}