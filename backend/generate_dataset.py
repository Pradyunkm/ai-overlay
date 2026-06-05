import os
import cv2
import random
import numpy as np

# =========================================================
# DATASET PATHS
# =========================================================

BASE_DIR = "dataset"

TRAIN_IMAGES = os.path.join(BASE_DIR, "images/train")
VAL_IMAGES = os.path.join(BASE_DIR, "images/val")

TRAIN_LABELS = os.path.join(BASE_DIR, "labels/train")
VAL_LABELS = os.path.join(BASE_DIR, "labels/val")

os.makedirs(TRAIN_IMAGES, exist_ok=True)
os.makedirs(VAL_IMAGES, exist_ok=True)
os.makedirs(TRAIN_LABELS, exist_ok=True)
os.makedirs(VAL_LABELS, exist_ok=True)

# =========================================================
# CLASS DEFINITIONS
# =========================================================

CLASSES = {
    0: "scratch",
    1: "crack",
    2: "dent",
    3: "contamination",
    4: "overlay_shift",
    5: "edge_chip",
    6: "dead_die",
    7: "burn_mark",
    8: "hole",
    9: "pattern_damage"
}

# =========================================================
# CREATE CLEAN WAFER
# =========================================================

def create_wafer():

    img = np.zeros((1024, 1024, 3), dtype=np.uint8)

    # background
    img[:] = (25, 25, 25)

    center = (512, 512)
    radius = 460

    # wafer
    cv2.circle(img, center, radius, (180, 180, 180), -1)

    # grid
    for x in range(100, 924, 22):
        cv2.line(img, (x, 100), (x, 924), (120,120,120), 1)

    for y in range(100, 924, 22):
        cv2.line(img, (100, y), (924, y), (120,120,120), 1)

    return img

# =========================================================
# RANDOM DEFECTS
# =========================================================

def add_scratch(img):

    x1 = random.randint(150, 850)
    y1 = random.randint(150, 850)

    x2 = x1 + random.randint(-200, 200)
    y2 = y1 + random.randint(-200, 200)

    cv2.line(img, (x1,y1), (x2,y2), (0,0,0), 3)

    return [0, x1, y1, x2, y2]

def add_crack(img):

    points = []

    x = random.randint(200, 800)
    y = random.randint(200, 800)

    for _ in range(6):
        x += random.randint(-40,40)
        y += random.randint(-40,40)

        points.append((x,y))

    for i in range(len(points)-1):
        cv2.line(img, points[i], points[i+1], (0,0,0), 2)

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]

    return [1, min(xs), min(ys), max(xs), max(ys)]

def add_dent(img):

    x = random.randint(200, 800)
    y = random.randint(200, 800)

    r = random.randint(10, 25)

    cv2.circle(img, (x,y), r, (50,50,50), -1)

    return [2, x-r, y-r, x+r, y+r]

def add_contamination(img):

    x = random.randint(150,850)
    y = random.randint(150,850)

    r = random.randint(5,20)

    cv2.circle(img, (x,y), r, (0,0,0), -1)

    return [3, x-r, y-r, x+r, y+r]

def add_overlay_shift(img):

    x = random.randint(200,700)
    y = random.randint(200,700)

    w = random.randint(80,150)
    h = random.randint(80,150)

    roi = img[y:y+h, x:x+w].copy()

    shift = random.randint(10,25)

    img[y+shift:y+h+shift, x+shift:x+w+shift] = roi

    return [4, x, y, x+w+shift, y+h+shift]

def add_edge_chip(img):

    x = random.randint(100,924)
    y = random.choice([100,924])

    cv2.circle(img, (x,y), 35, (25,25,25), -1)

    return [5, x-35, y-35, x+35, y+35]

def add_dead_die(img):

    x = random.randint(150,850)
    y = random.randint(150,850)

    w = 40
    h = 40

    cv2.rectangle(img, (x,y), (x+w,y+h), (0,0,0), -1)

    return [6, x, y, x+w, y+h]

def add_burn_mark(img):

    x = random.randint(200,800)
    y = random.randint(200,800)

    r = random.randint(20,50)

    cv2.circle(img, (x,y), r, (30,30,30), -1)

    return [7, x-r, y-r, x+r, y+r]

def add_hole(img):

    x = random.randint(200,800)
    y = random.randint(200,800)

    r = random.randint(8,20)

    cv2.circle(img, (x,y), r, (0,0,0), -1)

    return [8, x-r, y-r, x+r, y+r]

def add_pattern_damage(img):

    x = random.randint(150,850)
    y = random.randint(150,850)

    w = random.randint(50,100)
    h = random.randint(50,100)

    cv2.rectangle(img, (x,y), (x+w,y+h), (200,200,200), -1)

    return [9, x, y, x+w, y+h]

# =========================================================
# YOLO LABEL FORMAT
# =========================================================

def convert_to_yolo(box):

    cls, x1, y1, x2, y2 = box

    x_center = ((x1+x2)/2)/1024
    y_center = ((y1+y2)/2)/1024

    width = abs(x2-x1)/1024
    height = abs(y2-y1)/1024

    return f"{cls} {x_center} {y_center} {width} {height}"

# =========================================================
# GENERATE DATASET
# =========================================================

DEFECT_FUNCTIONS = [
    add_scratch,
    add_crack,
    add_dent,
    add_contamination,
    add_overlay_shift,
    add_edge_chip,
    add_dead_die,
    add_burn_mark,
    add_hole,
    add_pattern_damage
]

def generate_dataset(count, image_dir, label_dir):

    for i in range(count):

        img = create_wafer()

        labels = []

        defect_count = random.randint(1,5)

        for _ in range(defect_count):

            func = random.choice(DEFECT_FUNCTIONS)

            box = func(img)

            labels.append(convert_to_yolo(box))

        image_path = os.path.join(image_dir, f"wafer_{i}.png")
        label_path = os.path.join(label_dir, f"wafer_{i}.txt")

        cv2.imwrite(image_path, img)

        with open(label_path, "w") as f:
            f.write("\n".join(labels))

        print(f"Generated: wafer_{i}.png")

# =========================================================
# MAIN
# =========================================================

print("\nGenerating TRAIN dataset...\n")

generate_dataset(
    count=5000,
    image_dir=TRAIN_IMAGES,
    label_dir=TRAIN_LABELS
)

print("\nGenerating VALIDATION dataset...\n")

generate_dataset(
    count=1000,
    image_dir=VAL_IMAGES,
    label_dir=VAL_LABELS
)

print("\nDataset generation completed successfully!")