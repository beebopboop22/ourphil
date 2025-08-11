// Utility to export a DOM node to an image blob matching the node's dimensions.
// Elements marked with data-no-export are omitted.
export default async function exportCardImage(node, opts = {}) {
  if (!node) throw new Error("node required");
  const width = opts.width ?? node.offsetWidth;
  const height = opts.height ?? node.offsetHeight;
  const { toBlob } = await import("https://esm.sh/html-to-image");

  // Embed images to avoid tainting the canvas during export
  const embedImages = async (root) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    const originalSrcs = imgs.map((img) => img.src);
    await Promise.all(
      imgs.map(async (img) => {
        return new Promise((resolve) => {
          // Force crossOrigin to anonymous to fetch data
          img.crossOrigin = "anonymous";
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        });
      }),
    );
    return () => {
      imgs.forEach((img, i) => {
        img.src = originalSrcs[i];
      });
    };
  };

  const cleanup = await embedImages(node);
  const blob = await toBlob(node, {
    pixelRatio: opts.pixelRatio ?? 2,
    width,
    height,
    cacheBust: true,
    filter: (n) =>
      !(n instanceof HTMLElement && n.dataset.noExport !== undefined),
  });
  cleanup();
  return blob;
}
