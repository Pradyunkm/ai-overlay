# ============================================================
# UNet++ MAXIMUM ACCURACY TRAINING — Google Colab Notebook
# Copy each cell block into a Colab cell (separated by # %% marks)
# Run TOP TO BOTTOM in Google Colab with GPU (T4/A100/V100)
# ============================================================

# %% [markdown]
# # 🧠 UNet++ Maximum Accuracy Training for Wafer Defect Detection
# **Architecture:** UNet++ · **Encoder:** EfficientNet-B7 (ImageNet pretrained)
# **Loss:** Dice + Focal + Lovász | **Scheduler:** CosineAnnealingWarmRestarts
# **Augmentations:** Heavy Albumentations | **TTA:** 8-fold at inference

# %% ── CELL 1: Check GPU & install packages ──────────────────────────────────
import os
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

import subprocess, sys

def install(pkg):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

install("segmentation-models-pytorch")
install("albumentations")
install("lovasz-losses")
install("timm")

import torch
print("=" * 60)
print(f"PyTorch  : {torch.__version__}")
print(f"CUDA     : {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU Name : {torch.cuda.get_device_name(0)}")
    print(f"VRAM     : {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
print("=" * 60)

# %% ── CELL 2: Mount Google Drive (save checkpoints there) ──────────────────
from google.colab import drive
drive.mount('/content/drive')

import os
DRIVE_DIR = "/content/drive/MyDrive/wafer_unet_training"
os.makedirs(DRIVE_DIR, exist_ok=True)
os.makedirs(f"{DRIVE_DIR}/checkpoints", exist_ok=True)
print(f"✅ Drive mounted. Saving to: {DRIVE_DIR}")

# %% ── CELL 3: Upload your dataset ZIP from your local machine ───────────────
# Option A — Upload the dataset.zip from your project
from google.colab import files
print("📂 Upload your dataset.zip now (from ai-overlay-main/dataset.zip)...")
uploaded = files.upload()

import zipfile, shutil

for fname in uploaded:
    if fname.endswith(".zip"):
        print(f"Extracting {fname}...")
        with zipfile.ZipFile(fname, "r") as z:
            z.extractall("/content/dataset_raw")
        print("✅ Extracted.")

# %% ── CELL 4: Auto-detect dataset structure and organize ────────────────────
import os, glob

RAW = "/content/dataset_raw"

def find_specific_dir(base, category, split):
    for root, dirs, _ in os.walk(base):
        for d in dirs:
            full_path = os.path.join(root, d).replace("\\", "/").lower()
            if category.lower() in full_path and split.lower() in full_path:
                if category.lower() == "images" and "labels" in full_path and "images" not in d.lower():
                    continue
                return os.path.join(root, d)
    return None

TRAIN_IMG  = find_specific_dir(RAW, "images", "train")
VAL_IMG    = find_specific_dir(RAW, "images", "val")
TRAIN_MASK = find_specific_dir(RAW, "labels", "train")
VAL_MASK   = find_specific_dir(RAW, "labels", "val")

print(f"\n Train images : {TRAIN_IMG}")
print(f"   Val images   : {VAL_IMG}")
print(f"   Train masks  : {TRAIN_MASK}")
print(f"   Val masks    : {VAL_MASK}")

# Count files
if TRAIN_IMG and os.path.exists(TRAIN_IMG):
    print(f"\n   Train image files count: {len(os.listdir(TRAIN_IMG))}")
if VAL_IMG and os.path.exists(VAL_IMG):
    print(f"   Val image files count  : {len(os.listdir(VAL_IMG))}")

# %% ── CELL 5: (OPTIONAL) Generate synthetic wafer dataset if you have no data
# Skip this cell if you already uploaded real images.
GENERATE_SYNTHETIC = False  # Set to True if no real dataset

if GENERATE_SYNTHETIC:
    import cv2, numpy as np, random
    from pathlib import Path

    def generate_wafer_image(size=512):
        img = np.ones((size, size, 3), dtype=np.uint8) * 220
        for i in range(size):
            v = int(200 + 20 * (i / size))
            img[i, :] = [v, v - 5, v - 10]
        for x in range(0, size, 32):
            cv2.line(img, (x, 0), (x, size), (180, 178, 185), 1)
        for y in range(0, size, 32):
            cv2.line(img, (0, y), (size, y), (180, 178, 185), 1)

        mask = np.zeros((size, size), dtype=np.uint8)
        defects = []

        num_defects = random.randint(1, 7)
        for _ in range(num_defects):
            kind = random.choice(["scratch", "crack", "particle", "void", "burn"])
            if kind == "scratch":
                x1, y1 = random.randint(20, size-20), random.randint(20, size-20)
                x2, y2 = x1 + random.randint(30, 120), y1 + random.randint(-20, 20)
                cv2.line(img, (x1, y1), (x2, y2), (50, 45, 60), random.randint(1, 3))
                cv2.line(mask, (x1, y1), (x2, y2), 255, 4)
                defects.append((min(x1,x2), min(y1,y2), max(x1,x2), max(y1,y2)))
            elif kind == "crack":
                pts = [(random.randint(20, size-20), random.randint(20, size-20))]
                for _ in range(random.randint(3, 6)):
                    pts.append((pts[-1][0] + random.randint(-30, 30),
                                pts[-1][1] + random.randint(-30, 30)))
                for i in range(len(pts)-1):
                    cv2.line(img, pts[i], pts[i+1], (40, 35, 50), 2)
                    cv2.line(mask, pts[i], pts[i+1], 255, 5)
                xs, ys = zip(*pts)
                defects.append((min(xs), min(ys), max(xs), max(ys)))
            elif kind == "particle":
                cx, cy = random.randint(20, size-20), random.randint(20, size-20)
                r = random.randint(3, 15)
                cv2.circle(img, (cx, cy), r, (30, 25, 40), -1)
                cv2.circle(mask, (cx, cy), r+2, 255, -1)
                defects.append((cx-r, cy-r, cx+r, cy+r))
            elif kind == "void":
                cx, cy = random.randint(30, size-30), random.randint(30, size-30)
                rx, ry = random.randint(10, 35), random.randint(10, 25)
                cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, (160, 155, 165), -1)
                cv2.ellipse(mask, (cx, cy), (rx+3, ry+3), 0, 0, 360, 255, -1)
                defects.append((cx-rx, cy-ry, cx+rx, cy+ry))
            else:
                cx, cy = random.randint(30, size-30), random.randint(30, size-30)
                r = random.randint(8, 25)
                cv2.circle(img, (cx, cy), r, (20, 10, 10), -1)
                cv2.circle(mask, (cx, cy), r+3, 255, -1)
                defects.append((cx-r, cy-r, cx+r, cy+r))

        noise = np.random.normal(0, 4, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        labels = []
        for (x1, y1, x2, y2) in defects:
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(size, x2), min(size, y2)
            if x2 <= x1 or y2 <= y1: continue
            xc = ((x1 + x2) / 2) / size
            yc = ((y1 + y2) / 2) / size
            w  = (x2 - x1) / size
            h  = (y2 - y1) / size
            labels.append(f"0 {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}")

        return img, mask, "\n".join(labels)

    splits = {"train": 800, "val": 200}
    for split, n in splits.items():
        os.makedirs(f"/content/dataset/images/{split}", exist_ok=True)
        os.makedirs(f"/content/dataset/labels/{split}", exist_ok=True)
        for i in range(n):
            img, mask, labels = generate_wafer_image(512)
            cv2.imwrite(f"/content/dataset/images/{split}/{i:04d}.png", img)
            with open(f"/content/dataset/labels/{split}/{i:04d}.txt", "w") as f:
                f.write(labels)
        print(f"Generated {n} {split} images")

    TRAIN_IMG  = "/content/dataset/images/train"
    VAL_IMG    = "/content/dataset/images/val"
    TRAIN_MASK = "/content/dataset/labels/train"
    VAL_MASK   = "/content/dataset/labels/val"
    print("Dataset ready!")

# %% ── CELL 6: Dataset class ─────────────────────────────────────────────────
import os, cv2, torch, numpy as np
from torch.utils.data import Dataset

class WaferDataset(Dataset):
    def __init__(self, image_dir, mask_dir, transform=None, size=512):
        self.image_dir = image_dir
        self.mask_dir  = mask_dir
        self.transform = transform
        self.size      = size
        self.images    = sorted([
            f for f in os.listdir(image_dir)
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".tif", ".bmp"))
        ]) if image_dir and os.path.exists(image_dir) else []
        print(f"  Loaded {len(self.images)} images from {image_dir}")

    def __len__(self):
        return len(self.images)

    def _load_mask_from_yolo(self, txt_path, h, w):
        mask = np.zeros((h, w), dtype=np.uint8)
        if not os.path.exists(txt_path):
            return mask
        with open(txt_path) as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 5: continue
                _, xc, yc, bw, bh = map(float, parts[:5])
                x1 = int((xc - bw / 2) * w)
                y1 = int((yc - bh / 2) * h)
                x2 = int((xc + bw / 2) * w)
                y2 = int((yc + bh / 2) * h)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)
        return mask

    def __getitem__(self, idx):
        fname  = self.images[idx]
        base   = os.path.splitext(fname)[0]

        img = cv2.imread(os.path.join(self.image_dir, fname))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w = img.shape[:2]

        txt_path = os.path.join(self.mask_dir, base + ".txt") if self.mask_dir else ""
        png_path = os.path.join(self.mask_dir, fname) if self.mask_dir else ""

        if txt_path and os.path.exists(txt_path):
            mask = self._load_mask_from_yolo(txt_path, h, w)
        elif png_path and os.path.exists(png_path):
            mask = cv2.imread(png_path, 0)
            if mask is None:
                mask = np.zeros((h, w), dtype=np.uint8)
        else:
            mask = np.zeros((h, w), dtype=np.uint8)

        mask = (mask > 127).astype(np.float32)

        if self.transform:
            aug  = self.transform(image=img, mask=mask)
            img  = aug["image"]
            mask = aug["mask"]

        img  = torch.tensor(img).permute(2, 0, 1).float() / 255.0
        mask = torch.tensor(mask).unsqueeze(0).float()
        return img, mask

