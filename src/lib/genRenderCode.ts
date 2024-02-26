import { LineData, genLineDataFromCanvas, genLineDataFromImage, genLineDataFromImageUrl } from "./genLineData";
import { genSplitableCodeSegments } from "./genSplitableCodeSegments";
import { arrayLast, isIdentifierChar, lastChar, loadImage } from "./util";

export async function genRenderCodeFromImageUrl(
  // format
  code: string,
  imageUrl: string,
  charWidth: number,
  renderWidth: number
) {
  const image = await loadImage(imageUrl);
  return await genRenderCodeFromImage(code, image, charWidth, renderWidth);
}

export async function genRenderCodeFromImage(
  // format
  code: string,
  image: HTMLImageElement,
  charWidth: number,
  renderWidth: number
) {
  const lineData = await genLineDataFromImage(image);
  return await genRenderCodeFromLineData(code, lineData, charWidth, renderWidth);
}

export async function genRenderCodeFromCanvas(
  // format
  code: string,
  canvas: HTMLCanvasElement,
  charWidth: number,
  renderWidth: number
) {
  const lineData = await genLineDataFromCanvas(canvas);
  return await genRenderCodeFromLineData(code, lineData, charWidth, renderWidth);
}

export async function genRenderCodeFromLineData(code: string, lineData: LineData, charWidth: number, renderWidth: number): Promise<string> {
  const splitableCode = genSplitableCodeSegments(code);

  const measureTextWidth = (text: string) => getWidthFromLength(text.length);
  const getWidthFromLength = (length: number) => length * charWidth;
  const getPartsWidth = (parts: string[]) => getWidthFromLength(parts.map((o) => o.length).reduce((a, b) => a + b, 0));

  const getSegmentParts = (
    j: number,
    lineParts: string[],
    startX: number,
    endX: number
  ): {
    j: number;
    segmentParts: string[];
  } | null => {
    if (endX <= startX) throw new Error();

    // spacing segment
    {
      const x = getPartsWidth(lineParts);
      if (x < startX) {
        const dist = startX - x;
        const numChars = Math.floor(dist / charWidth);
        lineParts.push(" ".repeat(numChars));
      }
    }

    let trackMaxNumLoops = 0; // just in case throws exception to prevent infinite loop

    let segmentParts: string[] = [];
    const linePartsWidth = getPartsWidth(lineParts);

    while (true) {
      // segment
      const x = linePartsWidth + getPartsWidth(segmentParts);

      if (x >= endX) break;
      if (j >= splitableCode.length) return { j, segmentParts };

      const codePiece = splitableCode[j];

      const needsSpace = segmentParts.length && doesNeedSpace(arrayLast(segmentParts), codePiece);
      const newEndX = Math.abs(x + measureTextWidth(codePiece)) + (needsSpace ? charWidth : 0);

      if (newEndX > endX) {
        const dist = endX - x;

        const doubleQuote = '"';
        const singleQuote = "'";

        if (dist >= 2 * charWidth && (codePiece.endsWith(singleQuote) || codePiece.endsWith(doubleQuote))) {
          const codePieceBody = codePiece.slice(1, codePiece.length - 1);

          if (codePieceBody !== "use strict") {
            const quoteChar = lastChar(codePiece);
            const numChars = Math.floor(dist / charWidth);

            if (numChars === 2) {
              segmentParts.push(quoteChar + quoteChar);
              splitableCode.splice(j, 0, "+");
            } else {
              let numTakeChars = numChars - 2;
              let takeChars = codePieceBody.slice(0, numTakeChars);

              const nextToLastChar = takeChars[takeChars.length - 2];
              let doProcess = true;

              if (lastChar(takeChars) === "\\") {
                if (nextToLastChar !== "\\") {
                  numTakeChars--;
                  takeChars = codePieceBody.slice(0, numTakeChars);
                }
              }

              if (doProcess) {
                const restChars = codePieceBody.slice(numTakeChars);
                segmentParts.push(quoteChar + takeChars + quoteChar);
                splitableCode[j] = quoteChar + restChars + quoteChar;
                splitableCode.splice(j, 0, "+");
              }
            }
          }
          break;
        } else {
          const targetWidth = endX - startX;
          const newWidth = newEndX - startX;
          const closePercent = newWidth / targetWidth - 1;

          const allow = closePercent < 0.05 && segmentParts.length === 0;

          if (!allow) {
            break;
          }
        }
      }

      if (needsSpace) {
        segmentParts.push(" ");
      }

      segmentParts.push(codePiece);

      j++;
      trackMaxNumLoops++;

      if (trackMaxNumLoops >= 1000) throw new Error("loopCount >= 1000");
    }

    const x = linePartsWidth + getPartsWidth(segmentParts);

    if (x < endX && segmentParts.length > 1) {
      const dist = endX - x;
      const numChars = Math.floor(dist / charWidth);
      const numSpotsForSpaces = segmentParts.length - 1;
      const numSpacesPerSpot = Math.floor(numChars / numSpotsForSpaces);
      const numCharsInserted = numSpacesPerSpot * numSpotsForSpaces;
      const numCharsRemaining = numChars - numCharsInserted;

      const spots = new Array<number>(numSpotsForSpaces).fill(numSpacesPerSpot);

      if (numCharsRemaining > 0) {
        let j = segmentParts.length - 2;
        const skipSpot = numSpotsForSpaces / numCharsRemaining;
        for (let i = 0; i < numCharsRemaining; i++) {
          spots[Math.floor(j)]++;
          j -= skipSpot;
        }
      }

      const newSegmentParts = new Array<string>(segmentParts.length + spots.length);
      newSegmentParts[0] = segmentParts[0];

      for (let i = 0; i < spots.length; i++) {
        newSegmentParts[i * 2 + 1] = " ".repeat(spots[i]);
        newSegmentParts[i * 2 + 2] = segmentParts[i + 1];
      }

      segmentParts = newSegmentParts;
    }

    return { j, segmentParts };
  };

  let j = 0;
  let renderCode = "";
  let targetDrawCount = 1000;
  let drawCount = 0;

  outer_for: while (drawCount < targetDrawCount) {
    drawCount++;
    for (let iLine = 0; iLine < lineData.length; iLine++) {
      const line = lineData[iLine];
      const lineParts: string[] = [];

      for (let iRun = 0; iRun < line.length; iRun++) {
        const run = line[iRun];
        const [startXPercent, endXPercent] = run;
        const [startX, endX] = [startXPercent, endXPercent].map((x) => x * renderWidth);

        const results = getSegmentParts(j, lineParts, startX, endX);

        if (results == null) break outer_for;
        const { segmentParts } = results;
        j = results.j;

        lineParts.push(...segmentParts);

        if (j >= splitableCode.length) break;
      }

      renderCode += lineParts.join("");
      renderCode += "\n";
      if (j >= splitableCode.length) break outer_for;
    }
  }

  renderCode += "\n";
  renderCode += "\n";
  renderCode += "\n";

  while (j < splitableCode.length) {
    const lineParts: string[] = [];
    const [startX, endX] = [0, renderWidth];
    const results = getSegmentParts(j, [], startX, endX);

    if (results == null) {
      getSegmentParts(j, [], startX, endX);
      break;
    }

    const { segmentParts } = results;
    j = results.j;
    lineParts.push(...segmentParts);
    renderCode += lineParts.join("");
    renderCode += "\n";
    if (j >= splitableCode.length) break;
  }

  return renderCode;
}

function doesNeedSpace(prev: string, next: string) {
  return isIdentifierChar(lastChar(prev)) && isIdentifierChar(next[0]);
}
