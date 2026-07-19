declare module "ezuikit-js" {
  export class EZUIKitPlayer {
    static EVENTS?: Record<string, string>;
    constructor(options: Record<string, unknown>);
    stop?: () => void;
    destroy?: () => void;
    reSize?: (width: number, height: number) => void;
    resize?: (width: number, height: number) => void;
    eventEmitter?: {
      on?: (eventName: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
