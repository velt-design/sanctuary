/** Bound dimensions from headers before any raster decoder allocates pixels. */
export function assertStudioRenderImage(
  bytes: Uint8Array,
  contentType: string,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0;
  if (contentType === "image/png") {
    if (
      bytes.length < 24 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) ||
      String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR"
    )
      throw Error("Invalid PNG image");
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (contentType === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
      throw Error("Invalid JPG image");
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) throw Error("Invalid JPG image");
      let marker = bytes[offset++];
      while (marker === 255) marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length)
        throw Error("Invalid JPG image");
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 8) throw Error("Invalid JPG frame");
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  } else throw Error("Unsupported rendered image");
  if (
    !width ||
    !height ||
    width > 8192 ||
    height > 8192 ||
    width * height > 16_777_216
  )
    throw Error("Choose an image smaller than 16 megapixels");
  return { width, height };
}
