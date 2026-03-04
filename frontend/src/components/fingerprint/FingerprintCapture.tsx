"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useFingerprint } from "@/hooks/useFingerprint";
import { Fingerprint, Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface FingerprintCaptureProps {
  onCapture?: (template: string, quality: number) => void;
  onError?: (error: string) => void;
  autoDiscover?: boolean;
  className?: string;
  compact?: boolean;
}

export function FingerprintCapture({
  onCapture,
  onError,
  autoDiscover = true,
  className,
  compact = false,
}: FingerprintCaptureProps) {
  const {
    device,
    isDiscovering,
    isCapturing,
    lastCapture,
    error,
    discover,
    capture,
    reset,
  } = useFingerprint();

  // Auto-discover device on mount
  useEffect(() => {
    if (autoDiscover) {
      discover();
    }
  }, [autoDiscover, discover]);

  // Notify parent on capture
  useEffect(() => {
    if (lastCapture?.success && onCapture) {
      onCapture(lastCapture.template, lastCapture.qualityScore);
    }
    if (lastCapture && !lastCapture.success && onError) {
      onError(lastCapture.errorMessage || "Capture failed");
    }
  }, [lastCapture, onCapture, onError]);

  // Notify parent on error
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleCapture = async () => {
    reset();
    await capture();
  };

  const handleRetry = () => {
    reset();
    if (!device) {
      discover();
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <DeviceStatusDot device={device} isDiscovering={isDiscovering} />
        <Button
          onClick={handleCapture}
          disabled={!device?.isReady || isCapturing}
          isLoading={isCapturing}
          size="sm"
          leftIcon={<Fingerprint className="w-4 h-4" />}
        >
          {isCapturing ? "Scanning..." : "Scan"}
        </Button>
        {lastCapture?.success && (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center p-6 rounded-2xl border-2 border-dashed transition-all",
        device?.isReady
          ? "border-primary-300 bg-primary-50/50 dark:border-primary-700 dark:bg-primary-950/30"
          : "border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50",
        isCapturing && "border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30",
        lastCapture?.success && "border-green-400 bg-green-50/50 dark:border-green-600 dark:bg-green-950/30",
        className
      )}
    >
      {/* Fingerprint Icon with Animation */}
      <div className="relative mb-4">
        <div
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center transition-all",
            isCapturing
              ? "bg-blue-100 dark:bg-blue-900 animate-pulse"
              : lastCapture?.success
              ? "bg-green-100 dark:bg-green-900"
              : device?.isReady
              ? "bg-primary-100 dark:bg-primary-900"
              : "bg-gray-200 dark:bg-gray-700"
          )}
        >
          {isCapturing ? (
            <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
          ) : lastCapture?.success ? (
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
          ) : lastCapture && !lastCapture.success ? (
            <XCircle className="w-12 h-12 text-red-500 dark:text-red-400" />
          ) : (
            <Fingerprint
              className={cn(
                "w-12 h-12",
                device?.isReady
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-400 dark:text-gray-500"
              )}
            />
          )}
        </div>

        {/* Scanning rings animation */}
        {isCapturing && (
          <>
            <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-blue-400 animate-ping opacity-20" />
            <div className="absolute inset-[-8px] w-[calc(6rem+16px)] h-[calc(6rem+16px)] rounded-full border border-blue-300 animate-ping opacity-10" style={{ animationDelay: "0.5s" }} />
          </>
        )}
      </div>

      {/* Status Text */}
      <div className="text-center mb-4">
        {isDiscovering && (
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching for fingerprint device...
          </p>
        )}
        {!isDiscovering && !device && (
          <div className="text-center">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              No device found
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Ensure Mantra MFS100 is plugged in and RD Service is running
            </p>
            <a
              href="http://localhost:11100/rd/info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 dark:text-primary-400 underline mt-1 block"
            >
              Open RD Service in browser to verify
            </a>
          </div>
        )}
        {device && !isCapturing && !lastCapture && (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Device Ready
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {device.model} on port {device.port}
            </p>
          </div>
        )}
        {isCapturing && (
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Place your finger on the scanner...
          </p>
        )}
        {lastCapture?.success && (
          <div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Fingerprint captured successfully
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Quality: {lastCapture.qualityScore}%
            </p>
          </div>
        )}
        {lastCapture && !lastCapture.success && (
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Capture failed
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {lastCapture.errorMessage}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!device && !isDiscovering && (
          <Button onClick={() => discover()} size="sm" variant="outline">
            <WifiOff className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        )}
        {device?.isReady && !isCapturing && (
          <Button
            onClick={handleCapture}
            size="sm"
            leftIcon={<Fingerprint className="w-4 h-4" />}
          >
            {lastCapture ? "Scan Again" : "Scan Fingerprint"}
          </Button>
        )}
        {(lastCapture && !lastCapture.success) && (
          <Button onClick={handleRetry} size="sm" variant="outline">
            Try Again
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && !lastCapture && (
        <p className="mt-3 text-xs text-red-500 dark:text-red-400 text-center max-w-xs">
          {error}
        </p>
      )}
    </div>
  );
}

function DeviceStatusDot({
  device,
  isDiscovering,
}: {
  device: { isReady: boolean } | null;
  isDiscovering: boolean;
}) {
  if (isDiscovering) {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
      </span>
    );
  }
  if (device?.isReady) {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
      </span>
    );
  }
  return <span className="inline-flex rounded-full h-3 w-3 bg-red-500" />;
}

export function DeviceStatus({
  device,
  isDiscovering,
  className,
}: {
  device: { isReady: boolean; model: string; port: number } | null;
  isDiscovering: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
        device?.isReady
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : isDiscovering
          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
        className
      )}
    >
      {device?.isReady ? (
        <Wifi className="w-3.5 h-3.5" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      {isDiscovering
        ? "Searching..."
        : device?.isReady
        ? `${device.model} Connected`
        : "Device Not Found"}
    </div>
  );
}
