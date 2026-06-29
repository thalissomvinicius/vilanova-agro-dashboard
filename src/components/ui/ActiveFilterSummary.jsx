import React from 'react';
import { Filter, X } from 'lucide-react';
import { buildActiveFilterItems, buildActiveFilterSummary } from '../../utils/filterSummary';

export default function ActiveFilterSummary({ filters = {}, onClearFilter }) {
  const items = buildActiveFilterItems(filters);
  const summary = buildActiveFilterSummary(filters);

  return (
    <span className="active-filter-summary" title={`Filtros ativos: ${summary}`}>
      <Filter size={14} />
      <b>Filtros:</b>
      {items.length ? (
        <span className="active-filter-chip-list">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className="active-filter-chip"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClearFilter?.(item.id);
              }}
              title={`Remover filtro ${item.label}: ${item.value}`}
            >
              <span>{item.label}: {item.value}</span>
              <X size={11} />
            </button>
          ))}
        </span>
      ) : (
        <em>Todos</em>
      )}
    </span>
  );
}
