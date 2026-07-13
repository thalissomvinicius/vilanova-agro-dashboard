import React from 'react';

export default function PresentationDataFilters({
  sourceFilter = 'all',
  setSourceFilter,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  ariaLabel = 'Filtros da apresentação',
}) {
  return (
    <div className="field-bi-presentation-filters" aria-label={ariaLabel}>
      <label>
        <span>Fonte</span>
        <select
          value={sourceFilter || 'all'}
          onChange={(event) => setSourceFilter?.(event.target.value)}
          disabled={!setSourceFilter}
        >
          <option value="all">App + Excel</option>
          <option value="app">Só App</option>
          <option value="excel">Só Excel</option>
        </select>
      </label>
      <label>
        <span>Data inicial</span>
        <input
          type="date"
          value={dateFrom || ''}
          max={dateTo || undefined}
          onChange={(event) => setDateFrom?.(event.target.value)}
          disabled={!setDateFrom}
        />
      </label>
      <label>
        <span>Data final</span>
        <input
          type="date"
          value={dateTo || ''}
          min={dateFrom || undefined}
          onChange={(event) => setDateTo?.(event.target.value)}
          disabled={!setDateTo}
        />
      </label>
    </div>
  );
}