# %% ── CELL 7: Advanced augmentation pipeline ────────────────────────────────
import albumentations as A

SIZE = 512

train_transform = A.Compose([
    A.Resize(SIZE, SIZE),
    A.HorizontalFlip(p=0.5),
    A.VerticalFlip(p=0.5),
    A.RandomRotate90(p=0.5),
    A.Affine(scale=(0.9, 1.1), translate_percent=(-0.1, 0.1), rotate=(-45, 45), p=0.6),
    A.ElasticTransform(alpha=60, sigma=6, p=0.3),
    A.GridDistortion(num_steps=5, distort_limit=0.3, p=0.3),
    A.OpticalDistortion(distort_limit=0.3, p=0.2),
    A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.6),
    A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=20, p=0.4),
    A.CLAHE(clip_limit=4.0, p=0.3),
    A.RandomGamma(gamma_limit=(80, 120), p=0.3),
    A.Sharpen(alpha=(0.1, 0.4), p=0.3),
    A.Emboss(alpha=(0.1, 0.3), p=0.2),
    A.OneOf([
        A.GaussNoise(p=0.5),
        A.ISONoise(color_shift=(0.01, 0.05), intensity=(0.1, 0.3)),
        A.MultiplicativeNoise(multiplier=(0.9, 1.1)),
    ], p=0.4),
    A.OneOf([
        A.GaussianBlur(blur_limit=(3, 5)),
        A.MotionBlur(blur_limit=5),
        A.MedianBlur(blur_limit=3),
    ], p=0.3),
    A.CoarseDropout(num_holes_range=(1, 6), hole_height_range=(8, 32), hole_width_range=(8, 32), fill=0, p=0.3),
])

