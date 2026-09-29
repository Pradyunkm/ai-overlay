import sqlite3
import os

def check():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "sdf_platform.db")
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Inspections:")
    try:
        cursor.execute("SELECT id, filename, defects_count, inference_time, created_at FROM inspections ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error: {e}")
        
    conn.close()

if __name__ == "__main__":
    check()
