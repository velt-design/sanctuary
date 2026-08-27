import "server-only";

type DesignBookletSharpFactory =
  (typeof import("sharp"))["default"];

let sharpFactoryPromise: Promise<DesignBookletSharpFactory> | null = null;

export async function loadDesignBookletSharp(): Promise<DesignBookletSharpFactory> {
  try {
    sharpFactoryPromise ??= import("sharp").then(
      (sharpModule) => sharpModule.default,
    );
    return await sharpFactoryPromise;
  } catch (error) {
    sharpFactoryPromise = null;
    throw error;
  }
}
