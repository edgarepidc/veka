/** Read a local file URI into an ArrayBuffer (reliable on iOS; Blob uploads often break). */
export async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('No se pudo leer el archivo seleccionado.');
  }
  return response.arrayBuffer();
}
