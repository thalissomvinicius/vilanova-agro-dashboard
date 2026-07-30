import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useFarmParcelsGeoJson } from '../utils/geoData';
import { normalizeBunchWeightParcel } from '../utils/bunchWeightData';

const MAP_COLORS = {
  below: '#D97706',
  central: '#15803D',
  above: '#2563EB',
  empty: '#CBD5E1',
  outline: '#64748B',
  selected: '#0F172A',
};

function shapeParcelCode(properties = {}) {
  return properties.ID_PARCELA
    || properties.IDE
    || properties.ide
    || properties.parcela
    || properties.parcelId
    || '';
}

function parcelKey(farmId, parcel) {
  return `${farmId || 'default'}|${normalizeBunchWeightParcel(parcel)}`;
}

function weightBand(averageKg, referenceKg) {
  if (!(averageKg > 0) || !(referenceKg > 0)) return 'empty';
  if (averageKg < referenceKg * 0.9) return 'below';
  if (averageKg > referenceKg * 1.1) return 'above';
  return 'central';
}

function formatKg(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parcelTooltip(properties, row, referenceKg) {
  const farm = properties.farmName || properties.FAZENDA || properties.farmId || 'Fazenda';
  const parcel = shapeParcelCode(properties) || '--';
  if (!row?.weightCount) {
    return `
      <strong>${escapeHtml(farm)} / ${escapeHtml(parcel)}</strong>
      <span>Sem pesagem de cacho maduro no filtro.</span>
    `;
  }

  const delta = referenceKg > 0 ? ((row.averageKg / referenceKg) - 1) * 100 : 0;
  const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
  return `
    <strong>${escapeHtml(row.farm)} / ${escapeHtml(row.parcel)}</strong>
    <span>Média: ${escapeHtml(formatKg(row.averageKg))}</span>
    <span>${row.weightCount.toLocaleString('pt-BR')} cacho(s) pesado(s) · ${row.collectionCount.toLocaleString('pt-BR')} coleta(s)</span>
    <span>${escapeHtml(deltaLabel)} em relação à média do filtro</span>
  `;
}

export default function BunchWeightMap({
  theme = 'light',
  farmFilter = 'all',
  parcelRows = [],
  referenceAverageKg = 0,
  selectedParcelKey = '',
  onParcelSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const { data: geoJson, status } = useFarmParcelsGeoJson();

  const parcelRowsByKey = useMemo(() => {
    const rows = new Map();
    parcelRows.forEach((row) => {
      rows.set(parcelKey(row.farmId, row.parcel), row);
    });
    return rows;
  }, [parcelRows]);

  const filteredFeatures = useMemo(() => (
    (geoJson?.features || []).filter((feature) => (
      farmFilter === 'all' || feature.properties?.farmId === farmFilter
    ))
  ), [farmFilter, geoJson]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: [-2.39, -48.15],
      zoom: 12,
      zoomControl: false,
      preferCanvas: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    dataLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => map.invalidateSize(false));
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      dataLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tileUrl = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = dataLayerRef.current;
    if (!map || !layerGroup || status === 'loading') return undefined;

    setRendering(true);
    const timer = window.setTimeout(() => {
      layerGroup.clearLayers();
      if (!filteredFeatures.length) {
        setRendering(false);
        return;
      }

      const featureCollection = {
        type: 'FeatureCollection',
        features: filteredFeatures,
      };
      const evaluatedBounds = [];
      let selectedBounds = null;

      const geoLayer = L.geoJSON(featureCollection, {
        style: (feature) => {
          const properties = feature?.properties || {};
          const key = parcelKey(properties.farmId, shapeParcelCode(properties));
          const row = parcelRowsByKey.get(key);
          const band = weightBand(row?.averageKg, referenceAverageKg);
          const selected = selectedParcelKey === key;
          return {
            color: selected ? MAP_COLORS.selected : (band === 'empty' ? MAP_COLORS.outline : MAP_COLORS[band]),
            fillColor: MAP_COLORS[band],
            fillOpacity: band === 'empty' ? 0.08 : 0.62,
            opacity: 0.95,
            weight: selected ? 4 : (band === 'empty' ? 1.2 : 2.2),
          };
        },
        onEachFeature: (feature, layer) => {
          const properties = feature?.properties || {};
          const shapeParcel = shapeParcelCode(properties);
          const key = parcelKey(properties.farmId, shapeParcel);
          const row = parcelRowsByKey.get(key);
          const selected = selectedParcelKey === key;

          layer.bindTooltip(parcelTooltip(properties, row, referenceAverageKg), {
            sticky: true,
            className: 'bunch-weight-map-tooltip',
          });
          layer.on('click', () => onParcelSelect?.(selected ? null : {
            key,
            farmId: properties.farmId,
            farm: row?.farm || properties.farmName || properties.FAZENDA || properties.farmId,
            parcel: row?.parcel || shapeParcel,
          }));
          layer.on('mouseover', () => layer.setStyle({ weight: selected ? 4.5 : 3.2, opacity: 1 }));
          layer.on('mouseout', () => geoLayer.resetStyle(layer));

          if (row?.weightCount && layer.getBounds) evaluatedBounds.push(layer.getBounds());
          if (selected && layer.getBounds) selectedBounds = layer.getBounds();
        },
      }).addTo(layerGroup);

      const visibleBounds = selectedBounds
        || (evaluatedBounds.length
          ? evaluatedBounds.reduce((bounds, next) => bounds.extend(next), evaluatedBounds[0])
          : geoLayer.getBounds());

      window.requestAnimationFrame(() => {
        map.invalidateSize(false);
        if (visibleBounds?.isValid()) {
          map.fitBounds(visibleBounds.pad(selectedBounds ? 0.35 : 0.12), {
            animate: false,
            maxZoom: selectedBounds ? 16 : (farmFilter === 'all' ? 13 : 15),
            padding: [18, 18],
          });
        }
        setRendering(false);
      });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [
    farmFilter,
    filteredFeatures,
    onParcelSelect,
    parcelRowsByKey,
    referenceAverageKg,
    selectedParcelKey,
    status,
  ]);

  return (
    <div className="bunch-weight-map-shell">
      <div ref={containerRef} className="bunch-weight-map-canvas" aria-label="Mapa de peso médio por parcela" />
      {(status === 'loading' || rendering) && (
        <div className="bunch-weight-map-loading" role="status">
          <span className="spinner-modern" />
          <strong>Preparando shapes de pesagem</strong>
        </div>
      )}
      {status === 'fallback' && (
        <div className="bunch-weight-map-empty">Shapes indisponíveis neste momento.</div>
      )}
    </div>
  );
}
