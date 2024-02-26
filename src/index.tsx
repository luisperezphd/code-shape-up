import { useCallback, useEffect, useRef, useState } from "react";
import { useBoolean } from "usehooks-ts";
import { Button, Card, Column, LinkButton, Row } from "./lib/components";
import { drawCube, getCubeCanvas } from "./lib/cube";
import { genRenderCodeFromCanvas, genRenderCodeFromImage } from "./lib/genRenderCode";
import { cn, loadImage, nullthrows, promiseDoneCall, px } from "./lib/util";

const renderWidth = 900;
const charWidth = 4;

export default function IndexPage() {
  const [renderCode, setRenderCode] = useState("");

  const [code, setCode] = useState("");
  const [screen, setScreen] = useState<"welcome" | "enter-code" | "select-shape" | "draw-image" | "render-code" | "enter-word" | "cube">("welcome");

  const onImageSelect = useCallback(
    async (image: HTMLImageElement) => {
      setScreen("render-code");
      const renderCode = await genRenderCodeFromImage(code, image, charWidth, renderWidth);
      setRenderCode(renderCode);
    },
    [code]
  );

  return (
    <>
      <Page
        hideLogo={screen === "welcome"}
        onClickLogo={() => {
          setScreen("welcome");
          setRenderCode("");
        }}
      >
        <Container>
          {screen === "welcome" && <WelcomeScreen onGetStarted={() => setScreen("enter-code")} />}
          {screen === "enter-code" && (
            <EnterCodeScreen
              code={code}
              onContinue={(code) => {
                setCode(code);
                setScreen("select-shape");
              }}
            />
          )}
          {screen === "select-shape" && (
            <SelectShapeScreen
              // format
              onContinue={onImageSelect}
              onDrawImage={() => setScreen("draw-image")}
              onWord={() => setScreen("enter-word")}
              onCube={() => setScreen("cube")}
            />
          )}
          {screen === "draw-image" && <DrawImageScreen onContinue={onImageSelect} />}
          {screen === "enter-word" && <EnterWordScreen onContinue={onImageSelect} />}
        </Container>
        {screen === "render-code" && <CodeRender code={renderCode} />}
        {screen === "cube" && <CubeRender code={code} />}
      </Page>
    </>
  );
}

const canvas = getCubeCanvas();

function CubeRender(props: { code: string }) {
  const [renderCode, setRenderCode] = useState("");
  const { code } = props;

  useEffect(() => {
    let intervalId: number;

    promiseDoneCall(async () => {
      if (!code) return;

      intervalId = window.setInterval(async () => {
        drawCube();
        const renderCode = await genRenderCodeFromCanvas(code, canvas, charWidth, renderWidth);
        setRenderCode(renderCode);
      }, 10);
    });

    return () => clearInterval(intervalId);
  }, [code]);

  return <CodeRender code={renderCode} />;
}

type CanvasMouseEventHandler = (ev: MouseEvent) => void;

function EnterWordScreen(props: { onContinue: (image: HTMLImageElement) => void }) {
  const CHAR_LIMIT = 6;
  const [word, setWord] = useState("");
  return (
    <div className="mt-6">
      <Title content="The Word Is..." />
      <Card className="mt-2">
        <input
          // format
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a word..."
          className="outline-none w-full resize-none border-2 border-gray-300 rounded-md p-2"
          autoFocus
        />
        <div
          // format
          className={cn(" mt-1 ml-1", word.trim().length <= CHAR_LIMIT ? "text-gray-400" : "text-red-800")}
        >
          {word.trim().length === 0 ? `Up to ${CHAR_LIMIT} characters` : `${CHAR_LIMIT - word.trim().length} characters left`}
        </div>
        <Row className="justify-end mt-4 items-center gap-2">
          <div className="flex-grow">{/* nothing */}</div>
          <Button
            // format
            label="Next"
            isDisabled={word.trim().length === 0 || word.trim().length > 6}
            disabledTooltip={word.trim().length === 0 ? "Enter some code to continue." : "Word must be 6 characters or less"}
            onClick={async () => {
              const canvas = document.createElement("canvas");

              const debugShowCanvas = false;
              if (debugShowCanvas) {
                canvas.style.border = "1px solid red";
                document.body.append(canvas);
              }

              canvas.width = 100;
              canvas.height = 1000;

              const cxt = canvas.getContext("2d")!;

              const lineWidth = 60;

              const configureContext = (cxt: CanvasRenderingContext2D) => {
                cxt.font = "800px monospace";
                cxt.lineWidth = lineWidth;
              };

              function getTextSize(text: string, lineWidth: number) {
                const size = cxt.measureText(text);
                const height = size.actualBoundingBoxAscent + lineWidth + size.actualBoundingBoxDescent;
                return { baseline: size.actualBoundingBoxAscent + lineWidth / 2, height: height + lineWidth, ascent: size.actualBoundingBoxAscent };
              }

              function writeTextTop(cxt: CanvasRenderingContext2D, x: number, y: number, text: string, lineWidth: number) {
                const size = getTextSize(text, lineWidth);
                y += size.ascent;
                cxt.fillText(text, x, y);
                cxt.strokeText(text, x, y);
              }

              function measureTextHeight(fullText: string) {
                let y = 0;
                for (const c of fullText) {
                  const size = cxt.measureText(c);
                  const height = size.actualBoundingBoxAscent + lineWidth + size.actualBoundingBoxDescent;
                  y += height + 10;
                }
                return y;
              }

              configureContext(cxt);
              canvas.height = measureTextHeight(word) + 400;
              canvas.width = 800;
              configureContext(cxt);

              function writeText(fullText: string) {
                cxt.fillStyle = "black";
                cxt.strokeStyle = "black";
                const x = 200;
                let y = 0;
                for (const c of fullText) {
                  const size = cxt.measureText(c);
                  const height = size.actualBoundingBoxAscent + lineWidth + size.actualBoundingBoxDescent;
                  writeTextTop(cxt, x, y, c, lineWidth);
                  y += height + 10;
                }
              }

              writeText(word);

              const img = new Image();
              img.onload = () => props.onContinue(img);
              img.src = canvas.toDataURL();
            }}
          />
        </Row>
      </Card>
    </div>
  );
}

