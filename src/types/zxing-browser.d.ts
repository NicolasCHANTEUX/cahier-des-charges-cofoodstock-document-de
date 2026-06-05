declare module "@zxing/browser" {
  export type DecodeResult = {
    getText: () => string;
  };

  export type DecodeControls = {
    stop: () => void;
  };

  export class BrowserMultiFormatReader {
    decodeFromVideoElement(
      videoElement: HTMLVideoElement,
      callback: (result: DecodeResult | undefined) => void
    ): Promise<DecodeControls>;
  }
}
