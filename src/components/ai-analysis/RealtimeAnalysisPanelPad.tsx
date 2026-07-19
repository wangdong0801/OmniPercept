import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlertCircle, BrainCircuit, Camera, CheckCircle2, ChevronDown, Mic, Radio, RefreshCw, Save, Settings, SlidersHorizontal, Video, X, Zap } from "lucide-react";
import { EZUIKitPlayer } from "ezuikit-js";
import { AnimatePresence, motion } from "motion/react";
import { AiWorkspaceTab, RealtimeStreamConfig, RecordingConfig, RecordingTask } from "../../types";
import { RecordingConfigModal } from "./RecordingConfigModal";
import { getEzvizDevices, getEzvizToken } from "../../utils/ezvizService";

const DEFAULT_STREAM_URL = "ezopen://open.ys7.com/GG1317579/1.hd.live";

type RealtimeStatus = "idle" | "connecting" | "ready" | "error";

interface EzvizDevice {
  label: string;
  value: string;
}

const shouldBlockCaptureDownload = (anchor: HTMLAnchorElement) => {
  const href = anchor.getAttribute("href") || "";
  return (
    anchor.hasAttribute("download") ||
    href.startsWith("blob:") ||
    href.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|bmp)(\?|$)/i.test(href)
  );
};

const withCaptureDownloadSuppressed = async <T,>(task: () => Promise<T>) => {
  const originalClick = HTMLAnchorElement.prototype.click;
  const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
  const originalWindowOpen = window.open;
  const clickGuard = (event: MouseEvent) => {
    const target = event.target;
    const anchor = target instanceof Element ? target.closest("a") : null;
    if (anchor instanceof HTMLAnchorElement && shouldBlockCaptureDownload(anchor)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  };

  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    if (shouldBlockCaptureDownload(this)) {
      return;
    }
    return originalClick.call(this);
  };

  EventTarget.prototype.dispatchEvent = function patchedDispatchEvent(this: EventTarget, event: Event) {
    if (event.type === "click" && this instanceof HTMLAnchorElement && shouldBlockCaptureDownload(this)) {
      return true;
    }
    return originalDispatchEvent.call(this, event);
  };

  window.open = ((url?: string | URL | undefined, target?: string, features?: string) => {
    const nextUrl = typeof url === "string" ? url : url?.toString() || "";
    if (
      nextUrl.startsWith("blob:") ||
      nextUrl.startsWith("data:image/") ||
      /\.(png|jpe?g|webp|bmp)(\?|$)/i.test(nextUrl)
    ) {
      return null;
    }
    return originalWindowOpen.call(window, url as string | URL | undefined, target, features);
  }) as typeof window.open;

  document.addEventListener("click", clickGuard, true);

  try {
    return await task();
  } finally {
    HTMLAnchorElement.prototype.click = originalClick;
    EventTarget.prototype.dispatchEvent = originalDispatchEvent;
    window.open = originalWindowOpen;
    document.removeEventListener("click", clickGuard, true);
  }
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

const normalizeCapturedImage = async (captureData: unknown): Promise<string | null> => {
  if (!captureData) return null;
  if (typeof captureData === "string") {
    if (captureData.startsWith("data:image/") || captureData.startsWith("http")) {
      return captureData;
    }
    return `data:image/jpeg;base64,${captureData}`;
  }
  if (captureData instanceof Blob) {
    return blobToDataUrl(captureData);
  }

  const anyData = captureData as any;
  if (typeof anyData.data === "string") {
    return normalizeCapturedImage(anyData.data);
  }
  if (typeof anyData.base64 === "string") {
    return normalizeCapturedImage(anyData.base64);
  }
  if (typeof anyData.data?.base64 === "string") {
    return normalizeCapturedImage(anyData.data.base64);
  }
  if (typeof anyData.data?.picUrl === "string") {
    return anyData.data.picUrl;
  }
  if (typeof anyData.dataUrl === "string") {
    return anyData.dataUrl;
  }

  return null;
};

const isBlankImage = async (imageSrc: string) =>
  new Promise<boolean>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const sampleCanvas = document.createElement("canvas");
        const width = Math.max(1, Math.min(img.naturalWidth || img.width || 1, 64));
        const height = Math.max(1, Math.min(img.naturalHeight || img.height || 1, 64));
        sampleCanvas.width = width;
        sampleCanvas.height = height;
        const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a > 0 && (r !== 0 || g !== 0 || b !== 0)) {
            resolve(false);
            return;
          }
        }
        resolve(true);
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = imageSrc;
  });

