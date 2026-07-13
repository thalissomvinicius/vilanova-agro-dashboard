import React from 'react';

export default function SegmentedTabs({ activeId, className = '', onChange, tabs }) {
  return (
    <div className={`segmented-tabs ${className}`.trim()} role="tablist">
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        const tone = tab.tone === 'orange' ? 'orange' : 'green';

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-tab segmented-tab-${tone} ${active ? 'active' : ''}`.trim()}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
