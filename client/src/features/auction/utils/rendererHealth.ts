/** Native WebGL recovery, detached cleanly when the visual stage unmounts. */
export function watchWebGLContext(canvas: HTMLCanvasElement, onLost: () => void, onRestored: () => void): () => void {
  let lost = false;
  const lose = (event: Event) => {
    // Without preventDefault the browser is allowed to abandon restoration.
    event.preventDefault();
    if (!lost) { lost = true; onLost(); }
  };
  const restore = () => {
    if (!lost) return;
    lost = false; onRestored();
  };
  canvas.addEventListener('webglcontextlost', lose, false);
  canvas.addEventListener('webglcontextrestored', restore, false);
  return () => {
    canvas.removeEventListener('webglcontextlost', lose, false);
    canvas.removeEventListener('webglcontextrestored', restore, false);
  };
}
