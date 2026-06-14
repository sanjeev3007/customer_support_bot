declare module 'mammoth' {
  export interface Options {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }
  export interface Result {
    value: string;
    messages: any[];
  }
  export function extractRawText(options: Options): Promise<Result>;
  export function convertToHtml(options: Options, options2?: any): Promise<Result>;
}
