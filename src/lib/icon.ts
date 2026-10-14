export interface IconDesign {
  background: string;
  secondary: string;
  gradient: boolean;
  angle: number;
  source: string;
  zoom: number;
  imageX: number;
  imageY: number;
  rotation: number;
  opacity: number;
  overlay: number;
  text: string;
  textColor: string;
  font: "sans-serif" | "serif" | "monospace";
  fontSize: number;
  bold: boolean;
  textX: number;
  textY: number;
  shadow: boolean;
  borderColor: string;
  borderWidth: number;
  inset: number;
  radius: number;
}
export function defaultIcon(background: string, text: string): IconDesign {
  return {
    background,
    secondary: "#172e35",
    gradient: true,
    angle: 45,
    source: "",
    zoom: 1,
    imageX: 0,
    imageY: 0,
    rotation: 0,
    opacity: 100,
    overlay: 0,
    text: [...text][0]?.toUpperCase() || "T",
    textColor: "#ffffff",
    font: "sans-serif",
    fontSize: 125,
    bold: true,
    textX: 128,
    textY: 137,
    shadow: false,
    borderColor: "#ffffff",
    borderWidth: 2,
    inset: 24,
    radius: 0,
  };
}
export function bytesToImage(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
  });
}
function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode image"));
    image.src = source;
  });
}
/** Accept only bounded, local raster images; downscale originals before persisting. */
export async function importIconImage(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPG or WebP image under 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.width * image.height > 40_000_000)
      throw new Error("Image is too large (maximum 40 megapixels).");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function drawIcon(canvas: HTMLCanvasElement, d: IconDesign) {
  // Decode first: an old async render must never clear a newer preview.
  const image = d.source ? await loadImage(d.source) : null;
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const radians = (d.angle * Math.PI) / 180;
  const dx = Math.cos(radians) * 181,
    dy = Math.sin(radians) * 181;
  const gradient = ctx.createLinearGradient(
    128 - dx,
    128 - dy,
    128 + dx,
    128 + dy,
  );
  gradient.addColorStop(0, d.background);
  gradient.addColorStop(1, d.secondary);
  ctx.fillStyle = d.gradient ? gradient : d.background;
  ctx.fillRect(0, 0, 256, 256);
  if (image) {
    ctx.save();
    ctx.translate(128 + d.imageX, 128 + d.imageY);
    ctx.rotate((d.rotation * Math.PI) / 180);
    ctx.globalAlpha = d.opacity / 100;
    const scale = Math.max(256 / image.width, 256 / image.height) * d.zoom;
    ctx.drawImage(
      image,
      (-image.width * scale) / 2,
      (-image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
    ctx.restore();
  }
  ctx.fillStyle = `rgba(0,0,0,${d.overlay / 100})`;
  ctx.fillRect(0, 0, 256, 256);
  if (d.borderWidth) {
    ctx.strokeStyle = d.borderColor;
    ctx.lineWidth = d.borderWidth;
    ctx.beginPath();
    const inset = Math.max(d.inset, d.borderWidth / 2);
    ctx.roundRect(
      inset,
      inset,
      256 - inset * 2,
      256 - inset * 2,
      Math.min(d.radius, (256 - inset * 2) / 2),
    );
    ctx.stroke();
  }
  ctx.fillStyle = d.textColor;
  ctx.font = `${d.bold ? "bold " : ""}${d.fontSize}px ${d.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (d.shadow) {
    ctx.shadowColor = "#000000aa";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
  }
  ctx.fillText(d.text.slice(0, 24), d.textX, d.textY, 240);
}
export async function renderIcon(design: IconDesign): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  await drawIcon(canvas, design);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Unable to create PNG"))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
