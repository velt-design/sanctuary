const DESIGN_BOOKLET_UPLOAD_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const DESIGN_BOOKLET_UPLOAD_TARGET_BYTES = 3 * 1024 * 1024;
export const DESIGN_BOOKLET_UPLOAD_MAX_DIMENSION = 4096;

type DecodedImage = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

async function decodeWithImageBitmap(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return {
    width: bitmap.width,
    height: bitmap.height,
    draw: (context, width, height) =>
      context.drawImage(bitmap, 0, 0, width, height),
    close: () => bitmap.close(),
  };
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The image could not be read."));
      element.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (context, width, height) =>
        context.drawImage(image, 0, 0, width, height),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    return (await decodeWithImageBitmap(file)) ?? decodeWithImageElement(file);
  } catch {
    return decodeWithImageElement(file);
  }
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The image could not be compressed.")),
      "image/jpeg",
      quality,
    );
  });
}

function jpegFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "booklet-image";
  return `${base.slice(0, 150)}.jpg`;
}

export function scaledImageSize(
  width: number,
  height: number,
  maxDimension = DESIGN_BOOKLET_UPLOAD_MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressDesignBookletImage(
  file: File,
  targetBytes = DESIGN_BOOKLET_UPLOAD_TARGET_BYTES,
): Promise<File> {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("Choose a PNG or JPEG image.");
  }
  if (file.size <= 0) throw new Error("Choose a non-empty image.");
  if (file.size > DESIGN_BOOKLET_UPLOAD_MAX_SOURCE_BYTES) {
    throw new Error("Choose an image that is 15 MB or smaller.");
  }

  const decoded = await decodeImage(file);
  try {
    let dimensions = scaledImageSize(decoded.width, decoded.height);
    let best: Blob | null = null;
    const qualities = [0.9, 0.84, 0.78, 0.72, 0.66, 0.6];

    for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("The image could not be compressed.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      decoded.draw(context, canvas.width, canvas.height);

      for (const quality of qualities) {
        const blob = await canvasBlob(canvas, quality);
        best = !best || blob.size < best.size ? blob : best;
        if (blob.size <= targetBytes) {
          return new File([blob], jpegFileName(file.name), {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
        }
      }
      dimensions = {
        width: Math.max(1, Math.round(dimensions.width * 0.82)),
        height: Math.max(1, Math.round(dimensions.height * 0.82)),
      };
    }

    if (!best) throw new Error("The image could not be compressed.");
    return new File([best], jpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    decoded.close();
  }
}
