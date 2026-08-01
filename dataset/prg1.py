import os
import random
import shutil

SOURCE = r"C:\Users\ajith\OneDrive\Desktop\projects\dataset"
DEST = os.path.join(SOURCE, "yolo_dataset")

TRAIN_RATIO = 0.9
IMAGE_EXTS = (".jpg", ".jpeg", ".png")

IGNORE = {"runs", "yolo_dataset"}

os.makedirs(os.path.join(DEST, "images", "train"), exist_ok=True)
os.makedirs(os.path.join(DEST, "images", "val"), exist_ok=True)
os.makedirs(os.path.join(DEST, "labels", "train"), exist_ok=True)
os.makedirs(os.path.join(DEST, "labels", "val"), exist_ok=True)

classes = []

for folder in sorted(os.listdir(SOURCE)):
    folder_path = os.path.join(SOURCE, folder)

    if folder in IGNORE:
        continue

    if os.path.isdir(folder_path):
        classes.append(folder)

for class_id, cls in enumerate(classes):

    class_folder = os.path.join(SOURCE, cls)

    images = []

    for file in os.listdir(class_folder):
        if file.lower().endswith(IMAGE_EXTS):
            label = os.path.splitext(file)[0] + ".txt"

            if os.path.exists(os.path.join(class_folder, label)):
                images.append(file)

    random.shuffle(images)

    split = int(len(images) * TRAIN_RATIO)

    train_images = images[:split]
    val_images = images[split:]

    for subset, image_list in [("train", train_images), ("val", val_images)]:

        for img in image_list:

            label = os.path.splitext(img)[0] + ".txt"

            new_image_name = f"{cls}_{img}"
            new_label_name = f"{cls}_{label}"

            shutil.copy2(
                os.path.join(class_folder, img),
                os.path.join(DEST, "images", subset, new_image_name),
            )

            shutil.copy2(
                os.path.join(class_folder, label),
                os.path.join(DEST, "labels", subset, new_label_name),
            )

yaml_path = os.path.join(DEST, "data.yaml")

with open(yaml_path, "w") as f:
    f.write(f"path: {DEST.replace(os.sep,'/')}\n")
    f.write("train: images/train\n")
    f.write("val: images/val\n")
    f.write(f"nc: {len(classes)}\n")
    f.write("names:\n")

    for i, cls in enumerate(classes):
        f.write(f"  {i}: {cls}\n")

print("Dataset created successfully!")