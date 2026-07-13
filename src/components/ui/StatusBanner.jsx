import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const toneIcons = {
  danger: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
};

export default function StatusBanner({
  children,
  className = '',
  icon: Icon,
  message,
  role,
  tone = 'warning',
}) {
  const ToneIcon = Icon || toneIcons[tone] || AlertCircle;
  const bannerRole = role || (tone === 'danger' ? 'alert' : 'status');

  return (
    <div className={`warning-strip status-banner status-banner-${tone} ${className}`.trim()} role={bannerRole}>
      <ToneIcon size={16} />
      <span>{children || message}</span>
    </div>
  );
}
