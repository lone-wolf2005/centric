import os
import json

BASE_DIR = r"C:\Users\ajith\OneDrive\Desktop\projects\dataset"

classes = [
    "adjust",
    "aluminium",
    "Angle_Shutter_Frame",
    "Base_Plate",
    "Bracing_Pipe",
    "C_ledger_all",
    "C_vertical_all",
    "Gribs",
    "H_Pipe_All",
    "Lift_side_pipe",
    "MS_Channel",
    "Nandu_Clamp",
    "Platform_Grill",
    "Props",
    "Screw_Jacky",
    "Sheet",
    "Span",
    "V_Ledger"
]

for class_id, folder in enumerate(classes):

    folder_path = os.path.join(BASE_DIR, folder)

    json_file = None
    for f in os.listdir(folder_path):
        if f.endswith(".json"):
            json_file = os.path.join(folder_path, f)
            break

    if json_file is None:
        print(f"No JSON found in {folder}")
        continue

    with open(json_file, "r") as f:
        coco = json.load(f)

    image_map = {}
    for img in coco["images"]:
        image_map[img["id"]] = (
            img["file_name"],
            img["width"],
            img["height"]
        )

    annotations = {}

    for ann in coco["annotations"]:

        image_id = ann["image_id"]

        if image_id not in image_map:
            continue

        filename, width, height = image_map[image_id]

        seg = ann.get("segmentation", [])

        if len(seg) == 0:
            continue

        seg = seg[0]

        norm = []

        for i in range(0, len(seg), 2):
            x = seg[i] / width
            y = seg[i + 1] / height
            norm.extend([x, y])

        txt = filename.rsplit(".", 1)[0] + ".txt"

        if txt not in annotations:
            annotations[txt] = []

        line = str(class_id) + " " + " ".join(f"{v:.6f}" for v in norm)

        annotations[txt].append(line)

    for txt_name, lines in annotations.items():

        txt_path = os.path.join(folder_path, txt_name)

        with open(txt_path, "w") as out:
            out.write("\n".join(lines))

    print(f"✓ Converted {folder}")

print("\nAll folders converted successfully.")