declare module '@jscad/stl-serializer' {
  export function serialize(options: unknown, ...objects: unknown[]): Array<ArrayBuffer | Uint8Array | string>
}
