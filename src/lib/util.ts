export function noop() {
  // do nothing
}

export function promiseDoneCall<T>(fn: () => Promise<T>): void {
  promiseDone(fn());
}

export function promiseDone<T>(promise: Promise<T>): void {
  const invokeAtError = new Error();
  promise.then(noop).catch((e) => {
    console.log("promiseDoneCall exception", e, invokeAtError.stack);
  });
}

export function nullthrows<T>(value: T | null | undefined, message?: string): T {
  if (value == null) {
    throw new Error("nullthrows: " + (message ?? "value is null or undefined"));
  }

  return value;
}

export function range(start: number, end: number) {
  return Array.from({ length: end - start }, (_, i) => start + i);
}

export function isIdentifierChar(char: string) {
  return /^[a-z0-9_$]+$/i.test(char);
}

export function lastChar(str: string) {
  if (str == null) throw new Error();
  return str[str.length - 1];
}

export function arrayLast(array: any[]) {
  return array[array.length - 1];
}

export function json(value: any) {
  return JSON.stringify(value, null, 2);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function falslyToUndefined<T>(value: T | false | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (value === false) return undefined;
  return value;
}

export function px(value: number) {
  return value + "px";
}
