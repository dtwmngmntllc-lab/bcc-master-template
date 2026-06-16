import React from 'react';

/**
 * DemoBanner — renders a persistent yellow strip across the top of the app
 * when VITE_DEMO_MODE=true. For production client deploys, the env var is
 * unset/false and the banner does not render.
 *
 * Zero impact on client deployments — the code path is dead unless flag set.
 */
export default function DemoBanner() {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  if (!isDemo) return null;

  return (
    <div
      className="demo-banner"
      style={{
        background: 'linear-gradient(90deg, #FCD34D 0%, #F59E0B 100%)',
        color: '#1F2937',
        padding: '8px 16px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '14px',
        letterSpacing: '0.025em',
        borderBottom: '2px solid #D97706',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      🌟 DEMO DATA — This is "Sunshine State Insurance," a fictional agency.
      Your real BCC will be populated with your actual agency data.
      Demo resets nightly. Built by{' '}
      <a
        href="https://imaginary-farms.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#1F2937', textDecoration: 'underline', fontWeight: 700 }}
      >
        Imaginary Farms LLC
      </a>
      .
    </div>
  );
}
