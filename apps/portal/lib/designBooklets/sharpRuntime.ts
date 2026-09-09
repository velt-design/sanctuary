import "server-only";

type DesignBookletSharpFactory =
  (typeof import("sharp"))["default"];

let sharpFactoryPromise: Promise<DesignBookletSharpFactory> | null = null;

export class DesignBookletImageProcessorUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Image processing is temporarily unavailable.", { cause });
    this.name = "DesignBookletImageProcessorUnavailableError";
  }
}

export async function loadDesignBookletSharp(): Promise<DesignBookletSharpFactory> {
  try {
    sharpFactoryPromise ??= import("sharp").then(
      (sharpModule) => sharpModule.default,
    );
    return await sharpFactoryPromise;
  } catch (error) {
    sharpFactoryPromise = null;
    if (error instanceof DesignBookletImageProcessorUnavailableError) {
      throw error;
    }
    throw new DesignBookletImageProcessorUnavailableError(error);
  }
}
