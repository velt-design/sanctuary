export function preloadDesignBookletImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("The saved image could not be displayed."));
    image.src = src;
  });
}
