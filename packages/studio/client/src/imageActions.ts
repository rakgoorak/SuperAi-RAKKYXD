/**
 * Copy or save an image shown in chat or in the image preview modal.
 * Converts any image format (PNG, JPEG, WebP, GIF, AVIF) to PNG when writing to the clipboard
 * so Chromium / Electron ClipboardItem always accepts it.
 */
export async function copyImageToClipboard(src: string): Promise<void> {
  const pngBlob = await toPngBlob(src);
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return;
  }
  throw new Error('Clipboard image write is not supported');
}

async function toPngBlob(src: string): Promise<Blob> {
  try {
    const response = await fetch(src, { cache: 'no-store' });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.type === 'image/png') return blob;
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const converted = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (converted) return converted;
    }
  } catch {
    // Fall back to loading via HTMLImageElement below.
  }
  return await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode PNG'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export function resolveImageFilename(src: string, fallbackName = 'image.png'): string {
  const cleanFallback = fallbackName.trim() || 'image.png';
  if (/\.(png|jpe?g|gif|webp|avif)$/i.test(cleanFallback)) {
    return cleanFallback.split(/[\\/]/).pop() || cleanFallback;
  }
  try {
    const url = new URL(src, window.location.origin);
    const pathParam = url.searchParams.get('path') || url.pathname;
    const base = decodeURIComponent(pathParam).split(/[\\/]/).pop() || '';
    const extMatch = base.match(/\.(png|jpe?g|gif|webp|avif)$/i);
    if (extMatch) {
      return `${cleanFallback.replace(/[\\/:*?"<>|]+/g, '-')}${extMatch[0].toLowerCase()}`;
    }
  } catch {}
  return `${cleanFallback.replace(/[\\/:*?"<>|]+/g, '-')}.png`;
}

export async function saveImageFromSrc(src: string, name = 'image.png'): Promise<void> {
  const filename = resolveImageFilename(src, name);
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  } catch {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
