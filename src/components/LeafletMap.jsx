import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Flame, Layers, Map as MapIcon, Route, Satellite } from 'lucide-react';
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
  { id: 'maduro', label: 'Cacho maduro %', unit: '%', goodWhen: 'high', meta: 85 },
  { id: 'verde', label: 'Cacho verde %', unit: '%', goodWhen: 'low', meta: 1 },
  { id: 'passado', label: 'Cacho passado %', unit: '%', goodWhen: 'low', meta: 10 },
  { id: 'avermelhado', label: 'Cacho avermelhado %', unit: '%', goodWhen: 'low', meta: 4 },
  { id: 'talo', label: 'Talo comprido %', unit: '%', goodWhen: 'low', meta: 3 },
];

const RISK_COLORS = {
  good: '#22C55E',
  attention: '#F59E0B',
  critical: '#EF4444',
  neutral: '#CBD5E1',
};

function activeRiskMetric(metricId) {
  return RISK_METRICS.find((metric) => metric.id === metricId) || RISK_METRICS[1];
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
  if (field.includes('verde') || field.includes('passado') || field.includes('avermelhado') || field.includes('mal_posicionado')) {
    return '#F59E0B';
  }
  if (field.includes('talo') || field.includes('folha') || field.includes('estrela') || field.includes('brocado')) {
    return '#D98C10';
  }
  return fallbackColor || '#F59E0B';
}

function occurrenceSeverity(point) {
  const field = String(point?.fieldId || '').toLowerCase();
  if (field.includes('esquecido') || field.includes('nao_carreado') || field.includes('fruto_solto')) return 3;
  if (field.includes('verde') || field.includes('passado') || field.includes('avermelhado') || field.includes('mal_posicionado')) return 2;
  return 1;
}

function riskStatusLabel(color) {
  if (color === RISK_COLORS.critical) return 'Crítico';
  if (color === RISK_COLORS.attention) return 'Atenção';
  if (color === RISK_COLORS.good) return 'Dentro da meta';
  return 'Sem avaliação';
}

function normalizeParcelCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

function metricValue(metric, totals, areaHa) {
  if (!totals) return null;

  switch (metric.id) {
    case 'nota':
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

function metricTargetText(metric) {
  const prefix = metric.goodWhen === 'high' ? 'mín.' : 'máx.';
  return `${prefix} ${formatMetricValue(metric, metric.meta)}`;
}

function metricExplanation(metric, value, color) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Sem valor suficiente para comparar com a meta neste indicador.';
  }

  const numeric = Number(value);
  const diff = metric.goodWhen === 'high' ? numeric - metric.meta : metric.meta - numeric;
  const direction = metric.goodWhen === 'high'
    ? (diff >= 0 ? 'acima' : 'abaixo')
    : (diff >= 0 ? 'abaixo' : 'acima');
  const absDiff = Math.abs(diff);
  const status = riskStatusLabel(color).toLowerCase();

  return `${status}: ${metric.label} ficou ${direction} da meta em ${formatMetricValue(metric, absDiff)}.`;
}

function metricProgressWidth(metric, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
  const numeric = Math.max(0, Number(value));
  const base = Math.max(Number(metric.meta || 1), numeric);
  if (metric.goodWhen === 'high') return Math.max(8, Math.min(100, (numeric / base) * 100));
  return Math.max(8, Math.min(100, (numeric / (metric.meta * 2.4 || base)) * 100));
}

function metricTargetPosition(metric, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 50;
  const numeric = Math.max(0, Number(value));
  const base = metric.goodWhen === 'high'
    ? Math.max(Number(metric.meta || 1), numeric)
    : Math.max(Number(metric.meta || 1) * 2.4, numeric);
  return Math.max(6, Math.min(94, (Number(metric.meta || 0) / base) * 100));
}

function uniqueCompact(values, limit = 4) {
  return Array.from(new Set(values
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== '--')))
    .slice(0, limit);
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

