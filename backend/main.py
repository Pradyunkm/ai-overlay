import os
import shutil
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# =====================================================
# IMPORT IMAGE PROCESSING
# =====================================================

from services.image_processing import convert_to_grayscale


# =====================================================
# CREATE FASTAPI APP
# =====================================================

app = FastAPI()


# =====================================================
# ENABLE CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# CREATE REQUIRED FOLDERS
# =====================================================

os.makedirs("outputs", exist_ok=True)
os.makedirs("temp", exist_ok=True)


# =====================================================
# STATIC FILE SERVING
# =====================================================

app.mount(
    "/outputs",
    StaticFiles(directory="outputs"),
    name="outputs"
)

app.mount(
    "/temp",
    StaticFiles(directory="temp"),
    name="temp"
)


# =====================================================
# GLOBAL MODEL VARIABLE
# =====================================================

model = None


# =====================================================
# LOAD BEST TRAINED MODEL
# =====================================================

def load_yolo_model():

    # =================================================
    # NEW BEST MODEL FROM COLAB
    # =================================================

    weights_path = (
        "runs/overlay_fast_model/weights/best.pt"
    )

    fallback_model = "yolo11s.pt"

    # =================================================
    # LOAD TRAINED MODEL
    # =================================================

    if os.path.exists(weights_path):

        print(f"\n[YOLO] Loading trained model:")
        print(weights_path)

        return YOLO(weights_path)

    # =================================================
    # FALLBACK MODEL
    # =================================================

    print("\n[YOLO] Trained model not found.")
    print(f"[YOLO] Using fallback model: {fallback_model}")

    return YOLO(fallback_model)

    fallback_model = "yolo11s.pt"

    # Use trained model if exists
    if os.path.exists(weights_path):

        print(f"\n[YOLO] Loading trained model:")
        print(weights_path)

        return YOLO(weights_path)

    # Fallback
    print("\n[YOLO] Trained model not found.")
    print(f"[YOLO] Using fallback model: {fallback_model}")

    return YOLO(fallback_model)


# =====================================================
# LOAD MODEL ON STARTUP
# =====================================================

try:

    model = load_yolo_model()

except Exception as e:

    print(f"\nERROR LOADING MODEL:\n{e}")


# =====================================================
# HOME ROUTE
# =====================================================

@app.get("/")
def home():

    return {

        "message": "AI Overlay Detection Backend Running",

        "model_loaded":
        getattr(model, "ckpt_path", "No Model Loaded")

    }


# =====================================================
# MAIN AI DETECTION ROUTE
# =====================================================

@app.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):

    global model

    # =================================================
    # SAVE UPLOADED FILE
    # =================================================

    file_path = f"temp/{file.filename}"

    with open(file_path, "wb") as buffer:

        shutil.copyfileobj(file.file, buffer)

    print(f"\nUploaded File Saved: {file_path}")


    # =================================================
    # CONVERT TO GRAYSCALE
    # =================================================

    grayscale_path = convert_to_grayscale(file_path)


    # =================================================
    # RUN YOLO AI DETECTION
    # =================================================

    defects_count = 0

    defects_list = []

    inference_time = 0.0

    annotated_url = ""

    try:

        results = model(file_path)

        result = results[0]

        # =============================================
        # SAVE AI ANNOTATED IMAGE
        # =============================================

        annotated_path = f"outputs/annotated_{file.filename}"

        result.save(filename=annotated_path)

        base_url = str(request.base_url).rstrip("/")
        annotated_url = (
            f"{base_url}/{annotated_path}"
        )

        # =============================================
        # EXTRACT DETECTIONS
        # =============================================

        if result.boxes is not None:

            for box in result.boxes:

                # Coordinates
                xyxy = box.xyxy[0].tolist()

                # Confidence
                conf = float(box.conf[0])

                # Class ID
                cls_id = int(box.cls[0])

                # Class label
                label = (
                    result.names[cls_id]
                    if cls_id in result.names
                    else f"class_{cls_id}"
                )

                # Store detection
                defects_list.append({

                    "box": [
                        round(val, 1)
                        for val in xyxy
                    ],

                    "confidence": round(conf, 4),

                    "class_id": cls_id,

                    "label": label

                })

            defects_count = len(defects_list)

        # =============================================
        # INFERENCE TIME
        # =============================================

        if hasattr(result, "speed"):

            inference_time = (
                sum(result.speed.values()) / 1000.0
            )

    except Exception as e:

        print(f"\nYOLO INFERENCE ERROR:\n{e}")


    # =================================================
    # FINAL RESPONSE
    # =================================================

    return {

        "filename": file.filename,

        "status": "AI Analysis Successful",

        "original_image":
        f"{base_url}/temp/{file.filename}",

        "grayscale_output":
        f"{base_url}/{grayscale_path}",

        "annotated_image":
        annotated_url,

        "defects_count":
        defects_count,

        "defects":
        defects_list,

        "inference_time":
        round(inference_time, 4)

    }