export interface RealtimeAnalysisPanelPadHandle {
  captureScreenshot: () => Promise<string | null>;
  getContainerRect: () => DOMRect | null;
  startRecording: (options?: { video?: boolean; audio?: boolean; duration?: number }) => Promise<void>;
  stopRecording: () => Promise<string | null>;
}

interface RealtimeAnalysisPanelPadProps {
  config: RealtimeStreamConfig;
  status: RealtimeStatus;
  error: string | null;
  connectVersion: number;
  activeTab: AiWorkspaceTab;
  activeRecordingTask: RecordingTask | null;
  nextTriggerTime?: number | null;
  countdown?: number | null;
  onTabChange: (tab: AiWorkspaceTab) => void;
  onConfigChange: (config: RealtimeStreamConfig) => void;
  onStatusChange: (status: RealtimeStatus, error?: string | null) => void;
  onConnect: () => void;
  onSaveRecordingTask: (config: RecordingConfig) => void;
  onStopRecordingTask: () => void;
  onManualCapture?: (image: string, rect: DOMRect | null) => void;
  onManualVideo?: (url: string, rect: DOMRect | null) => void;
  onManualAudio?: (url: string, rect: DOMRect | null) => void;
}

export const RealtimeAnalysisPanelPad = React.forwardRef<RealtimeAnalysisPanelPadHandle, RealtimeAnalysisPanelPadProps>(({
  config,
  status,
  error,
  connectVersion,
  activeTab,
  activeRecordingTask,
  nextTriggerTime,
  countdown,
  onTabChange,
  onConfigChange,
  onStatusChange,
  onConnect,
  onSaveRecordingTask,
  onStopRecordingTask,
  onManualCapture,
  onManualVideo,
  onManualAudio,
}, ref) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<EZUIKitPlayer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const initSeqRef = useRef(0);

  // 手动录制相关状态
  const [isManualVideoRecording, setIsManualVideoRecording] = useState(false);
  const [isManualAudioRecording, setIsManualAudioRecording] = useState(false);
  const [isGlobalRecording, setIsGlobalRecording] = useState(false);
  const [manualVideoDuration, setManualVideoDuration] = useState(0);
  const [manualAudioDuration, setManualAudioDuration] = useState(0);
  const manualVideoTimerRef = useRef<number | null>(null);
  const manualAudioTimerRef = useRef<number | null>(null);

  const resolveRecordingConfig = useCallback(() => {
    if (activeRecordingTask?.config) return activeRecordingTask.config;
    const draft = localStorage.getItem("recording_config_draft");
    if (!draft) return null;
    try {
      return JSON.parse(draft) as RecordingConfig;
    } catch {
      return null;
    }
  }, [activeRecordingTask]);

  const internalCaptureScreenshot = useCallback(async () => {
    if (status !== "ready") return null;

    try {
      console.log("[RealtimePanelPad] Starting robust capture...");
      const sdkPlayer = (playerRef.current as any);

      // 1. 优先使用 SDK 官方截图
      if (sdkPlayer && typeof sdkPlayer.capturePicture === "function") {
        try {
          const sdkCapture = await withCaptureDownloadSuppressed(async () => sdkPlayer.capturePicture());
          const image = await normalizeCapturedImage(sdkCapture);
          if (image && !(await isBlankImage(image))) {
            return image;
          }
        } catch (e) {
          console.warn("[RealtimePanelPad] SDK capturePicture failed:", e);
        }
      }

      // 2. 内部原生截图
      const internalPlayer = sdkPlayer?._player || sdkPlayer?.jessibuca;
      if (internalPlayer && typeof internalPlayer.screenshot === "function") {
        try {
          const internalCapture = internalPlayer.screenshot();
          const image = await normalizeCapturedImage(internalCapture);
          if (image && !(await isBlankImage(image))) {
            return image;
          }
        } catch (e) {
          console.warn("[RealtimePanelPad] SDK internal screenshot failed:", e);
        }
      }

      // 3. Canvas 兜底
      const doCanvasCapture = () => {
        if (!playerContainerRef.current) return null;
        const videos = Array.from(playerContainerRef.current.querySelectorAll("video")) as HTMLVideoElement[];
        const canvases = Array.from(playerContainerRef.current.querySelectorAll("canvas")) as HTMLCanvasElement[];
        const allSources = [...videos, ...canvases].filter((el): el is HTMLVideoElement | HTMLCanvasElement => {
          const rect = el.getBoundingClientRect();
          return rect.width > 100 && rect.height > 100 && getComputedStyle(el).display !== "none";
        });
        allSources.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));

        return allSources.map((source) => {
          try {
            const tempCanvas = document.createElement("canvas");
            const width = (source as any).videoWidth || (source as any).width || source.clientWidth;
            const height = (source as any).videoHeight || (source as any).height || source.clientHeight;
            tempCanvas.width = width;
            tempCanvas.height = height;
            const ctx = tempCanvas.getContext("2d", { alpha: false });
            if (!ctx) return null;
            ctx.drawImage(source as any, 0, 0, width, height);
            return tempCanvas.toDataURL("image/png");
          } catch (e) {
            console.warn("[RealtimePanelPad] Canvas capture candidate failed:", e);
            return null;
          }
        });
      };

      let candidates = doCanvasCapture();
      if (!candidates?.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
        candidates = doCanvasCapture();
      }

      let result: string | null = null;
      for (const candidate of candidates || []) {
        if (!candidate) continue;
        if (!(await isBlankImage(candidate))) {
          result = candidate;
          break;
        }
      }
      return result;
    } catch (err) {
      console.error("[RealtimePanelPad] Global capture error:", err);
      return null;
    }
  }, [status]);

  const internalStartRecording = useCallback(async (options?: { video?: boolean; audio?: boolean; duration?: number }) => {
    if (!playerContainerRef.current || status !== "ready") return;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.warn("[RealtimePanelPad] Recording already in progress");
      return;
    }

    const videoEnabled = options?.video !== false;
    const audioEnabled = options?.audio === true;
    const duration = options?.duration;

    const container = playerContainerRef.current;
    const candidates = Array.from(container.querySelectorAll("video, canvas")) as Array<HTMLVideoElement | HTMLCanvasElement>;
    const visibleCandidates = candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 50 && rect.height > 50 && style.display !== "none" && style.visibility !== "hidden";
    });
    visibleCandidates.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight));
    const source = visibleCandidates[0] || null;

    if (!source) {
      console.warn("[RealtimePanelPad] Recording aborted: no source");
      return;
    }

    try {
      let stream: MediaStream | null = null;
      if ((source as any).captureStream) {
        stream = (source as any).captureStream();
      } else if ((source as any).msCaptureStream) {
        stream = (source as any).msCaptureStream();
      }

      if (!stream) return;

      if (audioEnabled && stream.getAudioTracks().length === 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const micTrack = micStream.getAudioTracks()[0];
          if (micTrack) {
            stream.addTrack(micTrack);
          }
        } catch (micErr) {
          console.warn("[RealtimePanelPad] Mic access failed:", micErr);
        }
      }

      if (!videoEnabled) {
        stream.getVideoTracks().forEach(track => { track.stop(); stream?.removeTrack(track); });
      }
      if (!audioEnabled) {
        stream.getAudioTracks().forEach(track => { track.stop(); stream?.removeTrack(track); });
      }

      if (stream.getTracks().length === 0) return;

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsGlobalRecording(true);

      if (duration && duration > 0) {
        if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = window.setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        }, duration * 1000);
      }
    } catch (err) {
      console.error("[RealtimePanelPad] Start recording failed:", err);
    }
  }, [status]);

  const internalStopRecording = useCallback(async () => {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    return new Promise<string | null>((resolve) => {
      const finalize = () => {
        if (recorder && recorder.stream) {
          recorder.stream.getTracks().forEach(track => track.stop());
        }

        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          resolve(null);
        }
        mediaRecorderRef.current = null;
        setIsGlobalRecording(false);
      };

      if (!recorder || recorder.state === "inactive") {
        finalize();
        return;
      }
      recorder.onstop = finalize;
      recorder.stop();
    });
  }, []);

  useImperativeHandle(ref, () => ({
    captureScreenshot: internalCaptureScreenshot,
    getContainerRect: () => playerContainerRef.current?.getBoundingClientRect() || null,
    startRecording: async (options?: { video?: boolean; audio?: boolean; duration?: number }) => {
      const config = resolveRecordingConfig();
      if (!config) return;
      await internalStartRecording({
        video: options?.video ?? config.videoEnabled,
        audio: options?.audio ?? config.audioEnabled,
        duration: options?.duration ?? config.duration
      });
    },
    stopRecording: internalStopRecording,
  }), [internalCaptureScreenshot, internalStartRecording, internalStopRecording]);

  // 手动控制逻辑
  const handleManualCaptureClick = async () => {
    if (status !== "ready") return;
    const image = await internalCaptureScreenshot();
    if (image && onManualCapture) {
      onManualCapture(image, playerContainerRef.current?.getBoundingClientRect() || null);
    }
  };

  const handleManualVideoToggle = async () => {
    if (status !== "ready") return;

    if (isManualVideoRecording) {
      setIsManualVideoRecording(false);
      if (manualVideoTimerRef.current) {
        window.clearInterval(manualVideoTimerRef.current);
        manualVideoTimerRef.current = null;
      }
      const url = await internalStopRecording();
      if (url && onManualVideo) {
        onManualVideo(url, playerContainerRef.current?.getBoundingClientRect() || null);
      }
      setManualVideoDuration(0);
    } else {
      setIsManualVideoRecording(true);
      setManualVideoDuration(0);
      internalStartRecording({ video: true, audio: true });

      manualVideoTimerRef.current = window.setInterval(() => {
        setManualVideoDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const handleManualAudioToggle = async () => {
    if (status !== "ready") return;

    if (isManualAudioRecording) {
      setIsManualAudioRecording(false);
      if (manualAudioTimerRef.current) {
        window.clearInterval(manualAudioTimerRef.current);
        manualAudioTimerRef.current = null;
      }
      const url = await internalStopRecording();
      if (url && onManualAudio) {
        onManualAudio(url, playerContainerRef.current?.getBoundingClientRect() || null);
      }
      setManualAudioDuration(0);
    } else {
      setIsManualAudioRecording(true);
      setManualAudioDuration(0);
      internalStartRecording({ video: false, audio: true });

      manualAudioTimerRef.current = window.setInterval(() => {
        setManualAudioDuration(prev => prev + 1);
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (manualVideoTimerRef.current) window.clearInterval(manualVideoTimerRef.current);
      if (manualAudioTimerRef.current) window.clearInterval(manualAudioTimerRef.current);
    };
  }, []);

  const [tempUrl, setTempUrl] = useState(config.streamUrl);
  const [tempToken, setTempToken] = useState(config.accessToken);
  const [ezvizAppKey, setEzvizAppKey] = useState(localStorage.getItem("EZVIZ_APP_KEY") || process.env.EZVIZ_APP_KEY || "");
  const [ezvizAppSecret, setEzvizAppSecret] = useState(localStorage.getItem("EZVIZ_APP_SECRET") || process.env.EZVIZ_APP_SECRET || "");
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [deviceList, setDeviceList] = useState<EzvizDevice[]>([]);
  const [isFetchingDevices, setIsFetchingDevices] = useState(false);

  useEffect(() => {
    setTempUrl(config.streamUrl);
    setTempToken(config.accessToken);
  }, [config.streamUrl, config.accessToken]);

  const fetchDeviceList = useCallback(async (token: string) => {
    if (!token || token.length < 20) return;
    setIsFetchingDevices(true);
    try {
      const devices = await getEzvizDevices(token);
      if (devices && devices.length > 0) {
        const list = devices
          .filter((item: any) => item.status === 1)
          .map((item: any) => ({
            label: item.deviceName || item.name || item.deviceSerial || "未知设备",
            value: item.url || item.liveUrl || `ezopen://open.ys7.com/${item.deviceSerial || item.serial}/${item.channelNo || 1}.hd.live`,
          }));
        setDeviceList(list);
      } else {
        console.warn("[RealtimePanelPad] No devices found or empty response from EZVIZ API.");
        // Fallback if no devices returned
        const mockDevices: EzvizDevice[] = [
          {
            label: "1号监控点-核心区 (模拟)",
            value: "ezopen://open.ys7.com/GG1317579/1.hd.live",
          },
          {
            label: "2号监控点-外围防护 (模拟)",
            value: "ezopen://open.ys7.com/GG1317580/1.hd.live",
          },
        ];
        setDeviceList(mockDevices);
      }
    } catch (err: any) {
      console.warn("[RealtimePanelPad] Failed to fetch device list from EZVIZ API (credentials might be invalid or expired):", err.message || err);
      // Fallback to mock device list so the application remains fully testable and functional!
      const mockDevices: EzvizDevice[] = [
        {
          label: "1号监控点-核心区 (模拟)",
          value: "ezopen://open.ys7.com/GG1317579/1.hd.live",
        },
        {
          label: "2号监控点-外围防护 (模拟)",
          value: "ezopen://open.ys7.com/GG1317580/1.hd.live",
        },
      ];
      console.log("[RealtimePanelPad] Falling back to mock device list:", mockDevices);
      setDeviceList(mockDevices);
    } finally {
      setIsFetchingDevices(false);
    }
  }, []);

  useEffect(() => {
    if (tempToken && tempToken.length > 20) {
      fetchDeviceList(tempToken);
      const interval = setInterval(() => fetchDeviceList(tempToken), 30000);
      return () => clearInterval(interval);
    }
  }, [tempToken, fetchDeviceList]);

  const handleRefreshEzvizToken = useCallback(async () => {
    if (!ezvizAppKey || !ezvizAppSecret) return;
    setIsFetchingToken(true);
    try {
      const data = await getEzvizToken(ezvizAppKey, ezvizAppSecret);
      if (data && data.accessToken) {
        setTempToken(data.accessToken);
      }
    } catch (err: any) {
      console.warn("[RealtimePanelPad] Failed to refresh token from EZVIZ API (credentials might be invalid):", err.message || err);
    } finally {
      setIsFetchingToken(false);
    }
  }, [ezvizAppKey, ezvizAppSecret]);

  useEffect(() => {
    if (ezvizAppKey && ezvizAppSecret && (!tempToken || tempToken.length < 20)) {
      handleRefreshEzvizToken();
    }
  }, [ezvizAppKey, ezvizAppSecret, tempToken, handleRefreshEzvizToken]);

  // 自动加载第一个视频的逻辑
  useEffect(() => {
    if (deviceList.length > 0 && (!config.streamUrl || config.streamUrl === DEFAULT_STREAM_URL)) {
      const firstDevice = deviceList[0];
      console.log("[RealtimePanelPad] Auto-loading first video:", firstDevice.label);

      const nextConfig = {
        ...config,
        streamUrl: firstDevice.value,
        accessToken: tempToken || config.accessToken
      };

      onConfigChange(nextConfig);
      localStorage.setItem("ai_analysis_stream_config", JSON.stringify(nextConfig));
      onConnect();
    }
  }, [deviceList, config, onConfigChange, onConnect, tempToken]);

  const syncPlayerSize = () => {
    const container = playerContainerRef.current;
    const player = playerRef.current;
    if (!container || !player) return;
    const width = Math.round(container.clientWidth || container.getBoundingClientRect().width || 0);
    const height = Math.round(container.clientHeight || container.getBoundingClientRect().height || 0);
    if (!width || !height) return;
    if (typeof player.reSize === "function") {
      player.reSize(width, height);
    } else if (typeof player.resize === "function") {
      player.resize(width, height);
    }
  };

  const destroyPlayer = () => {
    resizeObserverRef.current?.disconnect();
    mutationObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    mutationObserverRef.current = null;
    const player = playerRef.current;
    if (!player) return;
    try { player.stop?.(); } catch { }
    try { player.destroy?.(); } catch { }
    playerRef.current = null;
    const container = playerContainerRef.current;
    if (container) container.innerHTML = "";
  };

  useEffect(() => {
    return () => destroyPlayer();
  }, []);

  useEffect(() => {
    if (!connectVersion) return;

    const seq = ++initSeqRef.current;
    const { streamUrl, accessToken } = config;
    const container = playerContainerRef.current;
    if (!container) return;

    destroyPlayer();
    onStatusChange("connecting", null);

    const boot = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      if (seq !== initSeqRef.current) return;

      try {
        container.id = "ai-analysis-ezviz-container-pad";
        container.innerHTML = "";

        const template =
          streamUrl.toLowerCase().includes(".playback") || streamUrl.toLowerCase().includes(".record")
            ? "pcRec"
            : "pcLive";

        const player = new EZUIKitPlayer({
          id: container.id,
          url: streamUrl,
          accessToken,
          template,
          plugin: ["talk", "ptz"],
          autoplay: true,
          useWebCodecs: false,
          scaleMode: 1,
          showPt: true,
          width: container.clientWidth || 1024,
          height: container.clientHeight || 576,
          handleSuccess: () => {
            if (seq !== initSeqRef.current) return;
            window.setTimeout(() => syncPlayerSize(), 0);
            window.setTimeout(() => syncPlayerSize(), 100);
            window.setTimeout(() => syncPlayerSize(), 300);
          },
          handleError: (playerError: unknown) => {
            if (seq !== initSeqRef.current) return;
            console.error("[RealtimePanelPad] EZUIKit error:", playerError);
            const message = JSON.stringify(playerError || {});
            onStatusChange(
              "error",
              message.includes("Janus") || message.includes("WebSocket")
                ? "WebRTC 连接失败，建议在设置中尝试切换协议。"
                : "播放器连接失败，请检查流地址与 Token 是否有效。",
            );
          },
        } as any);

        playerRef.current = player;

        const ready = () => {
          if (seq !== initSeqRef.current) return;
          onStatusChange("ready", null);
          syncPlayerSize();
          window.setTimeout(() => syncPlayerSize(), 150);
          window.setTimeout(() => syncPlayerSize(), 350);
        };

        try {
          const firstFrameDisplay = EZUIKitPlayer.EVENTS?.firstFrameDisplay;
          if (firstFrameDisplay && player.eventEmitter?.on) {
            player.eventEmitter.on(firstFrameDisplay, ready);
          }
        } catch { }

        try {
          if (player.eventEmitter?.on) {
            player.eventEmitter.on("play", ready);
          }
        } catch { }

        const resizeObserver = new ResizeObserver(() => syncPlayerSize());
        resizeObserver.observe(container);
        if (container.parentElement) {
          resizeObserver.observe(container.parentElement);
        }
        resizeObserverRef.current = resizeObserver;

        const mutationObserver = new MutationObserver(() => syncPlayerSize());
        mutationObserver.observe(container, { childList: true, subtree: true });
        mutationObserverRef.current = mutationObserver;

        window.setTimeout(() => {
          if (seq === initSeqRef.current && status !== "ready") {
            ready();
          }
        }, 2400);
      } catch (playerError: any) {
        console.error("Failed to initialize player:", playerError);
        onStatusChange("error", `播放器初始化失败：${playerError?.message || "未知错误"}`);
      }
    };

    boot();

    return () => {
      if (seq === initSeqRef.current) destroyPlayer();
    };
  }, [config, connectVersion]);

  const handleSaveConfig = () => {
    const nextConfig = {
      streamUrl: tempUrl.trim(),
      accessToken: tempToken.trim(),
    };
    onConfigChange(nextConfig);
    localStorage.setItem("ai_analysis_stream_config", JSON.stringify(nextConfig));
    localStorage.setItem("EZVIZ_APP_KEY", ezvizAppKey.trim());
    localStorage.setItem("EZVIZ_APP_SECRET", ezvizAppSecret.trim());
    setLastSavedAt(new Date().toLocaleTimeString("zh-CN"));
    onConnect();
  };

  const statusText =
    status === "ready"
      ? "监控已就绪"
      : status === "connecting"
        ? "正在连接"
        : status === "error"
          ? "连接异常"
          : "等待连接";

  const statusColor =
    status === "ready"
      ? "text-emerald-400"
      : status === "connecting"
        ? "text-amber-400"
        : status === "error"
          ? "text-red-400"
          : "text-slate-400";

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between gap-3 text-xs">
      {/* Tab switch wrapper - Generous tap target layout */}
      <div className="flex flex-col gap-2 pb-2 border-b border-slate-800/50 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1 flex-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={!!activeRecordingTask}
              onClick={() => onTabChange("offline")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                activeTab === "offline" ? "bg-blue-600 text-white shadow-md" : "text-slate-400"
              }`}
            >
              <Camera className="h-4 w-4" />
              离线分析
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={!!activeRecordingTask}
              onClick={() => onTabChange("realtime")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                activeTab === "realtime" ? "bg-blue-600 text-white shadow-md" : "text-slate-400"
              }`}
            >
              <Radio className="h-4 w-4" />
              实时分析
            </motion.button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Auto Analysis Toggle Capsule */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl border border-slate-800 bg-slate-950/60 min-h-[38px]">
              {activeRecordingTask && countdown !== null && (
                <div className="flex items-center gap-1.5 pr-1.5 mr-1 border-r border-slate-800">
                  <Zap className="h-3.5 w-3.5 fill-blue-500 text-blue-500 animate-pulse" />
                  <span className="font-mono text-xs font-black text-blue-400 tabular-nums">
                    {countdown}s
                  </span>
                </div>
              )}
              <span className="text-[10px] font-bold text-slate-400">自动分析</span>
              <button
                onClick={() => {
                  if (activeRecordingTask) {
                    setShowDisableConfirm(true);
                  } else {
                    setShowEnableConfirm(true);
                  }
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all focus:outline-none ${
                  activeRecordingTask ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-700'
                }`}
                style={{ minWidth: "36px" }}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    activeRecordingTask ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Config & Settings buttons */}
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => setShowRecordingModal(true)}
              disabled={!!activeRecordingTask}
              className={`p-2 rounded-2xl border transition-all disabled:opacity-50 flex items-center justify-center ${
                activeRecordingTask
                  ? "bg-red-950/60 border-red-800 text-red-400"
                  : "bg-slate-800 border-slate-700 text-slate-100"
              }`}
              style={{ minWidth: "38px", minHeight: "38px" }}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => setShowSettings(true)}
              disabled={!!activeRecordingTask}
              className="p-2 bg-slate-800 border border-slate-700 text-slate-100 flex items-center justify-center rounded-2xl"
              style={{ minWidth: "38px", minHeight: "38px" }}
            >
              <Settings className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Video Container & Thumb floating action bar */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 flex-1 min-h-0">
        <div className="aspect-[21/9] w-full relative h-full">
          <div ref={playerContainerRef} className="h-full w-full" />

          {/* Status Display Overlays */}
          {status !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center z-10">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-950/60 text-blue-400">
                {status === "connecting" ? (
                  <RefreshCw className="h-6 w-6 animate-spin" />
                ) : status === "error" ? (
                  <AlertCircle className="h-6 w-6" />
                ) : (
                  <Radio className="h-6 w-6" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-100">{statusText}</div>
              <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-slate-400">
                {status === "connecting"
                  ? "正在初始化播放器并连接实时巡检视频，请稍候。"
                  : status === "error"
                    ? error || "监控连接失败，请检查配置或刷新 Token。"
                    : "请点击右上角设置配置您的萤石云监控流地址。"}
              </p>
            </div>
          )}

          {/* REC / AUDIO Indicators */}
          {(isManualVideoRecording || isManualAudioRecording) && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[9px] font-bold text-white shadow-lg backdrop-blur-md z-15">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span>{isManualVideoRecording ? "REC" : "AUDIO"}</span>
              <span className="font-mono">{
                isManualVideoRecording
                  ? `${Math.floor(manualVideoDuration / 60).toString().padStart(2, '0')}:${(manualVideoDuration % 60).toString().padStart(2, '0')}`
                  : `${Math.floor(manualAudioDuration / 60).toString().padStart(2, '0')}:${(manualAudioDuration % 60).toString().padStart(2, '0')}`
              }</span>
            </div>
          )}

          {activeRecordingTask && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-red-900/50 bg-red-950/60 px-2.5 py-1 backdrop-blur-md z-15">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">自动任务运行中</span>
            </div>
          )}

          {/* Thumb-Friendly Vertical Floating Action Toolbar (On the Right Edge for easy thumb accessibility when holding tablet) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 rounded-2xl bg-slate-900/80 p-1.5 border border-slate-700/40 backdrop-blur-md shadow-2xl z-20">
            {/* Standard 44x44px Tap Targets */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={handleManualCaptureClick}
              disabled={status !== "ready" || !!activeRecordingTask}
              className="w-11 h-11 rounded-xl bg-slate-950/50 hover:bg-slate-800 text-slate-100 flex items-center justify-center transition-colors disabled:opacity-30"
              title="手动截图"
            >
              <Camera className="h-5 w-5 text-blue-400" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={handleManualVideoToggle}
              disabled={status !== "ready" || !!activeRecordingTask || (isGlobalRecording && !isManualVideoRecording)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 ${
                isManualVideoRecording
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-slate-950/50 text-slate-100 hover:bg-slate-800"
              }`}
              title="手动录像"
            >
              <Video className="h-5 w-5 text-emerald-400" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={handleManualAudioToggle}
              disabled={status !== "ready" || !!activeRecordingTask || (isGlobalRecording && !isManualAudioRecording)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 ${
                isManualAudioRecording
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-slate-950/50 text-slate-100 hover:bg-slate-800"
              }`}
              title="手动录音"
            >
              <Mic className="h-5 w-5 text-amber-400" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Settings Modal - Large touch inputs */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-[460px] rounded-3xl border border-slate-800 bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">平板监控流配置</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
                  style={{ minWidth: "44px", minHeight: "44px" }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <section className="space-y-4">
                  <div>
                    <h3 className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                      萤石云开发者凭证
                    </h3>
                    <div className="space-y-3 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase">App Key</label>
                        <input
                          type="text"
                          value={ezvizAppKey}
                          onChange={(e) => setEzvizAppKey(e.target.value)}
                          placeholder="AppKey"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 font-mono text-[11px] text-slate-100 placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase">App Secret</label>
                        <input
                          type="password"
                          value={ezvizAppSecret}
                          onChange={(e) => setEzvizAppSecret(e.target.value)}
                          placeholder="Secret"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 font-mono text-[11px] text-slate-100 placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none"
                        />
                      </div>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRefreshEzvizToken}
                        disabled={isFetchingToken || !ezvizAppKey || !ezvizAppSecret}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-900/30 bg-blue-950/20 py-3 text-[11px] font-black uppercase tracking-wider text-blue-400 transition-colors disabled:opacity-50"
                        style={{ minHeight: "44px" }}
                      >
                        <RefreshCw className={`h-4 w-4 ${isFetchingToken ? "animate-spin" : ""}`} />
                        {isFetchingToken ? "正在获取 Token..." : "自动获取并刷新 Access Token"}
                      </motion.button>
                    </div>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                      监控镜头与在线设备
                    </h3>
                    <div className="space-y-4 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase">选择镜头设备</label>
                        <div className="relative">
                          <select
                            value={tempUrl}
                            onChange={(e) => setTempUrl(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-10 py-3 font-mono text-[11px] text-slate-100 focus:outline-none focus:border-blue-500/50"
                            style={{ minHeight: "44px" }}
                          >
                            {deviceList.length === 0 ? (
                              <option value={DEFAULT_STREAM_URL}>默认测试流 ({DEFAULT_STREAM_URL})</option>
                            ) : (
                              deviceList.map((dev, idx) => (
                                <option key={idx} value={dev.value}>{dev.label}</option>
                              ))
                            )}
                          </select>
                          <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => tempToken && fetchDeviceList(tempToken)}
                              disabled={isFetchingDevices || !tempToken}
                              className="p-1 rounded text-slate-500 hover:text-blue-400"
                            >
                              <RefreshCw className={`h-4 w-4 ${isFetchingDevices ? "animate-spin" : ""}`} />
                            </button>
                            <ChevronDown className="h-4 w-4 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowSettings(false)}
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-3 text-xs font-bold text-slate-400"
                          style={{ minHeight: "44px" }}
                        >
                          取消
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            handleSaveConfig();
                            setShowSettings(false);
                          }}
                          className="flex-[2] rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20"
                          style={{ minHeight: "44px" }}
                        >
                          保存并连接
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enable Confirm Dialog */}
      <AnimatePresence>
        {showEnableConfirm && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[170]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEnableConfirm(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[110]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-[360px] rounded-3xl border border-slate-800 bg-[#0f172a] p-5 shadow-2xl z-[170]"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg bg-blue-500/10 p-1.5">
                  <BrainCircuit className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">开启自动周期巡检</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                确定开启自动任务吗？系统将按照设定的时间间隔和规则，自动进行画面采集并推送至 AI 引擎深度研判。
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowEnableConfirm(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-3 text-xs font-bold text-slate-400"
                    style={{ minHeight: "44px" }}
                  >
                    取消
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const savedConfig = resolveRecordingConfig();
                      if (savedConfig) {
                        onSaveRecordingTask(savedConfig);
                      } else {
                        onSaveRecordingTask({
                          videoEnabled: true,
                          duration: 5,
                          audioEnabled: false,
                          audioBitrate: 128,
                          imageCaptureEnabled: true,
                          imageQuality: "HD",
                          triggerInterval: 5,
                          timeRange: {
                            startDate: new Date().toISOString().split("T")[0],
                            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                            startTime: "00:00",
                            endTime: "23:59",
                          },
                          storagePath: "",
                          storageEnabled: false,
                        });
                      }
                      setShowEnableConfirm(false);
                    }}
                    className="flex-[1.5] rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20"
                    style={{ minHeight: "44px" }}
                  >
                    确定开启
                  </motion.button>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowEnableConfirm(false);
                    setShowRecordingModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-blue-900/30 bg-blue-950/20 py-3 text-xs font-bold text-blue-400"
                  style={{ minHeight: "44px" }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  配置自动任务参数
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Disable Confirm Dialog */}
      <AnimatePresence>
        {showDisableConfirm && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[170]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDisableConfirm(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[110]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[420px] rounded-3xl border border-red-500/20 bg-slate-900 shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden z-[170]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 p-5 bg-gradient-to-r from-red-950/20 via-slate-900 to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <AlertCircle className="h-4 w-4 text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 font-sans tracking-wide">停止自动巡检</h2>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-0.5">Disable Auto Inspection</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDisableConfirm(false)}
                  className="group rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-300 hover:rotate-90 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    当前有正在执行中的周期巡检，是否确定立即停止？
                  </p>
                  <div className="space-y-2 pt-2 border-t border-slate-800/40">
                    <div className="flex items-start gap-2 text-[11px] text-slate-400">
                      <span className="text-red-500 font-bold">•</span>
                      <span>停止后将不再自动收集监控切片及视频素材</span>
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-slate-400">
                      <span className="text-red-500 font-bold">•</span>
                      <span>后台自动循环触发的 AI 巡检分析任务将立即终止</span>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDisableConfirm(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-slate-100 transition-all duration-200 active:scale-98 cursor-pointer"
                    style={{ minHeight: "44px" }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      onStopRecordingTask();
                      setShowDisableConfirm(false);
                    }}
                    className="flex-[1.4] rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 py-3 text-xs font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.25)] hover:shadow-[0_4px_20px_rgba(239,68,68,0.4)] transition-all duration-200 active:scale-98 cursor-pointer"
                    style={{ minHeight: "44px" }}
                  >
                    确认停止
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RecordingConfigModal
        isOpen={showRecordingModal}
        onClose={() => setShowRecordingModal(false)}
        onSave={onSaveRecordingTask}
        onStop={onStopRecordingTask}
        isActive={!!activeRecordingTask}
        initialConfig={activeRecordingTask?.config}
      />
    </div>
  );
});
