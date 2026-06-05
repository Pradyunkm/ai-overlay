from ultralytics import YOLO
import torch

def main():

    print("\n===================================")
    print("CUDA AVAILABLE:", torch.cuda.is_available())

    if torch.cuda.is_available():
        print("GPU:", torch.cuda.get_device_name(0))

    print("===================================\n")

    # ==========================================
    # FAST MODEL
    # ==========================================

    print("\nTraining FAST MODEL...\n")

    fast_model = YOLO("yolo11s.pt")

    fast_model.train(

        data="data.yaml",

        epochs=150,

        imgsz=1024,

        batch=2,

        device=0,

        workers=2,

        amp=True,

        cache="disk",

        patience=50,

        project="runs/detect",

        name="overlay_fast_model"

    )

    # ==========================================
    # ACCURATE MODEL
    # ==========================================

    print("\nTraining ACCURATE MODEL...\n")

    accurate_model = YOLO("yolo11x.pt")

    accurate_model.train(

        data="data.yaml",

        epochs=300,

        imgsz=1024,

        batch=2,

        device=0,

        workers=2,

        amp=True,

        cache="disk",

        patience=70,

        project="runs/detect",

        name="overlay_accurate_model"

    )

    print("\nTraining Completed Successfully!")

if __name__ == "__main__":
    main()