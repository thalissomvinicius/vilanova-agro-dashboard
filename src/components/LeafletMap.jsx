import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Flame, Layers, Map, Route, Satellite } from 'lucide-react';
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
    return (
      (record.gps && Number.isFinite(record.gps.lat) && Number.isFinite(record.gps.lng))
      || record.gpsTrack?.some((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      || record.gpsOccurrences?.some((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    );
  }), [filteredRecords]);

  const trackPoints = useMemo(() => geoRecords.flatMap((record) => {
    const points = record.gpsTrack?.length ? record.gpsTrack : [record.gps];
    return points
      .filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) > 0.1 && Math.abs(point.lng) > 0.1)
      .map((point, index) => ({
        ...point,
        index,
        record,
        weight: recordWeight(record),
      }));
  }), [geoRecords]);

  const occurrencePoints = useMemo(() => geoRecords.flatMap((record) => (
    (record.gpsOccurrences?.length ? record.gpsOccurrences : [])
      .filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) > 0.1 && Math.abs(point.lng) > 0.1)
      .map((point, index) => ({
        ...point,
        index,
        record,
        weight: Math.max(1, Number(point.quantity || 1)),
      }))
  )), [geoRecords]);

  const filteredParcelFeatures = useMemo(() => (
    parcelGeoJson?.features?.filter((feature) => (
      farmFilter === 'all' || feature.properties?.farmId === farmFilter
    )) || []
  ), [parcelGeoJson, farmFilter]);

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
      byFarm,
      lineCount: geoRecords.reduce((sum, record) => sum + Number(record?.totals?.linhas || record?.lines?.length || 0), 0),
    };
  }, [geoRecords, trackPoints, occurrencePoints]);

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

          let shapeParcel = props.ID_PARCELA || props.IDE || props.ide || props.parcela || props.parcelId || '';
          if (shapeParcel && props.farmId && shapeParcel.startsWith(props.farmId + '-')) {
            shapeParcel = shapeParcel.replace(props.farmId + '-', '');
          }

          if (mapLayer === 'polygon' && shapeParcel) {
            const parcelRecords = filteredRecords.filter((r) => 
               String(r.parcel).toLowerCase() === String(shapeParcel).toLowerCase() &&
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
            color: style.color,
            fillColor,
            fillOpacity,
            weight,
            opacity: 0.9,
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const style = farmStyle(props.farmId);
          
          let shapeParcel = props.ID_PARCELA || props.IDE || props.ide || props.parcela || props.parcelId || '';
          if (shapeParcel && props.farmId && shapeParcel.startsWith(props.farmId + '-')) {
            shapeParcel = shapeParcel.replace(props.farmId + '-', '');
          }
          
          let scoreText = '';
          if (mapLayer === 'polygon' && shapeParcel) {
            const parcelRecords = filteredRecords.filter((r) => 
               String(r.parcel).toLowerCase() === String(shapeParcel).toLowerCase() &&
               r.farmId === props.farmId
            );
            if (parcelRecords.length > 0) {
              const totals = aggregateRecords(parcelRecords);
              scoreText = `<span style="font-size:11px;">Nota CQO: <strong style="color:${getScoreColor(totals.generalScore)}">${totals.generalScore}</strong></span><br/>`;
            }
          }

          layer.bindPopup(`
            <div style="font-family: Inter, Segoe UI, sans-serif; max-width: 220px;">
              <strong style="color:${style.color};font-size:13px;">${props.farmName || 'Fazenda'}</strong><br/>
              <span style="font-size:11px;">Parcela: <strong>${shapeParcel || '--'}</strong></span><br/>
              ${scoreText}
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

    geoRecords.forEach((record) => {
      const style = farmStyle(record.farmId);
      const markerPoint = record.gps || record.gpsTrack?.[0];
      if (!markerPoint) return;
      const pinIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${style.fill};width:14px;height:14px;transform:rotate(45deg);border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([markerPoint.lat, markerPoint.lng], { icon: pinIcon })
        .addTo(layers)
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
            <span style="font-size:11px;">Status: <strong>${record.status}</strong></span>
          </div>
        `);
    });

    if (mapLayer === 'heat') {
      heatPoints.forEach((point) => {
        const style = farmStyle(point.record.farmId);
        const radius = 22 + point.heatWeight * 34;
        L.circle([point.lat, point.lng], {
          radius,
          color: style.color,
          fillColor: style.fill,
          fillOpacity: Math.min(0.46, 0.16 + point.heatWeight * 0.13),
          weight: 0.7,
          opacity: 0.35,
        }).addTo(layers);
      });
    }

    if (mapLayer === 'route') {
      geoRecords.forEach((record) => {
        const routePoints = (record.gpsTrack || [])
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
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
          .map((record) => record.gps || record.gpsTrack?.[0])
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

    if (trackPoints.length > 0) {
      const bounds = L.latLngBounds(trackPoints.map((point) => [point.lat, point.lng]));
      map.fitBounds(bounds.pad(0.18), { maxZoom: 16, animate: true });
    } else if (farmLayerBounds.length > 0) {
      const bounds = farmLayerBounds.reduce((acc, item) => acc.extend(item), L.latLngBounds([]));
      map.fitBounds(bounds.pad(0.08), { maxZoom: 14, animate: true });
    } else if (farmFilter !== 'all') {
      const selectedFarm = FARMS.find((farm) => farm.id === farmFilter);
      if (selectedFarm) {
        map.panTo([selectedFarm.Lat, selectedFarm.Lng]);
      }
    }
  }, [theme, farmFilter, areaFilter, mapLayer, baseLayer, geoRecords, trackPoints, heatPoints, parcelGeoJson, filteredParcelFeatures, filteredRecords]);

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
            <Map size={13} />
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
            <span>Focos de Perda (Calor)</span>
          </button>
          <button
            onClick={() => setMapLayer('route')}
            className={`btn ${mapLayer === 'route' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Route size={14} />
            <span>Rotas e trilhas GPS</span>
          </button>
        </div>

        <div className="gps-map-stats">
          <div className="gps-map-stats-total">
            {geoStats.occurrencePoints} ocorrencias / {geoStats.gpsPoints} pontos GPS / {geoStats.total} coletas
          </div>
          {Object.entries(FARM_STYLES).filter(([id]) => id !== 'default').map(([id, style]) => (
            <div key={id}>
              <span style={{ backgroundColor: style.fill }} />
              <span>{style.label}: {geoStats.byFarm[id] || 0}</span>
            </div>
          ))}
          <div className="gps-map-note">
            <span>{occurrencePoints.length ? 'Calor por ocorrencia georreferenciada' : 'Calor estimado pela trilha'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
