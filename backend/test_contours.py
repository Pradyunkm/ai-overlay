import os
import sys
import time
import cv2
import numpy as np
import torch

def test():
    print("Testing U-Net contour extraction on wafer-e.png...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    training_path = os.path.join(script_dir, "training")
    sys.path.append(training_path)

    from model import get_model

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = get_model()
    weights_path = os.path.join(script_dir, "best_unet_model.pth")
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device)
    model.eval()

    test_path = os.path.join(script_dir, "temp/wafer-e.png")
    if not os.path.exists(test_path):
        print(f"File not found: {test_path}")
        return
    
    img = cv2.imread(test_path)
    h_orig, w_orig, _ = img.shape
    print(f"Image shape: {h_orig}x{w_orig}")

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (512, 512))
    img_normalized = img_resized / 255.0

    tensor = torch.tensor(img_normalized).permute(2, 0, 1).unsqueeze(0).float().to(device)
    
    with torch.no_grad():
        pred = model(tensor)
    
    pred_probs = torch.sigmoid(pred).squeeze().cpu().numpy()
    print(f"wafer-e.png Probs: min={pred_probs.min():.4f}, max={pred_probs.max():.4f}, mean={pred_probs.mean():.4f}")
    
    for thresh in [0.5, 0.1, 0.05, 0.01]:
        mask = (pred_probs > thresh).astype(np.uint8)
        mask_orig = cv2.resize(mask, (w_orig, h_orig), interpolation=cv2.INTER_NEAREST)
        contours, _ = cv2.findContours(mask_orig, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        print(f"Threshold: {thresh} | Contours count: {len(contours)}")
        if thresh == 0.05:
            for idx, c in enumerate(contours):
                x, y, w_box, h_box = cv2.boundingRect(c)
                print(f"  Contour {idx}: x={x}, y={y}, w={w_box}, h={h_box}")

if __name__ == "__main__":
    test()
