import os
import cv2
import torch
import numpy as np

from torch.utils.data import Dataset

class WaferDataset(Dataset):

    def __init__(self, image_dir, mask_dir, transform=None):

        self.image_dir = image_dir
        self.mask_dir = mask_dir
        self.transform = transform

        self.images = [f for f in os.listdir(image_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

    def __len__(self):
        return len(self.images)

    def __getitem__(self, index):

        img_path = os.path.join(self.image_dir, self.images[index])
        
        image = cv2.imread(img_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w, _ = image.shape

        # Try to find corresponding YOLO format label file first
        base_name = os.path.splitext(self.images[index])[0]
        txt_path = os.path.join(self.mask_dir, base_name + ".txt")

        if os.path.exists(txt_path):
            mask = np.zeros((h, w), dtype=np.uint8)
            with open(txt_path, "r") as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        cls_id, x_center, y_center, width, height = map(float, parts[:5])
                        x_c = x_center * w
                        y_c = y_center * h
                        wd = width * w
                        ht = height * h

                        x1 = int(x_c - wd / 2)
                        y1 = int(y_c - ht / 2)
                        x2 = int(x_c + wd / 2)
                        y2 = int(y_c + ht / 2)

                        x1 = max(0, min(w, x1))
                        y1 = max(0, min(h, y1))
                        x2 = max(0, min(w, x2))
                        y2 = max(0, min(h, y2))

                        cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)
        else:
            # Fallback to reading mask image
            mask_path = os.path.join(self.mask_dir, self.images[index])
            mask = cv2.imread(mask_path, 0)
            if mask is None:
                mask = np.zeros((h, w), dtype=np.uint8)

        mask = (mask > 127).astype(np.float32)

        if self.transform:
            augmented = self.transform(
                image=image,
                mask=mask
            )

            image = augmented["image"]
            mask = augmented["mask"]

        image = torch.tensor(image).permute(2,0,1).float() / 255.0
        mask = torch.tensor(mask).unsqueeze(0).float()

        return image, mask