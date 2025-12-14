import type { FITSData } from "./types";

export async function parseFITS(file: File): Promise<FITSData | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    let offset = 0;
    let width = 0;
    let height = 0;
    let bitpix = 0;
    let headerComplete = false;

    while (!headerComplete && offset < arrayBuffer.byteLength) {
      const headerBlock = new TextDecoder("ascii").decode(
        new Uint8Array(arrayBuffer, offset, 2880)
      );

      const lines = headerBlock.match(/.{1,80}/g) || [];

      for (const line of lines) {
        if (line.startsWith("NAXIS1")) {
          width = parseInt(line.split("=")[1].split("/")[0].trim());
        } else if (line.startsWith("NAXIS2")) {
          height = parseInt(line.split("=")[1].split("/")[0].trim());
        } else if (line.startsWith("BITPIX")) {
          bitpix = parseInt(line.split("=")[1].split("/")[0].trim());
        } else if (line.startsWith("END")) {
          headerComplete = true;
          break;
        }
      }

      offset += 2880;
    }

    if (!width || !height) {
      throw new Error("Invalid FITS file: missing dimensions");
    }

    const bytesPerPixel = Math.abs(bitpix) / 8;
    const data: number[][] = [];
    let min = Infinity;
    let max = -Infinity;

    for (let y = 0; y < height; y++) {
      const row: number[] = [];

      for (let x = 0; x < width; x++) {
        const pixelOffset = offset + (y * width + x) * bytesPerPixel;
        let value: number;

        if (bitpix === -32) {
          value = dataView.getFloat32(pixelOffset, false);
        } else if (bitpix === -64) {
          value = dataView.getFloat64(pixelOffset, false);
        } else if (bitpix === 16) {
          value = dataView.getInt16(pixelOffset, false);
        } else if (bitpix === 32) {
          value = dataView.getInt32(pixelOffset, false);
        } else {
          value = dataView.getUint8(pixelOffset);
        }

        if (!Number.isFinite(value)) {
          value = 0;
        }

        row.push(value);
        if (value < min) min = value;
        if (value > max) max = value;
      }

      data.push(row);
    }

    return { data, width, height, min, max };
  } catch (error) {
    console.error("Error parsing FITS file:", error);
    return null;
  }
}
