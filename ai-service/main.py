import json
import os
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent
# Prefer weights shipped under this repo: centric/dataset/.../best.pt
DEFAULT_MODEL = str(
    BASE_DIR.parent
    / "dataset"
    / "runs"
    / "segment"
    / "train"
    / "weights"
    / "best.pt"
)
MODEL_PATH = os.getenv("YOLO_MODEL_PATH", DEFAULT_MODEL)
CONFIDENCE_THRESHOLD = float(os.getenv("YOLO_CONFIDENCE", "0.35"))
MAX_IMAGE_DIMENSION = int(os.getenv("YOLO_MAX_DIMENSION", "1920"))

with open(BASE_DIR / "class_mapping.json", encoding="utf-8") as mapping_file:
    CLASS_TO_MATERIAL_CODE = json.load(mapping_file)

app = FastAPI(title="Centric AI Detection Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model: YOLO | None = None


def get_model() -> YOLO:
    global model
    if model is None:
        path = Path(MODEL_PATH)
        if not path.exists():
            raise FileNotFoundError(
                f"YOLO weights not found at {path}. "
                "Set YOLO_MODEL_PATH or place best.pt under dataset/runs/segment/train/weights/."
            )
        model = YOLO(str(path))
    return model


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_path": MODEL_PATH,
        "model_loaded": model is not None,
        "classes": len(CLASS_TO_MATERIAL_CODE),
    }


@app.get("/classes")
def classes():
    yolo_model = get_model()
    return {
        "yolo_classes": yolo_model.names,
        "material_mapping": CLASS_TO_MATERIAL_CODE,
    }


def normalize_image(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("RGB")
    width, height = image.size

    if max(width, height) <= MAX_IMAGE_DIMENSION:
        return image

    scale = MAX_IMAGE_DIMENSION / max(width, height)
    resized = (
        max(1, int(width * scale)),
        max(1, int(height * scale)),
    )

    return image.resize(resized, Image.Resampling.LANCZOS)


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image file")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")

    try:
        pil_image = normalize_image(Image.open(BytesIO(image_bytes)))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unsupported or corrupted image file") from exc

    try:
        yolo_model = get_model()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load YOLO model: {exc}",
        ) from exc

    try:
        results = yolo_model.predict(
            source=pil_image,
            conf=CONFIDENCE_THRESHOLD,
            verbose=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"YOLO inference failed: {exc}",
        ) from exc

    if not results:
        return {"detected": False, "message": "No inference result"}

    result = results[0]
    if result.boxes is None or len(result.boxes) == 0:
        return {"detected": False, "message": "No centric elements detected in scan area"}

    best_index = int(result.boxes.conf.argmax())
    class_id = int(result.boxes.cls[best_index])
    confidence = float(result.boxes.conf[best_index]) * 100
    yolo_class = yolo_model.names[class_id]
    material_code = CLASS_TO_MATERIAL_CODE.get(yolo_class)

    detections = []
    for index in range(len(result.boxes)):
        det_class_id = int(result.boxes.cls[index])
        det_name = yolo_model.names[det_class_id]
        detections.append(
            {
                "yolo_class": det_name,
                "material_code": CLASS_TO_MATERIAL_CODE.get(det_name),
                "confidence": round(float(result.boxes.conf[index]) * 100, 2),
            }
        )

    return {
        "detected": material_code is not None,
        "yolo_class": yolo_class,
        "material_code": material_code,
        "confidence": round(confidence, 2),
        "image_size": {"width": pil_image.width, "height": pil_image.height},
        "detections": detections,
    }
