"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DeviceInfo,
  CaptureResult,
  discoverDevice,
  captureFingerprint,
  isDeviceReady,
} from "@/lib/fingerprint";

interface UseFingerprintReturn {
  device: DeviceInfo | null;
  isDiscovering: boolean;
  isCapturing: boolean;
  lastCapture: CaptureResult | null;
  error: string | null;
  discover: () => Promise<DeviceInfo | null>;
  capture: (timeout?: number) => Promise<CaptureResult | null>;
  reset: () => void;
  checkReady: () => Promise<boolean>;
}

export function useFingerprint(): UseFingerprintReturn {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<DeviceInfo | null>(null);

  // Keep ref in sync
  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  const discover = useCallback(async (): Promise<DeviceInfo | null> => {
    setIsDiscovering(true);
    setError(null);

    try {
      const info = await discoverDevice();
      if (info) {
        setDevice(info);
        return info;
      } else {
        setError(
          "No device found. If using HTTPS mode, open http://localhost:11100/rd/info in your browser once to accept the certificate, then retry."
        );
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Discovery failed";
      setError(message);
      return null;
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  const capture = useCallback(
    async (timeout?: number): Promise<CaptureResult | null> => {
      const currentDevice = deviceRef.current;
      if (!currentDevice) {
        setError("No device connected. Please discover device first.");
        return null;
      }

      setIsCapturing(true);
      setError(null);
      setLastCapture(null);

      try {
        const result = await captureFingerprint(currentDevice.port, timeout, currentDevice.protocol);
        setLastCapture(result);

        if (!result.success) {
          setError(result.errorMessage || "Capture failed");
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Capture failed";
        setError(message);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    []
  );

  const checkReady = useCallback(async (): Promise<boolean> => {
    const currentDevice = deviceRef.current;
    if (!currentDevice) return false;
    return isDeviceReady(currentDevice.port, currentDevice.protocol);
  }, []);

  const reset = useCallback(() => {
    setLastCapture(null);
    setError(null);
  }, []);

  return {
    device,
    isDiscovering,
    isCapturing,
    lastCapture,
    error,
    discover,
    capture,
    reset,
    checkReady,
  };
}
