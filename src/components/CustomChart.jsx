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

export default function CustomChart({ type = 'line', data = [], height = 220, title, loading = false }) {
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
      </svg>
    );
  };

  // Chart type 2: LINE / AREA CHART
  const renderLineChart = () => {
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
            const fallbackColors = ['#D98C10', '#F2B544', '#B36F00', '#234F2A'];
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
                    backgroundColor: hoveredIdx === idx ? 'var(--orange-highlight)' : (item.fill || ['#D98C10', '#F2B544', '#B36F00', '#234F2A'][idx % 4])
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
      </div>
    </div>
  );
}
