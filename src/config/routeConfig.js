import {
  FileSpreadsheet,
  Gauge,
  Lightbulb,
  LayoutDashboard,
  Map,
  RefreshCw,
  Scale,
  Settings,
  Tractor,
  Truck,
  Users,
} from 'lucide-react';

export const DEFAULT_PAGE_ID = 'dashboard';

export const ROUTE_DEFINITIONS = [
  {
    id: 'dashboard',
    path: '/campo',
    label: 'Corte (Campo)',
    icon: LayoutDashboard,
    navGroup: 'campo',
    filterPreset: 'field',
  },
  {
    id: 'cqo-carreamento',
    path: '/carreamento',
    label: 'Carreamento',
    icon: Truck,
    navGroup: 'campo',
    filterPreset: 'field',
  },
  {
    id: 'perdas-agricola',
    path: '/perdas',
    label: 'Perdas Agrícola',
    icon: Scale,
    navGroup: 'campo',
    filterPreset: 'field',
  },
  {
    id: 'cqo-rampa',
    path: '/rampa',
    label: 'CQO Rampa',
    icon: Gauge,
    navGroup: 'main',
    filterPreset: 'rampa',
  },
  {
    id: 'coletas',
    path: '/coletas',
    label: 'Coletas recebidas',
    icon: Tractor,
    navGroup: 'main',
    filterPreset: 'field',
  },
  {
    id: 'inventario',
    path: '/inventario',
    label: 'Inventário parcelas',
    icon: FileSpreadsheet,
    navGroup: 'main',
    filterPreset: 'inventory',
  },
  {
    id: 'mapa',
    path: '/mapa',
    label: 'Mapa GPS',
    icon: Map,
    navGroup: 'main',
    filterPreset: 'field',
  },
  {
    id: 'desenvolvimento',
    path: '/desenvolvimento',
    label: 'Desenvolvimento',
    icon: Lightbulb,
    navGroup: 'main',
    filterPreset: 'none',
    adminOnly: true,
    developmentOnly: true,
  },
  {
    id: 'sync',
    path: '/sincronizacoes',
    label: 'Sincronizações',
    icon: RefreshCw,
    navGroup: 'main',
    filterPreset: 'none',
  },
  {
    id: 'colaboradores',
    path: '/colaboradores',
    label: 'Colaboradores',
    icon: Users,
    navGroup: 'main',
    filterPreset: 'none',
    permission: 'manage_collaborators',
  },
  {
    id: 'config',
    path: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    navGroup: 'main',
    filterPreset: 'none',
  },
];

export const SIDEBAR_GROUPS = [
  {
    id: 'campo',
    label: 'CQO Campo',
    icon: LayoutDashboard,
    itemIds: ['dashboard', 'cqo-carreamento', 'perdas-agricola'],
  },
  {
    id: 'main',
    itemIds: [
      'cqo-rampa',
      'coletas',
      'inventario',
      'mapa',
      'desenvolvimento',
      'sync',
      'colaboradores',
      'config',
    ],
  },
];

export const FILTER_PRESETS = {
  none: [],
  field: ['search', 'farm', 'cycle', 'evaluator', 'source', 'year', 'month', 'dateRange'],
  rampa: ['farm', 'source', 'year', 'month', 'dateRange'],
  inventory: ['search', 'farm'],
};

export const ROUTES_BY_ID = Object.fromEntries(
  ROUTE_DEFINITIONS.map((route) => [route.id, route])
);

export const PAGE_ROUTES = Object.fromEntries(
  ROUTE_DEFINITIONS.map((route) => [route.id, route.path])
);

export const ROUTE_PAGES = Object.fromEntries(
  ROUTE_DEFINITIONS.map((route) => [route.path, route.id])
);

export function getRouteById(routeId) {
  return ROUTES_BY_ID[routeId] || ROUTES_BY_ID[DEFAULT_PAGE_ID];
}

export function getRouteFilterIds(routeId) {
  const route = getRouteById(routeId);
  return FILTER_PRESETS[route.filterPreset] || FILTER_PRESETS.none;
}