val_transform = A.Compose([A.Resize(SIZE, SIZE)])
print("Augmentations defined")

val_transform = A.Compose([A.Resize(SIZE, SIZE)])
print("Augmentations defined")

# %% ── CELL 8: Build DataLoaders ─────────────────────────────────────────────
from torch.utils.data import DataLoader

# Optimized for Colab T4 (14.5GB VRAM): batch=4 + accum=2 -> effective batch=8 with zero OOM risk
BATCH_SIZE  = 4
ACCUM_STEPS = 2

train_ds = WaferDataset(TRAIN_IMG, TRAIN_MASK, transform=train_transform, size=SIZE)
val_ds   = WaferDataset(VAL_IMG,   VAL_MASK,   transform=val_transform,   size=SIZE)

train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                          num_workers=2, pin_memory=True, drop_last=True)
val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=2, pin_memory=True)

print(f"Train batches: {len(train_loader)} | Val batches: {len(val_loader)}")

# %% ── CELL 9: Model — UNet++ with EfficientNet-B7 ───────────────────────────
import segmentation_models_pytorch as smp

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {DEVICE}")

model = smp.UnetPlusPlus(
    encoder_name           = "efficientnet-b7",
    encoder_weights        = "imagenet",
    in_channels            = 3,
    classes                = 1,
    decoder_attention_type = "scse",
    decoder_channels       = (256, 128, 64, 32, 16),
).to(DEVICE)

