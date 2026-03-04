/**
 * Mantra MFS100 Fingerprint Scanner Service
 * Communicates with the local RD Service running on the machine.
 * The RD Service exposes REST endpoints on ports 11100-11120.
 */

export interface DeviceInfo {
  port: number;
  protocol: "http" | "https";
  serialNo: string;
  make: string;
  model: string;
  isReady: boolean;
}

export interface CaptureResult {
  success: boolean;
  template: string; // Base64 encoded FMR template
  qualityScore: number;
  errorCode?: string;
  errorMessage?: string;
}

const RD_SERVICE_PORTS = Array.from({ length: 21 }, (_, i) => 11100 + i);
const CAPTURE_TIMEOUT = 10000; // 10 seconds
const DISCOVERY_TIMEOUT = 1500; // 1.5 seconds per attempt
// Try HTTP first (most common), then HTTPS for newer RD Service installs
const PROTOCOLS = ["http", "https"] as const;

/**
 * Discover the active Mantra MFS100 RD Service by scanning ports and protocols
 */
export async function discoverDevice(): Promise<DeviceInfo | null> {
  for (const port of RD_SERVICE_PORTS) {
    for (const protocol of PROTOCOLS) {
      try {
        const info = await getDeviceInfo(port, protocol);
        if (info) return info;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Get device info from a specific port and protocol
 */
export async function getDeviceInfo(
  port: number,
  protocol: "http" | "https" = "http"
): Promise<DeviceInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT);

    const response = await fetch(`${protocol}://localhost:${port}/rd/info`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      // Parse XML response from RD Service
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");

      const deviceInfo = xml.querySelector("RDService");
      if (deviceInfo) {
        return {
          port,
          serialNo: deviceInfo.getAttribute("info") || "",
          make: "Mantra",
          model: "MFS100",
          isReady: deviceInfo.getAttribute("status") === "READY",
          protocol,
        };
      }
    }
  } catch {
    // Port not available or service not running on this protocol
  }
  return null;
}

/**
 * Capture fingerprint from the device
 */
export async function captureFingerprint(
  port: number,
  timeout: number = CAPTURE_TIMEOUT,
  protocol: "http" | "https" = "http"
): Promise<CaptureResult> {
  const pidOptions = `<?xml version="1.0"?>
<PidOptions ver="1.0">
  <Opts fCount="1" fType="2" iCount="0" pCount="0"
        format="0" pidVer="2.0"
        timeout="${timeout}"
        posh="UNKNOWN" env="P" wadh="" />
  <CustOpts>
    <Param name="manteConnectAfterCreate" value="Y" />
  </CustOpts>
</PidOptions>`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout + 5000);

    const response = await fetch(`${protocol}://localhost:${port}/rd/capture`, {
      method: "CAPTURE",
      headers: { "Content-Type": "text/xml" },
      body: pidOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        template: "",
        qualityScore: 0,
        errorCode: "CAPTURE_FAILED",
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();
    return parseCaptureResponse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      template: "",
      qualityScore: 0,
      errorCode: "DEVICE_ERROR",
      errorMessage: message.includes("abort")
        ? "Capture timed out. Please try again."
        : `Device error: ${message}`,
    };
  }
}

/**
 * Parse the XML response from MFS100 capture
 */
function parseCaptureResponse(xmlText: string): CaptureResult {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");

    const resp = xml.querySelector("Resp");
    const errCode = resp?.getAttribute("errCode") || "";
    const errInfo = resp?.getAttribute("errInfo") || "";

    if (errCode !== "0") {
      return {
        success: false,
        template: "",
        qualityScore: 0,
        errorCode: errCode,
        errorMessage: errInfo || "Fingerprint capture failed",
      };
    }

    // Extract the BIR data (base64 encoded) - <Data> is a direct child of root <PidData>
    const pidData = xml.querySelector("Data");
    const template = pidData?.textContent?.trim() || "";

    // Extract quality score
    const hmac = xml.querySelector("Hmac");
    const skey = xml.querySelector("Skey");

    // Quality is in the DeviceInfo or Resp attributes
    const qualityAttr = resp?.getAttribute("qScore") || "0";
    const qualityScore = parseInt(qualityAttr, 10);

    if (!template) {
      return {
        success: false,
        template: "",
        qualityScore: 0,
        errorCode: "NO_TEMPLATE",
        errorMessage: "No fingerprint template received",
      };
    }

    return {
      success: true,
      template,
      qualityScore: qualityScore || 80, // Default quality if not provided
    };
  } catch (error) {
    return {
      success: false,
      template: "",
      qualityScore: 0,
      errorCode: "PARSE_ERROR",
      errorMessage: "Failed to parse device response",
    };
  }
}

/**
 * Check if device is ready (quick check)
 */
export async function isDeviceReady(port: number, protocol: "http" | "https" = "http"): Promise<boolean> {
  const info = await getDeviceInfo(port, protocol);
  return info?.isReady || false;
}
