import segmentation_models_pytorch as smp

def get_model(encoder_name="efficientnet-b7"):
    """
    UNet++ with customizable encoder (defaults to efficientnet-b7 for max accuracy).
    Supports fallback to efficientnet-b4 if loading older weights.
    """
    if encoder_name == "efficientnet-b4":
        model = smp.UnetPlusPlus(
            encoder_name           = "efficientnet-b4",
            encoder_weights        = "imagenet",
            in_channels            = 3,
            classes                = 1,
            decoder_attention_type = "scse",
        )
    else:
        model = smp.UnetPlusPlus(
            encoder_name           = "efficientnet-b7",
            encoder_weights        = "imagenet",
            in_channels            = 3,
            classes                = 1,
            decoder_attention_type = "scse",
            decoder_channels       = (256, 128, 64, 32, 16),
        )
    return model