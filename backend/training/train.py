import torch
import albumentations as A
import os

from torch.utils.data import DataLoader

from dataset import WaferDataset
from loss import segmentation_loss

# pyrefly: ignore [missing-import]
from model import get_model

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Ensure checkpoints directory exists
os.makedirs("checkpoints", exist_ok=True)

def evaluate_model(model, data_loader, device):
    model.eval()
    total_loss = 0.0
    total_iou = 0.0
    total_dice = 0.0
    num_batches = len(data_loader)
    
    with torch.no_grad():
        for images, masks in data_loader:
            images = images.to(device)
            masks = masks.to(device)
            
            with torch.amp.autocast('cuda' if device == 'cuda' else 'cpu'):
                outputs = model(images)
                loss = segmentation_loss(outputs, masks)
                
            total_loss += loss.item()
            
            # Binarize outputs to compute IoU & Dice
            preds = (torch.sigmoid(outputs) > 0.5).float()
            intersection = (preds * masks).sum()
            union = preds.sum() + masks.sum() - intersection
            
            iou = (intersection + 1e-6) / (union + 1e-6)
            dice = (2 * intersection + 1e-6) / (preds.sum() + masks.sum() + 1e-6)
            
            total_iou += iou.item()
            total_dice += dice.item()
            
    return total_loss / num_batches, total_iou / num_batches, total_dice / num_batches

def main():
    transform = A.Compose([
        A.Resize(512, 512),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.Rotate(limit=15, p=0.5),
        A.RandomBrightnessContrast(p=0.3),
        A.GaussianBlur(p=0.2),
    ])

    val_transform = A.Compose([
        A.Resize(512, 512),
    ])

    script_dir = os.path.dirname(os.path.abspath(__file__))

    train_dataset = WaferDataset(
        image_dir=os.path.join(script_dir, "../../dataset/images/train"),
        mask_dir=os.path.join(script_dir, "../../dataset/labels/train"),
        transform=transform
    )

    val_dataset = WaferDataset(
        image_dir=os.path.join(script_dir, "../../dataset/images/val"),
        mask_dir=os.path.join(script_dir, "../../dataset/labels/val"),
        transform=val_transform
    )

    # Auto-adjust batch size for 4GB VRAM GPUs (e.g. RTX 3050)
    batch_size = 2 if DEVICE == "cuda" else 8
    accum_steps = 4  # Effective batch size = 8 with gradient accumulation

    if DEVICE == "cuda":
        torch.cuda.empty_cache()

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=True
    )

    # Use EfficientNet-B4 for 4GB VRAM GPUs to prevent CUDA OOM
    model_encoder = "efficientnet-b4" if (DEVICE == "cuda" and torch.cuda.get_device_properties(0).total_memory < 6e9) else "efficientnet-b7"
    print(f"Loading UNet++ with {model_encoder} encoder (Batch size={batch_size}, Accumulation steps={accum_steps})...")
    model = get_model(encoder_name=model_encoder).to(DEVICE)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-4,
        weight_decay=1e-4
    )

    EPOCHS = 150
    
    # Cosine annealing learning rate scheduler
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    
    scaler = torch.amp.GradScaler('cuda') if DEVICE == "cuda" else None

    best_val_iou = 0.0

    print(f"Starting training on {DEVICE} ({model_encoder}) for {EPOCHS} epochs...")

    for epoch in range(EPOCHS):
        model.train()
        total_train_loss = 0.0
        optimizer.zero_grad()

        for step, (images, masks) in enumerate(train_loader):
            images = images.to(DEVICE)
            masks = masks.to(DEVICE)

            if DEVICE == "cuda":
                with torch.amp.autocast('cuda'):
                    outputs = model(images)
                    loss = segmentation_loss(outputs, masks) / accum_steps
                scaler.scale(loss).backward()

                if (step + 1) % accum_steps == 0 or (step + 1) == len(train_loader):
                    scaler.step(optimizer)
                    scaler.update()
                    optimizer.zero_grad()
            else:
                outputs = model(images)
                loss = segmentation_loss(outputs, masks) / accum_steps
                loss.backward()
                if (step + 1) % accum_steps == 0 or (step + 1) == len(train_loader):
                    optimizer.step()
                    optimizer.zero_grad()

            total_train_loss += loss.item() * accum_steps

        scheduler.step()

        avg_train_loss = total_train_loss / len(train_loader)
        val_loss, val_iou, val_dice = evaluate_model(model, val_loader, DEVICE)

        print(f"Epoch {epoch+1:03d}/{EPOCHS} | Train Loss: {avg_train_loss:.4f} | Val Loss: {val_loss:.4f} | Val IoU: {val_iou:.4f} | Val Dice: {val_dice:.4f}")

        if val_iou > best_val_iou:
            best_val_iou = val_iou

            # Save the state dict to main path
            torch.save(
                model.state_dict(),
                os.path.join(script_dir, "../best_unet_model.pth")
            )
            # Also save to checkpoints folder
            torch.save(
                model.state_dict(),
                os.path.join(script_dir, "checkpoints/best_model.pth")
            )

            print(f"--> Best model saved with Val IoU: {val_iou:.4f}")

if __name__ == "__main__":
    main()