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

function heatRiskColor(score) {
  if (score >= 30) return '#EF4444';
  if (score >= 14) return '#F59E0B';
  return '#D98C10';
}

function heatRiskLabel(score) {
  if (score >= 30) return 'Alta incidência estimada';
  if (score >= 14) return 'Incidência moderada estimada';
  return 'Incidência baixa estimada';
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

export default function LeafletMap({ theme, farmFilter, areaFilter, periodFilter, cycleFilter, dateFrom, dateTo }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('polygon');
  const [baseLayer, setBaseLayer] = useState('standard');
  const [parcelGeoJson, setParcelGeoJson] = useState(null);
  const { records } = useCqoData();

  const filteredRecords = useMemo(() => filterRecords(records, {
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    dateFrom,
    dateTo,
  }), [records, farmFilter, areaFilter, periodFilter, cycleFilter, dateFrom, dateTo]);

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
    const byFarm = geoRecords.reduce((acc, record) => {
      const key = record.farmId || 'default';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      total: geoRecords.length,
      gpsPoints: trackPoints.length,
      occurrencePoints: occurrencePoints.length,
      sampledLines: new Set(occurrencePoints.map((point) => `${point.record.id}|${point.line}`)).size,
      sampledParcels: new Set(geoRecords.map((record) => `${record.farmId}|${record.parcel}`)).size,
      uniqueGpsPoints: allGpsPoints.length,
      byFarm,
      lineCount: geoRecords.reduce((sum, record) => sum + Number(record?.totals?.linhas || record?.lines?.length || 0), 0),
    };
  }, [geoRecords, trackPoints, occurrencePoints, allGpsPoints]);

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
          const heatSummary = heatByParcel.get(parcelHeatKey(props.farmId, shapeParcel));

          if (mapLayer === 'heat') {
            if (heatSummary) {
              fillColor = heatRiskColor(heatSummary.score);
              fillOpacity = 0.56;
              weight = 2.8;
            } else {
              fillColor = '#CBD5E1';
              fillOpacity = 0.08;
              weight = 1;
            }
          }

          if (mapLayer === 'polygon' && shapeParcel) {
            const parcelRecords = filteredRecords.filter((r) =>
               reviewState(r) === 'approved' &&
               normalizeParcelCode(r.parcel) === normalizeParcelCode(shapeParcel) &&
               r.farmId === props.farmId
            );
            if (parcelRecords.length > 0) {
              const totals = aggregateRecords(parcelRecords);
              fillColor = getScoreColor(totals.generalScore);
              fillOpacity = 0.55;
              weight = 2;
            } else {
              fillColor = '#CBD5E1'; // Neutral gray for un-evaluated parcels
              fillOpacity = 0.15;
              weight = 1;
            }
          }

          return {
            color: mapLayer === 'heat' && heatSummary ? heatRiskColor(heatSummary.score) : style.color,
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
          const heatSummary = heatByParcel.get(parcelHeatKey(props.farmId, shapeParcel));
          
          let scoreText = '';
          if (mapLayer === 'polygon' && shapeParcel) {
            const parcelRecords = filteredRecords.filter((r) =>
               reviewState(r) === 'approved' &&
               normalizeParcelCode(r.parcel) === normalizeParcelCode(shapeParcel) &&
               r.farmId === props.farmId
            );
            if (parcelRecords.length > 0) {
              const totals = aggregateRecords(parcelRecords);
              scoreText = `<span style="font-size:11px;">Nota CQO: <strong style="color:${getScoreColor(totals.generalScore)}">${totals.generalScore}</strong></span><br/>`;
            }
          }

          const heatText = mapLayer === 'heat' && heatSummary
            ? `
              <span style="font-size:11px;">Mapa de calor: <strong style="color:${heatRiskColor(heatSummary.score)}">${heatRiskLabel(heatSummary.score)}</strong></span><br/>
              <span style="font-size:11px;">Amostragem: <strong>${heatSummary.points} pontos / ${heatSummary.lines.size} rua(s)</strong></span><br/>
              <span style="font-size:11px;">Aplicação: <strong>parcela completa por estimativa</strong></span><br/>
            `
            : '';

          layer.bindPopup(`
            <div style="font-family: Inter, Segoe UI, sans-serif; max-width: 220px;">
              <strong style="color:${style.color};font-size:13px;">${props.farmName || 'Fazenda'}</strong><br/>
              <span style="font-size:11px;">Parcela: <strong>${shapeParcel || '--'}</strong></span><br/>
              ${scoreText}
              ${heatText}
              <span style="font-size:11px;">Fonte: shapefile</span>
            </div>
          `);
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
          permanent: geoRecords.length <= 5,
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

    if (mapLayer === 'heat') {
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
  }, [theme, farmFilter, areaFilter, mapLayer, baseLayer, geoRecords, trackPoints, occurrencePoints, allGpsPoints, heatPoints, heatByParcel, parcelGeoJson, filteredParcelFeatures, filteredRecords]);

  return (
    <div className="card gps-map-card">
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
            <span>Mapa de Calor</span>
          </button>
          <button
            onClick={() => setMapLayer('route')}
            className={`btn ${mapLayer === 'route' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Route size={14} />
            <span>GPS detalhado</span>
          </button>
        </div>

        <div className="gps-map-stats">
          <div className="gps-map-stats-total">
            {geoStats.total} coletas / {geoStats.sampledParcels} parcelas
          </div>
          <div className="gps-sample-grid">
            <div>
              <strong>{geoStats.sampledLines}</strong>
              <span>ruas amostradas</span>
            </div>
            <div>
              <strong>{geoStats.occurrencePoints}</strong>
              <span>pontos reais</span>
            </div>
            <div>
              <strong>{geoStats.uniqueGpsPoints}</strong>
              <span>coord. unicas</span>
            </div>
            <div>
              <strong>{geoStats.gpsPoints}</strong>
              <span>trilha GPS</span>
            </div>
          </div>
          {Object.entries(FARM_STYLES).filter(([id]) => id !== 'default').map(([id, style]) => (
            <div key={id}>
              <span style={{ backgroundColor: style.fill }} />
              <span>{style.label}: {geoStats.byFarm[id] || 0}</span>
            </div>
          ))}
          <div className="gps-map-note">
            <span>
              {mapLayer === 'heat' && 'Calor aplicado na parcela completa com base nas ruas amostradas.'}
              {mapLayer === 'route' && 'GPS detalhado mostra as coordenadas reais numeradas dentro da parcela.'}
              {mapLayer === 'polygon' && 'Semaforo por parcela; use o calor para ver tendencia espacial da amostra.'}
            </span>
          </div>
          <div className="gps-heat-legend" aria-label="Legenda do mapa CQO">
            <div>
              <span className="gps-legend-dot gps-legend-dot-real" />
              <strong>GPS real</strong>
            </div>
            <div>
              <span className="gps-legend-heat" />
              <strong>estimativa por calor</strong>
            </div>
            <div>
              <span className="gps-legend-line" />
              <strong>rua/trilha amostrada</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