function parcelFiscalRows(records) {
  const byFiscal = new Map();

  records.forEach((record) => {
    const fiscal = record.fiscal || 'Sem fiscal';
    const current = byFiscal.get(fiscal) || {
      fiscal,
      count: 0,
      dates: [],
      sources: new Set(),
    };
    current.count += 1;
    if (record.date && record.date !== '--') current.dates.push(record.date);
    current.sources.add(record.source === 'excel' ? 'Excel' : 'App');
    byFiscal.set(fiscal, current);
  });

  return Array.from(byFiscal.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => {
      const sortedDates = sortDateTexts(item.dates);
      const dateText = sortedDates.length
        ? `${sortedDates[0]}${sortedDates[0] !== sortedDates[sortedDates.length - 1] ? ` a ${sortedDates[sortedDates.length - 1]}` : ''}`
        : 'Sem data';
      return `
        <div class="parcel-popup-person-row">
          <strong>${escapeHtml(item.fiscal)}</strong>
          <span>${formatInteger(item.count)} coleta(s) · ${escapeHtml(dateText)} · ${escapeHtml(Array.from(item.sources).join(' + '))}</span>
        </div>
      `;
    }).join('');
}

function parcelCollaboratorCodes(records) {
  return uniqueCompact(records.flatMap((record) => (
    (record.lines || []).flatMap((line) => [
      line.matricula_colaborador,
      line.MatriculaColaborador,
      line.MatriculaCortador,
      line.colaborador_matricula,
    ])
  )), 8);
}

function parcelLatestRows(records) {
  return [...records]
    .sort((a, b) => dateOrderValue(b.date) - dateOrderValue(a.date))
    .slice(0, 4)
    .map((record) => {
      const collaboratorCodes = parcelCollaboratorCodes([record]);
      return `
        <div class="parcel-popup-event-row">
          <strong>${escapeHtml(record.date || '--')}</strong>
          <span>${escapeHtml(record.form || record.type || 'CQO')} · ${escapeHtml(record.fiscal || 'Sem fiscal')}</span>
          <small>${escapeHtml(record.source === 'excel' ? 'Excel' : 'App')}${collaboratorCodes.length ? ` · Colab. ${escapeHtml(collaboratorCodes.join(', '))}` : ''}</small>
        </div>
      `;
    }).join('');
}

