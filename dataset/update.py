import os

dataset_path = r"C:\Users\ajith\OneDrive\Desktop\projects\dataset"

class_ids = {
    "adjust": 0,
    "aluminium": 1,
    "Angle_Shutter_Frame": 2,
    "Base_Plate": 3,
    "Bracing_Pipe": 4,
    "C_ledger_all": 5,
    "C_vertical_all": 6,
    "Gribs": 7,
    "H_Pipe_All": 8,
    "Lift_side_pipe": 9,
    "MS_Channel": 10,
    "Nandu_Clamp": 11,
    "Platform_Grill": 12,
    "Props": 13,
    "Screw_Jacky": 14,
    "Sheet": 15,
    "Span": 16,
    "V_Ledger": 17
}

updated = 0

for folder, class_id in class_ids.items():

    folder_path = os.path.join(dataset_path, folder)

    if not os.path.isdir(folder_path):
        print(f"Folder not found: {folder}")
        continue

    for file in os.listdir(folder_path):

        if file.endswith(".txt"):

            txt_path = os.path.join(folder_path, file)

            with open(txt_path, "r") as f:
                lines = f.readlines()

            new_lines = []

            for line in lines:

                line = line.strip()

                if line == "":
                    continue

                parts = line.split()

                parts[0] = str(class_id)

                new_lines.append(" ".join(parts))

            with open(txt_path, "w") as f:
                f.write("\n".join(new_lines))

            updated += 1

print(f"\nDone!")
print(f"Updated {updated} label files.")