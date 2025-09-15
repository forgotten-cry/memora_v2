import React from 'react';

interface DebugOverlayProps {
  deviceHeading: number | null;
  destinationBearing: number;
  relativeBearing: number;
  steps: number;
  simulatedHeading: number;
  setSimulatedHeading: (h: number) => void;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({
  deviceHeading,
  destinationBearing,
  relativeBearing,
  steps,
  simulatedHeading,
  setSimulatedHeading,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 backdrop-blur-sm text-white text-xs font-mono z-20">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>H_device:</span><span>{deviceHeading?.toFixed(2) ?? 'N/A'}°</span>
        <span>B_dest:</span><span>{destinationBearing.toFixed(2)}°</span>
        <span>Relative:</span><span>{relativeBearing.toFixed(2)}°</span>
        <span>Steps:</span><span>{steps.toFixed(0)}</span>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-600">
        <label htmlFor="simHeading" className="block mb-1">Simulate Heading: {simulatedHeading}°</label>
        <input
            type="range"
            id="simHeading"
            min="0"
            max="360"
            step="1"
            value={simulatedHeading}
            onChange={(e) => setSimulatedHeading(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};

export default DebugOverlay;