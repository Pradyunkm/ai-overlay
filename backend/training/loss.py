import segmentation_models_pytorch as smp

dice_loss = smp.losses.DiceLoss(
    mode='binary',
    from_logits=True,
    smooth=1.0
)

focal_loss = smp.losses.FocalLoss(
    mode='binary',
    alpha=0.25,
    gamma=2.5   # Slightly higher gamma for harder examples
)

def segmentation_loss(pred, target):
    """Combined Dice + Focal loss (same as Colab training)."""
    dice  = dice_loss(pred, target)
    focal = focal_loss(pred, target)
    return 0.6 * dice + 0.4 * focal