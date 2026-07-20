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
    anchor.hasAttribute("download")
    || href.startsWith("blob:")
    || href.startsWith("data:image/")
    || /\.(png|jpe?g|webp|bmp)(\?|$)/i.test(href)
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
      nextUrl.startsWith("blob:")
      || nextUrl.startsWith("data:image/")
      || /\.(png|jpe?g|webp|bmp)(\?|$)/i.test(nextUrl)
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

export interface RealtimeAnalysisPanelHandle {
  captureScreenshot: () => Promise<string | null>;
  getContainerRect: () => DOMRect | null;
  startRecording: (options?: { video?: boolean; audio?: boolean; duration?: number }) => Promise<void>;
  stopRecording: () => Promise<string | null>;
}

interface RealtimeAnalysisPanelProps {
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
  ref?: React.Ref<RealtimeAnalysisPanelHandle>;
}

export const RealtimeAnalysisPanel = React.forwardRef<RealtimeAnalysisPanelHandle, RealtimeAnalysisPanelProps>(({
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

  // --- 逻辑提取 ---

  const internalCaptureScreenshot = useCallback(async () => {
    if (status !== "ready") return null;

    // 如果是自动任务触发，可能需要检查配置；但手动截图通常跳过配置检查
    // const recordingConfig = resolveRecordingConfig();
    // if (recordingConfig && !recordingConfig.imageCaptureEnabled) return null;

    try {
      console.log("[RealtimePanel] Starting robust capture (No-Download Mode)...");

      const sdkPlayer = (playerRef.current as any);

      // 1. 优先恢复到 SDK 官方截图链路
      if (sdkPlayer && typeof sdkPlayer.capturePicture === "function") {
        try {
          const sdkCapture = await withCaptureDownloadSuppressed(async () => sdkPlayer.capturePicture());
          const image = await normalizeCapturedImage(sdkCapture);
          if (image && !(await isBlankImage(image))) {
            return image;
          }
        } catch (e) {
          console.warn("[RealtimePanel] SDK capturePicture failed:", e);
        }
      }

      // 2. 次选 SDK 内部截图方法
      const internalPlayer = sdkPlayer?._player || sdkPlayer?.jessibuca;
      if (internalPlayer && typeof internalPlayer.screenshot === "function") {
        try {
          const internalCapture = internalPlayer.screenshot();
          const image = await normalizeCapturedImage(internalCapture);
          if (image && !(await isBlankImage(image))) {
            return image;
          }
        } catch (e) {
          console.warn("[RealtimePanel] SDK internal screenshot failed:", e);
        }
      }

      // 3. 兜底方案：Canvas 捕获
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
            console.warn("[RealtimePanel] Canvas capture candidate failed:", e);
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
      console.error("[RealtimePanel] Global capture error:", err);
      return null;
    }
  }, [status]);

  const internalStartRecording = useCallback(async (options?: { video?: boolean; audio?: boolean; duration?: number }) => {
    if (!playerContainerRef.current || status !== "ready") return;

    // 避免冲突：如果已经在录制中，则忽略新请求
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.warn("[RealtimePanel] Recording already in progress, ignoring request");
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
      console.warn("[RealtimePanel] Recording aborted: no capture source found");
      return;
    }
    try {
      let stream: MediaStream | null = null;
      if ((source as any).captureStream) {
        stream = (source as any).captureStream();
      } else if ((source as any).msCaptureStream) {
        stream = (source as any).msCaptureStream();
      }

      if (!stream) {
        console.warn("[RealtimePanel] Could not capture stream from source");
        return;
      }

      // 处理音频轨道：如果开启了音频录制但流中没有音频轨道，尝试获取麦克风
      if (audioEnabled && stream.getAudioTracks().length === 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const micTrack = micStream.getAudioTracks()[0];
          if (micTrack) {
            stream.addTrack(micTrack);
            // 确保在录制停止时也停止麦克风轨道
            micTrack.onended = () => console.log("Mic track ended");
          }
        } catch (micErr) {
          console.warn("[RealtimePanel] Failed to access microphone for audio recording:", micErr);
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

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000
      });

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
      console.error("[RealtimePanel] Start recording failed:", err);
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
        // 停止流中的所有轨道
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

  // --- 手动功能实现 ---

  // 1. 手动截图
  const handleManualCaptureClick = async () => {
    if (status !== "ready") return;
    const image = await internalCaptureScreenshot();
    if (image && onManualCapture) {
      onManualCapture(image, playerContainerRef.current?.getBoundingClientRect() || null);
    }
  };

  // 2. 手动视频录制
  const handleManualVideoToggle = async () => {
    if (status !== "ready") return;

    if (isManualVideoRecording) {
      // 停止录制
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
      // 开始录制
      setIsManualVideoRecording(true);
      setManualVideoDuration(0);
      internalStartRecording({ video: true, audio: true }); // 手动视频默认带音频

      manualVideoTimerRef.current = window.setInterval(() => {
        setManualVideoDuration(prev => prev + 1);
      }, 1000);
    }
  };

  // 3. 手动音频录制
  const handleManualAudioToggle = async () => {
    if (status !== "ready") return;

    if (isManualAudioRecording) {
      // 停止录制
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
      // 开始录制
      setIsManualAudioRecording(true);
      setManualAudioDuration(0);
      internalStartRecording({ video: false, audio: true }); // 手动音频仅录制音频

      manualAudioTimerRef.current = window.setInterval(() => {
        setManualAudioDuration(prev => prev + 1);
      }, 1000);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (manualVideoTimerRef.current) window.clearInterval(manualVideoTimerRef.current);
      if (manualAudioTimerRef.current) window.clearInterval(manualAudioTimerRef.current);
    };
  }, []);

  const [tempUrl, setTempUrl] = useState(config.streamUrl);
  const [tempToken, setTempToken] = useState(config.accessToken);
  const [ezvizAppKey, setEzvizAppKey] = useState(localStorage.getItem("EZVIZ_APP_KEY") || "");
  const [ezvizAppSecret, setEzvizAppSecret] = useState(localStorage.getItem("EZVIZ_APP_SECRET") || "");
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showNotReadyWarning, setShowNotReadyWarning] = useState(false);
  const [deviceList, setDeviceList] = useState<EzvizDevice[]>([]);
  const [isFetchingDevices, setIsFetchingDevices] = useState(false);

  useEffect(() => {
    setTempUrl(config.streamUrl);
    setTempToken(config.accessToken);
  }, [config.streamUrl, config.accessToken]);

  const fetchDeviceList = useCallback(async (token: string) => {
    if (!token || token.length < 20) return;
    setIsFetchingDevices(true);
    console.log("[RealtimePanel] Fetching device list with token:", token.substring(0, 10) + "...");
    try {
      const devices = await getEzvizDevices(token);
      console.log("[RealtimePanel] Device list data:", devices);

      if (devices && devices.length > 0) {
        const list = devices
          .filter((item: any) => item.status === 1)
          .map((item: any) => ({
            label: item.deviceName || item.name || item.deviceSerial || "未知设备",
            value: item.url || item.liveUrl || `ezopen://open.ys7.com/${item.deviceSerial || item.serial}/${item.channelNo || 1}.hd.live`,
          }));
        console.log("[RealtimePanel] Processed device list:", list);
        setDeviceList(list);
      } else {
        console.warn("[RealtimePanel] No devices found or empty response:", devices);
      }
    } catch (err: any) {
      if (err.message?.includes("数据异常")) {
        console.warn("[RealtimePanel] Device list fetch returned '数据异常' - token might be expired.");
      } else {
        console.error("[RealtimePanel] Failed to fetch device list:", err);
      }
    } finally {
      setIsFetchingDevices(false);
    }
  }, []); // 移除了 tempUrl 依赖，解决循环刷新问题

  useEffect(() => {
    if (tempToken && tempToken.length > 20) {
      fetchDeviceList(tempToken);

      const interval = setInterval(() => {
        fetchDeviceList(tempToken);
      }, 30000);
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
      console.error("[RealtimePanel] Failed to refresh token:", err);
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
    // 如果设备列表不为空，且当前没有配置视频流地址（或使用的是默认测试地址）
    if (deviceList.length > 0 && (!config.streamUrl || config.streamUrl === DEFAULT_STREAM_URL)) {
      const firstDevice = deviceList[0];
      console.log("[RealtimePanel] Auto-loading first video:", firstDevice.label);

      const nextConfig = {
        ...config,
        streamUrl: firstDevice.value,
        accessToken: tempToken || config.accessToken // 确保使用最新的 token
      };

      // 1. 更新父组件配置，从而触发播放器初始化
      onConfigChange(nextConfig);
      // 2. 同步到本地存储，确保刷新后依然生效
      localStorage.setItem("ai_analysis_stream_config", JSON.stringify(nextConfig));
      // 3. 触发连接动作
      onConnect();
    }
  }, [deviceList, config, onConfigChange, onConnect, tempToken]);


  const syncPlayerSize = () => {
    const container = playerContainerRef.current;
    const player = playerRef.current;
    if (!container || !player) return;
    
    const rect = container.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    
    // Explicitly update container size
    container.style.width = '100%';
    container.style.height = '100%';

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
    try {
      player.stop?.();
    } catch { }
    try {
      player.destroy?.();
    } catch { }
    playerRef.current = null;
    const container = playerContainerRef.current;
    if (container) {
      container.innerHTML = "";
    }
  };

  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, []);

  useEffect(() => {
    if (!connectVersion) return;

    const seq = ++initSeqRef.current;
    const { streamUrl, accessToken } = config;
    const container = playerContainerRef.current;
    if (!container) return;

    // if (!streamUrl.trim()) {
    //   onStatusChange("error", "请先填写实时监控流地址。");
    //   return;
    // }
    // if (!accessToken.trim()) {
    //   onStatusChange("error", "请先填写 Access Token。");
    //   return;
    // }

    destroyPlayer();
    onStatusChange("connecting", null);

    const boot = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      if (seq !== initSeqRef.current) return;

      try {
        container.id = "ai-analysis-ezviz-container";
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
          plugin: ["talk", "ptz"], // 启用对讲和云台控制
          autoplay: true,
          useWebCodecs: false,
          scaleMode: 1, // 比例缩放
          showPt: true, // 显示云台控制
          width: container.clientWidth > 0 ? container.clientWidth : 1280,
          height: container.clientHeight > 0 ? container.clientHeight : 720,
          handleSuccess: () => {
            if (seq !== initSeqRef.current) return;
            window.setTimeout(() => syncPlayerSize(), 0);
            window.setTimeout(() => syncPlayerSize(), 100);
            window.setTimeout(() => syncPlayerSize(), 300);
          },
          handleError: (playerError: unknown) => {
            if (seq !== initSeqRef.current) return;
            console.error("[RealtimePanel] EZUIKit error:", playerError);
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

        const resizeObserver = new ResizeObserver((entries) => {
          window.requestAnimationFrame(() => syncPlayerSize());
        });
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
      if (seq === initSeqRef.current) {
        destroyPlayer();
      }
    };
  }, [config, connectVersion, onStatusChange]);

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

    // 触发重连
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
    <div className="h-full flex flex-col">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/50 pb-4 mb-0">
        <div className="flex flex-wrap items-center justify-between w-full gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1">
            <button
              type="button"
              disabled={!!activeRecordingTask}
              onClick={() => onTabChange("offline")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${activeTab === "offline" ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-slate-200"
                }`}
              title={activeRecordingTask ? "自动分析运行中，禁用模式切换" : "离线分析"}
            >
              <span className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                离线分析
              </span>
            </button>
            <button
              type="button"
              disabled={!!activeRecordingTask}
              onClick={() => onTabChange("realtime")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${activeTab === "realtime" ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-slate-200"
                }`}
              title={activeRecordingTask ? "自动分析运行中，禁用模式切换" : "实时分析"}
            >
              <span className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                实时分析
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* 自动分析开关 */}
            <div 
              onClick={() => {
                if (activeRecordingTask) {
                  setShowDisableConfirm(true);
                } else {
                  if (status !== 'ready') {
                    setShowNotReadyWarning(true);
                    return;
                  }
                  setShowEnableConfirm(true);
                }
              }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-sm cursor-pointer select-none"
            >
              {activeRecordingTask && countdown !== null && (
                <div className="flex items-center gap-2 pr-2 mr-2 border-r border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 fill-blue-500 text-blue-500 animate-pulse" />
                    <span className="font-mono text-xs font-black text-blue-400 tabular-nums">
                      {countdown}s
                    </span>
                  </div>
                </div>
              )}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自动分析</span>
              <div
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 focus:outline-none pointer-events-none ${activeRecordingTask ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-700'
                  }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 ${activeRecordingTask ? 'translate-x-5' : 'translate-x-1'
                    }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecordingModal(true)}
                disabled={!!activeRecordingTask}
                className={`p-2 rounded-full border transition-all shadow-lg disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${activeRecordingTask
                  ? "bg-red-950/60 border-red-800 text-red-400"
                  : "bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
                  }`}
                title={activeRecordingTask ? "自动分析运行中，禁用配置修改" : "自动分析配置"}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                disabled={!!activeRecordingTask}
                className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 transition-all shadow-lg disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                title={activeRecordingTask ? "自动分析运行中，禁用监控配置" : "监控配置"}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl relative overflow-hidden flex-grow flex flex-col min-h-0">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 flex-grow flex flex-col min-h-0">
          <div className="relative w-full h-full min-h-0">
            <div ref={playerContainerRef} className="h-full w-full" />
          </div>

          {/* 功能按钮 - 右上角 */}
          <div className="absolute right-3 top-3 flex items-center gap-2 z-20">
            {/* 手动录制时长显示 */}
            {(isManualVideoRecording || isManualAudioRecording) && (
              <div className="flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-md">
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
              <div className="flex items-center gap-2 rounded-full border border-red-900/50 bg-red-950/40 px-3 py-1.5 backdrop-blur-md">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">正在自动分析</span>
              </div>
            )}
            <div className="h-4 w-[1px] bg-slate-700/50 mx-1" />

            <div className="flex items-center gap-1 rounded-full bg-slate-800/80 p-1 border border-slate-700/50 backdrop-blur-sm shadow-lg">
              <button
                onClick={handleManualCaptureClick}
                disabled={status !== "ready" || !!activeRecordingTask}
                className="p-1.5 rounded-full text-slate-100 hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                title={activeRecordingTask ? "自动分析运行中，禁用手动截图" : "手动截图"}
              >
                <Camera className="h-4 w-4" />
              </button>

              <button
                onClick={handleManualVideoToggle}
                disabled={status !== "ready" || !!activeRecordingTask || (isGlobalRecording && !isManualVideoRecording)}
                className={`p-1.5 rounded-full transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${isManualVideoRecording
                  ? "bg-red-600 text-white animate-pulse"
                  : "text-slate-100 hover:bg-slate-700"
                  }`}
                title={activeRecordingTask ? "自动分析运行中，禁用手动录像" : (isManualVideoRecording ? "停止录像" : "开始录像")}
              >
                <Video className="h-4 w-4" />
              </button>

              <button
                onClick={handleManualAudioToggle}
                disabled={status !== "ready" || !!activeRecordingTask || (isGlobalRecording && !isManualAudioRecording)}
                className={`p-1.5 rounded-full transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${isManualAudioRecording
                  ? "bg-red-600 text-white animate-pulse"
                  : "text-slate-100 hover:bg-slate-700"
                  }`}
                title={activeRecordingTask ? "自动分析运行中，禁用手动录音" : (isManualAudioRecording ? "停止录音" : "开始录音")}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>




          </div>

          {status !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center z-10 select-none">
              <div className="space-y-2 max-w-sm">
                <div className="text-sm font-bold text-slate-100 tracking-wide font-sans">
                  {status === "connecting" ? "正在连接监控视频" : status === "error" ? "监控连接失败" : "监控未连接"}
                </div>
                <p className="text-xs leading-relaxed text-slate-400 font-sans">
                  {status === "connecting"
                    ? "系统正在努力建立安全监控流连接，请稍候..."
                    : status === "error"
                      ? error || "无法获取实时视频流数据，请确认配置或网络连接。"
                      : "请点击右上角设置图标，配置正确的萤石监控流地址。"}
                </p>
                {status === "error" && (
                  <p className="text-[10px] text-amber-500/80 font-medium pt-1">
                    提示：请确保填写的 AppKey, Secret 和流地址均有效且匹配
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 设置弹窗 */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[500px] max-h-[90vh] rounded-3xl border border-slate-800 bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-blue-500/10 p-1.5">
                    <Settings className="h-4 w-4 text-blue-400" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">监控配置 (Settings)</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <section className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      萤石云开发者配置 (EZVIZ Developer)
                    </h3>
                    <div className="space-y-4 rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">App Key</label>
                          <input
                            type="text"
                            value={ezvizAppKey}
                            onChange={(e) => setEzvizAppKey(e.target.value)}
                            placeholder="开发者 AppKey"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">App Secret</label>
                          <input
                            type="password"
                            value={ezvizAppSecret}
                            onChange={(e) => setEzvizAppSecret(e.target.value)}
                            placeholder="开发者 Secret"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshEzvizToken}
                        disabled={isFetchingToken || !ezvizAppKey || !ezvizAppSecret}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-900/30 bg-blue-950/20 py-2.5 text-[11px] font-bold uppercase tracking-wider text-blue-400 transition-all hover:bg-blue-900/40 disabled:opacity-50 disabled:hover:bg-blue-950/20"
                      >
                        {isFetchingToken ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {isFetchingToken ? "正在获取 Token..." : "自动刷新 Access Token"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      视频流与设备 (Stream & Devices)
                    </h3>

                    <div className="space-y-5 rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
                      <div className="space-y-2">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">快速选择设备 (Select Device)</label>
                        <div className="relative">
                          <select
                            value={tempUrl}
                            onChange={(e) => setTempUrl(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 pl-10 pr-10 py-2.5 font-mono text-[11px] text-slate-100 focus:border-blue-500/50 focus:outline-none transition-colors"
                          >
                            {deviceList.length === 0 ? (
                              <option value={DEFAULT_STREAM_URL}>默认测试流 ({DEFAULT_STREAM_URL})</option>
                            ) : (
                              <>
                                {/* <option value="">-- 请选择在线设备 --</option> */}
                                {deviceList.map((dev, idx) => (
                                  <option key={idx} value={dev.value}>{dev.label}</option>
                                ))}
                              </>
                            )}
                          </select>
                          <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => tempToken && fetchDeviceList(tempToken)}
                              disabled={isFetchingDevices || !tempToken}
                              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors"
                              title="手动刷新设备列表"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isFetchingDevices ? "animate-spin" : ""}`} />
                            </button>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                        {isFetchingDevices && (
                          <div className="flex items-center gap-2 text-[10px] text-blue-400 animate-pulse">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            正在刷新设备列表...
                          </div>
                        )}
                      </div>

                      {/* <div className="space-y-2">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">实时流地址 (EZOpen URL)</label>
                        <textarea
                          rows={2}
                          value={tempUrl}
                          onChange={(event) => setTempUrl(event.target.value)}
                          placeholder="请输入 EZOpen 监控流地址"
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors resize-none"
                        />
                      </div> */}

                      {/* <div className="space-y-2">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Access Token</label>
                        <input
                          type="password"
                          value={tempToken}
                          onChange={(event) => setTempToken(event.target.value)}
                          placeholder="请输入监控平台 Access Token"
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors"
                        />
                      </div> */}

                      {/* <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 font-mono text-[10px] text-slate-500">
                        <div className="flex justify-between items-center mb-2">
                          <span>当前状态</span>
                          <span className={`px-2 py-0.5 rounded-full border border-slate-800 ${statusColor}`}>{statusText}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>上次保存时间</span>
                          <span>{lastSavedAt || "尚未保存"}</span>
                        </div>
                      </div> */}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowSettings(false)}
                          className="flex-1 rounded-lg border border-slate-800 bg-slate-900 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveConfig();
                            setShowSettings(false);
                          }}
                          className="flex-[2] rounded-lg bg-blue-600 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500"
                        >
                          应用并连接
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 开启自动分析确认弹窗 */}
      <AnimatePresence>
        {showEnableConfirm && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[140]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEnableConfirm(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md z-[110]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-[420px] rounded-3xl border border-slate-800 bg-[#0b1329]/95 shadow-2xl overflow-hidden z-[140] transition-all duration-500 ${showRecordingModal ? "-translate-x-64" : ""
                }`}
            >
              <div className="flex items-center justify-between border-b border-slate-850 p-5 bg-slate-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-blue-500/10 p-2">
                    <BrainCircuit className="h-4.5 w-4.5 text-blue-400" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-sans">开启自动分析</h2>
                </div>
                <button
                  onClick={() => setShowEnableConfirm(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  是否确认开启自动分析功能？系统将根据预设参数自动执行多模态AI分析。
                </p>

                {(() => {
                  const currentConfig = resolveRecordingConfig() || {
                    videoEnabled: true,
                    duration: 5,
                    audioEnabled: false,
                    imageCaptureEnabled: true,
                    imageQuality: "HD",
                    triggerInterval: 5,
                    timeRange: { startTime: "00:00", endTime: "23:59" }
                  };
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4 space-y-3 font-mono text-[11px] leading-relaxed">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <span className="text-slate-400 font-sans font-semibold">当前预设分析配置</span>
                        <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-sans font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          就绪
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex justify-between">
                          <span className="text-slate-500">分析间隔:</span>
                          <span className="text-slate-300 font-bold">{currentConfig.triggerInterval} 秒 / 次</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">画面质量:</span>
                          <span className="text-slate-300 font-bold">{currentConfig.imageQuality || "HD"}</span>
                        </div>
                        <div className="flex justify-between col-span-2 border-t border-slate-950 pt-2">
                          <span className="text-slate-500">监测时段:</span>
                          <span className="text-slate-300 font-bold">
                            {currentConfig.timeRange?.startTime || "00:00"} - {currentConfig.timeRange?.endTime || "23:59"}
                          </span>
                        </div>
                        <div className="flex justify-between col-span-2">
                          <span className="text-slate-500">短视频抓拍:</span>
                          <span className="text-slate-300 font-bold">{currentConfig.videoEnabled ? `启用 (${currentConfig.duration}s)` : "已禁用"}</span>
                        </div>
                      </div>
                      
                      <div className="mt-2.5 pt-2 border-t border-slate-900/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowRecordingModal(true)}
                          className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 px-2 py-1 rounded-md transition-all font-sans font-bold cursor-pointer"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          修改配置参数
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowEnableConfirm(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      const config = resolveRecordingConfig();
                      if (config) {
                        onSaveRecordingTask(config);
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
                    className="flex-[1.5] rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:shadow-blue-500/30 transition-all cursor-pointer active:scale-98"
                  >
                    确认开启
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 关闭自动分析确认弹窗 */}
      <AnimatePresence>
        {showDisableConfirm && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[140]">
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
              className="relative w-full max-w-[420px] rounded-3xl border border-red-500/20 bg-slate-900 shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden z-[140]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 p-5 bg-gradient-to-r from-red-950/20 via-slate-900 to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <AlertCircle className="h-4 w-4 text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 font-sans tracking-wide">关闭自动分析</h2>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-0.5">Disable Auto Analysis</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDisableConfirm(false)}
                  className="group rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-300 hover:rotate-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    当前正在执行自动分析任务，是否确认立即停止？
                  </p>
                  <div className="space-y-2 pt-2 border-t border-slate-800/40">
                    <div className="flex items-start gap-2 text-[11px] text-slate-400">
                      <span className="text-red-500 font-bold">•</span>
                      <span>停止后系统将不再自动捕获视频或图片素材</span>
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-slate-400">
                      <span className="text-red-500 font-bold">•</span>
                      <span>后台自动循环触发的 AI 分析任务将立即终止</span>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDisableConfirm(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-slate-100 transition-all duration-200 active:scale-98 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      onStopRecordingTask();
                      setShowDisableConfirm(false);
                    }}
                    className="flex-[1.4] rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 py-3 text-xs font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.25)] hover:shadow-[0_4px_20px_rgba(239,68,68,0.4)] transition-all duration-200 active:scale-98 cursor-pointer"
                  >
                    确认停止
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 视频播放器未就绪提示弹窗 */}
      <AnimatePresence>
        {showNotReadyWarning && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[140]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotReadyWarning(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[110]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[420px] rounded-3xl border border-amber-500/20 bg-slate-900 shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden z-[140]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 p-5 bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                    <AlertCircle className="h-4 w-4 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 font-sans tracking-wide">系统提示</h2>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-0.5">System Notification</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotReadyWarning(false)}
                  className="group rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-300 hover:rotate-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 space-y-1.5 text-center">
                  <p className="text-sm font-semibold text-amber-400 font-sans">
                    视频流尚未加载就绪
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    请等待监控画面正常播放，确保视频流连接就绪后再开启自动分析功能。
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowNotReadyWarning(false)}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-3 text-xs font-bold text-slate-950 shadow-[0_4px_15px_rgba(245,158,11,0.2)] hover:shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all duration-200 active:scale-98 cursor-pointer"
                  >
                    我知道了
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
