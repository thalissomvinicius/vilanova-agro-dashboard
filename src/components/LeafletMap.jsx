import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowLeft, Layers, Map as MapIcon, Route, Satellite } from 'lucide-react';
import { FARMS } from '../utils/mockData';
import { filterRecords, useCqoData, aggregateRecords } from '../utils/cqoData';

function getScoreColor(score) {
  if (score >= 90) return '#22C55E';
  if (score >= 75) return '#F59E0B';
  return '#EF4444';
}

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const SENTINEL_TILE_URL = import.meta.env.VITE_SENTINEL_TILE_URL
  || 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg';

const SENTINEL_ATTRIBUTION = import.meta.env.VITE_SENTINEL_ATTRIBUTION
  || 'Sentinel-2 cloudless &copy; EOX IT Services GmbH, modified Copernicus Sentinel data 2025';

const BASE_LAYER_NOTES = {
  standard: 'Mapa leve para navegação e conferência geral.',
  satellite: 'Imagem mais nítida para enxergar estrada, talhão e detalhe visual.',
  sentinel: 'Imagem recente/agronômica Sentinel-2: gratuita, mas limitada a 10 m/pixel.',
};

const RISK_METRICS = [
  { id: 'nota', label: 'Nota CQO', unit: '%', goodWhen: 'high', meta: 90 },
  { id: 'perda_t_ha', label: 'Perda estimada t/ha', unit: 't/ha', goodWhen: 'low', meta: 0.08 },
  { id: 'cachos_ha', label: 'Cachos perdidos/ha', unit: 'cachos/ha', goodWhen: 'low', meta: 4 },
  { id: 'perda_corte', label: 'Perda corte %', unit: '%', goodWhen: 'low', meta: 1 },
  { id: 'nao_carreado', label: 'Não carreado %', unit: '%', goodWhen: 'low', meta: 0.4 },
  { id: 'mal_posicionado', label: 'Mal posicionado %', unit: '%', goodWhen: 'low', meta: 5 },
  { id: 'poda_planta_sem_podar', label: 'Planta sem podar %', unit: '%', goodWhen: 'low', meta: 1 },
  { id: 'poda_cacho_exposto', label: 'Cacho exposto %', unit: '%', goodWhen: 'low', meta: 2 },
  { id: 'poda_meia_coroa', label: 'Poda meia coroa %', unit: '%', goodWhen: 'low', meta: 2 },
  { id: 'poda_maior_1_1', label: 'Poda > 1:1 %', unit: '%', goodWhen: 'low', meta: 2 },
  { id: 'poda_bico_gaita', label: 'Bico de gaita %', unit: '%', goodWhen: 'low', meta: 2 },
  { id: 'poda_cacho_podre', label: 'Cacho podre %', unit: '%', goodWhen: 'low', meta: 1 },
  { id: 'poda_folha_mamando', label: 'Folha mamando %', unit: '%', goodWhen: 'low', meta: 2 },
  { id: 'poda_palha_mal_empilhada', label: 'Palha mal empilhada %', unit: '%', goodWhen: 'low', meta: 2 },
  { id: 'maduro', label: 'Cacho maduro %', unit: '%', goodWhen: 'high', meta: 85 },
  { id: 'verde', label: 'Cacho verde %', unit: '%', goodWhen: 'low', meta: 1 },
  { id: 'passado', label: 'Cacho passado %', unit: '%', goodWhen: 'low', meta: 10 },
  { id: 'avermelhado', label: 'Cacho avermelhado %', unit: '%', goodWhen: 'low', meta: 4 },
  { id: 'talo', label: 'Talo comprido %', unit: '%', goodWhen: 'low', meta: 3 },
];

const MAP_OPERATION_MODES = [
  {
    id: 'corte',
    label: 'Corte',
    areaFilter: 'corte',
    defaultMetric: 'perda_corte',
    metrics: ['nota', 'perda_corte', 'maduro', 'verde', 'passado', 'avermelhado', 'talo', 'mal_posicionado'],
  },
  {
    id: 'carreamento',
    label: 'Carreamento',
    areaFilter: 'carreamento',
    defaultMetric: 'nao_carreado',
    metrics: ['nota', 'nao_carreado', 'mal_posicionado'],
  },
  {
    id: 'poda',
    label: 'Poda',
    areaFilter: 'poda',
    defaultMetric: 'poda_planta_sem_podar',
    metrics: [
      'nota',
      'poda_planta_sem_podar',
      'poda_cacho_exposto',
      'poda_meia_coroa',
      'poda_maior_1_1',
      'poda_bico_gaita',
      'poda_cacho_podre',
      'poda_folha_mamando',
      'poda_palha_mal_empilhada',
    ],
  },
  {
    id: 'perdas',
    label: 'Perdas',
    areaFilter: 'all',
    defaultMetric: 'perda_t_ha',
    metrics: ['perda_t_ha', 'cachos_ha', 'perda_corte', 'nao_carreado'],
  },
];

const SUMMARY_OPERATION_MODES = [
  { id: 'all', label: 'Geral' },
  { id: 'corte', label: 'Corte' },
  { id: 'carreamento', label: 'Carreamento' },
  { id: 'poda', label: 'Poda' },
];

const RISK_COLORS = {
  good: '#22C55E',
  attention: '#F59E0B',
  critical: '#EF4444',
  neutral: '#CBD5E1',
};

const CORTE_METRIC_IDS = new Set(['perda_corte', 'maduro', 'verde', 'passado', 'avermelhado', 'talo']);
const CARREAMENTO_METRIC_IDS = new Set(['nao_carreado']);
const PODA_METRIC_IDS = new Set([
  'poda_planta_sem_podar',
  'poda_cacho_exposto',
  'poda_meia_coroa',
  'poda_maior_1_1',
  'poda_bico_gaita',
  'poda_cacho_podre',
  'poda_folha_mamando',
  'poda_palha_mal_empilhada',
]);

function activeRiskMetric(metricId) {
  return RISK_METRICS.find((metric) => metric.id === metricId)
    || RISK_METRICS.find((metric) => metric.id === 'perda_t_ha')
    || RISK_METRICS[0];
}

function activeOperationMode(operationId) {
  return MAP_OPERATION_MODES.find((mode) => mode.id === operationId)
    || MAP_OPERATION_MODES.find((mode) => mode.id === 'perdas')
    || MAP_OPERATION_MODES[0];
}

function activeSummaryOperation(summaryOperationId) {
  return SUMMARY_OPERATION_MODES.find((mode) => mode.id === summaryOperationId)
    || SUMMARY_OPERATION_MODES[0];
}

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const FARM_STYLES = {
  'vila-nova': {
    color: '#1F7A3A',
    fill: '#1F7A3A',
    label: 'Vila Nova',
  },
  'fe-em-deus': {
    color: '#D98C10',
    fill: '#D98C10',
    label: 'Fe em Deus',
  },
  'nova-conceicao': {
    color: '#2563EB',
    fill: '#2563EB',
    label: 'Nova Conceicao',
  },
  default: {
    color: '#7C3AED',
    fill: '#7C3AED',
    label: 'Sem fazenda',
  },
};

function farmStyle(farmId) {
  return FARM_STYLES[farmId] || FARM_STYLES.default;
}

function recordWeight(record) {
  const lines = Number(record?.totals?.linhas || record?.lines?.length || 1);
  const observed = Number(record?.totals?.plantasObservadas || 0);
  return Math.max(1, Math.min(10, lines + Math.floor(observed / 20)));
}

function reviewState(record) {
  const status = String(record?.status || '').toLowerCase();
  if (status.includes('aprov')) return 'approved';
  if (status.includes('reprov')) return 'rejected';
  return 'pending';
}

function markerColor(record, fallbackColor) {
  const state = reviewState(record);
  if (state === 'approved') return '#22C55E';
  if (state === 'rejected') return '#EF4444';
  return fallbackColor || '#F59E0B';
}

function isValidGpsPoint(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && Math.abs(lat) > 0.1
    && Math.abs(lng) > 0.1;
}

function normalizeLatLng(point) {
  if (!isValidGpsPoint(point)) return null;
  return {
    ...point,
    lat: Number(point.lat),
    lng: Number(point.lng),
  };
}

function firstValidGpsPoint(record) {
  return [
    record?.gps,
    ...(record?.gpsOccurrences || []),
    ...(record?.gpsTrack || []),
  ].map(normalizeLatLng).find(Boolean) || null;
}

function occurrenceTitle(point) {
  return point?.title
    || point?.titulo
    || point?.occurrence_meta?.titulo
    || point?.fieldId
    || point?.campo_id
    || 'Ocorrencia GPS';
}

function occurrenceField(point) {
  return point?.fieldId
    || point?.campo_id
    || point?.occurrence_meta?.campo_id
    || '';
}

function occurrenceLine(point) {
  return point?.line
    || point?.linha
    || point?.linha_index
    || point?.occurrence_meta?.linha
    || '--';
}

function occurrenceDisplayPoint(point) {
  if (!point?.duplicateTotal || point.duplicateTotal <= 1) return point;
  const angle = ((point.duplicateIndex || 0) / point.duplicateTotal) * Math.PI * 2;
  const offsetMeters = 1.8;
  const latOffset = (Math.cos(angle) * offsetMeters) / 111320;
  const lngOffset = (Math.sin(angle) * offsetMeters) / (111320 * Math.cos((point.lat * Math.PI) / 180));
  return {
    ...point,
    displayLat: point.lat + latOffset,
    displayLng: point.lng + lngOffset,
  };
}

function occurrenceHeatColor(point, fallbackColor) {
  const field = String(point?.fieldId || '').toLowerCase();
  if (field.includes('esquecido') || field.includes('nao_carreado') || field.includes('fruto_solto')) {
    return '#EF4444';
  }
  if (field.includes('verde') || field.includes('passado') || field.includes('avermelhado')) {
    return '#F59E0B';
  }
  if (field.includes('talo') || field.includes('folha') || field.includes('estrela') || field.includes('brocado') || field.includes('mal_posicionado')) {
    return '#D98C10';
  }
  return fallbackColor || '#F59E0B';
}

function occurrenceSeverity(point) {
  const field = String(point?.fieldId || '').toLowerCase();
  if (field.includes('esquecido') || field.includes('nao_carreado') || field.includes('fruto_solto')) return 3;
  if (field.includes('verde') || field.includes('passado') || field.includes('avermelhado')) return 2;
  return 1;
}

function riskStatusLabel(color) {
  if (color === RISK_COLORS.critical) return 'Crítico';
  if (color === RISK_COLORS.attention) return 'Atenção';
  if (color === RISK_COLORS.good) return 'Dentro da meta';
  return 'Sem avaliação';
}

function normalizeParcelCode(value) {
  const compact = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const parsed = compact.match(/^([a-z]*)(0*\d+)([a-z]*)$/);
  if (!parsed) return compact;

  return `${parsed[1]}${Number(parsed[2])}${parsed[3]}`;
}

function shapeParcelCode(props = {}) {
  let shapeParcel = props.ID_PARCELA || props.IDE || props.ide || props.parcela || props.parcelId || '';
  if (shapeParcel && props.farmId && String(shapeParcel).startsWith(`${props.farmId}-`)) {
    shapeParcel = String(shapeParcel).replace(`${props.farmId}-`, '');
  }
  return shapeParcel;
}

function parcelHeatKey(farmId, parcel) {
  return `${farmId || 'default'}|${normalizeParcelCode(parcel)}`;
}

