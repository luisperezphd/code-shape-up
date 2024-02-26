import { loadImage, nullthrows } from "./util";

export type Run = [
  number, // skip width
  number, // draw width
];

export type Line = Run[];
export type LineData = Line[];

export function Run(startX: number, endX: number): Run {
  return [startX, endX];
}

export function Line(...runs: Run[]): Line {
  return runs;
}

export async function genLineDataFromImageUrl(url: string): Promise<LineData> {
  const img = await loadImage(url);
  return await genLineDataFromImage(img);
}

export async function genLineDataFromImage(img: HTMLImageElement): Promise<LineData> {
  const canvas = document.createElement("canvas");

  const debugShowCanvas = false;
  if (debugShowCanvas) {
    document.body.append(canvas);
  }

  const canvasWidth = img.width;
  const canvasHeight = Math.floor(img.height * (100 / 800));

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = nullthrows(canvas.getContext("2d"));
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return await genLineDataFromCanvas(canvas);
}

export async function genLineDataFromCanvas(canvas: HTMLCanvasElement): Promise<LineData> {
  const ctx = nullthrows(canvas.getContext("2d"));

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const isPixel = (x: number, y: number) => {
    const i = y * (canvas.width * 4) + x * 4;

    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];

    return red < 10 && green < 10 && blue < 10 && alpha > 200;
  };

  const lines: LineData = [];
  for (let y = 0; y < canvas.height; y++) {
    const line: Line = [];
    lines.push(line);
    let x = 0;

    while (x < canvas.width) {
      while (!isPixel(x, y) && x < canvas.width) x++;

      if (x >= canvas.width) break;

      const startX = x;

      while (isPixel(x, y) && x < canvas.width) x++;

      const endX = x;

      line.push(Run(startX / canvas.width, endX / canvas.width));
    }
  }

  return lines;
}
