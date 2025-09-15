import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDeviceSensors } from '../../hooks/useDeviceSensors';
import { normalizeAngle } from '../../utils/navigation';
import CalibrationModal from './ARNavigation/CalibrationModal';
import NavigationArrow from './ARNavigation/NavigationArrow';
import DebugOverlay from './ARNavigation/DebugOverlay';

// --- Configuration ---
const DESTINATION_BEARING = 296; // Target bearing in degrees (e.g., 296° NW)
const TOTAL_STEPS = 10;
const ARRIVAL_THRESHOLD_STEPS = 0.5;
// PDR (Step Detection) Config
const STEP_THRESHOLD = 1.3; // Acceleration magnitude threshold (g-force)
const STEP_LOCKOUT_MS = 400; // Cooldown to prevent double counting a single step

interface ARNavigationProps {
  onBack: () => void;
}

type NavState = 'REQUESTING_PERMISSIONS' | 'CALIBRATING' | 'NAVIGATING' | 'ARRIVED';

const ARNavigation: React.FC<ARNavigationProps> = ({ onBack }) => {
  const [navState, setNavState] = useState<NavState>('REQUESTING_PERMISSIONS');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Sensor and Navigation State ---
  const { heading, acceleration, permissionState, requestPermissions } = useDeviceSensors();
  const [steps, setSteps] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);


  // --- Dev Mode ---
  const [devMode, setDevMode] = useState(false);
  const [simulatedHeading, setSimulatedHeading] = useState(296);

  const effectiveHeading = devMode ? simulatedHeading : heading;

  // --- Step Detection Logic ---
  const lastStepTimeRef = useRef(0);
  const isPeakRef = useRef(false);

  useEffect(() => {
    if (navState !== 'NAVIGATING' || !acceleration) return;

    const { x, y, z } = acceleration;
    const magnitude = Math.sqrt(x * x + y * y + z * z) / 9.81; // Normalize to g-force

    const now = Date.now();
    if (now - lastStepTimeRef.current < STEP_LOCKOUT_MS) return;

    if (magnitude > STEP_THRESHOLD && !isPeakRef.current) {
        isPeakRef.current = true; // Mark that we've entered a peak
    } else if (magnitude < 1.0 && isPeakRef.current) {
        // We've completed a peak-trough cycle, count it as a step
        setSteps(s => Math.min(s + 1, TOTAL_STEPS));
        lastStepTimeRef.current = now;
        isPeakRef.current = false; // Reset for the next step
    }
  }, [acceleration, navState]);
  
  // --- State Machine and Permissions ---
  useEffect(() => {
    // This effect now simply moves to calibration if permissions are already granted.
    // The main logic is now in the handleStart function.
    if (navState === 'REQUESTING_PERMISSIONS' && permissionState === 'granted') {
      setNavState('CALIBRATING');
    }
  }, [permissionState, navState]);

  // --- Stream Cleanup ---
  useEffect(() => {
    // This effect runs only once on mount and cleans up the camera stream on unmount.
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // --- Attach stream to video element when navigating ---
  useEffect(() => {
    if (navState === 'NAVIGATING' && videoRef.current && streamRef.current) {
        if(videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }
  }, [navState]);


  // --- Arrival Logic ---
  useEffect(() => {
    if (steps >= TOTAL_STEPS - ARRIVAL_THRESHOLD_STEPS) {
      setNavState('ARRIVED');
    }
  }, [steps]);

  // --- UI Event Handlers ---
  const handleStart = async () => {
    setPermissionError(null);
    try {
        // Request motion sensor permissions first.
        const motionGranted = await requestPermissions();
        if (!motionGranted) {
            setPermissionError("Motion sensor access is required. Please enable it in your browser settings.");
            return;
        }

        // Then, request camera permissions.
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;

        // If both are successful, proceed.
        setNavState('CALIBRATING');

    } catch (err) {
        console.error("Permission error:", err);
        if (err instanceof DOMException) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                 setPermissionError("Camera access was denied. Please enable it in your browser settings.");
            } else {
                 setPermissionError("Could not access camera. It may be in use by another app.");
            }
        } else {
            setPermissionError("An unknown error occurred while accessing device features.");
        }
    }
  };


  const handleCalibrationComplete = () => {
    setIsCalibrated(true);
    setNavState('NAVIGATING');
  };

  const handleFinish = () => {
    // Reset state for next navigation
    setSteps(0);
    setIsCalibrated(false);
    onBack();
  };
  
  const relativeBearing = useMemo(() => {
    if (effectiveHeading === null) return 0;
    // This is the core logic from the spec
    // Example: B_dest=296, H_device=296 -> relative=0 (arrow points straight)
    // Example: B_dest=296, H_device=206 -> relative=90 (arrow points right)
    return normalizeAngle(DESTINATION_BEARING - effectiveHeading);
  }, [effectiveHeading]);

  const stepsRemaining = Math.max(0, TOTAL_STEPS - steps);

  // --- Render Logic ---
  const renderContent = () => {
    switch (navState) {
      case 'REQUESTING_PERMISSIONS':
        return (
          <div className="flex flex-col items-center justify-center text-center h-full text-white p-4">
            <h2 className="text-3xl font-bold">AR Navigation</h2>
            <p className="mt-2 text-slate-400">This feature requires access to your camera and motion sensors.</p>
            <button
              onClick={handleStart}
              className="mt-8 px-8 py-4 bg-slate-700 text-white font-bold text-xl rounded-full shadow-lg hover:bg-slate-600 active:scale-95 transition-all disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              Grant Permissions
            </button>
            {permissionError && <p className="text-sm text-red-400 mt-4 max-w-xs">{permissionError}</p>}
          </div>
        );

      case 'CALIBRATING':
        return <CalibrationModal onComplete={handleCalibrationComplete} />;

      case 'NAVIGATING':
        return (
          <>
            <NavigationArrow relativeBearing={relativeBearing} />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full px-4 text-center">
                <p className="text-white text-5xl font-bold drop-shadow-2xl">{stepsRemaining.toFixed(0)}</p>
                <p className="text-slate-300 text-xl font-semibold drop-shadow-lg">steps remaining</p>
            </div>
          </>
        );

      case 'ARRIVED':
        return (
          <div className="flex flex-col items-center justify-center text-center h-full text-white p-4 bg-black/50">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-bold">You have arrived!</h2>
            <button
              onClick={handleFinish}
              className="mt-8 px-8 py-4 bg-green-700 text-white font-bold text-xl rounded-full shadow-lg hover:bg-green-600 active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        );
    }
  };

  return (
    <div className="relative w-full h-[95vh] bg-gray-900 overflow-hidden rounded-3xl shadow-2xl flex flex-col justify-between border border-slate-700/50">
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/30"></div>
      
      <header className="relative p-4 flex justify-between items-center bg-black/50 backdrop-blur-sm z-10">
        <button onClick={navState === 'ARRIVED' ? handleFinish : onBack} className="text-white text-sm p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1">
            <span className='text-lg'>&larr;</span> Back
        </button>
        {/* Dev Mode Toggle */}
        <div className="flex items-center gap-2 text-xs text-white">
            <label htmlFor="devModeToggle">Dev Mode</label>
            <input
                type="checkbox"
                id="devModeToggle"
                checked={devMode}
                onChange={() => setDevMode(!devMode)}
                className="toggle-checkbox"
            />
        </div>
      </header>

      <main className="relative flex-grow flex flex-col items-center justify-center text-white p-4">
        {renderContent()}
      </main>

      {devMode && navState === 'NAVIGATING' && (
        <DebugOverlay
            deviceHeading={heading}
            destinationBearing={DESTINATION_BEARING}
            relativeBearing={relativeBearing}
            steps={steps}
            simulatedHeading={simulatedHeading}
            setSimulatedHeading={setSimulatedHeading}
        />
      )}
      
      {/* Basic styles for the toggle switch */}
      <style>{`
        .toggle-checkbox {
            appearance: none;
            width: 32px;
            height: 18px;
            background-color: #4a5568;
            border-radius: 9px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .toggle-checkbox:checked {
            background-color: #48bb78;
        }
        .toggle-checkbox::before {
            content: '';
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: white;
            top: 2px;
            left: 2px;
            transition: transform 0.2s;
        }
        .toggle-checkbox:checked::before {
            transform: translateX(14px);
        }
      `}</style>
    </div>
  );
};

export default ARNavigation;