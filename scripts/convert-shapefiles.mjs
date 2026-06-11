import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('..');
const SHAPE_DIR = path.join(ROOT, 'shapefiles');
const OUT_FILE = path.resolve('public/data/farm-parcels.geojson');

const FILES = [
  {
    file: 'PARCELAS FAZEND NOVA CONCEIÇÃO.shp',
    farmId: 'nova-conceicao',
    farmName: 'Nova Conceicao',
  },
  {
    file: 'PARCELAS FAZENDA FÉ EM DEUS.shp',
    farmId: 'fe-em-deus',
    farmName: 'Fe em Deus',
  },
  {
    file: 'PARCELAS VILA NOVA.shp',
    farmId: 'vila-nova',
    farmName: 'Vila Nova',
  },
];

function utm22sToLonLat(easting, northing) {
  const a = 6378137;
  const eccSquared = 0.00669438;
  const k0 = 0.9996;
  const zoneNumber = 22;
  const x = easting - 500000;
  const y = northing - 10000000;
  const longOrigin = (zoneNumber - 1) * 6 - 180 + 3;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const m = y / k0;
  const mu = m / (a * (1 - eccSquared / 4 - (3 * eccSquared ** 2) / 64 - (5 * eccSquared ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp = mu
    + j1 * Math.sin(2 * mu)
    + j2 * Math.sin(4 * mu)
    + j3 * Math.sin(6 * mu)
    + j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = eccPrimeSquared * cosFp ** 2;
  const t1 = tanFp ** 2;
  const n1 = a / Math.sqrt(1 - eccSquared * sinFp ** 2);
  const r1 = (a * (1 - eccSquared)) / ((1 - eccSquared * sinFp ** 2) ** 1.5);
  const d = x / (n1 * k0);
  const lat = fp - (n1 * tanFp / r1) * (
    (d ** 2) / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccPrimeSquared) * (d ** 4) / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccPrimeSquared - 3 * c1 ** 2) * (d ** 6) / 720
  );
  const lon = (d
    - (1 + 2 * t1 + c1) * (d ** 3) / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccPrimeSquared + 24 * t1 ** 2) * (d ** 5) / 120) / cosFp;

  return [
    Number((longOrigin + lon * 180 / Math.PI).toFixed(7)),
    Number((lat * 180 / Math.PI).toFixed(7)),
  ];
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum;
}

function readPolygonRecords(filePath, metadata) {
  const buffer = fs.readFileSync(filePath);
  const features = [];
  let offset = 100;
  let parcelIndex = 1;

  while (offset < buffer.length) {
    const recordNumber = buffer.readInt32BE(offset);
    const contentLengthBytes = buffer.readInt32BE(offset + 4) * 2;
    const contentOffset = offset + 8;
    const shapeType = buffer.readInt32LE(contentOffset);

    if (shapeType === 5) {
      const numParts = buffer.readInt32LE(contentOffset + 36);
      const numPoints = buffer.readInt32LE(contentOffset + 40);
      const partsOffset = contentOffset + 44;
      const pointsOffset = partsOffset + numParts * 4;
      const parts = Array.from({ length: numParts }, (_, index) => buffer.readInt32LE(partsOffset + index * 4));
      const points = Array.from({ length: numPoints }, (_, index) => {
        const pointOffset = pointsOffset + index * 16;
        return utm22sToLonLat(buffer.readDoubleLE(pointOffset), buffer.readDoubleLE(pointOffset + 8));
      });

      const rings = parts.map((start, index) => {
        const end = parts[index + 1] ?? points.length;
        const ring = points.slice(start, end);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);
        return ring;
      });

      const outerRings = rings.filter((ring) => ringArea(ring) < 0);
      const fallbackRings = outerRings.length ? outerRings : rings;
      const geometry = fallbackRings.length === 1
        ? { type: 'Polygon', coordinates: [fallbackRings[0]] }
        : { type: 'MultiPolygon', coordinates: fallbackRings.map((ring) => [ring]) };

      features.push({
        type: 'Feature',
        properties: {
          farmId: metadata.farmId,
          farmName: metadata.farmName,
          parcelId: `${metadata.farmId}-${parcelIndex}`,
          sourceFile: metadata.file,
          recordNumber,
        },
        geometry,
      });
      parcelIndex += 1;
    }

    offset = contentOffset + contentLengthBytes;
  }

  return features;
}

const features = FILES.flatMap((metadata) => readPolygonRecords(path.join(SHAPE_DIR, metadata.file), metadata));
const geojson = {
  type: 'FeatureCollection',
  name: 'farm-parcels',
  crs: {
    type: 'name',
    properties: { name: 'EPSG:4326' },
  },
  features,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(geojson)}\n`);
console.log(`Converted ${features.length} parcel polygons to ${OUT_FILE}`);
