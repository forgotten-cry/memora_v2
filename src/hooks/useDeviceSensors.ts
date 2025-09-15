import { useState, useEffect, useCallback, useRef } from 'react';

type PermissionState = 'prompt' | 'granted' | 'denied';

interface DeviceSensors {
  heading: number | null;
  linearAcceleration: { x: number; y: number; z: number; } | null;
  permissionState: PermissionState;
  requestPermissions: () => Promise<boolean>;
  stopSensors: () => void;
}

// Helper to check if we are on iOS 13+
const isIOS13OrNewer = () => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    const osVersion = ua.match(/OS (\d+)_/);
    if (osVersion && osVersion[1] && parseInt(osVersion[1], 10) >= 13) {
      return true;
    }
  }
  return false;
};

// --- Smoothing logic ---
const HEADING_SMOOTHING_BUFFER_SIZE = 10;
const headingBuffer: number[] = [];

const getSmoothedHeading = (newHeading: number): number => {
    if (headingBuffer.length > 0) {
        const lastAvg = headingBuffer.reduce((sum, val) => sum + val, 0) / headingBuffer.length;
        if (Math.abs(newHeading - lastAvg) > 180) {
            headingBuffer.length = 0;
        }
    }

    headingBuffer.push(newHeading);
    if (headingBuffer.length > HEADING_SMOOTHING_BUFFER_SIZE) {
        headingBuffer.shift();
    }

    let sumX = 0;
    let sumY = 0;
    for (const angle of headingBuffer) {
        sumX += Math.cos(angle * Math.PI / 180);
        sumY += Math.sin(angle * Math.PI / 180);
    }
    const avgX = sumX / headingBuffer.length;
    const avgY = sumY / headingBuffer.length;

    const avgAngleRad = Math.atan2(avgY, avgX);
    let avgAngleDeg = avgAngleRad * 180 / Math.PI;

    if (avgAngleDeg < 0) {
        avgAngleDeg += 360;
    }

    return avgAngleDeg;
};


export const useDeviceSensors = (): DeviceSensors => {
  const [heading, setHeading] = useState<number | null>(null);
  const [linearAcceleration, setLinearAcceleration] = useState<{ x: number; y: number; z: number } | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  
  const gravityRef = useRef([0, 0, 0]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      const compassHeading = (event as any).webkitCompassHeading || event.alpha;
      setHeading(getSmoothedHeading(360 - compassHeading));
    }
  }, []);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (event.acceleration && event.acceleration.x !== null) {
      const { x, y, z } = event.acceleration;
      if (x !== null && y !== null && z !== null) {
        setLinearAcceleration({ x, y, z });
      }
    } 
    else if (event.accelerationIncludingGravity && event.accelerationIncludingGravity.x !== null) {
      const acc = event.accelerationIncludingGravity;
      const alpha = 0.8;

      gravityRef.current[0] = alpha * gravityRef.current[0] + (1 - alpha) * (acc.x || 0);
      gravityRef.current[1] = alpha * gravityRef.current[1] + (1 - alpha) * (acc.y || 0);
      gravityRef.current[2] = alpha * gravityRef.current[2] + (1 - alpha) * (acc.z || 0);

      const linear = {
        x: (acc.x || 0) - gravityRef.current[0],
        y: (acc.y || 0) - gravityRef.current[1],
        z: (acc.z || 0) - gravityRef.current[2],
      };
      setLinearAcceleration(linear);
    }
  }, []);

  const stopSensors = useCallback(() => {
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);
  }, [handleOrientation, handleMotion]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isIOS13OrNewer() || typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      setPermissionState('granted');
      return true;
    }

    try {
      const orientationPermission = await (DeviceOrientationEvent as any).requestPermission();
      const motionPermission = await (DeviceMotionEvent as any).requestPermission();
      
      if (orientationPermission === 'granted' && motionPermission === 'granted') {
        setPermissionState('granted');
        return true;
      } else {
        setPermissionState('denied');
        return false;
      }
    } catch (error) {
      console.error("Error requesting sensor permissions:", error);
      setPermissionState('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    if (permissionState === 'granted') {
      window.addEventListener('deviceorientation', handleOrientation);
      window.addEventListener('devicemotion', handleMotion);
    }
    
    return () => {
      stopSensors();
    };
  }, [permissionState, handleOrientation, handleMotion, stopSensors]);

  return { heading, linearAcceleration, permissionState, requestPermissions, stopSensors };
};