function topCauseRows(totals) {
  if (!totals) return [];

  return [
    { label: 'Perda corte', value: Number(totals.perdaCorteRate || 0), detail: `${formatInteger(totals.cachoEsquecido || 0)} cacho(s) esquecido(s)`, color: '#EF4444' },
    { label: 'Não carreado', value: Number(totals.cachoNaoCarreadoRate || 0), detail: `${formatInteger(totals.cachoNaoCarreado || 0)} cacho(s)`, color: '#EF4444' },
    { label: 'Verde', value: Number(totals.cachoVerdeRate || 0), detail: `${formatInteger(totals.cachoVerde || 0)} cacho(s)`, color: '#F59E0B' },
    { label: 'Passado', value: Number(totals.cachoPassadoRate || 0), detail: `${formatInteger(totals.cachoPassado || 0)} cacho(s)`, color: '#6B4B3E' },
    { label: 'Avermelhado', value: percentOf(totals.cachoAvermelhado, totals.cachosObservados), detail: `${formatInteger(totals.cachoAvermelhado || 0)} cacho(s)`, color: '#B91C1C' },
    { label: 'Talo comprido', value: Number(totals.taloCompridoRate || 0), detail: `${formatInteger(totals.taloComprido || 0)} ocorr.`, color: '#D98C10' },
    { label: 'Mal posicionado', value: Number(totals.cachoMalPosicionadoRate || 0), detail: `${formatInteger(totals.cachoMalPosicionado || 0)} ocorr.`, color: '#F97316' },
  ].filter((item) => item.value > 0 || !/^0\b/.test(String(item.detail)))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

function popupMetricChart(metric, value, color) {
  const width = metricProgressWidth(metric, value);
  const target = metricTargetPosition(metric, value);

  return `
    <div class="parcel-popup-chart-card">
      <div class="parcel-popup-chart-head">
        <span>${escapeHtml(metric.label)}</span>
        <strong style="color:${color};">${formatMetricValue(metric, value)}</strong>
      </div>
      <div class="parcel-popup-goalbar">
        <span style="width:${width}%; background:${color};"></span>
        <i style="left:${target}%;" title="Meta"></i>
      </div>
      <div class="parcel-popup-chart-foot">
        <span>Meta ${escapeHtml(metricTargetText(metric))}</span>
        <b>${escapeHtml(metricExplanation(metric, value, color))}</b>
      </div>
    </div>
  `;
}

function popupCauseChart(totals) {
  const causes = topCauseRows(totals);
  if (!causes.length) {
    return '<div class="parcel-popup-empty">Nenhum desvio relevante identificado nos campos calculados.</div>';
  }
  const max = Math.max(...causes.map((item) => item.value), 1);

  return `
    <div class="parcel-popup-cause-list">
      ${causes.map((item) => `
        <div class="parcel-popup-cause-row">
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </div>
          <div class="parcel-popup-mini-bar">
            <span style="width:${Math.max(7, (item.value / max) * 100)}%; background:${item.color};"></span>
          </div>
          <b>${formatDecimal(item.value, 1)}%</b>
        </div>
      `).join('')}
    </div>
  `;
}

function popupBunchStack(totals) {
  const parts = [
    { label: 'Maduro', value: Number(totals?.cachoMaduro || 0), color: '#FB8A4B' },
    { label: 'Passado', value: Number(totals?.cachoPassado || 0), color: '#6B4B3E' },
    { label: 'Verde', value: Number(totals?.cachoVerde || 0), color: '#22C55E' },
    { label: 'Averm.', value: Number(totals?.cachoAvermelhado || 0), color: '#B91C1C' },
  ];
  const total = parts.reduce((sum, item) => sum + item.value, 0);

  if (!total) return '<div class="parcel-popup-empty">Sem composição de cachos observados nesta parcela.</div>';

  return `
    <div class="parcel-popup-stack">
      <div class="parcel-popup-stackbar">
        ${parts.map((item) => `
          <span style="width:${Math.max(item.value ? 3 : 0, (item.value / total) * 100)}%; background:${item.color};" title="${escapeHtml(item.label)}"></span>
        `).join('')}
      </div>
      <div class="parcel-popup-stack-legend">
        ${parts.map((item) => `
          <span><i style="background:${item.color};"></i>${escapeHtml(item.label)} ${formatDecimal(percentOf(item.value, total), 1)}%</span>
        `).join('')}
      </div>
    </div>
  `;
}

function buildParcelSummary({ feature, records, heatSummary, metric }) {
  const props = feature?.properties || {};
  const shapeParcel = shapeParcelCode(props);
  const parcelRecords = shapeParcel
    ? records.filter((record) => parcelRecordMatches(record, props, shapeParcel))
    : [];
  const totals = parcelRecords.length ? aggregateRecords(parcelRecords) : null;
  const areaHa = parcelAreaHa(props);
  const value = metricValue(metric, totals, areaHa);
  const color = metricColor(metric, value, Boolean(totals));
  const excelCount = parcelRecords.filter((record) => record.source === 'excel').length;
  const appCount = parcelRecords.filter((record) => record.source === 'app').length;
  const firstDate = parcelRecords.map((record) => record.date).filter(Boolean).sort()[0] || '';
  const lastDate = parcelRecords.map((record) => record.date).filter(Boolean).sort().slice(-1)[0] || '';

  return {
    key: parcelHeatKey(props.farmId, shapeParcel),
    props,
    shapeParcel,
    records: parcelRecords,
    totals,
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

function popupMetric(label, value, tone = '') {
  return `
    <div class="parcel-popup-metric">
      <span>${label}</span>
      <strong style="color:${tone || '#182230'};">${value}</strong>
    </div>
  `;
}

function popupPercentRow(label, value, tone = '') {
  return `
    <div class="parcel-popup-percent-row">
      <span>${label}</span>
      <strong style="color:${tone || '#182230'};">${value}</strong>
    </div>
  `;
}

function parcelNumbersPopup({ props, shapeParcel, style, parcelRecords, metric }) {
  const totals = parcelRecords.length ? aggregateRecords(parcelRecords) : null;
  const areaHa = parcelAreaHa(props);
  const densityShape = parcelDensity(props);
  const score = totals?.generalScore ?? 0;
  const scoreColor = totals ? getScoreColor(score) : '#94A3B8';
  const selectedMetric = metric || RISK_METRICS[1];
  const selectedValue = metricValue(selectedMetric, totals, areaHa);
  const selectedColor = metricColor(selectedMetric, selectedValue, Boolean(totals));
  const statusText = totals
    ? `${formatInteger(totals.aprovados)} aprov. / ${formatInteger(totals.reprovados)} reprov.`
    : 'Sem coleta aprovada';
  const excelCount = parcelRecords.filter((record) => record.source === 'excel').length;
  const appCount = parcelRecords.filter((record) => record.source === 'app').length;
  const dateValues = sortDateTexts(parcelRecords.map((record) => record.date));
  const dateRange = dateValues.length
    ? `${dateValues[0]}${dateValues[0] !== dateValues[dateValues.length - 1] ? ` a ${dateValues[dateValues.length - 1]}` : ''}`
    : 'Sem data';
  const latestDate = dateValues[dateValues.length - 1] || 'Sem data';
  const collaboratorCodes = parcelCollaboratorCodes(parcelRecords);
  const fiscalRows = parcelFiscalRows(parcelRecords);
  const latestRows = parcelLatestRows(parcelRecords);

  const riskBlock = totals
    ? `
      <div class="parcel-popup-heat">
        <strong style="color:${selectedColor};">${riskStatusLabel(selectedColor)} - ${selectedMetric.label}</strong>
        <span>${formatMetricValue(selectedMetric, selectedValue)} aplicado na parcela completa a partir da amostragem.</span>
      </div>
    `
    : `
      <div class="parcel-popup-heat parcel-popup-heat-neutral">
        <strong>Sem avaliação no período</strong>
        <span>Esta parcela não tem coleta aprovada ou registro Excel dentro dos filtros atuais.</span>
      </div>
    `;

  const mainMetrics = [
    popupMetric('Nota CQO', totals ? `${formatDecimal(score, 0)}%` : 'N/D', scoreColor),
    popupMetric('Area', areaHa ? `${formatDecimal(areaHa, 2)} ha` : 'N/D'),
    popupMetric('Densidade', densityShape ? `${formatDecimal(densityShape, 0)} pl/ha` : 'N/D'),
    popupMetric('Periodo', dateRange),
    popupMetric('Fonte', totals ? `${excelCount} Excel / ${appCount} App` : 'N/D'),
    popupMetric('Linhas amostradas', formatInteger(totals?.linhas || 0)),
    popupMetric('Plantas obs.', formatInteger(totals?.plantasObservadas || 0)),
    popupMetric('Cachos obs.', formatInteger(totals?.cachosObservados || 0)),
    popupMetric('Perda fruta/ha', areaHa ? `${formatDecimal(perHa(totals?.lostFrutosTon || 0, areaHa), 3)} t/ha` : 'N/D', '#EF4444'),
  ].join('');

  const percentMetrics = [
    popupPercentRow('Cacho maduro', `${formatDecimal(percentOf(totals?.cachoMaduro, totals?.cachosObservados), 1)}%`, '#22C55E'),
    popupPercentRow('Perda corte', `${formatDecimal(totals?.perdaCorteRate || 0, 1)}%`, '#EF4444'),
    popupPercentRow('Cacho verde', `${formatDecimal(totals?.cachoVerdeRate || 0, 1)}%`, '#F59E0B'),
    popupPercentRow('Cacho passado', `${formatDecimal(totals?.cachoPassadoRate || 0, 1)}%`, '#F59E0B'),
    popupPercentRow('Avermelhado', `${formatDecimal(percentOf(totals?.cachoAvermelhado, totals?.cachosObservados), 1)}%`, '#EF4444'),
    popupPercentRow('Talo comprido', `${formatDecimal(totals?.taloCompridoRate || 0, 1)}%`, '#D98C10'),
    popupPercentRow('Nao carreado', `${formatDecimal(totals?.cachoNaoCarreadoRate || 0, 1)}%`, '#EF4444'),
  ].join('');

  return `
    <div class="parcel-popup-card">
      <div class="parcel-popup-head">
        <strong style="color:${style.color};">${escapeHtml(props.farmName || 'Fazenda')}</strong>
        <span>Parcela: <b>${escapeHtml(shapeParcel || '--')}</b> | Fonte: shapefile</span>
        <small>${formatInteger(parcelRecords.length)} coleta(s) | ${statusText} | Último dado: ${escapeHtml(latestDate)}</small>
      </div>
      <div class="parcel-popup-scroll">
        <div class="parcel-popup-executive" style="color:${selectedColor};">
          <strong style="color:${selectedColor};">${riskStatusLabel(selectedColor)}</strong>
          <span>${escapeHtml(metricExplanation(selectedMetric, selectedValue, selectedColor))}</span>
        </div>
        ${totals ? popupMetricChart(selectedMetric, selectedValue, selectedColor) : ''}
        <div class="parcel-popup-grid">${mainMetrics}</div>
        ${riskBlock}
        <div class="parcel-popup-section">O que aconteceu</div>
        ${popupCauseChart(totals)}
        <div class="parcel-popup-section">Composição dos cachos</div>
        ${popupBunchStack(totals)}
        <div class="parcel-popup-section">Fiscal responsável</div>
        <div class="parcel-popup-person-list">
          ${fiscalRows || '<div class="parcel-popup-empty">Sem fiscal responsável informado.</div>'}
        </div>
        <div class="parcel-popup-section">Coletas no período</div>
        <div class="parcel-popup-event-list">
          ${latestRows || '<div class="parcel-popup-empty">Sem coleta dentro dos filtros atuais.</div>'}
        </div>
        ${collaboratorCodes.length ? `
          <div class="parcel-popup-section">Matrículas de colaboradores</div>
          <div class="parcel-popup-chip-list">
            ${collaboratorCodes.map((code) => `<span>${escapeHtml(code)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="parcel-popup-section">Percentuais principais</div>
        <div class="parcel-popup-percent-list">${percentMetrics}</div>
      </div>
    </div>
  `;
}

export default function LeafletMap({ theme, farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter = 'all', sourceFilter = 'all', dateFrom, dateTo, presentationMode = false }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('heat');
  const [baseLayer, setBaseLayer] = useState('standard');
  const [riskMetricId, setRiskMetricId] = useState('perda_t_ha');
  const [parcelGeoJson, setParcelGeoJson] = useState(null);
  const { records } = useCqoData({
    sourceFilter,
    includeAttachments: false,
    includeForms: false,
    appLimit: sourceFilter === 'app' ? 500 : 1000,
  });
  const selectedRiskMetric = useMemo(() => activeRiskMetric(riskMetricId), [riskMetricId]);

  const filteredRecords = useMemo(() => filterRecords(records, {
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  }), [records, farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter, dateFrom, dateTo]);

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
      }))
  ), [filteredParcelFeatures, filteredRecords, heatByParcel, selectedRiskMetric]);

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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (mounted) setParcelGeoJson(geojson);
      })
      .catch(() => {
        if (mounted) setParcelGeoJson(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

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
          let weight = mapLayer === 'heat' ? 2 : 1.4;

          const shapeParcel = shapeParcelCode(props);
          const summary = parcelSummaryByKey.get(parcelHeatKey(props.farmId, shapeParcel));
          const parcelTotals = summary?.totals || null;

          if (mapLayer === 'heat') {
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

          if (mapLayer === 'polygon' && shapeParcel) {
            if (parcelTotals && summary) {
              fillColor = summary.color;
              fillOpacity = 0.5;
              weight = 2;
            } else {
              fillColor = '#CBD5E1'; // Neutral gray for un-evaluated parcels
              fillOpacity = 0.15;
              weight = 1;
            }
          }

          return {
            color: (mapLayer === 'heat' || mapLayer === 'polygon') && summary?.totals ? summary.color : style.color,
            fillColor,
            fillOpacity,
            weight,
            opacity: 0.9,
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const style = farmStyle(props.farmId);
          
          const shapeParcel = shapeParcelCode(props);
          const summary = parcelSummaryByKey.get(parcelHeatKey(props.farmId, shapeParcel));
          const parcelRecords = summary?.records || [];

          layer.bindPopup(parcelNumbersPopup({
            props,
            shapeParcel,
            style,
            parcelRecords,
            metric: selectedRiskMetric,
          }), {
            maxWidth: 460,
            minWidth: 380,
            autoPan: true,
            autoPanPaddingTopLeft: [24, 120],
            autoPanPaddingBottomRight: [380, 70],
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
          if (layer.getBounds) farmLayerBounds.push(layer.getBounds());
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
              <strong style="color: #234F2A; font-size: 14px;">${farm.name}</strong><br/>
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
          .bindTooltip(`${index + 1}. ${point.title}`, {
            direction: 'top',
            offset: [0, -12],
            opacity: 0.95,
            className: 'gps-marker-tooltip',
          })
          .bindPopup(`
            <div style="font-family: Inter, Segoe UI, sans-serif; max-width: 260px;">
              <strong style="color:${style.color};font-size:12px;">Ponto GPS ${index + 1}</strong><br/>
              <span style="font-size:11px;">Ocorrencia: <strong>${point.title}</strong></span><br/>
              <span style="font-size:11px;">Campo: <strong>${point.fieldId || '--'}</strong></span><br/>
              <span style="font-size:11px;">Linha: <strong>${point.line}</strong></span><br/>
              <span style="font-size:11px;">Fazenda: <strong>${point.record.farm}</strong></span><br/>
              <span style="font-size:11px;">Parcela: <strong>${point.record.parcel}</strong></span><br/>
              <span style="font-size:11px;">Quantidade: <strong>${point.quantity || 1}</strong></span><br/>
              <span style="font-size:11px;">GPS original: <strong>${point.label}</strong></span><br/>
              <span style="font-size:11px;">Status: <strong style="color:${markerColor(point.record, style.fill)};">${point.record.status}</strong></span>
            </div>
          `);
      });
    }

    geoRecords.forEach((record) => {
      if (record.gpsOccurrences?.length && mapLayer !== 'polygon') return;
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
        .bindTooltip(`${record.status} - ${record.gpsOccurrences?.length || record.gpsTrack?.length || 1} ponto(s) GPS`, {
          permanent: geoRecords.length <= 5 && !record.gpsOccurrences?.length,
          direction: 'top',
          offset: [0, -14],
          opacity: 0.95,
          className: 'gps-marker-tooltip',
        })
        .bindPopup(`
          <div style="font-family: Inter, Segoe UI, sans-serif; max-width: 240px;">
            <strong style="color:${style.color};font-size:12px;">Coleta #${record.id}</strong><br/>
            <span style="font-size:11px;">Formulario: <strong>${record.form}</strong></span><br/>
            <span style="font-size:11px;">Fazenda: <strong>${record.farm}</strong></span><br/>
            <span style="font-size:11px;">Parcela: <strong>${record.parcel}</strong></span><br/>
            <span style="font-size:11px;">Linhas avaliadas: <strong>${record.totals?.linhas || record.lines?.length || 0}</strong></span><br/>
            <span style="font-size:11px;">Ocorrencias GPS: <strong>${record.gpsOccurrences?.length || 0}</strong></span><br/>
            <span style="font-size:11px;">Pontos da trilha: <strong>${record.gpsTrack?.length || 1}</strong></span><br/>
            <span style="font-size:11px;">GPS: <strong>${markerPoint.label}</strong></span><br/>
            <span style="font-size:11px;">Status: <strong style="color:${pinColor};">${record.status}</strong></span>
          </div>
        `);
    });

    if (mapLayer === 'heat' && !parcelGeoJson?.features?.length) {
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
          .bindTooltip(`${point.title || 'Ocorrencia'} - linha ${point.line || '--'}`, {
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

      if (gpsLatLngs.length === 1) {
        map.setView(gpsLatLngs[0], 17, { animate: false });
      } else if (gpsLatLngs.length > 1) {
        const bounds = L.latLngBounds(gpsLatLngs);
        map.fitBounds(bounds.pad(0.18), { maxZoom: 17, animate: false });
      } else if (farmLayerBounds.length > 0) {
        const bounds = farmLayerBounds.reduce((acc, item) => acc.extend(item), L.latLngBounds([]));
        map.fitBounds(bounds.pad(0.08), { maxZoom: 14, animate: false });
      } else if (farmFilter !== 'all') {
        const selectedFarm = FARMS.find((farm) => farm.id === farmFilter);
        if (selectedFarm) {
          map.setView([selectedFarm.Lat, selectedFarm.Lng], 14, { animate: false });
        }
      }
    };

    const frame = window.requestAnimationFrame(() => {
      map.whenReady(() => {
        applyViewport();
        window.setTimeout(applyViewport, 120);
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [theme, farmFilter, areaFilter, mapLayer, baseLayer, selectedRiskMetric, geoRecords, trackPoints, occurrencePoints, allGpsPoints, heatPoints, heatByParcel, parcelGeoJson, filteredParcelFeatures, parcelSummaryByKey]);

  return (
    <div className={`card gps-map-card ${presentationMode ? 'gps-map-card-presentation' : ''}`}>
      <div ref={mapContainerRef} className="gps-map-canvas" />

      <div className="map-overlay-card gps-map-overlay">
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
            onClick={() => setMapLayer('heat')}
            className={`btn ${mapLayer === 'heat' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Flame size={14} />
            <span>Risco por parcela</span>
          </button>
          <button
            onClick={() => setMapLayer('route')}
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
              {RISK_METRICS.map((metric) => (
                <option key={metric.id} value={metric.id}>{metric.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="gps-map-stats">
          <div className="gps-map-stats-total">
            {geoStats.total} coletas / {geoStats.sampledParcels} parcelas avaliadas
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
          {mapLayer === 'heat' ? (
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
                          item.openPopup();
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
              {mapLayer === 'heat' && `${selectedRiskMetric.label} aplicado na parcela completa com base na amostragem filtrada.`}
              {mapLayer === 'route' && 'GPS detalhado mostra as coordenadas reais numeradas dentro da parcela.'}
              {mapLayer === 'polygon' && `${selectedRiskMetric.label} em semaforo por parcela, respeitando os filtros atuais.`}
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
      </div>
    </div>
  );
}