total_params = sum(p.numel() for p in model.parameters())
print(f"UNet++ (EfficientNet-B7) | Params: {total_params:,}")

# %% ── CELL 10: Combined Loss — Dice + Focal + Lovász ────────────────────────
import segmentation_models_pytorch as smp

dice_loss  = smp.losses.DiceLoss(mode="binary", from_logits=True, smooth=1.0)
focal_loss = smp.losses.FocalLoss(mode="binary", alpha=0.25, gamma=2.5)

try:
    from lovasz_losses import lovasz_hinge
    LOVASZ = True
    print("Lovász loss: ENABLED")
except ImportError:
    LOVASZ = False
    print("Lovász loss: NOT AVAILABLE - using Dice+Focal only")

def combined_loss(pred, target, epoch=0):
    d = dice_loss(pred, target)
    f = focal_loss(pred, target)
    if LOVASZ:
        probs = torch.sigmoid(pred).squeeze(1)
        flat_target = target.squeeze(1).float()
        l = lovasz_hinge(probs * 2 - 1, flat_target)
        w_dice  = min(0.8, 0.3 + epoch * 0.005)
        w_focal = max(0.2, 0.5 - epoch * 0.003)
        w_lovaz = 1.0 - w_dice - w_focal
        return w_dice * d + w_focal * f + w_lovaz * l
    else:
        return 0.6 * d + 0.4 * f

# %% ── CELL 11: Optimizer & Scheduler ────────────────────────────────────────
EPOCHS = 200

encoder_params = list(model.encoder.parameters())
decoder_params = [p for p in model.parameters() if not any(
    p is ep for ep in encoder_params)]

optimizer = torch.optim.AdamW([
    {"params": encoder_params, "lr": 5e-5},
    {"params": decoder_params, "lr": 3e-4},
], weight_decay=1e-4)

scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
    optimizer, T_0=40, T_mult=2, eta_min=1e-7)

scaler = torch.amp.GradScaler("cuda") if DEVICE == "cuda" else None
print(f"Epochs={EPOCHS} | Optimizer=AdamW | Scheduler=CosineWarmRestarts | AMP={'ON' if scaler else 'OFF'}")

# %% ── CELL 12: Metrics helper ───────────────────────────────────────────────
def compute_metrics(pred_logits, masks, threshold=0.5):
    probs = torch.sigmoid(pred_logits)
    preds = (probs > threshold).float()
    tp = (preds * masks).sum()
    fp = preds.sum() - tp
    fn = masks.sum() - tp
    iou    = (tp + 1e-6) / (tp + fp + fn + 1e-6)
    dice   = (2 * tp + 1e-6) / (2 * tp + fp + fn + 1e-6)
    prec   = (tp + 1e-6) / (tp + fp + 1e-6)
    recall = (tp + 1e-6) / (tp + fn + 1e-6)
    f1     = 2 * prec * recall / (prec + recall + 1e-6)
    return {"iou": iou.item(), "dice": dice.item(), "f1": f1.item()}

# %% ── CELL 13: Training loop ─────────────────────────────────────────────────
import time

CHECKPOINT_PATH     = f"{DRIVE_DIR}/checkpoints/best_unet_model.pth"
LAST_CKPT_PATH      = f"{DRIVE_DIR}/checkpoints/last_epoch.pth"
LOG_PATH            = f"{DRIVE_DIR}/training_log.csv"
EARLY_STOP_PATIENCE = 40

best_val_iou   = 0.0
patience_count = 0
history        = []

with open(LOG_PATH, "w") as lf:
    lf.write("epoch,train_loss,val_loss,val_iou,val_dice,val_f1,lr,time_s\n")

print("Starting maximum accuracy training...\n")
print(f"{'Epoch':>6} | {'T-Loss':>8} | {'V-Loss':>8} | {'IoU':>7} | {'Dice':>7} | {'F1':>7}")
print("-" * 70)

