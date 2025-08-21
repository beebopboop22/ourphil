import React from 'react';

export default function ProgressBar({ current = 1, total = 4 }) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-indigo-600 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
