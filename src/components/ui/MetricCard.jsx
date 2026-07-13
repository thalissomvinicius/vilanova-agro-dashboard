import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

export default function MetricCard({
  title,
  label,
  value,
  subtitle,
  footer,
  icon: Icon,
  tone = 'green',
  loading = false,
  trend = null,
  variant = 'metric',
}) {
  const displayTitle = title || label;
  const skeletonValue = loading ? '\u00A0' : value;
  const iconClassName = `kpi-icon-wrapper kpi-icon-${tone}`;

  if (variant === 'kpi') {
    return (
      <div className="card kpi-card">
        <div className="kpi-card-header">
          <span className="kpi-title">{displayTitle}</span>
          {Icon ? (
            <div className={iconClassName}>
              <Icon size={18} />
            </div>
          ) : null}
        </div>
        <div className="kpi-body">
          <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
            {skeletonValue}
          </span>
          {trend !== null && !loading ? (
            <span className={`kpi-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          ) : null}
        </div>
        {footer ? (
          <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
            {loading ? '\u00A0' : footer}
          </span>
        ) : null}
      </div>
    );
  }

  if (variant === 'collaborator') {
    return (
      <div className="card collaborator-metric">
        {Icon ? (
          <div className={iconClassName}>
            <Icon size={19} />
          </div>
        ) : null}
        <div>
          <span>{displayTitle}</span>
          <strong className={loading ? 'skeleton-text' : ''}>{skeletonValue}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="card metric-card">
      {Icon ? (
        <div className={iconClassName}>
          <Icon size={20} />
        </div>
      ) : null}
      <div>
        <span className="metric-label">{displayTitle}</span>
        <strong className={`metric-value ${loading ? 'skeleton-text' : ''}`}>{skeletonValue}</strong>
        {subtitle ? (
          <span className={`metric-subtitle ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
            {loading ? '\u00A0' : subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
