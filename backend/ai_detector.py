from ultralytics import YOLO
import cv2
import os


# =====================================================
# LOAD TRAINED MODEL
# =====================================================

MODEL_PATH = "runs/detect/overlay_accurate_model-3/weights/best.pt"

model = YOLO(MODEL_PATH)


# =====================================================
# AI DETECTION FUNCTION
# =====================================================

def detect_overlay(input_image_path):

    # Read image
    image = cv2.imread(input_image_path)

    # Run AI inference
    results = model(input_image_path)

    detections = []

    # Loop through detected boxes
    for result in results:

        boxes = result.boxes

        for box in boxes:

            # Coordinates
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Confidence
            confidence = float(box.conf[0])

            # Class
            class_id = int(box.cls[0])

            # Draw rectangle
            cv2.rectangle(
                image,
                (x1, y1),
                (x2, y2),
                (0, 0, 255),
                2
            )

            # Label text
            label = f"Overlay Error {confidence:.2f}"

            cv2.putText(
                image,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

            # Store detection
            detections.append({
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "confidence": confidence,
                "class_id": class_id
            })

    # =====================================================
    # SAVE OUTPUT IMAGE
    # =====================================================

    output_path = "temp/detected_output.png"

    cv2.imwrite(output_path, image)

    return {
        "output_image": output_path,
        "detections": detections
    }