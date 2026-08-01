const MAX_SCAN_DIMENSION = 1920;
const JPEG_QUALITY = 0.9;

async function loadImageSource(source: File | Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source);
  } catch {
    const objectUrl = URL.createObjectURL(source);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Unable to read image file"));
        element.src = objectUrl;
      });

      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function scaleDimensions(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / Math.max(width, height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareScanImage(source: File | Blob): Promise<File> {
  const bitmap = await loadImageSource(source);
  const { width, height } = scaleDimensions(
    bitmap.width,
    bitmap.height,
    MAX_SCAN_DIMENSION,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Unable to process image");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );

  if (!blob) {
    throw new Error("Failed to prepare image for scanning");
  }

  const originalName =
    source instanceof File ? source.name.replace(/\.[^.]+$/, "") : "scan";

  return new File([blob], `${originalName}.jpg`, { type: "image/jpeg" });
}

export async function createImagePreviewUrl(source: File | Blob): Promise<string> {
  return URL.createObjectURL(source);
}