for epoch in range(1, EPOCHS + 1):
    t0 = time.time()
    model.train()
    train_loss = 0.0
    
    if DEVICE == "cuda":
        torch.cuda.empty_cache()

    optimizer.zero_grad()

    for step, (imgs, masks) in enumerate(train_loader):
        imgs, masks = imgs.to(DEVICE), masks.to(DEVICE)
        if DEVICE == "cuda":
            with torch.amp.autocast("cuda"):
                out  = model(imgs)
                loss = combined_loss(out, masks, epoch) / ACCUM_STEPS
            scaler.scale(loss).backward()
            
            if (step + 1) % ACCUM_STEPS == 0 or (step + 1) == len(train_loader):
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()
        else:
            out  = model(imgs)
            loss = combined_loss(out, masks, epoch) / ACCUM_STEPS
            loss.backward()
            if (step + 1) % ACCUM_STEPS == 0 or (step + 1) == len(train_loader):
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                optimizer.zero_grad()
        train_loss += loss.item() * ACCUM_STEPS

    scheduler.step(epoch)

    model.eval()
    val_loss = 0.0
    val_m    = {"iou": 0, "dice": 0, "f1": 0}

    with torch.no_grad():
        for imgs, masks in val_loader:
            imgs, masks = imgs.to(DEVICE), masks.to(DEVICE)
            with torch.amp.autocast("cuda" if DEVICE == "cuda" else "cpu"):
                out  = model(imgs)
                loss = combined_loss(out, masks, epoch)
            val_loss += loss.item()
            m = compute_metrics(out, masks)
            for k in val_m: val_m[k] += m[k]

    n_b     = len(val_loader)
    tl_avg  = train_loss / len(train_loader)
    vl_avg  = val_loss   / n_b
    iou_avg = val_m["iou"]  / n_b
    dce_avg = val_m["dice"] / n_b
    f1_avg  = val_m["f1"]   / n_b
    cur_lr  = optimizer.param_groups[1]["lr"]
    elapsed = time.time() - t0

    history.append({"epoch": epoch, "train_loss": tl_avg, "val_loss": vl_avg,
                    "iou": iou_avg, "dice": dce_avg, "f1": f1_avg})

    with open(LOG_PATH, "a") as lf:
        lf.write(f"{epoch},{tl_avg:.4f},{vl_avg:.4f},{iou_avg:.4f},"
                 f"{dce_avg:.4f},{f1_avg:.4f},{cur_lr:.2e},{elapsed:.1f}\n")

    marker = " <-- BEST" if iou_avg > best_val_iou else ""
    print(f"{epoch:>6} | {tl_avg:>8.4f} | {vl_avg:>8.4f} | {iou_avg:>7.4f} | "
          f"{dce_avg:>7.4f} | {f1_avg:>7.4f}{marker}")

    if iou_avg > best_val_iou:
        best_val_iou   = iou_avg
        patience_count = 0
        torch.save({
            "epoch":           epoch,
            "model_state":     model.state_dict(),
            "optimizer_state": optimizer.state_dict(),
            "scheduler_state": scheduler.state_dict(),
            "val_iou":         best_val_iou,
            "val_dice":        dce_avg,
            "val_f1":          f1_avg,
        }, CHECKPOINT_PATH)
        print(f"         Saved best model! IoU={best_val_iou:.4f}")
    else:
        patience_count += 1

    if epoch % 10 == 0:
        torch.save({"epoch": epoch, "model_state": model.state_dict(),
                    "optimizer_state": optimizer.state_dict(),
                    "scheduler_state": scheduler.state_dict()}, LAST_CKPT_PATH)

    if patience_count >= EARLY_STOP_PATIENCE:
        print(f"\nEarly stopping at epoch {epoch}")
        break

print(f"\nTraining complete! Best Val IoU: {best_val_iou:.4f}")

# %% ── CELL 14: Plot training curves ─────────────────────────────────────────
import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 3, figsize=(18, 5))
fig.suptitle("UNet++ Training Curves", fontsize=16, fontweight="bold")

epochs_h = [h["epoch"] for h in history]
axes[0].plot(epochs_h, [h["train_loss"] for h in history], label="Train")
axes[0].plot(epochs_h, [h["val_loss"]   for h in history], label="Val")
axes[0].set_title("Loss"); axes[0].legend(); axes[0].grid(alpha=0.3)

axes[1].plot(epochs_h, [h["iou"]  for h in history], color="green")
axes[1].set_title("Val IoU"); axes[1].grid(alpha=0.3)

