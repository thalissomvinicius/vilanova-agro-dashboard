import React from 'react';

export default function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  className = '',
  variant = 'page',
  children,
}) {
  const baseClass = variant === 'dashboard' ? 'dashboard-page-header' : 'page-header';
  const classes = [baseClass, 'operational-hero', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="page-title-block">
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {meta}
      </div>
      {children}
    </div>
  );
}
