import { useEffect, useState } from 'react';

let farmParcelsGeoJson = null;
let farmParcelsPromise = null;

export function loadFarmParcelsGeoJson() {
  if (farmParcelsGeoJson) return Promise.resolve(farmParcelsGeoJson);
  if (farmParcelsPromise) return farmParcelsPromise;

  farmParcelsPromise = fetch('/data/farm-parcels.geojson', { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('Mapa de parcelas indisponivel.');
      return response.json();
    })
    .then((geojson) => {
      farmParcelsGeoJson = geojson;
      return geojson;
    })
    .catch((error) => {
      farmParcelsPromise = null;
      throw error;
    });

  return farmParcelsPromise;
}

export function useFarmParcelsGeoJson() {
  const [state, setState] = useState(() => ({
    data: farmParcelsGeoJson,
    status: farmParcelsGeoJson ? 'ready' : 'loading',
  }));

  useEffect(() => {
    let mounted = true;
    let readyTimer;

    if (farmParcelsGeoJson) {
      readyTimer = window.setTimeout(() => {
        if (mounted) setState({ data: farmParcelsGeoJson, status: 'ready' });
      }, 0);
      return () => {
        mounted = false;
        if (readyTimer) window.clearTimeout(readyTimer);
      };
    }

    loadFarmParcelsGeoJson()
      .then((geojson) => {
        if (mounted) setState({ data: geojson, status: 'ready' });
      })
      .catch(() => {
        if (mounted) setState({ data: null, status: 'fallback' });
      });

    return () => {
      mounted = false;
      if (readyTimer) window.clearTimeout(readyTimer);
    };
  }, []);

  return state;
}
