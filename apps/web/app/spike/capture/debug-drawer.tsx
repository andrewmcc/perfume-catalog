'use client';

import type { FrameMetrics, GateConfig, GateState } from '@/lib/capture/capture-gate';

const SLIDERS: readonly (readonly [keyof GateConfig, number, number, number])[] = [
  ['minSharpness', 0, 2000, 25],
  ['maxDiff', 0, 40, 0.5],
  ['minEdgeRatio', 0, 10, 0.1],
  ['stableMs', 100, 2000, 50],
  ['rearmDiff', 5, 80, 1],
  ['maxGlare', 0, 1, 0.01],
];

export function DebugDrawer(props: {
  metrics: FrameMetrics;
  gateState: GateState;
  config: GateConfig;
  onChange: (key: keyof GateConfig, value: number) => void;
  onCopy: () => void;
}) {
  const { metrics, gateState, config } = props;
  return (
    <div className="absolute inset-x-0 top-20 z-30 mx-4 rounded bg-black/85 p-3 text-xs">
      <p className="mb-2 font-mono tabular-nums">
        state {gateState} · sharp {metrics.sharpness.toFixed(0)} · diff {metrics.diff.toFixed(1)} · edge{' '}
        {metrics.edgeRatio.toFixed(2)} · since {metrics.sinceFire.toFixed(1)} · glare {metrics.glare.toFixed(3)}
      </p>
      {SLIDERS.map(([key, min, max, step]) => (
        <label key={key} className="mb-1 flex items-center gap-2">
          <span className="w-24">{key}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={config[key]}
            onChange={(e) => props.onChange(key, Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-12 text-right font-mono tabular-nums">{config[key]}</span>
        </label>
      ))}
      <button onClick={props.onCopy} className="mt-2 rounded bg-white px-3 py-1 text-black">
        Copy config
      </button>
    </div>
  );
}