axes[2].plot(epochs_h, [h["dice"] for h in history], color="purple")
axes[2].set_title("Val Dice"); axes[2].grid(alpha=0.3)

plt.tight_layout()
plt.savefig(f"{DRIVE_DIR}/training_curves.png", dpi=150)
plt.show()

# %% ── CELL 15: Export inference weights ─────────────────────────────────────
ckpt = torch.load(CHECKPOINT_PATH, map_location="cpu")
EXPORT_PATH = f"{DRIVE_DIR}/best_unet_model.pth"
torch.save(ckpt["model_state"], EXPORT_PATH)
print(f"Exported inference weights: {EXPORT_PATH}")
print(f"Val IoU={ckpt['val_iou']:.4f} | Dice={ckpt['val_dice']:.4f} | F1={ckpt['val_f1']:.4f}")

# %% ── CELL 16: Download to your computer ────────────────────────────────────
from google.colab import files
print("Downloading best_unet_model.pth to your computer...")
files.download(EXPORT_PATH)
print("DONE! Copy the downloaded file to:")
print("  ai-overlay-main/backend/best_unet_model.pth")

# %% ── CELL 17: TTA inference verification ───────────────────────────────────
def tta_predict(model, img_tensor, device):
    """8-fold Test-Time Augmentation for maximum accuracy"""
    model.eval()
    preds = []
    transforms = [
        lambda x: x,
        lambda x: torch.flip(x, [3]),
        lambda x: torch.flip(x, [2]),
        lambda x: torch.flip(torch.flip(x, [3]), [2]),
        lambda x: torch.rot90(x, 1, [2, 3]),
        lambda x: torch.rot90(x, 2, [2, 3]),
        lambda x: torch.rot90(x, 3, [2, 3]),
        lambda x: torch.flip(torch.rot90(x, 1, [2, 3]), [3]),
    ]
    inv_transforms = [
        lambda x: x,
        lambda x: torch.flip(x, [3]),
        lambda x: torch.flip(x, [2]),
        lambda x: torch.flip(torch.flip(x, [2]), [3]),
        lambda x: torch.rot90(x, 3, [2, 3]),
        lambda x: torch.rot90(x, 2, [2, 3]),
        lambda x: torch.rot90(x, 1, [2, 3]),
        lambda x: torch.flip(torch.rot90(x, 3, [2, 3]), [3]),
    ]
    with torch.no_grad():
        for t, t_inv in zip(transforms, inv_transforms):
            aug_in = t(img_tensor.to(device))
            with torch.amp.autocast("cuda" if device == "cuda" else "cpu"):
                pred = model(aug_in)
            pred = t_inv(torch.sigmoid(pred))
            preds.append(pred.cpu())
    return torch.stack(preds).mean(0)

sample_img, sample_mask = val_ds[0]
tensor_in = sample_img.unsqueeze(0)
tta_pred  = tta_predict(model, tensor_in, DEVICE)
print("TTA inference OK")
print(f"Pred range: [{tta_pred.min():.3f}, {tta_pred.max():.3f}]")

import matplotlib.pyplot as plt
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
axes[0].imshow(sample_img.permute(1,2,0).numpy()); axes[0].set_title("Input")
axes[1].imshow(sample_mask.squeeze().numpy(), cmap="gray"); axes[1].set_title("Ground Truth")
axes[2].imshow(tta_pred.squeeze().numpy(), cmap="hot"); axes[2].set_title("TTA Prediction")
for ax in axes: ax.axis("off")
plt.savefig(f"{DRIVE_DIR}/sample_prediction.png", dpi=150)
plt.show()

# %% ── CELL 18: Summary ──────────────────────────────────────────────────────
print("=" * 60)
print("TRAINING COMPLETE")
print("=" * 60)
print(f"Best Val IoU: {best_val_iou:.4f}")
print()
print("FILES IN GOOGLE DRIVE:")
print(f"  {DRIVE_DIR}/")
print(f"    best_unet_model.pth   <- COPY THIS to backend/")
print(f"    training_curves.png")
print(f"    training_log.csv")
print()
print("LOCAL DEPLOYMENT STEPS:")
print("  1. Cell 16 downloads the model automatically")
print("  2. Place it at: ai-overlay-main/backend/best_unet_model.pth")
print("  3. Restart: uvicorn main:app --reload")
print("  4. The backend auto-loads the new model at startup!")
print("=" * 60)