function parcelRecordMatches(record, props, shapeParcel) {
  return reviewState(record) === 'approved'
    && normalizeParcelCode(record.parcel) === normalizeParcelCode(shapeParcel)
    && record.farmId === props.farmId;
}

function numericProp(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parcelAreaHa(props = {}) {
  return numericProp(
    props.HECTARE_PA
    || props.HECTARES
    || props.HECTARE
    || props.AREA_HA
    || props.areaHa
  );
}

function parcelPlants(props = {}) {
  return numericProp(
    props.N_PLANTA
    || props.TOTAL_PLANTAS
    || props.PLANTAS
    || props.plantas
  );
}

function parcelDensity(props = {}) {
  const density = numericProp(props.DENSIDADE || props.DENSITY || props.densidade);
  if (density) return density;
  const areaHa = parcelAreaHa(props);
  const plants = parcelPlants(props);
  return areaHa > 0 ? plants / areaHa : 0;
}

function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates || []];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates || [];
  return [];
}

function ringBounds(ring) {
  return ring.reduce((bounds, point) => ({
    minLng: Math.min(bounds.minLng, Number(point[0])),
    maxLng: Math.max(bounds.maxLng, Number(point[0])),
    minLat: Math.min(bounds.minLat, Number(point[1])),
    maxLat: Math.max(bounds.maxLat, Number(point[1])),
  }), {
    minLng: Infinity,
    maxLng: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
  });
}

function ringAreaAbs(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area += (Number(ring[index][0]) * Number(ring[index + 1][1]))
      - (Number(ring[index + 1][0]) * Number(ring[index][1]));
  }
  return Math.abs(area / 2);
}

function ringCentroid(ring) {
  let areaFactor = 0;
  let lngSum = 0;
  let latSum = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    const cross = (Number(current[0]) * Number(next[1])) - (Number(next[0]) * Number(current[1]));
    areaFactor += cross;
    lngSum += (Number(current[0]) + Number(next[0])) * cross;
    latSum += (Number(current[1]) + Number(next[1])) * cross;
  }

  if (!areaFactor) {
    const bounds = ringBounds(ring);
    return [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2];
  }

  return [lngSum / (3 * areaFactor), latSum / (3 * areaFactor)];
}

