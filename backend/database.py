"""
SQLite database setup and helper functions.
"""
import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "sdf_platform.db")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create all tables on first run."""
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS inspections (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT NOT NULL,
            original_url   TEXT,
            annotated_url  TEXT,
            defects_count  INTEGER DEFAULT 0,
            defects        TEXT DEFAULT '[]',   -- JSON
            inference_time REAL DEFAULT 0,
            process_node   TEXT DEFAULT '7nm',
            layer_type     TEXT DEFAULT 'Metal',
            metrics        TEXT DEFAULT '{}',   -- JSON
            step_images    TEXT DEFAULT '{}',   -- JSON
            severity       TEXT DEFAULT 'None',
            created_at     TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS defect_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER REFERENCES inspections(id),
            label       TEXT,
            confidence  REAL,
            class_id    INTEGER,
            box_x1 REAL, box_y1 REAL, box_x2 REAL, box_y2 REAL,
            crop_url    TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS reports (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT,
            inspection_id INTEGER REFERENCES inspections(id),
            pdf_path    TEXT,
            pdf_url     TEXT,
            size_kb     REAL,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS system_logs (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            level   TEXT DEFAULT 'INFO',
            message TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """)
    try:
        seed_data()
    except Exception as e:
        print(f"Failed to seed database: {e}")
    log_event("INFO", "Database initialised")


def seed_data():
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM inspections").fetchone()[0]
        if count > 0:
            return
        
        # Insert historical scans
        import random
        from datetime import datetime, timedelta
        
        nodes = ["3nm", "5nm", "7nm", "14nm", "28nm"]
        layers = ["Metal Interconnect", "Gate Poly", "Active Diffusion", "Contact/Via"]
        defect_labels = ["scratch", "crack", "contamination", "overlay_shift", "dead_die", "burn_mark", "pattern_damage"]
        
        now = datetime.now()
        for i in range(25):
            days_ago = 25 - i
            timestamp = (now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))).isoformat()
            
            filename = f"historical_wafer_{100 + i}.png"
            dc = random.randint(0, 8)
            
            defects = []
            for j in range(dc):
                defects.append({
                    "box": [random.randint(100, 400), random.randint(100, 400), random.randint(150, 450), random.randint(150, 450)],
                    "confidence": round(random.uniform(0.5, 0.98), 4),
                    "class_id": random.randint(0, 6),
                    "label": random.choice(defect_labels),
                    "crop_image": ""
                })
            
            if dc > 6:
                sev = "Critical"
            elif dc > 4:
                sev = "High"
            elif dc > 2:
                sev = "Medium"
            elif dc > 0:
                sev = "Low"
            else:
                sev = "None"
                
            overlay_shift = round(random.uniform(1.5, 12.0), 2)
            overlay_x = round(random.uniform(-overlay_shift, overlay_shift), 2)
            overlay_y = round((abs(overlay_shift**2 - overlay_x**2))**0.5 * random.choice([-1, 1]), 2)
            
            metrics = {
                "overlay_shift": overlay_shift,
                "overlay_x": overlay_x,
                "overlay_y": overlay_y,
                "rotation_misalignment": round(random.uniform(0.01, 0.12), 3),
                "edge_placement_error": round(overlay_shift * random.uniform(0.8, 1.1), 2),
                "alignment_confidence": round(random.uniform(75.0, 99.8), 1),
                "defect_severity": sev,
                "severity_score": round(min(10.0, dc * 1.3 + random.uniform(0.5, 2.0)), 1),
                "mean_intensity": round(random.uniform(110.0, 160.0), 2),
                "std_dev": round(random.uniform(35.0, 55.0), 2),
                "edge_density_pct": round(random.uniform(1.2, 5.5), 2)
            }
            
            cur = conn.execute(
                """INSERT INTO inspections
                   (filename, original_url, annotated_url, defects_count,
                    defects, inference_time, process_node, layer_type,
                    metrics, step_images, severity, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    filename,
                    "", # No actual image file for mock seed
                    "",
                    dc,
                    json.dumps(defects),
                    round(random.uniform(0.04, 0.18), 4),
                    random.choice(nodes),
                    random.choice(layers),
                    json.dumps(metrics),
                    "{}",
                    sev,
                    timestamp
                )
            )
            inspection_id = cur.lastrowid
            
            # Save defect events
            for d in defects:
                box = d["box"]
                conn.execute(
                    """INSERT INTO defect_events
                       (inspection_id, label, confidence, class_id,
                        box_x1, box_y1, box_x2, box_y2, crop_url, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (
                        inspection_id,
                        d["label"],
                        d["confidence"],
                        d["class_id"],
                        box[0], box[1], box[2], box[3],
                        "",
                        timestamp
                    )
                )


def log_event(level: str, message: str):
    try:
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO system_logs (level, message) VALUES (?, ?)",
                (level, message)
            )
    except Exception:
        pass


def save_inspection(data: dict) -> int:
    """Persist an inspection and its defects; return the new row id."""
    defects = data.get("defects", [])
    metrics = data.get("metrics", {})
    step_images = data.get("step_images", {})

    dc = data.get("defects_count", len(defects))
    if dc > 6:
        sev = "Critical"
    elif dc > 4:
        sev = "High"
    elif dc > 2:
        sev = "Medium"
    elif dc > 0:
        sev = "Low"
    else:
        sev = "None"

    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO inspections
               (filename, original_url, annotated_url, defects_count,
                defects, inference_time, process_node, layer_type,
                metrics, step_images, severity)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                data.get("filename"),
                data.get("original_image"),
                data.get("annotated_image"),
                dc,
                json.dumps(defects),
                data.get("inference_time", 0),
                data.get("process_node", "7nm"),
                data.get("layer_type", "Metal"),
                json.dumps(metrics),
                json.dumps(step_images),
                sev,
            ),
        )
        inspection_id = cur.lastrowid

        for d in defects:
            box = d.get("box", [0, 0, 0, 0])
            conn.execute(
                """INSERT INTO defect_events
                   (inspection_id, label, confidence, class_id,
                    box_x1, box_y1, box_x2, box_y2, crop_url)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    inspection_id,
                    d.get("label"),
                    d.get("confidence"),
                    d.get("class_id"),
                    box[0] if len(box) > 0 else 0,
                    box[1] if len(box) > 1 else 0,
                    box[2] if len(box) > 2 else 0,
                    box[3] if len(box) > 3 else 0,
                    d.get("crop_image"),
                ),
            )

    log_event("INFO", f"Inspection saved: {data.get('filename')} — {dc} defects")
    return inspection_id
