import os
import sys
import time
import cv2
import numpy as np
import torch

def test():
    print("Testing U-Net inference setup...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    training_path = os.path.join(script_dir, "training")
    sys.path.append(training_path)

    from model import get_model
    from annotate import create_annotation

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    # Load model
    print("Loading model structure...")
    model = get_model()
    
    weights_path = os.path.join(script_dir, "best_unet_model.pth")
    if os.path.exists(weights_path):
        print(f"Loading weights from {weights_path}...")
        model.load_state_dict(torch.load(weights_path, map_location=device))
    else:
        print("Weights file not found!")
        return

    model.to(device)
    model.eval()
    print("Model loaded and moved to device successfully.")

    # Find a test image
    img_dir = os.path.join(script_dir, "../dataset/images/train")
    files = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not files:
        print("No test images found!")
        return
    
    test_path = os.path.join(img_dir, files[0])
    print(f"Loading test image: {test_path}")
    img = cv2.imread(test_path)
    h, w, _ = img.shape

    # Preprocessing
    t0 = time.time()
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (512, 512))
    img_normalized = img_resized / 255.0

    tensor = torch.tensor(img_normalized).permute(2, 0, 1).unsqueeze(0).float().to(device)
    print("Tensor created. Running forward pass...")
    
    with torch.no_grad():
        pred = model(tensor)
    
    print("Forward pass completed successfully!")
    pred_probs = torch.sigmoid(pred).squeeze().cpu().numpy()
    print(f"Prediction Probs: min={pred_probs.min():.4f}, max={pred_probs.max():.4f}, mean={pred_probs.mean():.4f}")
    mask = (pred_probs > 0.05).astype(np.uint8)
    print(f"Mask positive pixels (at 0.05 threshold): {np.sum(mask)}")

    mask_orig = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
    annotated = create_annotation(img, mask_orig)
    
    print(f"Time taken: {time.time() - t0:.4f} seconds")
    print("Inference completed successfully!")

if __name__ == "__main__":
    test()