function pointInRing(point, ring) {
  const [lng, lat] = point;
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentLng = Number(ring[index][0]);
    const currentLat = Number(ring[index][1]);
    const previousLng = Number(ring[previous][0]);
    const previousLat = Number(ring[previous][1]);
    const intersects = ((currentLat > lat) !== (previousLat > lat))
      && (lng < ((previousLng - currentLng) * (lat - currentLat)) / ((previousLat - currentLat) || 1e-12) + currentLng);

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point, polygon) {
  const outerRing = polygon?.[0] || [];
  if (!pointInRing(point, outerRing)) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function pointSegmentDistanceSquared(point, start, end) {
  const x = Number(point[0]);
  const y = Number(point[1]);
  const x1 = Number(start[0]);
  const y1 = Number(start[1]);
  const x2 = Number(end[0]);
  const y2 = Number(end[1]);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLength = (dx * dx) + (dy * dy);
  const ratio = segmentLength ? Math.max(0, Math.min(1, (((x - x1) * dx) + ((y - y1) * dy)) / segmentLength)) : 0;
  const projectionX = x1 + ratio * dx;
  const projectionY = y1 + ratio * dy;

  return ((x - projectionX) ** 2) + ((y - projectionY) ** 2);
}

function pointDistanceToPolygonEdge(point, polygon) {
  return polygon.reduce((minDistance, ring) => {
    let ringMin = minDistance;
    for (let index = 0; index < ring.length - 1; index += 1) {
      ringMin = Math.min(ringMin, pointSegmentDistanceSquared(point, ring[index], ring[index + 1]));
    }
    return ringMin;
  }, Infinity);
}

function featureLabelLatLng(feature) {
  const polygons = geometryPolygons(feature?.geometry)
    .filter((polygon) => polygon?.[0]?.length >= 4)
    .sort((a, b) => ringAreaAbs(b[0]) - ringAreaAbs(a[0]));
  const polygon = polygons[0];
  if (!polygon) return null;

  const outerRing = polygon[0];
  const bounds = ringBounds(outerRing);
  const centroid = ringCentroid(outerRing);
  const candidates = [centroid];
  const gridSteps = 8;

  for (let xIndex = 1; xIndex < gridSteps; xIndex += 1) {
    for (let yIndex = 1; yIndex < gridSteps; yIndex += 1) {
      candidates.push([
        bounds.minLng + ((bounds.maxLng - bounds.minLng) * xIndex) / gridSteps,
        bounds.minLat + ((bounds.maxLat - bounds.minLat) * yIndex) / gridSteps,
      ]);
    }
  }

  const best = candidates
    .filter((point) => pointInPolygon(point, polygon))
    .map((point) => ({
      point,
      distance: pointDistanceToPolygonEdge(point, polygon),
    }))
    .sort((a, b) => b.distance - a.distance)[0]?.point;

  const labelPoint = best || centroid;
  return [labelPoint[1], labelPoint[0]];
}

function parcelLabelIcon(label, hasData) {
  return L.divIcon({
    className: `parcel-label-icon ${hasData ? '' : 'parcel-label-icon-muted'}`,
    html: `<span>${escapeHtml(label)}</span>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function perHa(value, areaHa) {
  const parsed = Number(value || 0);
  return areaHa > 0 ? parsed / areaHa : 0;
}

function percentOf(value, total) {
  const parsedValue = Number(value || 0);
  const parsedTotal = Number(total || 0);
  return parsedTotal > 0 ? (parsedValue / parsedTotal) * 100 : 0;
}

function hasCorteBunchBase(totals) {
  return Number(totals?.corte || 0) > 0 && Number(totals?.cachosObservados || 0) > 0;
}

function hasCortePlantBase(totals) {
  return Number(totals?.corte || 0) > 0 && Number(totals?.plantasObservadas || 0) > 0;
}

function hasCarreamentoBase(totals) {
  return Number(totals?.carreamento || 0) > 0 && Number(totals?.plantasObservadas || 0) > 0;
}

function hasPodaPlantBase(totals) {
  return Number(totals?.poda || 0) > 0 && Number(totals?.podaPlantasObservadas || totals?.plantasObservadas || 0) > 0;
}

function formatDecimal(value, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function operationLabel(operation) {
  return operation?.label || 'Geral';
}

function metricDisplay(metric, operation) {
  if (!metric) return metric;
  if (metric.id === 'nota') {
    return {
      ...metric,
      label: operation?.id && operation.id !== 'perdas'
        ? `Nota ${operationLabel(operation)}`
        : 'Nota CQO',
    };
  }
  if (metric.id === 'mal_posicionado') {
    return {
      ...metric,
      label: operation?.id === 'corte'
        ? 'Palha mal empilhada %'
        : 'Cacho mal posicionado %',
    };
  }
  return metric;
}

function recordsByType(records, type) {
  if (type === 'all') return records;
  return records.filter((record) => record.type === type);
}

function aggregateByType(records, type = 'all') {
  const scopedRecords = recordsByType(records, type);
  return scopedRecords.length ? aggregateRecords(scopedRecords) : null;
}

function metricRecordScope(metric, operation) {
  if (!metric) return 'all';
  if (metric.id === 'nota') {
    if (operation?.id === 'corte') return 'corte';
    if (operation?.id === 'carreamento') return 'carreamento';
    if (operation?.id === 'poda') return 'poda';
    return 'all';
  }
  if (CORTE_METRIC_IDS.has(metric.id)) return 'corte';
  if (CARREAMENTO_METRIC_IDS.has(metric.id)) return 'carreamento';
  if (PODA_METRIC_IDS.has(metric.id)) return 'poda';
  if (metric.id === 'mal_posicionado') {
    return operation?.id === 'carreamento' ? 'carreamento' : 'corte';
  }
  return 'all';
}

function aggregateForMetric(records, metric, operation) {
  return aggregateByType(records, metricRecordScope(metric, operation));
}

function operationScore({ totals, corteTotals, carreamentoTotals, podaTotals, operation }) {
  if (operation?.id === 'corte') {
    return corteTotals ? Number(corteTotals.corteScore || 0) : null;
  }
  if (operation?.id === 'carreamento') {
    return carreamentoTotals ? Number(carreamentoTotals.carreamentoScore || 0) : null;
  }
  if (operation?.id === 'poda') {
    return podaTotals ? Number(podaTotals.podaScore || 0) : null;
  }

  const scores = [];
  if (corteTotals) scores.push(Number(corteTotals.corteScore || 0));
  if (carreamentoTotals) scores.push(Number(carreamentoTotals.carreamentoScore || 0));
  if (podaTotals) scores.push(Number(podaTotals.podaScore || 0));
  if (scores.length) {
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }
  return totals ? Number(totals.generalScore || 0) : null;
}

function operationTotalsFor({ totals, corteTotals, carreamentoTotals, podaTotals, operation }) {
  if (operation?.id === 'corte') return corteTotals;
  if (operation?.id === 'carreamento') return carreamentoTotals;
  if (operation?.id === 'poda') return podaTotals;
  return totals;
}

function metricValue(metric, totals, areaHa, operation) {
  if (!totals) return null;

  switch (metric.id) {
    case 'nota':
      if (operation?.id === 'corte') return Number(totals.corteScore || 0);
      if (operation?.id === 'carreamento') return Number(totals.carreamentoScore || 0);
      if (operation?.id === 'poda') return Number(totals.podaScore || 0);
      return Number(totals.generalScore || 0);
    case 'perda_t_ha':
      if (!(areaHa > 0)) return null;
      return perHa(totals.lostFrutosTon || 0, areaHa);
    case 'cachos_ha':
      if (!(areaHa > 0)) return null;
      return perHa(totals.lostCachosQty || 0, areaHa);
    case 'perda_corte':
      if (!hasCorteBunchBase(totals)) return null;
      return Number(totals.perdaCorteRate || 0);
    case 'nao_carreado':
      if (!hasCarreamentoBase(totals)) return null;
      return Number(totals.cachoNaoCarreadoRate || 0);
    case 'mal_posicionado':
      if (operation?.id === 'corte') {
        if (!hasCortePlantBase(totals)) return null;
        return percentOf(totals.cachoMalPosicionado, totals.cortePlantasObservadas || totals.plantasObservadas);
      }
      if (!hasCarreamentoBase(totals)) return null;
      return Number(totals.cachoMalPosicionadoRate || 0);
    case 'poda_planta_sem_podar':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.plantaSemPodarRate || 0);
    case 'poda_cacho_exposto':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.cachoExpostoRate || 0);
    case 'poda_meia_coroa':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.podaMeiaCoroaRate || 0);
    case 'poda_maior_1_1':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.podaMaiorUmParaUmRate || 0);
    case 'poda_bico_gaita':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.bicoGaitaRate || 0);
    case 'poda_cacho_podre':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.cachoPodrePlantaRate || 0);
    case 'poda_folha_mamando':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.folhaMamandoPodaRate || 0);
    case 'poda_palha_mal_empilhada':
      if (!hasPodaPlantBase(totals)) return null;
      return Number(totals.palhaMalEmpilhadaRate || 0);
    case 'maduro':
      if (!hasCorteBunchBase(totals)) return null;
      return percentOf(totals.cachoMaduro, totals.cachosObservados);
    case 'verde':
      if (!hasCorteBunchBase(totals)) return null;
      return Number(totals.cachoVerdeRate || 0);
    case 'passado':
      if (!hasCorteBunchBase(totals)) return null;
      return Number(totals.cachoPassadoRate || 0);
    case 'avermelhado':
      if (!hasCorteBunchBase(totals)) return null;
      return percentOf(totals.cachoAvermelhado, totals.cachosObservados);
    case 'talo':
      if (!hasCortePlantBase(totals)) return null;
      return Number(totals.taloCompridoRate || 0);
    default:
      return 0;
  }
}

function metricColor(metric, value, hasData) {
  if (!hasData || value === null || value === undefined || !Number.isFinite(Number(value))) {
    return RISK_COLORS.neutral;
  }

  const numeric = Number(value);
  if (metric.goodWhen === 'high') {
    if (numeric >= metric.meta) return RISK_COLORS.good;
    if (numeric >= metric.meta * 0.88) return RISK_COLORS.attention;
    return RISK_COLORS.critical;
  }

  if (numeric <= metric.meta) return RISK_COLORS.good;
  if (numeric <= metric.meta * 2.2) return RISK_COLORS.attention;
  return RISK_COLORS.critical;
}

function metricRiskScore(metric, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return -Infinity;
  const numeric = Number(value);
  return metric.goodWhen === 'high' ? metric.meta - numeric : numeric - metric.meta;
}

function hasMetricValue(summary) {
  return summary?.value !== null
    && summary?.value !== undefined
    && Number.isFinite(Number(summary.value));
}

function formatMetricValue(metric, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N/D';
  if (metric.unit === 't/ha') return `${formatDecimal(value, 3)} t/ha`;
  if (metric.unit === 'cachos/ha') return `${formatDecimal(value, 1)} cachos/ha`;
  if (metric.unit === '%') return `${formatDecimal(value, metric.id === 'nota' ? 0 : 1)}%`;
  return formatDecimal(value, 1);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dateOrderValue(value) {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Number(`${iso[1]}${iso[2]}${iso[3]}`);

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return Number(`${br[3]}${br[2].padStart(2, '0')}${br[1].padStart(2, '0')}`);

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

function sortDateTexts(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => dateOrderValue(a) - dateOrderValue(b));
}

function buildParcelSummary({ feature, records, heatSummary, metric, operation }) {
  const props = feature?.properties || {};
  const shapeParcel = shapeParcelCode(props);
  const parcelRecords = shapeParcel
    ? records.filter((record) => parcelRecordMatches(record, props, shapeParcel))
    : [];
  const totals = parcelRecords.length ? aggregateRecords(parcelRecords) : null;
  const metricTotals = aggregateForMetric(parcelRecords, metric, operation);
  const areaHa = parcelAreaHa(props);
  const value = metricValue(metric, metricTotals, areaHa, operation);
  const color = metricColor(metric, value, Boolean(metricTotals));
  const excelCount = parcelRecords.filter((record) => record.source === 'excel').length;
  const appCount = parcelRecords.filter((record) => record.source === 'app').length;
  const firstDate = parcelRecords.map((record) => record.date).filter(Boolean).sort()[0] || '';
  const lastDate = parcelRecords.map((record) => record.date).filter(Boolean).sort().slice(-1)[0] || '';

  return {
    key: parcelHeatKey(props.farmId, shapeParcel),
    feature,
    props,
    shapeParcel,
    records: parcelRecords,
    totals,
    metricTotals,
    areaHa,
    heatSummary,
    metric,
    value,
    color,
    status: riskStatusLabel(color),
    riskScore: metricRiskScore(metric, value),
    excelCount,
    appCount,
    firstDate,
    lastDate,
  };
}

function featureBounds(feature) {
  if (!feature) return null;
  try {
    const bounds = L.geoJSON(feature).getBounds();
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

function fitMapToBounds(map, bounds, {
  pad = 0.16,
  maxZoom = 16,
  minZoom = 0,
  animate = false,
} = {}) {
  if (!map || !bounds?.isValid?.()) return false;
  map.invalidateSize({ pan: false, debounceMoveend: false });
  map.fitBounds(bounds.pad(pad), { maxZoom, animate, padding: [18, 18] });
  if (minZoom && map.getZoom() < minZoom) {
    map.setZoom(minZoom, { animate });
  }
  return true;
}

function collectionDateSummary(records) {
  const dateValues = sortDateTexts(records.map((record) => record.date));
  const firstDate = dateValues[0] || 'Sem data';
  const lastDate = dateValues[dateValues.length - 1] || 'Sem data';

  return {
    firstDate,
    lastDate,
    latestDate: lastDate,
    label: dateValues.length && firstDate !== lastDate ? `${firstDate} a ${lastDate}` : firstDate,
  };
}

function compactPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N/D';
  return `${formatDecimal(value, digits)}%`;
}

function compactMetaText(metric) {
  const signal = metric.goodWhen === 'high' ? '>=' : '<=';
  return `Meta ${signal} ${formatMetricValue(metric, metric.meta)}`;
}

function compactOccurrenceDetail(count, projected = null) {
  const countText = `${formatInteger(count || 0)} ocorr.`;
  if (projected === null || projected === undefined) return countText;
  return `${countText} · ${formatInteger(projected || 0)} proj.`;
}

function compactMetricBox(label, value, detail = '', color = '#182230') {
  return `
    <div class="parcel-compact-metric">
      <span>${escapeHtml(label)}</span>
      <strong style="color:${color};">${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
    </div>
  `;
}

function compactQualityBubble({
  label,
  value,
  count,
  total,
  color,
  detail = '',
  meta = '',
  valueDisplay = '',
  ringValue,
}) {
  const numeric = Number(ringValue ?? value);
  const hasValue = Number.isFinite(numeric);
  const percent = hasValue ? Math.max(0, Math.min(100, numeric)) : 0;
  const safeDetail = detail || `${formatInteger(count || 0)} / ${formatInteger(total || 0)}`;

  return `
    <div class="parcel-quality-bubble" style="--bubble-color:${color}; --bubble-pct:${percent}%;">
      <div>
        <strong>${escapeHtml(valueDisplay || (hasValue ? compactPercent(Number(value), 1) : 'N/D'))}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
      <small>${escapeHtml(safeDetail)}</small>
      ${meta ? `<small class="parcel-quality-bubble-meta">${escapeHtml(meta)}</small>` : ''}
    </div>
  `;
}

function compactOperationBubbleCard({ title, subtitle, bubbles, emptyText, className = '', footer = '' }) {
  if (!bubbles?.length) {
    return `
      <section class="parcel-operation-bubble-card ${escapeHtml(className)}">
        <div class="parcel-operation-bubble-head">
          <strong>${escapeHtml(title)}</strong>
          <span>Sem base</span>
        </div>
        <div class="parcel-popup-empty">${escapeHtml(emptyText)}</div>
      </section>
    `;
  }

  return `
    <section class="parcel-operation-bubble-card ${escapeHtml(className)}">
      <div class="parcel-operation-bubble-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="parcel-operation-bubble-grid">
        ${bubbles.map(compactQualityBubble).join('')}
      </div>
      ${footer ? `<div class="parcel-operation-bubble-note">${escapeHtml(footer)}</div>` : ''}
    </section>
  `;
}

function firstReadableText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== '--' && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined') return text;
  }
  return '';
}

function recordFiscalEquipeLabel(record) {
  const raw = record?.raw || {};
  return firstReadableText(
    record?.fiscal,
    raw.fiscal_resp_equipe,
    raw.fiscal_responsavel_equipe,
    raw.fiscalResponsavelEquipe,
    raw.FiscalRespEquipe,
    raw['Fiscal Resp Equipe'],
    raw['Fiscal Responsavel Equipe'],
    raw.FiscalResponsavelEquipe,
    raw.fiscal_resp,
    raw.FiscalResp,
    raw['Fiscal Resp'],
    raw.Fiscal
  );
}

function recordEvaluatorLabel(record) {
  const raw = record?.raw || {};
  const evaluator = firstReadableText(
    record?.evaluator,
    raw.nome_avaliador,
    raw.avaliador,
    raw.Avaliador,
    raw.NomeAvaliador
  );
  const matricula = firstReadableText(
    record?.evaluatorMatricula,
    raw.matricula_avaliador,
    raw.matricula_digitador,
    raw.MatriculaAvaliadores,
    raw.MatriculaDigitador
  );

  if (evaluator && matricula && !evaluator.includes(matricula)) return `${evaluator} · Mat. ${matricula}`;
  return evaluator || (matricula ? `Mat. ${matricula}` : 'Sem avaliador');
}

function recordCollectionDateLabel(record) {
  const date = firstReadableText(record?.date);
  const time = firstReadableText(record?.time);
  if (date && time && time !== '--') return `${date} ${time}`;
  return date || firstReadableText(record?.sentAt, record?.receivedAt, record?.createdAt) || 'Sem data';
}

function recordOperationDataSummary(record) {
  const totals = record?.totals || {};
  if (record?.type === 'poda') {
    return [
      `${formatInteger(totals.linhas || 0)} linhas`,
      `${formatInteger(totals.plantasObservadas || totals.plantasLinha || 0)} plantas`,
      `Sem podar ${formatInteger(totals.plantaSemPodar || 0)}`,
      `Cacho exp. ${formatInteger(totals.cachoExposto || 0)}`,
    ].join(' · ');
  }

  if (record?.type === 'carreamento') {
    return [
      `${formatInteger(totals.linhas || 0)} linhas`,
      `${formatInteger(totals.plantasObservadas || totals.plantasLinha || 0)} plantas`,
      `Não carr. ${formatInteger(totals.cachoNaoCarreado || 0)}`,
      `Mal pos. ${formatInteger(totals.cachoMalPosicionado || 0)}`,
    ].join(' · ');
  }

  return [
    `${formatInteger(totals.linhas || 0)} linhas`,
    `${formatInteger(totals.cachosObservados || 0)} cachos`,
    `Perda ${formatInteger(totals.cachoEsquecido || 0)}`,
    `Maduro ${formatInteger(totals.cachoMaduro || 0)}`,
  ].join(' · ');
}

function recordStatusClass(status) {
  const text = String(status || '').toLowerCase();
  if (text.includes('aprov') || text.includes('sincron')) return 'is-success';
  if (text.includes('reprov') || text.includes('falha') || text.includes('erro')) return 'is-danger';
  return 'is-warning';
}

function parcelCollectionHistoryHtml({ parcelRecords, summaryOperation = 'all' }) {
  const summaryMode = activeSummaryOperation(summaryOperation);
  const operationRecords = recordsByType(parcelRecords, summaryMode.id === 'all' ? 'all' : summaryMode.id);
  const sortedRecords = [...operationRecords].sort((a, b) => (
    dateOrderValue(recordCollectionDateLabel(b)) - dateOrderValue(recordCollectionDateLabel(a))
  ));
  const visibleRecords = sortedRecords.slice(0, 8);
  const hiddenCount = Math.max(sortedRecords.length - visibleRecords.length, 0);
  const title = summaryMode.id === 'all' ? 'Coletas da parcela' : `Coletas de ${operationLabel(summaryMode)}`;

  return `
    <section class="parcel-collection-card">
      <div class="parcel-collection-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${formatInteger(sortedRecords.length)} registro(s)</span>
      </div>
      ${visibleRecords.length ? `
        <div class="parcel-collection-list">
          ${visibleRecords.map((record) => {
            const fiscal = recordFiscalEquipeLabel(record);
            const evaluator = recordEvaluatorLabel(record);
            return `
              <article class="parcel-collection-row">
                <div class="parcel-collection-row-top">
                  <strong>${escapeHtml(recordCollectionDateLabel(record))}</strong>
                  <em class="${recordStatusClass(record.status)}">${escapeHtml(record.status || 'Pendente')}</em>
                </div>
                <div class="parcel-collection-row-meta">
                  <span>${escapeHtml(record.form || operationLabel(activeOperationMode(record.type || 'perdas')))}</span>
                  <span>${escapeHtml(record.sourceLabel || record.source || 'Fonte N/D')}</span>
                </div>
                <div class="parcel-collection-responsibles">
                  <span><b>Fiscal equipe:</b> ${escapeHtml(fiscal || 'Não informado neste registro')}</span>
                  <span><b>Avaliador:</b> ${escapeHtml(evaluator)}</span>
                </div>
                <small>${escapeHtml(recordOperationDataSummary(record))}</small>
              </article>
            `;
          }).join('')}
        </div>
        ${hiddenCount ? `<div class="parcel-collection-more">+ ${formatInteger(hiddenCount)} coleta(s) neste filtro</div>` : ''}
      ` : `<div class="parcel-popup-empty">Sem coleta desta operação para a parcela no filtro atual.</div>`}
    </section>
  `;
}

function compactParcelSummaryHtml({
  totals,
  corteTotals,
  carreamentoTotals,
  podaTotals,
  parcelRecords,
  areaHa,
  densityShape,
  collectionDates,
  summaryOperation = 'all',
}) {
  const summaryMode = activeSummaryOperation(summaryOperation);
  const summaryRecords = recordsByType(parcelRecords, summaryMode.id === 'all' ? 'all' : summaryMode.id);
  const summaryTotals = operationTotalsFor({
    totals,
    corteTotals,
    carreamentoTotals,
    podaTotals,
    operation: summaryMode.id === 'all' ? activeOperationMode('perdas') : summaryMode,
  }) || totals;
  const corteScore = corteTotals ? Number(corteTotals.corteScore || 0) : null;
  const carreamentoScore = carreamentoTotals ? Number(carreamentoTotals.carreamentoScore || 0) : null;
  const podaScore = podaTotals ? Number(podaTotals.podaScore || 0) : null;
  const summaryScore = operationScore({
    totals,
    corteTotals,
    carreamentoTotals,
    podaTotals,
    operation: summaryMode.id === 'all' ? activeOperationMode('perdas') : summaryMode,
  });
  const summaryScoreDetail = summaryMode.id === 'all' ? 'Corte + carreamento + poda' : summaryMode.label;
  const qualityTotal = Number(corteTotals?.cachosObservados || 0);
  const palhaRate = corteTotals?.cortePlantasObservadas
    ? percentOf(corteTotals.cachoMalPosicionado, corteTotals.cortePlantasObservadas)
    : null;
  const notaMetric = activeRiskMetric('nota');
  const maduroMetric = activeRiskMetric('maduro');
  const passadoMetric = activeRiskMetric('passado');
  const verdeMetric = activeRiskMetric('verde');
  const avermelhadoMetric = activeRiskMetric('avermelhado');
  const perdaCorteMetric = activeRiskMetric('perda_corte');
  const taloMetric = activeRiskMetric('talo');
  const palhaMetric = activeRiskMetric('mal_posicionado');
  const naoCarreadoMetric = activeRiskMetric('nao_carreado');
  const malPosicionadoMetric = activeRiskMetric('mal_posicionado');
  const plantaSemPodarMetric = activeRiskMetric('poda_planta_sem_podar');
  const cachoExpostoMetric = activeRiskMetric('poda_cacho_exposto');
  const podaMeiaCoroaMetric = activeRiskMetric('poda_meia_coroa');
  const podaMaiorMetric = activeRiskMetric('poda_maior_1_1');
  const bicoGaitaMetric = activeRiskMetric('poda_bico_gaita');
  const cachoPodreMetric = activeRiskMetric('poda_cacho_podre');
  const folhaMamandoPodaMetric = activeRiskMetric('poda_folha_mamando');
  const palhaPodaMetric = activeRiskMetric('poda_palha_mal_empilhada');

  const corteBubbles = corteTotals ? [
    {
      label: 'Nota',
      value: corteScore,
      valueDisplay: corteScore !== null ? `${formatDecimal(corteScore, 0)}%` : 'N/D',
      detail: `${formatInteger(corteTotals.total || 0)} coleta(s)`,
      meta: compactMetaText(notaMetric),
      color: corteScore !== null ? getScoreColor(corteScore) : '#64748B',
    },
    {
      label: 'Maduro',
      value: percentOf(corteTotals.cachoMaduro, qualityTotal),
      count: corteTotals.cachoMaduro,
      total: qualityTotal,
      meta: compactMetaText(maduroMetric),
      color: metricColor(maduroMetric, percentOf(corteTotals.cachoMaduro, qualityTotal), Boolean(qualityTotal)),
    },
    {
      label: 'Passado',
      value: percentOf(corteTotals.cachoPassado, qualityTotal),
      count: corteTotals.cachoPassado,
      total: qualityTotal,
      meta: compactMetaText(passadoMetric),
      color: metricColor(passadoMetric, percentOf(corteTotals.cachoPassado, qualityTotal), Boolean(qualityTotal)),
    },
    {
      label: 'Verde',
      value: percentOf(corteTotals.cachoVerde, qualityTotal),
      count: corteTotals.cachoVerde,
      total: qualityTotal,
      meta: compactMetaText(verdeMetric),
      color: metricColor(verdeMetric, percentOf(corteTotals.cachoVerde, qualityTotal), Boolean(qualityTotal)),
    },
    {
      label: 'Averm.',
      value: percentOf(corteTotals.cachoAvermelhado, qualityTotal),
      count: corteTotals.cachoAvermelhado,
      total: qualityTotal,
      meta: compactMetaText(avermelhadoMetric),
      color: metricColor(avermelhadoMetric, percentOf(corteTotals.cachoAvermelhado, qualityTotal), Boolean(qualityTotal)),
    },
    {
      label: 'Perda',
      value: Number(corteTotals.perdaCorteRate || 0),
      detail: `${formatInteger(corteTotals.cachoEsquecido || 0)} esquecido(s)`,
      meta: compactMetaText(perdaCorteMetric),
      color: metricColor(perdaCorteMetric, Number(corteTotals.perdaCorteRate || 0), true),
    },
    {
      label: 'Talo',
      value: Number(corteTotals.taloCompridoRate || 0),
      detail: `${formatInteger(corteTotals.taloComprido || 0)} ocorrência(s)`,
      meta: compactMetaText(taloMetric),
      color: metricColor(taloMetric, Number(corteTotals.taloCompridoRate || 0), true),
    },
    {
      label: 'Palha M.E.',
      value: palhaRate,
      valueDisplay: palhaRate === null ? 'N/D' : compactPercent(palhaRate, 1),
      ringValue: palhaRate,
      detail: `${formatInteger(corteTotals.cachoMalPosicionado || 0)} ocorrência(s)`,
      meta: compactMetaText(palhaMetric),
      color: metricColor(palhaMetric, palhaRate, palhaRate !== null),
    },
  ] : [];

  const carreamentoBubbles = carreamentoTotals ? [
    {
      label: 'Nota',
      value: carreamentoScore,
      valueDisplay: carreamentoScore !== null ? `${formatDecimal(carreamentoScore, 0)}%` : 'N/D',
      detail: `${formatInteger(carreamentoTotals.total || 0)} coleta(s)`,
      meta: compactMetaText(notaMetric),
      color: carreamentoScore !== null ? getScoreColor(carreamentoScore) : '#64748B',
    },
    {
      label: 'Não carr.',
      value: Number(carreamentoTotals.cachoNaoCarreadoRate || 0),
      detail: `${formatInteger(carreamentoTotals.cachoNaoCarreado || 0)} cacho(s)`,
      meta: compactMetaText(naoCarreadoMetric),
      color: metricColor(naoCarreadoMetric, Number(carreamentoTotals.cachoNaoCarreadoRate || 0), true),
    },
    {
      label: 'Mal pos.',
      value: Number(carreamentoTotals.cachoMalPosicionadoRate || 0),
      detail: `${formatInteger(carreamentoTotals.cachoMalPosicionado || 0)} cacho(s)`,
      meta: compactMetaText(malPosicionadoMetric),
      color: metricColor(malPosicionadoMetric, Number(carreamentoTotals.cachoMalPosicionadoRate || 0), true),
    },
  ] : [];

  const podaBubbles = podaTotals ? [
    {
      label: 'Nota',
      value: podaScore,
      valueDisplay: podaScore !== null ? `${formatDecimal(podaScore, 0)}%` : 'N/D',
      detail: `${formatInteger(podaTotals.total || 0)} coleta(s)`,
      meta: compactMetaText(notaMetric),
      color: podaScore !== null ? getScoreColor(podaScore) : '#64748B',
    },
    {
      label: 'Sem podar',
      value: Number(podaTotals.plantaSemPodarRate || 0),
      detail: compactOccurrenceDetail(podaTotals.plantaSemPodar, podaTotals.plantaSemPodarProjetada),
      meta: compactMetaText(plantaSemPodarMetric),
      color: metricColor(plantaSemPodarMetric, Number(podaTotals.plantaSemPodarRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'Cacho exp.',
      value: Number(podaTotals.cachoExpostoRate || 0),
      detail: compactOccurrenceDetail(podaTotals.cachoExposto, podaTotals.cachoExpostoProjetado),
      meta: compactMetaText(cachoExpostoMetric),
      color: metricColor(cachoExpostoMetric, Number(podaTotals.cachoExpostoRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'Meia coroa',
      value: Number(podaTotals.podaMeiaCoroaRate || 0),
      detail: compactOccurrenceDetail(podaTotals.podaMeiaCoroa, podaTotals.podaMeiaCoroaProjetada),
      meta: compactMetaText(podaMeiaCoroaMetric),
      color: metricColor(podaMeiaCoroaMetric, Number(podaTotals.podaMeiaCoroaRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'Poda >1:1',
      value: Number(podaTotals.podaMaiorUmParaUmRate || 0),
      detail: compactOccurrenceDetail(podaTotals.podaMaiorUmParaUm, podaTotals.podaMaiorUmParaUmProjetada),
      meta: compactMetaText(podaMaiorMetric),
      color: metricColor(podaMaiorMetric, Number(podaTotals.podaMaiorUmParaUmRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'Bico gaita',
      value: Number(podaTotals.bicoGaitaRate || 0),
      detail: compactOccurrenceDetail(podaTotals.bicoGaita, podaTotals.bicoGaitaProjetado),
      meta: compactMetaText(bicoGaitaMetric),
      color: metricColor(bicoGaitaMetric, Number(podaTotals.bicoGaitaRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'C. podre',
      value: Number(podaTotals.cachoPodrePlantaRate || 0),
      detail: compactOccurrenceDetail(podaTotals.cachoPodrePlanta, podaTotals.cachoPodrePlantaProjetado),
      meta: compactMetaText(cachoPodreMetric),
      color: metricColor(cachoPodreMetric, Number(podaTotals.cachoPodrePlantaRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'Folha mam.',
      value: Number(podaTotals.folhaMamandoPodaRate || 0),
      detail: compactOccurrenceDetail(podaTotals.folhaMamando, podaTotals.folhaMamandoProjetada),
      meta: compactMetaText(folhaMamandoPodaMetric),
      color: metricColor(folhaMamandoPodaMetric, Number(podaTotals.folhaMamandoPodaRate || 0), hasPodaPlantBase(podaTotals)),
    },
    {
      label: 'Palha M.E.',
      value: Number(podaTotals.palhaMalEmpilhadaRate || 0),
      detail: compactOccurrenceDetail(podaTotals.palhaMalEmpilhada, podaTotals.palhaMalEmpilhadaProjetada),
      meta: compactMetaText(palhaPodaMetric),
      color: metricColor(palhaPodaMetric, Number(podaTotals.palhaMalEmpilhadaRate || 0), hasPodaPlantBase(podaTotals)),
    },
  ] : [];

  const operationCards = [
    {
      id: 'corte',
      html: compactOperationBubbleCard({
        title: 'Corte',
        subtitle: `${formatInteger(corteTotals?.total || 0)} coleta(s) · ${formatInteger(corteTotals?.cachosObservados || 0)} cachos · ${formatInteger(corteTotals?.plantasObservadas || 0)} plantas`,
        bubbles: corteBubbles,
        emptyText: 'Sem coleta de corte nesta parcela no filtro atual.',
        className: 'parcel-operation-bubble-card-corte',
      }),
    },
    {
      id: 'carreamento',
      html: compactOperationBubbleCard({
        title: 'Carreamento',
        subtitle: `${formatInteger(carreamentoTotals?.total || 0)} coleta(s) · ${formatInteger(carreamentoTotals?.plantasObservadas || 0)} plantas`,
        bubbles: carreamentoBubbles,
        emptyText: 'Sem coleta de carreamento nesta parcela no filtro atual.',
        className: 'parcel-operation-bubble-card-carreamento',
        footer: carreamentoTotals ? `Peso médio: ${formatDecimal(carreamentoTotals.mediaPesoFrutos || 0, 1)} kg · ${formatInteger(carreamentoTotals.plantasObservadas || 0)} planta(s) avaliadas` : '',
      }),
    },
    {
      id: 'poda',
      html: compactOperationBubbleCard({
        title: 'Poda',
        subtitle: `${formatInteger(podaTotals?.total || 0)} coleta(s) · ${formatInteger(podaTotals?.plantasObservadas || 0)} plantas · ${formatInteger(podaTotals?.plantasProjetadas || 0)} projetadas`,
        bubbles: podaBubbles,
        emptyText: 'Sem coleta de poda nesta parcela no filtro atual.',
        className: 'parcel-operation-bubble-card-poda',
        footer: podaTotals ? `Ocorrências projetadas: ${formatInteger(podaTotals.ocorrenciasPodaProjetadas || 0)} · GPS: ${formatDecimal(podaTotals.gpsRate || 0, 0)}%` : '',
      }),
    },
  ];
  const visibleOperationCards = operationCards
    .filter((card) => summaryMode.id === 'all' || card.id === summaryMode.id)
    .map((card) => card.html)
    .join('');

  return `
    <div class="parcel-popup-summary-grid">
      ${compactMetricBox(summaryMode.id === 'all' ? 'Nota geral' : `Nota ${summaryMode.label}`, summaryScore !== null && summaryScore !== undefined ? `${formatDecimal(summaryScore, 0)}%` : 'N/D', summaryScoreDetail, summaryScore !== null && summaryScore !== undefined ? getScoreColor(summaryScore) : '#64748B')}
      ${compactMetricBox('Área', areaHa ? `${formatDecimal(areaHa, 2)} ha` : 'N/D', densityShape ? `${formatDecimal(densityShape, 0)} pl/ha` : 'densidade N/D')}
      ${compactMetricBox('Coletas', `${formatInteger(summaryRecords.length || parcelRecords.length)}`, `${formatInteger(summaryTotals?.linhas || 0)} linha(s) avaliadas`)}
    </div>

    <div class="parcel-operation-bubble-stack">
      ${visibleOperationCards}
    </div>

    ${parcelCollectionHistoryHtml({ parcelRecords, summaryOperation: summaryMode.id })}

    <div class="parcel-compact-footer">
      <span>Primeira coleta: <b>${escapeHtml(collectionDates.firstDate)}</b></span>
      <span>Última coleta: <b>${escapeHtml(collectionDates.lastDate)}</b></span>
    </div>
  `;
}

function compactSummaryShellHtml({
  title,
  subtitle,
  badge = 'Resumo',
  accent = '#174D2B',
  datesLabel,
  statusText,
  summaryHtml,
  contextText = '',
  extraClass = '',
}) {
  return `
    <div class="parcel-popup-card parcel-popup-compact-card ${escapeHtml(extraClass)}" style="--parcel-accent:${accent};">
      <div class="parcel-popup-head">
        <div class="parcel-popup-title-row">
          <div>
            <strong>${escapeHtml(title || 'Fazenda')}</strong>
            <span>${escapeHtml(subtitle || 'Resumo de qualidade')}</span>
          </div>
          <em>${escapeHtml(badge)}</em>
        </div>
        <div class="parcel-popup-head-meta">
          <span>Coletas: <b>${escapeHtml(datesLabel || 'Sem data')}</b></span>
          <span>${escapeHtml(statusText || 'Sem coleta aprovada')}</span>
        </div>
      </div>
      <div class="parcel-popup-scroll parcel-popup-compact-scroll">
        ${summaryHtml}
        ${contextText ? `<div class="parcel-compact-context">${escapeHtml(contextText)}</div>` : ''}
      </div>
    </div>
  `;
}

function parcelNumbersPopup({ props, shapeParcel, style, parcelRecords, metric: _metric, operation, summaryOperation }) {
  const totals = parcelRecords.length ? aggregateRecords(parcelRecords) : null;
  const corteTotals = aggregateByType(parcelRecords, 'corte');
  const carreamentoTotals = aggregateByType(parcelRecords, 'carreamento');
  const podaTotals = aggregateByType(parcelRecords, 'poda');
  const summaryMode = activeSummaryOperation(summaryOperation || (operation?.id === 'perdas' ? 'all' : operation?.id));
  const operationRecords = recordsByType(parcelRecords, summaryMode.id === 'all' ? 'all' : summaryMode.id);
  const areaHa = parcelAreaHa(props);
  const densityShape = parcelDensity(props);
  const operationTotals = operationTotalsFor({
    totals,
    corteTotals,
    carreamentoTotals,
    podaTotals,
    operation: summaryMode.id === 'all' ? activeOperationMode('perdas') : summaryMode,
  });
  const allDates = collectionDateSummary(parcelRecords);
  const operationDates = collectionDateSummary(operationRecords);
  const statusText = totals
    ? `${formatInteger(totals.aprovados)} aprov. / ${formatInteger(totals.reprovados)} reprov.`
    : 'Sem coleta aprovada';
  const summaryHtml = compactParcelSummaryHtml({
    totals,
    corteTotals,
    carreamentoTotals,
    podaTotals,
    parcelRecords,
    areaHa,
    densityShape,
    collectionDates: allDates,
    summaryOperation: summaryMode.id,
  });

  return compactSummaryShellHtml({
    title: props.farmName || 'Fazenda',
    subtitle: `Parcela ${shapeParcel || '--'} · Fonte shapefile`,
    badge: 'Resumo',
    accent: style.color,
    datesLabel: allDates.label,
    statusText: `${formatInteger(parcelRecords.length)} coleta(s) · ${statusText}`,
    summaryHtml,
    contextText: operationTotals ? `Quadro ativo: ${operationLabel(summaryMode)} · ${operationDates.label}` : '',
  });
}

export default function LeafletMap({
  theme,
  farmFilter,
  areaFilter,
  periodFilter,
  cycleFilter,
  evaluatorFilter = 'all',
  sourceFilter = 'all',
  dateFrom,
  dateTo,
  presentationMode = false,
  initialOperation = 'perdas',
  initialMetricId = '',
  onParcelSelect,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const initialMode = MAP_OPERATION_MODES.find((mode) => mode.id === initialOperation) || MAP_OPERATION_MODES.find((mode) => mode.id === 'perdas');
  const initialMetric = initialMetricId && initialMode.metrics.includes(initialMetricId)
    ? initialMetricId
    : initialMode.defaultMetric;
  const [mapLayer, setMapLayer] = useState('polygon');
  const [baseLayer, setBaseLayer] = useState('standard');
  const [mapOperation, setMapOperation] = useState(initialMode.id);
  const [summaryOperation, setSummaryOperation] = useState(initialMode.id === 'perdas' ? 'all' : initialMode.id);
  const [riskMetricId, setRiskMetricId] = useState(initialMetric);
  const [selectedParcelKey, setSelectedParcelKey] = useState(null);
  const [parcelGeoJson, setParcelGeoJson] = useState(null);
  const [parcelGeoStatus, setParcelGeoStatus] = useState('loading');
  const [mapRenderState, setMapRenderState] = useState({
    loading: true,
    progress: 10,
    label: 'Preparando mapa',
  });
  const { records, loading: recordsLoading } = useCqoData();
  const selectedOperation = useMemo(() => activeOperationMode(mapOperation), [mapOperation]);
  const metricOptions = useMemo(() => (
    RISK_METRICS.filter((metric) => selectedOperation.metrics.includes(metric.id))
  ), [selectedOperation]);
  const selectedRiskMetric = useMemo(() => activeRiskMetric(riskMetricId), [riskMetricId]);
  const selectedRiskMetricDisplay = useMemo(
    () => metricDisplay(selectedRiskMetric, selectedOperation),
    [selectedRiskMetric, selectedOperation]
  );
  const effectiveAreaFilter = areaFilter && areaFilter !== 'all' ? areaFilter : selectedOperation.areaFilter;

  const filteredRecords = useMemo(() => filterRecords(records, {
    farmFilter,
    areaFilter: effectiveAreaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  }), [records, farmFilter, effectiveAreaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter, dateFrom, dateTo]);

  const geoRecords = useMemo(() => filteredRecords.filter((record) => {
    if (record.raw?.mapeamento_legado || record.evaluatorMatricula === 'HISTORICO') return false;
    return Boolean(firstValidGpsPoint(record));
  }), [filteredRecords]);

  const trackPoints = useMemo(() => geoRecords.flatMap((record) => {
    const points = record.gpsTrack?.length ? record.gpsTrack : [record.gps];
    return points
      .map(normalizeLatLng)
      .filter(Boolean)
      .map((point, index) => ({
        ...point,
        index,
        record,
        weight: recordWeight(record),
      }));
  }), [geoRecords]);

  const occurrencePoints = useMemo(() => {
    const points = geoRecords.flatMap((record) => (
      (record.gpsOccurrences?.length ? record.gpsOccurrences : [])
        .map(normalizeLatLng)
        .filter(Boolean)
        .map((point, index) => ({
          ...point,
          index,
          record,
          title: occurrenceTitle(point),
          fieldId: occurrenceField(point),
          line: occurrenceLine(point),
          weight: Math.max(1, Number(point.quantity || 1)),
        }))
    ));

    const duplicateGroups = points.reduce((acc, point) => {
      const key = `${point.record.id}|${point.lat.toFixed(7)}|${point.lng.toFixed(7)}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(point);
      return acc;
    }, {});

    return points.map((point) => {
      const key = `${point.record.id}|${point.lat.toFixed(7)}|${point.lng.toFixed(7)}`;
      const group = duplicateGroups[key] || [];
      return occurrenceDisplayPoint({
        ...point,
        duplicateIndex: group.indexOf(point),
        duplicateTotal: group.length,
      });
    });
  }, [geoRecords]);

  const allGpsPoints = useMemo(() => {
    const seen = new Set();
    return [...trackPoints, ...occurrencePoints].filter((point) => {
      const key = `${Number(point.lat).toFixed(6)}|${Number(point.lng).toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [trackPoints, occurrencePoints]);

  const filteredParcelFeatures = useMemo(() => (
    parcelGeoJson?.features?.filter((feature) => (
      farmFilter === 'all' || feature.properties?.farmId === farmFilter
    )) || []
  ), [parcelGeoJson, farmFilter]);

  const heatByParcel = useMemo(() => {
    const summaries = new globalThis.Map();

    occurrencePoints.forEach((point) => {
      const key = parcelHeatKey(point.record.farmId, point.record.parcel);
      const current = summaries.get(key) || {
        farmId: point.record.farmId,
        farm: point.record.farm,
        parcel: point.record.parcel,
        points: 0,
        uniqueCoords: new Set(),
        lines: new Set(),
        score: 0,
        records: new Set(),
      };
      current.points += 1;
      current.uniqueCoords.add(`${point.lat.toFixed(6)}|${point.lng.toFixed(6)}`);
      current.lines.add(point.line || '--');
      current.score += occurrenceSeverity(point) * Math.max(1, Number(point.quantity || 1));
      current.records.add(point.record.id);
      summaries.set(key, current);
    });

    return summaries;
  }, [occurrencePoints]);

  const parcelSummaries = useMemo(() => (
    filteredParcelFeatures
      .map((feature) => buildParcelSummary({
        feature,
        records: filteredRecords,
        heatSummary: heatByParcel.get(parcelHeatKey(
          feature?.properties?.farmId,
          shapeParcelCode(feature?.properties || {})
        )),
        metric: selectedRiskMetric,
        operation: selectedOperation,
      }))
  ), [filteredParcelFeatures, filteredRecords, heatByParcel, selectedRiskMetric, selectedOperation]);

  const parcelSummaryByKey = useMemo(() => {
    const map = new globalThis.Map();
    parcelSummaries.forEach((summary) => {
      map.set(summary.key, summary);
    });
    return map;
  }, [parcelSummaries]);

  const rankedParcels = useMemo(() => (
    parcelSummaries
      .filter((summary) => summary.totals && Number.isFinite(summary.riskScore))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5)
  ), [parcelSummaries]);

  const selectedParcelSummary = useMemo(() => (
    selectedParcelKey ? parcelSummaryByKey.get(selectedParcelKey) || null : null
  ), [selectedParcelKey, parcelSummaryByKey]);
  const isParcelDetailOpen = Boolean(selectedParcelSummary && mapLayer !== 'route');

  const selectedParcelDetailHtml = useMemo(() => {
    if (!selectedParcelSummary) return '';
    return parcelNumbersPopup({
      props: selectedParcelSummary.props,
      shapeParcel: selectedParcelSummary.shapeParcel,
      style: farmStyle(selectedParcelSummary.props?.farmId),
      parcelRecords: selectedParcelSummary.records || [],
      metric: selectedRiskMetric,
      operation: selectedOperation,
      summaryOperation,
    });
  }, [selectedParcelSummary, selectedRiskMetric, selectedOperation, summaryOperation]);

  const heatPoints = useMemo(() => {
    const sourcePoints = occurrencePoints.length ? occurrencePoints : trackPoints;
    return sourcePoints.filter((point) => {
      if (farmFilter !== 'all' && point.record.farmId !== farmFilter) return false;
      const perdidos = occurrencePoints.length
        ? Number(point.weight || 1)
        : (point.record?.totals?.cachoEsquecido || 0) + (point.record?.totals?.cachoNaoCarreado || 0);
      return perdidos > 0;
  }).map((point) => {
    const perdidos = occurrencePoints.length
      ? Number(point.weight || 1)
      : (point.record?.totals?.cachoEsquecido || 0) + (point.record?.totals?.cachoNaoCarreado || 0);
    const heatWeight = Math.max(0.4, Math.min(3.0, perdidos / 3));
    return {
      ...point,
      heatWeight,
    };
    });
  }, [occurrencePoints, trackPoints, farmFilter]);

  const geoStats = useMemo(() => {
    const approvedRecords = filteredRecords.filter((record) => reviewState(record) === 'approved');
    const byFarm = approvedRecords.reduce((acc, record) => {
      const key = record.farmId || 'default';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      total: approvedRecords.length,
      gpsPoints: trackPoints.length,
      occurrencePoints: occurrencePoints.length,
      sampledLines: new Set(occurrencePoints.map((point) => `${point.record.id}|${point.line}`)).size,
      sampledParcels: parcelSummaries.filter(hasMetricValue).length,
      uniqueGpsPoints: allGpsPoints.length,
      byFarm,
      lineCount: approvedRecords.reduce((sum, record) => sum + Number(record?.totals?.linhas || record?.lines?.length || 0), 0),
      excelRecords: approvedRecords.filter((record) => record.source === 'excel').length,
      appRecords: approvedRecords.filter((record) => record.source === 'app').length,
      evaluatedHa: parcelSummaries
        .filter(hasMetricValue)
        .reduce((sum, summary) => sum + Number(summary.areaHa || 0), 0),
    };
  }, [filteredRecords, trackPoints, occurrencePoints, allGpsPoints, parcelSummaries]);

  const farmHomeSummaryHtml = useMemo(() => {
    const approvedRecords = filteredRecords.filter((record) => reviewState(record) === 'approved');
    const totals = approvedRecords.length ? aggregateRecords(approvedRecords) : null;
    const corteTotals = aggregateByType(approvedRecords, 'corte');
    const carreamentoTotals = aggregateByType(approvedRecords, 'carreamento');
    const podaTotals = aggregateByType(approvedRecords, 'poda');
    const summaryMode = activeSummaryOperation(summaryOperation);
    const operationRecords = recordsByType(approvedRecords, summaryMode.id === 'all' ? 'all' : summaryMode.id);
    const operationTotals = operationTotalsFor({
      totals,
      corteTotals,
      carreamentoTotals,
      podaTotals,
      operation: summaryMode.id === 'all' ? activeOperationMode('perdas') : summaryMode,
    });
    const allDates = collectionDateSummary(approvedRecords);
    const operationDates = collectionDateSummary(operationRecords);
    const farm = FARMS.find((item) => item.id === farmFilter);
    const farmName = farmFilter === 'all'
      ? 'Todas as fazendas'
      : farm?.name || approvedRecords[0]?.farm || 'Fazenda';
    const statusText = totals
      ? `${formatInteger(approvedRecords.length)} coleta(s) · ${formatInteger(totals.aprovados)} aprov. / ${formatInteger(totals.reprovados)} reprov.`
      : '0 coleta(s) · Sem coleta aprovada';
    const summaryHtml = compactParcelSummaryHtml({
      totals,
      corteTotals,
      carreamentoTotals,
      podaTotals,
      parcelRecords: approvedRecords,
      areaHa: geoStats.evaluatedHa,
      densityShape: 0,
      collectionDates: allDates,
      summaryOperation: summaryMode.id,
    });

    return compactSummaryShellHtml({
      title: farmName,
      subtitle: `${formatInteger(geoStats.sampledParcels)} parcela(s) avaliadas · ${operationLabel(summaryMode)}`,
      badge: 'Fazenda',
      accent: farmFilter === 'all' ? FARM_STYLES.default.color : farmStyle(farmFilter).color,
      datesLabel: allDates.label,
      statusText,
      summaryHtml,
      contextText: operationTotals ? `Quadro ativo: ${operationLabel(summaryMode)} · ${operationDates.label}` : '',
      extraClass: 'parcel-popup-home-card',
    });
  }, [filteredRecords, farmFilter, geoStats.evaluatedHa, geoStats.sampledParcels, summaryOperation]);

  useEffect(() => {
    if (!mapContainerRef.current) return undefined;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-2.39, -48.15],
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/data/farm-parcels.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Mapa de parcelas indisponível.');
        return response.json();
      })
      .then((geojson) => {
        if (mounted) {
          setParcelGeoJson(geojson);
          setParcelGeoStatus('ready');
        }
      })
      .catch(() => {
        if (mounted) {
          setParcelGeoJson(null);
          setParcelGeoStatus('fallback');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return undefined;

    const prepTimer = window.setTimeout(() => {
      setMapRenderState({
        loading: true,
        progress: parcelGeoStatus === 'loading' ? 32 : 48,
        label: parcelGeoStatus === 'loading' ? 'Carregando parcelas do mapa' : 'Atualizando filtros do mapa',
      });
    }, 0);
    let viewportFrame = 0;
    let viewportTimer = 0;
    let settleTimer = 0;
    let finishTimer = 0;

    const drawTimer = window.setTimeout(() => {
      setMapRenderState({
        loading: true,
        progress: 66,
        label: 'Renderizando camadas',
      });

      layers.clearLayers();
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.removeLayer(layer);
        }
      });

      let tileUrl = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      let tileOptions = {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      };

      if (baseLayer === 'satellite') {
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        tileOptions = {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 20,
        };
      }

      if (baseLayer === 'sentinel') {
        tileUrl = SENTINEL_TILE_URL;
        tileOptions = {
          attribution: SENTINEL_ATTRIBUTION,
          maxZoom: 20,
          maxNativeZoom: 16,
        };
      }

      L.tileLayer(tileUrl, tileOptions).addTo(map);

      const farmLayerBounds = [];
      const evaluatedLayerBounds = [];

    if (parcelGeoJson?.features?.length) {
      const filteredParcels = {
        ...parcelGeoJson,
        features: filteredParcelFeatures,
      };

      L.geoJSON(filteredParcels, {
        style: (feature) => {
          const props = feature?.properties || {};
          const style = farmStyle(props.farmId);
          let fillColor = style.fill;
          let fillOpacity = mapLayer === 'polygon' ? 0.12 : 0.03;
          let weight = mapLayer === 'polygon' ? 2 : 1.4;

          const shapeParcel = shapeParcelCode(props);
          const summary = parcelSummaryByKey.get(parcelHeatKey(props.farmId, shapeParcel));
          const parcelTotals = summary?.totals || null;

          if (mapLayer === 'polygon') {
            if (parcelTotals && summary) {
              fillColor = summary.color;
              fillOpacity = 0.62;
              weight = 2.5;
            } else {
              fillColor = '#CBD5E1';
              fillOpacity = 0.08;
              weight = 1;
            }
          }

          return {
            color: mapLayer === 'polygon' && summary?.totals ? summary.color : style.color,
            fillColor,
            fillOpacity,
            weight,
            opacity: 0.9,
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};

          const shapeParcel = shapeParcelCode(props);
          const summary = parcelSummaryByKey.get(parcelHeatKey(props.farmId, shapeParcel));

          layer.on('click', () => {
            const key = parcelHeatKey(props.farmId, shapeParcel);
            setSelectedParcelKey((current) => {
              const nextKey = current === key ? null : key;
              onParcelSelect?.(nextKey ? parcelSummaryByKey.get(key) || summary || null : null);
              return nextKey;
            });
          });

          layer.on('mouseover', () => {
            if (mapLayer === 'polygon') layer.setStyle({ weight: 3.2, opacity: 1 });
          });

          layer.on('mouseout', () => {
            if (mapLayer === 'polygon') {
              layer.setStyle({
                weight: summary?.totals ? 2.5 : 1,
                opacity: 0.9,
              });
            }
          });

          if (shapeParcel && mapLayer !== 'route') {
            const labelLatLng = featureLabelLatLng(feature);
            if (labelLatLng) {
              L.marker(labelLatLng, {
                icon: parcelLabelIcon(shapeParcel, Boolean(summary?.totals)),
                interactive: false,
                keyboard: false,
                pane: 'tooltipPane',
              }).addTo(layers);
            }
          }
          if (layer.getBounds) {
            const bounds = layer.getBounds();
            farmLayerBounds.push(bounds);
            if (summary?.totals) evaluatedLayerBounds.push(bounds);
          }
        },
      }).addTo(layers);
    } else {
      FARMS.forEach((farm) => {
        if (farm.id === 'all') return;
        if (farmFilter !== 'all' && farmFilter !== farm.id) return;

        const offset = 0.012;
        const bounds = [
          [farm.Lat - offset, farm.Lng - offset],
          [farm.Lat - offset, farm.Lng + offset],
          [farm.Lat + offset, farm.Lng + offset],
          [farm.Lat + offset, farm.Lng - offset],
        ];

        const polygon = L.polygon(bounds, {
          color: farmStyle(farm.id).color,
          fillColor: farmStyle(farm.id).fill,
          fillOpacity: mapLayer === 'polygon' ? 0.12 : 0.05,
          weight: 2,
          dashArray: '4, 4',
        })
          .addTo(layers)
          .bindPopup(`
            <div style="font-family: Inter, Segoe UI, sans-serif;">
              <strong style="color: #234F2A; font-size: 14px;">${escapeHtml(farm.name)}</strong><br/>
              <span>Area estimada</span>
            </div>
          `);
        farmLayerBounds.push(polygon.getBounds());
      });
    }

    const gpsPointIcon = (point, index, pinColor) => L.divIcon({
      className: 'custom-div-icon gps-occurrence-marker',
      html: `
        <span style="--gps-point-color:${pinColor};">
          ${index + 1}
        </span>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    if (mapLayer === 'route') {
      occurrencePoints.forEach((point, index) => {
        const style = farmStyle(point.record.farmId);
        const pinColor = occurrenceHeatColor(point, markerColor(point.record, style.fill));
        const pointLat = Number(point.displayLat || point.lat);
        const pointLng = Number(point.displayLng || point.lng);

        L.marker([pointLat, pointLng], { icon: gpsPointIcon(point, index, pinColor) })
          .addTo(layers)
          .bindTooltip(`${index + 1}. ${escapeHtml(point.title)}`, {
            direction: 'top',
            offset: [0, -12],
            opacity: 0.95,
            className: 'gps-marker-tooltip',
          })
          .bindPopup(`
            <div style="font-family: Inter, Segoe UI, sans-serif; max-width: 260px;">
              <strong style="color:${style.color};font-size:12px;">Ponto GPS ${index + 1}</strong><br/>
              <span style="font-size:11px;">Ocorrencia: <strong>${escapeHtml(point.title)}</strong></span><br/>
              <span style="font-size:11px;">Campo: <strong>${escapeHtml(point.fieldId || '--')}</strong></span><br/>
              <span style="font-size:11px;">Linha: <strong>${escapeHtml(point.line)}</strong></span><br/>
              <span style="font-size:11px;">Fazenda: <strong>${escapeHtml(point.record.farm)}</strong></span><br/>
              <span style="font-size:11px;">Parcela: <strong>${escapeHtml(point.record.parcel)}</strong></span><br/>
              <span style="font-size:11px;">Quantidade: <strong>${escapeHtml(point.quantity || 1)}</strong></span><br/>
              <span style="font-size:11px;">GPS original: <strong>${escapeHtml(point.label)}</strong></span><br/>
              <span style="font-size:11px;">Status: <strong style="color:${markerColor(point.record, style.fill)};">${escapeHtml(point.record.status)}</strong></span>
            </div>
          `);
      });
    }

    geoRecords.forEach((record) => {
      if (mapLayer !== 'route') return;
      if (record.gpsOccurrences?.length) return;
      const style = farmStyle(record.farmId);
      const markerPoint = firstValidGpsPoint(record);
      if (!markerPoint) return;
      const pinColor = markerColor(record, style.fill);
      const pinIcon = L.divIcon({
        className: 'custom-div-icon gps-collection-marker',
        html: `
          <div class="gps-pin-ring" style="--gps-pin-color:${pinColor};">
            <span></span>
          </div>
          <strong>GPS</strong>
        `,
        iconSize: [52, 34],
        iconAnchor: [16, 16],
      });

      L.marker([markerPoint.lat, markerPoint.lng], { icon: pinIcon })
        .addTo(layers)
        .bindTooltip(`${escapeHtml(record.status)} - ${record.gpsOccurrences?.length || record.gpsTrack?.length || 1} ponto(s) GPS`, {
          permanent: geoRecords.length <= 5 && !record.gpsOccurrences?.length,
          direction: 'top',
          offset: [0, -14],
          opacity: 0.95,
          className: 'gps-marker-tooltip',
        })
        .bindPopup(`
          <div style="font-family: Inter, Segoe UI, sans-serif; max-width: 240px;">
            <strong style="color:${style.color};font-size:12px;">Coleta #${escapeHtml(record.id)}</strong><br/>
            <span style="font-size:11px;">Formulario: <strong>${escapeHtml(record.form)}</strong></span><br/>
            <span style="font-size:11px;">Fazenda: <strong>${escapeHtml(record.farm)}</strong></span><br/>
            <span style="font-size:11px;">Parcela: <strong>${escapeHtml(record.parcel)}</strong></span><br/>
            <span style="font-size:11px;">Linhas avaliadas: <strong>${record.totals?.linhas || record.lines?.length || 0}</strong></span><br/>
            <span style="font-size:11px;">Ocorrencias GPS: <strong>${record.gpsOccurrences?.length || 0}</strong></span><br/>
            <span style="font-size:11px;">Pontos da trilha: <strong>${record.gpsTrack?.length || 1}</strong></span><br/>
            <span style="font-size:11px;">GPS: <strong>${escapeHtml(markerPoint.label)}</strong></span><br/>
            <span style="font-size:11px;">Status: <strong style="color:${pinColor};">${escapeHtml(record.status)}</strong></span>
          </div>
        `);
    });

    if (mapLayer === 'polygon' && !parcelGeoJson?.features?.length) {
      heatPoints.forEach((point) => {
        if (heatByParcel.has(parcelHeatKey(point.record.farmId, point.record.parcel))) return;
        const style = farmStyle(point.record.farmId);
        const heatColor = occurrenceHeatColor(point, style.fill);
        const radius = Math.max(24, Math.min(82, 22 + point.heatWeight * 24 + Number(point.accuracy || 0) * 2));
        L.circle([point.lat, point.lng], {
          radius,
          color: heatColor,
          fillColor: heatColor,
          fillOpacity: Math.min(0.42, 0.14 + point.heatWeight * 0.09),
          weight: 1.2,
          opacity: 0.44,
        })
          .addTo(layers)
          .bindTooltip(`${escapeHtml(point.title || 'Ocorrencia')} - linha ${escapeHtml(point.line || '--')}`, {
            direction: 'top',
            opacity: 0.9,
            className: 'gps-marker-tooltip',
          });

        L.circleMarker([point.lat, point.lng], {
          radius: 4,
          color: '#FFFFFF',
          fillColor: heatColor,
          fillOpacity: 1,
          weight: 1.5,
        }).addTo(layers);
      });
    }

    if (mapLayer === 'route') {
      geoRecords.forEach((record) => {
        const routePoints = (record.gpsTrack || [])
          .map(normalizeLatLng)
          .filter(Boolean)
          .map((point) => [point.lat, point.lng]);
        if (routePoints.length >= 2) {
          const style = farmStyle(record.farmId);
          L.polyline(routePoints, {
            color: style.color,
            weight: 4,
            opacity: 0.82,
          }).addTo(layers);
        }
      });

      Object.keys(FARM_STYLES).forEach((farmId) => {
        if (farmId === 'default') return;
        const routeRecords = geoRecords
          .filter((record) => record.farmId === farmId)
          .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        const routePoints = routeRecords
          .map(firstValidGpsPoint)
          .filter(Boolean)
          .map((point) => [point.lat, point.lng]);
        if (routePoints.length >= 2) {
          const style = farmStyle(farmId);
          L.polyline(routePoints, {
            color: style.color,
            weight: 3,
            opacity: 0.82,
            dashArray: '6, 6',
          }).addTo(layers);
        }
      });
    }

    const applyViewport = () => {
      if (!mapContainerRef.current) return;
      map.invalidateSize({ pan: false, debounceMoveend: false });

      const gpsLatLngs = allGpsPoints
        .map(normalizeLatLng)
        .filter(Boolean)
        .map((point) => L.latLng(point.lat, point.lng));

      const selectedBounds = selectedParcelSummary ? featureBounds(selectedParcelSummary.feature) : null;
      if (mapLayer !== 'route' && selectedBounds) {
        fitMapToBounds(map, selectedBounds, { pad: 0.22, maxZoom: 17, minZoom: 15, animate: false });
      } else if (mapLayer !== 'route' && farmFilter !== 'all' && farmLayerBounds.length > 0) {
        const bounds = farmLayerBounds.reduce((acc, item) => acc.extend(item), L.latLngBounds([]));
        fitMapToBounds(map, bounds, { pad: 0.08, maxZoom: 16, minZoom: 14, animate: false });
      } else if (mapLayer !== 'route' && evaluatedLayerBounds.length > 0) {
        const bounds = evaluatedLayerBounds.reduce((acc, item) => acc.extend(item), L.latLngBounds([]));
        fitMapToBounds(map, bounds, { pad: 0.1, maxZoom: 16, minZoom: presentationMode ? 13 : 12, animate: false });
      } else if (mapLayer === 'route' && gpsLatLngs.length === 1) {
        map.setView(gpsLatLngs[0], 17, { animate: false });
      } else if (mapLayer === 'route' && gpsLatLngs.length > 1) {
        const bounds = L.latLngBounds(gpsLatLngs);
        fitMapToBounds(map, bounds, { pad: 0.12, maxZoom: 17, minZoom: 13, animate: false });
      } else if (farmLayerBounds.length > 0) {
        const bounds = farmLayerBounds.reduce((acc, item) => acc.extend(item), L.latLngBounds([]));
        fitMapToBounds(map, bounds, { pad: 0.08, maxZoom: mapLayer === 'route' ? 14 : 15, minZoom: farmFilter === 'all' ? 12 : 13, animate: false });
      } else if (farmFilter !== 'all') {
        const selectedFarm = FARMS.find((farm) => farm.id === farmFilter);
        if (selectedFarm) {
          map.setView([selectedFarm.Lat, selectedFarm.Lng], 14, { animate: false });
        }
      }
    };

      viewportFrame = window.requestAnimationFrame(() => {
        map.whenReady(() => {
          setMapRenderState({
            loading: true,
            progress: 92,
            label: 'Ajustando visualização',
          });
          applyViewport();
          viewportTimer = window.setTimeout(applyViewport, 120);
          settleTimer = window.setTimeout(applyViewport, 420);
          finishTimer = window.setTimeout(() => {
            setMapRenderState({
              loading: false,
              progress: 100,
              label: 'Mapa pronto',
            });
          }, 180);
        });
      });
    }, 45);

    return () => {
      window.clearTimeout(prepTimer);
      window.clearTimeout(drawTimer);
      window.cancelAnimationFrame(viewportFrame);
      window.clearTimeout(viewportTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(finishTimer);
    };
  }, [theme, farmFilter, areaFilter, mapLayer, baseLayer, selectedRiskMetric, selectedOperation, geoRecords, trackPoints, occurrencePoints, allGpsPoints, heatPoints, heatByParcel, parcelGeoJson, parcelGeoStatus, filteredParcelFeatures, parcelSummaryByKey, selectedParcelSummary, presentationMode, onParcelSelect]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize({ pan: false, debounceMoveend: false });
    }, 120);

    return () => window.clearTimeout(resizeTimer);
  }, [isParcelDetailOpen, presentationMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedParcelSummary || mapLayer === 'route') return undefined;

    const timer = window.setTimeout(() => {
      const bounds = featureBounds(selectedParcelSummary.feature);
      if (bounds) {
        fitMapToBounds(map, bounds, { pad: 0.22, maxZoom: 17, minZoom: 15, animate: true });
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [selectedParcelSummary, mapLayer]);

  const mapIsLoading = recordsLoading || parcelGeoStatus === 'loading' || mapRenderState.loading;
  const mapProgress = recordsLoading
    ? 24
    : parcelGeoStatus === 'loading'
      ? 42
      : mapRenderState.progress;
  const mapLoadingLabel = recordsLoading
    ? 'Buscando coletas no Supabase'
    : parcelGeoStatus === 'loading'
      ? 'Carregando parcelas do mapa'
      : mapRenderState.label;
  const activeSummaryOperationId = activeSummaryOperation(summaryOperation).id;
  const applyMapOperation = (operationId) => {
    const nextMode = activeOperationMode(operationId);
    setMapOperation(nextMode.id);
    setSummaryOperation(nextMode.id === 'perdas' ? 'all' : nextMode.id);
    setRiskMetricId(nextMode.defaultMetric);
  };
  const applySummaryOperation = (summaryOperationId) => {
    const nextSummaryMode = activeSummaryOperation(summaryOperationId);
    const nextMapMode = activeOperationMode(nextSummaryMode.id === 'all' ? 'perdas' : nextSummaryMode.id);
    setSummaryOperation(nextSummaryMode.id);
    setMapOperation(nextMapMode.id);
    setRiskMetricId(nextMapMode.defaultMetric);
  };
  const focusFarmOverview = (animate = true) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const visibleFeatures = filteredParcelFeatures.filter((feature) => {
      if (!feature) return false;
      if (selectedParcelSummary?.props?.farmId) {
        return feature.properties?.farmId === selectedParcelSummary.props.farmId;
      }
      return true;
    });
    if (visibleFeatures.length) {
      const overviewBounds = L.geoJSON({
        type: 'FeatureCollection',
        features: visibleFeatures,
      }).getBounds();

      if (overviewBounds.isValid()) {
        fitMapToBounds(map, overviewBounds, {
          pad: selectedParcelSummary?.props?.farmId ? 0.08 : 0.1,
          maxZoom: 16,
          minZoom: selectedParcelSummary?.props?.farmId || farmFilter !== 'all' ? 14 : 12,
          animate,
        });
        return;
      }
    }

    const gpsLatLngs = allGpsPoints
      .map(normalizeLatLng)
      .filter(Boolean)
      .map((point) => L.latLng(point.lat, point.lng));

    if (gpsLatLngs.length > 1) {
      const gpsBounds = L.latLngBounds(gpsLatLngs);
      map.invalidateSize({ pan: false, debounceMoveend: false });
      map.fitBounds(gpsBounds.pad(0.2), { maxZoom: 15, animate });
      return;
    }

    if (gpsLatLngs.length === 1) {
      map.setView(gpsLatLngs[0], 15, { animate });
      return;
    }

    if (farmFilter !== 'all') {
      const selectedFarm = FARMS.find((farm) => farm.id === farmFilter);
      if (selectedFarm) {
        map.setView([selectedFarm.Lat, selectedFarm.Lng], 14, { animate });
      }
    }
  };
  const clearParcelSelection = () => {
    setSelectedParcelKey(null);
    if (mapLayer === 'route') setMapLayer('polygon');
    window.setTimeout(() => focusFarmOverview(true), mapLayer === 'route' ? 260 : 80);
  };
  const renderSummaryOperationTabs = (extraClass = '') => (
    <div className={`gps-summary-operation-tabs ${extraClass}`} aria-label="Escolher operação do quadro">
      {SUMMARY_OPERATION_MODES.map((mode) => (
        <button
          type="button"
          key={mode.id}
          className={activeSummaryOperationId === mode.id ? 'active' : ''}
          aria-pressed={activeSummaryOperationId === mode.id}
          onClick={() => applySummaryOperation(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`card gps-map-card ${presentationMode ? 'gps-map-card-presentation' : ''} ${isParcelDetailOpen ? 'gps-map-card-detail-open' : 'gps-map-card-controls-open'}`}>
      <div ref={mapContainerRef} className="gps-map-canvas" />

      {mapIsLoading ? (
        <div className="gps-map-loading" role="status" aria-live="polite">
          <div className="gps-map-loading-box">
            <div className="gps-map-loading-spinner" />
            <strong>{mapLoadingLabel}</strong>
            <span>Atualizando dados, filtros e camadas do mapa.</span>
            <div className="gps-map-loading-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(8, Math.min(100, mapProgress))}%` }} />
            </div>
            <em>{Math.round(Math.max(0, Math.min(100, mapProgress)))}%</em>
          </div>
        </div>
      ) : null}

      <div className={`gps-map-overlay ${isParcelDetailOpen ? 'gps-map-detail-panel' : ''}`}>
        {isParcelDetailOpen ? (
          <div className="gps-detail-view">
            <div className="gps-detail-toolbar">
              <button type="button" onClick={clearParcelSelection}>
                <ArrowLeft size={14} />
                Ver fazenda toda
              </button>
              <span>
                {selectedParcelSummary.props?.farmName || selectedParcelSummary.props?.farmId || 'Fazenda'}
                {' / '}
                {selectedParcelSummary.shapeParcel || '--'}
              </span>
            </div>
            {renderSummaryOperationTabs('gps-summary-operation-tabs-detail')}
            <div
              className="gps-detail-content"
              dangerouslySetInnerHTML={{ __html: selectedParcelDetailHtml }}
            />
          </div>
        ) : (
          <>
        {renderSummaryOperationTabs('gps-summary-operation-tabs-home')}
        <div
          className="gps-home-summary"
          dangerouslySetInnerHTML={{ __html: farmHomeSummaryHtml }}
        />

        <h4>Visualização</h4>
        <div className="gps-base-toggle" aria-label="Tipo de mapa">
          <button
            type="button"
            className={baseLayer === 'standard' ? 'active' : ''}
            onClick={() => setBaseLayer('standard')}
          >
            <MapIcon size={13} />
            Padrão
          </button>
          <button
            type="button"
            className={baseLayer === 'satellite' ? 'active' : ''}
            onClick={() => setBaseLayer('satellite')}
            title="Satélite mais nítido para detalhe visual"
          >
            <Satellite size={13} />
            HD
          </button>
          <button
            type="button"
            className={baseLayer === 'sentinel' ? 'active' : ''}
            onClick={() => setBaseLayer('sentinel')}
            title="Sentinel-2 gratuito, recente/agronômico, com resolução de 10 m/pixel"
          >
            <Satellite size={13} />
            Recente
          </button>
        </div>
        <p className="gps-base-note">
          {BASE_LAYER_NOTES[baseLayer]}
        </p>

        <h4 className="gps-overlay-section-title">Operação</h4>
        <div className="gps-operation-toggle" aria-label="Separação operacional do mapa">
          {MAP_OPERATION_MODES.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={mapOperation === mode.id ? 'active' : ''}
              onClick={() => applyMapOperation(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <h4 className="gps-overlay-section-title">Camadas do mapa</h4>
        <div className="gps-layer-stack">
          <button
            onClick={() => setMapLayer('polygon')}
            className={`btn ${mapLayer === 'polygon' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Layers size={14} />
            <span>Qualidade (Semáforo)</span>
          </button>
          <button
            onClick={() => {
              setSelectedParcelKey(null);
              setMapLayer('route');
            }}
            className={`btn ${mapLayer === 'route' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Route size={14} />
            <span>GPS detalhado</span>
          </button>
        </div>

        {mapLayer !== 'route' ? (
          <label className="gps-metric-control">
            <span>Indicador</span>
            <select value={riskMetricId} onChange={(event) => setRiskMetricId(event.target.value)}>
              {metricOptions.map((metric) => (
                <option key={metric.id} value={metric.id}>{metricDisplay(metric, selectedOperation).label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="gps-map-stats">
          <div className="gps-map-stats-total">
            {geoStats.total} coletas de {selectedOperation.label.toLowerCase()} / {geoStats.sampledParcels} parcelas avaliadas
          </div>
          <div className="gps-sample-grid">
            <div>
              <strong>{geoStats.lineCount}</strong>
              <span>linhas amostradas</span>
            </div>
            <div>
              <strong>{formatDecimal(geoStats.evaluatedHa, 1)}</strong>
              <span>hectares avaliados</span>
            </div>
            <div>
              <strong>{geoStats.excelRecords}</strong>
              <span>coletas Excel</span>
            </div>
            <div>
              <strong>{geoStats.gpsPoints}</strong>
              <span>pontos GPS app</span>
            </div>
          </div>
          {mapLayer === 'polygon' ? (
            <div className="gps-risk-ranking">
              <strong>Top parcelas críticas</strong>
              {rankedParcels.length ? rankedParcels.map((summary, index) => (
                <button
                  type="button"
                  key={summary.key}
                  className="gps-risk-row"
                  onClick={() => {
                    const map = mapInstanceRef.current;
                    if (!map) return;
                    const layer = layerGroupRef.current;
                    layer?.eachLayer((item) => {
                      if (item.feature?.properties) {
                        const props = item.feature.properties;
                        const key = parcelHeatKey(props.farmId, shapeParcelCode(props));
                        if (key === summary.key && item.getBounds) {
                          map.fitBounds(item.getBounds().pad(0.22), { maxZoom: 17, animate: true });
                          setSelectedParcelKey(summary.key);
                        }
                      }
                    });
                  }}
                >
                  <span>{index + 1}</span>
                  <em>{summary.props.farmName || summary.props.farmId} / {summary.shapeParcel}</em>
                  <b style={{ color: summary.color }}>{formatMetricValue(selectedRiskMetric, summary.value)}</b>
                </button>
              )) : (
                <small>Nenhuma parcela avaliada no filtro.</small>
              )}
            </div>
          ) : null}
          {Object.entries(FARM_STYLES).filter(([id]) => id !== 'default').map(([id, style]) => (
            <div key={id}>
              <span style={{ backgroundColor: style.fill }} />
              <span>{style.label}: {geoStats.byFarm[id] || 0}</span>
            </div>
          ))}
          <div className="gps-map-note">
            <span>
              {mapLayer === 'route' && `GPS detalhado mostra as coordenadas reais de ${selectedOperation.label.toLowerCase()} dentro da parcela.`}
              {mapLayer === 'polygon' && `${selectedRiskMetricDisplay.label} de ${selectedOperation.label.toLowerCase()} aplicado no semaforo por parcela, respeitando os filtros atuais.`}
            </span>
          </div>
          <div className="gps-heat-legend" aria-label="Legenda do mapa CQO">
            {mapLayer === 'route' ? (
              <>
                <div>
                  <span className="gps-legend-dot gps-legend-dot-real" />
                  <strong>GPS real</strong>
                </div>
                <div>
                  <span className="gps-legend-line" />
                  <strong>rua/trilha amostrada</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="gps-legend-risk gps-risk-good" />
                  <strong>Dentro da meta</strong>
                </div>
                <div>
                  <span className="gps-legend-risk gps-risk-attention" />
                  <strong>Atenção</strong>
                </div>
                <div>
                  <span className="gps-legend-risk gps-risk-critical" />
                  <strong>Crítico</strong>
                </div>
                <div>
                  <span className="gps-legend-risk gps-risk-neutral" />
                  <strong>Sem avaliação</strong>
                </div>
              </>
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
