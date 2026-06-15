import React, { useState } from 'react';

function getSkipLabel(idx, total) {
  if (total <= 8) return false;
  const count = Math.min(6, total);
  const indices = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.round((i * (total - 1)) / (count - 1)));
  }
  return !indices.includes(idx);
}

export default function CustomChart({ type = 'line', data = [], height = 280, title, loading = false, targetValue = null, targetLabel = 'Meta' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (loading) {
    return (
      <div className="card" style={{ height: 'auto' }}>
        <div className="card-header" style={{ marginBottom: '10px' }}>
          <h3 className="card-title" style={{ fontSize: '0.925rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
            <span className="skeleton-text" style={{ minWidth: '150px', height: '18px' }}>&nbsp;</span>
          </h3>
        </div>
        <div style={{ position: 'relative', height }}>
          <div className="skeleton-chart" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height: 'auto' }}>
        <div className="card-header" style={{ marginBottom: '10px' }}>
          <h3 className="card-title" style={{ fontSize: '0.925rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
            {title}
          </h3>
        </div>
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Nenhum dado disponivel
        </div>
      </div>
    );
  }

  // Dimension helpers
  const width = 500;
  const padding = { top: 30, right: 30, bottom: 52, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Chart type 1: BAR CHART
  const renderBarChart = () => {
    const maxVal = Math.max(...data.map(d => d.value), 10);
    const barWidth = Math.max(15, (graphWidth / data.length) - 20);
    const stepX = graphWidth / data.length;
    const shouldRotate = data.length > 4;

    return (
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orange-highlight)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--orange-institutional)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="greenBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green-institutional)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--green-dark)" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + graphHeight * (1 - ratio);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className="chart-grid-line"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="chart-axis-text"
              >
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const valRatio = item.value / maxVal;
          const barHeight = graphHeight * valRatio;
          const x = padding.left + (idx * stepX) + (stepX - barWidth) / 2;
          const y = padding.top + graphHeight - barHeight;

          const isHovered = hoveredIdx === idx;
          const fillGrad = item.fill === '#234F2A' ? 'url(#greenBarGrad)' : 'url(#barGrad)';

          return (
            <g
              key={idx}
              onMouseEnter={() => {
                setHoveredIdx(idx);
                setTooltipPos({ x: x + barWidth / 2, y: y - 10 });
              }}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Bar Rect */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                fill={isHovered ? 'var(--orange-highlight)' : (item.fill || fillGrad)}
                rx="4"
                className="chart-bar"
              />
              {/* Label */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 14}
                textAnchor={shouldRotate ? 'end' : 'middle'}
                transform={shouldRotate ? `rotate(-25, ${x + barWidth / 2}, ${height - padding.bottom + 14})` : undefined}
                className="chart-axis-text"
                style={{ fontSize: shouldRotate ? '8px' : '9px' }}
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Hover Tooltip Overlay (SVG internal for safety) */}
        {hoveredIdx !== null && (
          <g>
            <rect
              x={tooltipPos.x - 55}
              y={tooltipPos.y - 25}
              width="110"
              height="20"
              rx="4"
              fill="var(--gray-dark)"
              opacity="0.95"
            />
            <text
              x={tooltipPos.x}
              y={tooltipPos.y - 11}
              fill="#FFFFFF"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
            >
              {data[hoveredIdx].label}: {data[hoveredIdx].value}
            </text>
          </g>
        )}

        {/* Target Line */}
        {targetValue !== null && (
          <g>
            <line
              x1={padding.left}
              y1={padding.top + graphHeight - (targetValue / maxVal) * graphHeight}
              x2={width - padding.right}
              y2={padding.top + graphHeight - (targetValue / maxVal) * graphHeight}
              stroke="var(--status-danger)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padding.right - 5}
              y={padding.top + graphHeight - (targetValue / maxVal) * graphHeight - 5}
              textAnchor="end"
              fill="var(--status-danger)"
              fontSize="9"
              fontWeight="bold"
            >
              {targetLabel}: {targetValue}
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Chart type 2: LINE / AREA CHART
  const renderLineChart = () => {
    // Guard: single data point — render a single dot centered
    if (data.length <= 1) {
      const item = data[0] || { label: '—', value: 0 };
      return (
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
          <circle cx={width / 2} cy={height / 2} r="6" fill="var(--orange-institutional)" />
          <text x={width / 2} y={height / 2 + 20} textAnchor="middle" className="chart-axis-text">
            {item.label}: {item.value}
          </text>
        </svg>
      );
    }

    const maxVal = Math.max(...data.map(d => d.value), 10);
    const stepX = graphWidth / (data.length - 1);

    // Build path points
    const points = data.map((item, idx) => {
      const x = padding.left + idx * stepX;
      const y = padding.top + graphHeight - (item.value / maxVal) * graphHeight;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`
      : '';

    return (
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orange-institutional)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--orange-institutional)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--orange-highlight)" />
            <stop offset="100%" stopColor="var(--orange-institutional)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + graphHeight * (1 - ratio);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className="chart-grid-line"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="chart-axis-text"
              >
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        {/* Shaded Area */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line Path */}
        <path
          d={linePath}
          stroke="url(#lineGrad)"
          className="chart-line"
          style={{ filter: 'drop-shadow(0px 2px 4px rgba(217,140,16,0.18))' }}
        />

        {/* Interactive Dots and Hover Bars */}
        {points.map((p, idx) => (
          <g key={idx}>
            {/* Invisible vertical detector bar */}
            <rect
              x={p.x - stepX / 2}
              y={padding.top}
              width={stepX}
              height={graphHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredIdx(idx);
                setTooltipPos({ x: p.x, y: p.y - 12 });
              }}
              onMouseLeave={() => setHoveredIdx(null)}
            />

            {/* Visual Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === idx ? 6 : 4}
              fill={hoveredIdx === idx ? 'var(--orange-highlight)' : 'var(--orange-institutional)'}
              stroke="var(--bg-card)"
              strokeWidth="2"
              className="chart-dot"
            />

            {/* Label */}
            {!getSkipLabel(idx, points.length) && (
              <text
                x={p.x}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                className="chart-axis-text"
                style={{ fontSize: '9px' }}
              >
                {data[idx].label}
              </text>
            )}
          </g>
        ))}

        {/* Hover Tooltip Overlay */}
        {hoveredIdx !== null && (
          <g>
            <rect
              x={tooltipPos.x - 55}
              y={tooltipPos.y - 25}
              width="110"
              height="20"
              rx="4"
              fill="var(--gray-dark)"
              opacity="0.95"
            />
            <text
              x={tooltipPos.x}
              y={tooltipPos.y - 11}
              fill="#FFFFFF"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
            >
              {data[hoveredIdx].label}: {data[hoveredIdx].value}
            </text>
          </g>
        )}

        {/* Target Line */}
        {targetValue !== null && (
          <g>
            <line
              x1={padding.left}
              y1={padding.top + graphHeight - (targetValue / maxVal) * graphHeight}
              x2={width - padding.right}
              y2={padding.top + graphHeight - (targetValue / maxVal) * graphHeight}
              stroke="var(--status-danger)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padding.right - 5}
              y={padding.top + graphHeight - (targetValue / maxVal) * graphHeight - 5}
              textAnchor="end"
              fill="var(--status-danger)"
              fontSize="9"
              fontWeight="bold"
            >
              {targetLabel}: {targetValue}
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Chart type 3: DONUT CHART
  const renderDonutChart = () => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let accumulatedAngle = 0;

    const radius = 70;
    const innerRadius = 45;
    const centerX = 160;
    const centerY = 110;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '10px 0' }}>
        <svg className="chart-svg" viewBox="0 0 320 220" style={{ maxWidth: '200px', flex: '1' }}>
          {data.map((item, idx) => {
            const angle = (item.value / total) * 360;

            // Start coordinates
            const radStart = (accumulatedAngle - 90) * Math.PI / 180;
            const xStartOuter = centerX + radius * Math.cos(radStart);
            const yStartOuter = centerY + radius * Math.sin(radStart);
            const xStartInner = centerX + innerRadius * Math.cos(radStart);
            const yStartInner = centerY + innerRadius * Math.sin(radStart);

            accumulatedAngle += angle;

            // End coordinates
            const radEnd = (accumulatedAngle - 90) * Math.PI / 180;
            const xEndOuter = centerX + radius * Math.cos(radEnd);
            const yEndOuter = centerY + radius * Math.sin(radEnd);
            const xEndInner = centerX + innerRadius * Math.cos(radEnd);
            const yEndInner = centerY + innerRadius * Math.sin(radEnd);

            const largeArcFlag = angle > 180 ? 1 : 0;

            // Path for donut slice
            const pathData = `
              M ${xStartOuter} ${yStartOuter}
              A ${radius} ${radius} 0 ${largeArcFlag} 1 ${xEndOuter} ${yEndOuter}
              L ${xEndInner} ${yEndInner}
              A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${xStartInner} ${yStartInner}
              Z
            `;

            const isHovered = hoveredIdx === idx;
            const fallbackColors = ['var(--orange-institutional)', 'var(--orange-highlight)', 'var(--green-institutional)', 'var(--green-medium)'];
            const color = item.fill || fallbackColors[idx % fallbackColors.length];

            return (
              <path
                key={idx}
                d={pathData}
                fill={isHovered ? 'var(--orange-highlight)' : color}
                stroke="var(--bg-card)"
                strokeWidth="1.5"
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}

          {/* Center text indicating total */}
          <circle cx={centerX} cy={centerY} r={innerRadius - 2} fill="var(--bg-card)" />
          <text x={centerX} y={centerY - 2} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="500">TOTAL</text>
          <text x={centerX} y={centerY + 12} textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="800">
            {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
          </text>
        </svg>

        {/* Legend Panel */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.775rem' }}>
          {data.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: hoveredIdx === idx ? 'var(--bg-primary)' : 'transparent',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    backgroundColor: hoveredIdx === idx ? 'var(--orange-highlight)' : (item.fill || ['var(--orange-institutional)', 'var(--orange-highlight)', 'var(--green-institutional)', 'var(--green-medium)'][idx % 4])
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{item.label}</span>
              </div>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                {item.value} ({((item.value / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Chart type 4: GAUGE (Semi-circular score meter)
  const renderGauge = () => {
    const score = Number(data[0]?.value ?? 0);
    const label = data[0]?.label ?? '';
    const maxScore = 100;

    // Gauge arc parameters
    const cx = 140;
    const cy = 145;
    const r = 100;
    const startAngle = -180; // left side
    const sweepDeg = 180;   // 180° sweep for half-donut

    function polarToCart(angleDeg, radius) {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: cx + radius * Math.cos(rad),
        y: cy + radius * Math.sin(rad),
      };
    }

    function arcPath(startDeg, endDeg, radius, innerRadius) {
      const s = polarToCart(startDeg, radius);
      const e = polarToCart(endDeg, radius);
      const si = polarToCart(startDeg, innerRadius);
      const ei = polarToCart(endDeg, innerRadius);
      const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
      return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${si.x} ${si.y} Z`;
    }

    const track = arcPath(startAngle, startAngle + sweepDeg, r, r - 16);
    const fillDeg = (score / maxScore) * sweepDeg;
    const fillPath = fillDeg > 0 ? arcPath(startAngle, startAngle + fillDeg, r, r - 16) : '';

    const scoreColor = score >= 90
      ? '#22C55E'
      : score >= 75
      ? '#F59E0B'
      : '#EF4444';

    // Needle
    const needleAngleDeg = startAngle + fillDeg;
    const needleTip = polarToCart(needleAngleDeg, r - 8);
    const startPoint = polarToCart(startAngle, r - 8);
    const endPointTrack = polarToCart(startAngle + sweepDeg, r - 8);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
        <svg viewBox="0 0 280 190" width="100%" style={{ maxWidth: 280 }}>
          {/* Track with rounded caps */}
          <circle cx={startPoint.x} cy={startPoint.y} r="8" fill="var(--bg-tertiary)" />
          <circle cx={endPointTrack.x} cy={endPointTrack.y} r="8" fill="var(--bg-tertiary)" />
          <path d={track} fill="var(--bg-tertiary)" />

          {/* Fill */}
          {fillPath && (
            <g>
              <circle cx={startPoint.x} cy={startPoint.y} r="8" fill={scoreColor} style={{ transition: 'all 0.6s ease' }} />
              <path d={fillPath} fill={scoreColor} style={{ transition: 'all 0.6s ease' }} />
            </g>
          )}

          {/* Needle dot (rounds the end of the fill) */}
          <circle cx={needleTip.x} cy={needleTip.y} r="8" fill={scoreColor} style={{ transition: 'all 0.6s ease' }} />

          {/* Score value */}
          <text x={cx} y={cy - 12} textAnchor="middle" fill={scoreColor} fontSize="42" fontWeight="800">
            {score}
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontWeight="600">
            / 100
          </text>

          {/* Zone labels */}
          <text x={polarToCart(startAngle, r + 20).x} y={polarToCart(startAngle, r + 20).y + 4} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="600">0</text>
          <text x={polarToCart(startAngle + sweepDeg, r + 20).x} y={polarToCart(startAngle + sweepDeg, r + 20).y + 4} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="600">100</text>
          
          {/* Status badge */}
          <rect x={cx - 44} y={cy + 20} width="88" height="22" rx="11"
            fill={score >= 90 ? 'rgba(34,197,94,0.15)' : score >= 75 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}
          />
          <text x={cx} y={cy + 34} textAnchor="middle" fill={scoreColor} fontSize="9.5" fontWeight="700">
            {score >= 90 ? '✓ Excelente' : score >= 75 ? '~ Atenção' : '✗ Crítico'}
          </text>
        </svg>
        {label && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>{label}</span>
        )}
      </div>
    );
  };

  return (
    <div className="card" style={{ height: 'auto' }}>
      <div className="card-header" style={{ marginBottom: '10px' }}>
        <h3 className="card-title" style={{ fontSize: '0.925rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
          {title}
        </h3>
      </div>
      <div style={{ position: 'relative' }}>
        {type === 'bar' && renderBarChart()}
        {type === 'line' && renderLineChart()}
        {type === 'donut' && renderDonutChart()}
        {type === 'gauge' && renderGauge()}
      </div>
    </div>
  );
}
