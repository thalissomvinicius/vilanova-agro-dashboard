export const EXPORT_IMAGE_IGNORE_CLASS = 'export-image-ignore';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const MAX_EXPORT_PIXELS = 85_000_000;
const BLOCKED_EXPORT_SELECTORS = [
  `.${EXPORT_IMAGE_IGNORE_CLASS}`,
  '.leaflet-tile-pane',
  '.leaflet-tile',
  '.leaflet-control-attribution',
].join(',');

function shouldIncludeNode(node) {
  if (!(node instanceof Element)) return true;
  return !node.closest(BLOCKED_EXPORT_SELECTORS);
}

function sanitizeFilePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function createExportFileName(prefix, periodText) {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('');
  const period = sanitizeFilePart(periodText);
  return `${sanitizeFilePart(prefix)}${period ? `-${period}` : ''}-${stamp}.png`;
}

export async function downloadElementAsPng(element, options = {}) {
  if (!element) {
    throw new Error('Elemento para exportacao nao encontrado.');
  }

  await document.fonts?.ready?.catch(() => undefined);

  const { toPng } = await import('html-to-image');
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(element.scrollWidth, rect.width));
  const height = Math.ceil(Math.max(element.scrollHeight, rect.height));
  const requestedPixelRatio = Number(options.pixelRatio || 3);
  const maxSafePixelRatio = Math.sqrt(MAX_EXPORT_PIXELS / Math.max(1, width * height));
  const pixelRatio = Math.max(1, Math.min(requestedPixelRatio, maxSafePixelRatio));
  const previousCursor = document.body.style.cursor;

  document.body.style.cursor = 'wait';
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: options.backgroundColor || '#f3f6f4',
      cacheBust: true,
      height,
      imagePlaceholder: TRANSPARENT_PIXEL,
      pixelRatio,
      skipAutoScale: true,
      width,
      filter: shouldIncludeNode,
      style: {
        height: `${height}px`,
        width: `${width}px`,
      },
    });

    const link = document.createElement('a');
    link.download = options.filename || createExportFileName('dashboard', '');
    link.href = dataUrl;
    link.click();
  } finally {
    document.body.style.cursor = previousCursor;
  }
}
