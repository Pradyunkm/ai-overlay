import cv2
import torch
import numpy as np
import os

from model import get_model
from annotate import create_annotation

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

model = get_model()

script_dir = os.path.dirname(os.path.abspath(__file__))

model_path = os.path.join(script_dir, "../best_unet_model.pth")
if not os.path.exists(model_path):
    # Fallback to checkpoints directory if not found in parent
    model_path = os.path.join(script_dir, "checkpoints/best_model.pth")

if os.path.exists(model_path):
    model.load_state_dict(
        torch.load(model_path, map_location=DEVICE)
    )
    print(f"Loaded model checkpoint from: {model_path}")
else:
    print(f"Warning: No model checkpoint found at {model_path}. Running with random weights.")

model.to(DEVICE)
model.eval()

# Look for test.jpg or use a sample from dataset
test_img_path = os.path.join(script_dir, "../test.jpg")
if not os.path.exists(test_img_path):
    # Fallback to a dataset image if test.jpg is missing
    train_img_dir = os.path.join(script_dir, "../../dataset/images/train")
    if os.path.exists(train_img_dir):
        files = [f for f in os.listdir(train_img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        if files:
            test_img_path = os.path.join(train_img_dir, files[0])

if os.path.exists(test_img_path):
    print(f"Running inference on: {test_img_path}")
    image = cv2.imread(test_img_path)
    original = image.copy()

    image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB
    )

    image = cv2.resize(image, (512,512))
    image = image / 255.0

    tensor = torch.tensor(image)\
        .permute(2,0,1)\
        .unsqueeze(0)\
        .float()\
        .to(DEVICE)

    with torch.no_grad():
        pred = model(tensor)

    pred = torch.sigmoid(pred)
    pred = pred.squeeze().cpu().numpy()

    # Apply 0.5 threshold matching training evaluation
    mask = (pred > 0.5).astype(np.uint8)

    mask = cv2.resize(
        mask,
        (
            original.shape[1],
            original.shape[0]
        )
    )

    annotated = create_annotation(
        original,
        mask
    )

    output_path = os.path.join(script_dir, "../annotated_prediction.png")
    cv2.imwrite(
        output_path,
        annotated
    )

    print(f"Annotation saved to: {output_path}")
else:
    print("Error: No test image found for prediction.")