function canvasToImage(canvas: HTMLCanvasElement) {
  return new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL();
  });
}

function DrawImageScreen(props: { onContinue: (image: HTMLImageElement) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { value: isDirty, setTrue: setIsDirtyTrue, setFalse: setIsDirtyFalse } = useBoolean(false);

  useEffect(() => {
    const container = containerRef.current!;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineWidth = 120;

    let isDragging = false;

    let lastX = 0;
    let lastY = 0;

    const cursorCanvas = document.createElement("canvas");
    cursorCanvas.width = ctx.lineWidth;
    cursorCanvas.height = ctx.lineWidth;
    cursorCanvas.className = "absolute pointer-events-none";
    container.appendChild(cursorCanvas);

    const cursorCtx = cursorCanvas.getContext("2d")!;
    cursorCtx.lineCap = ctx.lineCap;
    cursorCtx.lineWidth = ctx.lineWidth;
    cursorCtx.beginPath();
    const cursorCenter = ctx.lineWidth / 2;
    cursorCtx.moveTo(cursorCenter, cursorCenter);
    cursorCtx.lineTo(cursorCenter, cursorCenter);
    cursorCtx.stroke();

    const onMouseDown: CanvasMouseEventHandler = (e) => {
      isDragging = true;
      setIsDirtyTrue();

      const { clientX, clientY } = e;
      const { offsetLeft, offsetTop } = container;

      const x = clientX - offsetLeft;
      const y = clientY - offsetTop;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();

      [lastX, lastY] = [x, y];
    };

    const onMouseMove: CanvasMouseEventHandler = (e) => {
      const { clientX, clientY } = e;
      const { offsetLeft, offsetTop } = container;

      const x = clientX - offsetLeft;
      const y = clientY - offsetTop;

      cursorCanvas.style.left = px(x - cursorCenter);
      cursorCanvas.style.top = px(y - cursorCenter);

      if (!isDragging) return;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      [lastX, lastY] = [x, y];
    };

    const onMouseUp: CanvasMouseEventHandler = (e) => {
      isDragging = false;
    };

    const onMouseLeave: CanvasMouseEventHandler = (e) => {
      cursorCanvas.style.left = px(-1000);
      cursorCanvas.style.top = px(-1000);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <Column>
      <Title content="DRAW" className="mt-4" />
      <div ref={containerRef} className="border-4 border-black rounded-3xl mt-4 overflow-hidden bg-white aspect-square flex items-center justify-center relative">
        <canvas width={665} height={665} ref={canvasRef} className="aspect-square" />
      </div>
      <Column className="mt-4 gap-2">
        <Button
          label="Clear"
          use="secondary"
          onClick={() => {
            const canvas = nullthrows(canvasRef.current);
            canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
            setIsDirtyFalse();
          }}
        />
        <Button
          label="Continue"
          isDisabled={!isDirty}
          disabledTooltip="Draw something to continue."
          onClick={() => {
            const img = new Image();
            img.onload = () => props.onContinue(img);
            img.src = nullthrows(canvasRef.current).toDataURL();
          }}
        />
      </Column>
    </Column>
  );
}

function SelectShapeScreen(props: { onContinue: (image: HTMLImageElement) => void; onDrawImage: () => void; onWord: () => void; onCube: () => void }) {
  return (
    <div>
      <Title content="Select a Shape" className="mt-4" />
      <Row className="gap-4 mt-5 flex-wrap">
        {[
          // format
          { imageUrl: "dist/shape-light-bulb.png" },
          { imageUrl: "dist/shape-star.png" },
          { imageUrl: "dist/shape-star-column.png" },
          { imageUrl: "dist/shape-helix.png" },
        ].map((o) => (
          <div
            key={o.imageUrl}
            onClick={async () => {
              const image = await loadImage(o.imageUrl);
              props.onContinue(image);
            }}
            className="border-4 border-black rounded-3xl w-80 h-80 p-4 pt-3 bg-white hover:scale-105 transition-transform cursor-pointer flex items-center justify-center overflow-hidden select-none"
          >
            <img src={o.imageUrl} className="w-full x:h-40 x:object-cover" />
          </div>
        ))}

        <div onClick={props.onDrawImage} className="border-4 border-black rounded-3xl w-80 h-80 p-4 pt-3 bg-white hover:scale-105 transition-transform cursor-pointer flex items-center justify-center select-none">
          <div className="text-9xl text-center font-bold font-mono" style={{ lineHeight: ".7em" }}>
            <div>DR</div>
            <div>AW</div>
          </div>
        </div>

        <div onClick={props.onWord} className="border-4 border-black rounded-3xl w-80 h-80 p-4 pt-3 bg-white hover:scale-105 transition-transform cursor-pointer flex items-center justify-center select-none">
          <div className="text-9xl text-center font-bold font-mono" style={{ lineHeight: ".7em" }}>
            <img src="dist/shape-word.png" className="w-full x:h-40 x:object-cover" />
          </div>
        </div>

        <div onClick={props.onCube} className="border-4 border-black rounded-3xl w-80 h-80 p-4 pt-3 bg-white hover:scale-105 transition-transform cursor-pointer flex items-center justify-center select-none">
          <div className="text-9xl text-center font-bold font-mono" style={{ lineHeight: ".7em" }}>
            <img src="dist/shape-cube.png" className="w-full x:h-40 x:object-cover" />
          </div>
        </div>
      </Row>
    </div>
  );
}

function Title(props: { content: string; className?: string }) {
  return <div className={cn("text-center text-black text-2xl font-bold", props.className)}>{props.content}</div>;
}

function WelcomeScreen(props: { onGetStarted: () => void }) {
  return (
    <Column className="content-center items-center">
      <img src="dist/logo.svg" className="w-[300px] h-[66.53px] mt-24" />
      <Title content="Whip your JavaScript into Shape" className="mt-8" />
      <div>Literally, that is. Enter your code, choose a picture and BAM!</div>
      <div>Code in the shape of a picture...wonders never cease.</div>
      <Button label="Get Started" use="secondary" className="mt-8" onClick={props.onGetStarted} />
    </Column>
  );
}

function EnterCodeScreen(props: { code: string; onContinue: (code: string) => void }) {
  const [code, setCode] = useState(props.code);
  return (
    <div className="mt-6">
      <Title content="Enter Your Code" />
      <Card className="mt-2">
        <textarea
          // format
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Type or paste your code into here..."
          className="outline-none w-full h-80 resize-none text-sm"
          autoFocus
        />
        <Row className="justify-end mt-4 items-center gap-2">
          <div className="flex-grow">
            <LinkButton
              label="Use Sample Code"
              onClick={async () => {
                const code = await fetch("dist/sample-code3.js").then((o) => o.text());
                setCode(code);
              }}
            />
          </div>
          <Button
            // format
            label="Clear"
            use="secondary"
            isDisabled={code.trim().length === 0}
            disabledTooltip="There's nothing to clear."
            onClick={() => setCode("")}
          />
          <Button
            // format
            label="Next"
            isDisabled={code.trim().length === 0}
            disabledTooltip="Enter some code to continue."
            onClick={() => props.onContinue(code)}
          />
        </Row>
      </Card>
    </div>
  );
}

function Container(props: { children: React.ReactNode }) {
  return <div className="max-w-2xl m-auto">{props.children}</div>;
}

function Page(props: { children: React.ReactNode; hideLogo: boolean; onClickLogo?: () => void }) {
  return (
    <div className="p-2 pb-20">
      {!props.hideLogo && (
        <img
          // format
          src="dist/logo.svg"
          className="absolute top-2 left-2 w-[110px] hover:scale-105 active:scale-95 scale-100 cursor-pointer transition-transform duration-75"
          onClick={props.onClickLogo}
        />
      )}
      {props.children}
    </div>
  );
}

function CodeRender(props: { code: string }) {
  return (
    <Column className="items-center">
      <Title content="BAM!" />
      <CopyToClipboardButton content={props.code} className="absolute top-2 right-2" />
      <div className="font-mono break whitespace-pre font-bold leading-3 text-xxs w-[970px] m-auto">{props.code}</div>
      <LinkButton
        label="Back to Top"
        onClick={() =>
          scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth",
          })
        }
        className="mt-4"
      />
    </Column>
  );
}

function CopyToClipboardButton(props: { content: string; className?: string }) {
  const LABEL = "Copy to Clipboard";
  const [label, setLabel] = useState(LABEL);
  return (
    <Button
      label={label}
      className={cn("w-56", props.className)}
      onClick={() => {
        setLabel("Copied!");
        navigator.clipboard.writeText(props.content);
        setTimeout(() => setLabel(LABEL), 1000);
      }}
    />
  );
}
