// src/FallingPills.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// ── Falling Pills Setup ──────────────────────────────────────
const colors = ['#22C55E','#0D9488','#DB2777','#3B82F6','#F97316','#EAB308','#8B5CF6','#EF4444'];

export default function FallingPills() {
  const [pillConfigs, setPillConfigs] = useState([]);

  useEffect(() => {
    supabase
      .from('tags')
      .select('id,name,slug')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        const configs = data.map((t, i) => ({
          key:      t.slug,
          name:     t.name,
          color:    colors[i % colors.length],
          left:     Math.random() * 100,
          duration: 20 + Math.random() * 10,
          delay:    -Math.random() * 20,
        }));
        setPillConfigs(configs);
      });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <style>{`
        .pill {
          position: absolute;
          top: -4rem;
          padding: .6rem 1.2rem;
          border-radius: 9999px;
          color: #fff;
          font-size: 1rem;
          white-space: nowrap;
          opacity: .1;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes fall {
          to { transform: translateY(120vh); }
        }
      `}</style>

      {pillConfigs.map((p) => (
        <span
          key={p.key}
          className="pill"
          style={{
            left:              `${p.left}%`,
            backgroundColor:   p.color,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        >
          #{p.name}
        </span>
      ))}
    </div>
  );
}
