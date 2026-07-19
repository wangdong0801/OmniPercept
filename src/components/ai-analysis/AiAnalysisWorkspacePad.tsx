import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, CheckCircle2, PlaySquare, Sparkles, ChevronLeft, ChevronRight, Video, Camera, Mic, Info, ArrowRight, Database, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  AgentAnalysisResult,
  AgentAnalysisTrace,
  AgentNodeCall,
  AgentTemplate,
  AiWorkspaceTab,
  AnalysisHistoryItem,
  OfflineAssetItem,
  RealtimeStreamConfig,
  RecordingConfig,
  RecordingTask,
} from "../../types";
import { getStoredConfig } from "../../lib/configStore";
import { OfflineAnalysisPanelPad } from "./OfflineAnalysisPanelPad";
import { RealtimeAnalysisPanelPad, RealtimeAnalysisPanelPadHandle } from "./RealtimeAnalysisPanelPad";
import { AgentAnalysisPanel, AgentAnalysisPanelHandle, getThinkingLogsForTemplate } from "./AgentAnalysisPanel";
import { addToHistory } from "../../utils/analysisHistory";

type RealtimeStatus = "idle" | "connecting" | "ready" | "error";

const STORAGE_KEY = "ai_analysis_stream_config";
const ACTIVE_TASK_KEY = "active_recording_task";
const DRAFT_CONFIG_KEY = "recording_config_draft";
const HISTORY_STORAGE_KEY = "ai_analysis_history";

const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  videoEnabled: true,
  duration: 300,
  audioEnabled: false,
  audioBitrate: 128,
  imageCaptureEnabled: false,
  imageQuality: "HD",
  triggerInterval: 10,
  timeRange: {
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    startTime: "00:00",
    endTime: "23:59",
  },
  storagePath: "",
  storageEnabled: false,
};

const getPreferredTemplate = (templates: AgentTemplate[], mode: "offline" | "realtime") =>
  templates.find((template) => template.supportedModes.includes(mode)) || templates[0];

const buildNodeSummary = (
  node: Omit<AgentNodeCall, "status" | "summary">,
  mode: "offline" | "realtime",
  template: AgentTemplate,
  assets: OfflineAssetItem[],
) => {
  const imageCount = assets.filter((asset) => asset.mimeType.startsWith("image/")).length;
  const audioCount = assets.filter((asset) => asset.mimeType.startsWith("audio/")).length;
  if (mode === "realtime" && node.resourceType === "videoLibrary") {
    return `${node.nodeName} 已连接 ${node.resourceName}，对实时监控流执行连续帧扫描与事件捕获。`;
  }
  if (node.resourceType === "imageLibrary") {
    return `${node.nodeName} 调用 ${node.resourceName}，对 ${imageCount} 份图片素材进行异常比对与关键特征复核。`;
  }
  if (node.resourceType === "audioLibrary") {
    return `${node.nodeName} 调用 ${node.resourceName}，对 ${audioCount} 份音频素材进行频谱特征匹配。`;
  }
  if (node.resourceType === "tool") {
    return `${node.nodeName} 调用 ${node.resourceName}，将 ${template.name} 的中间结果整理为结构化结论。`;
  }
  return `${node.nodeName} 调用 ${node.resourceName}，执行 ${node.role}。`;
};

const buildResult = (
  mode: "offline" | "realtime",
  template: AgentTemplate,
  assets: OfflineAssetItem[],
): AgentAnalysisResult => {
  const imageCount = assets.filter((asset) => asset.mimeType.startsWith("image/")).length;
  const audioCount = assets.filter((asset) => asset.mimeType.startsWith("audio/")).length;
  const matchedResources = [
    ...template.videoLibraries.slice(0, 1),
    ...template.imageLibraries.slice(0, 1),
    ...template.audioLibraries.slice(0, 1),
    ...template.tools.slice(0, 1),
  ].filter(Boolean);

  const hasAudio = audioCount > 0;
  const hasImage = imageCount > 0;
  const riskLevel: AgentAnalysisResult["riskLevel"] =
    mode === "realtime" || (hasAudio && hasImage) ? "高" : hasImage || hasAudio ? "中" : "低";

  const headline =
    mode === "realtime"
      ? `${template.name} 已完成实时巡检分析`
      : `${template.name} 已完成离线素材分析`;

  const summary =
    mode === "realtime"
      ? `系统已基于实时监控流完成连续画面分析，并结合 ${template.name} 的默认节点编排输出风险结论。`
      : `系统已对 ${assets.length} 个离线素材完成联合研判，其中图片 ${imageCount} 个、音频 ${audioCount} 个。`;

  const recommendations =
    mode === "realtime"
      ? [
          "继续保持实时画面在线，便于后续节点持续复核。",
          "对命中的关键事件时间点进行人工复检并截取快照归档。",
          "若风险等级持续偏高，建议触发现场告警或派发巡检任务。",
        ]
      : [
          "对已上传素材关联的现场设备或区域进行复查，确认是否存在持续异常。",
          "将命中的图片或音频素材补充进标准样本库，完善后续 AI 比对能力。",
          "根据当前模版输出结果，安排二次分析或人工复核流程。",
        ];

  return {
    headline,
    summary,
    riskLevel,
    matchedResources,
    recommendations,
  };
};

interface AiAnalysisWorkspacePadProps {
  aiMode?: "mock" | "local" | "gemini" | "qwen";
  onActiveTaskChange?: (active: boolean) => void;
}

export const AiAnalysisWorkspacePad: React.FC<AiAnalysisWorkspacePadProps> = ({ aiMode = "mock", onActiveTaskChange }) => {
  const [activeTab, setActiveTab] = useState<AiWorkspaceTab>("realtime");

  // Load dynamic templates from configStore
  const configs = useMemo(() => getStoredConfig(), []);
  const dynamicTemplates = useMemo<AgentTemplate[]>(() => {
    return configs.templates.map(tmpl => {
      const agent = configs.agents.find(a => a.id === tmpl.agentId);
      const sampleLib = configs.samples.find(s => s.id === tmpl.sampleLibraryId);
      const skills = (tmpl.skillIds || []).map(sid => configs.skills.find(s => s.id === sid)).filter((s): s is any => !!s);

      const nodeFlow: Omit<AgentNodeCall, "status" | "summary">[] = [];

      // Add resource node
      if (sampleLib) {
        nodeFlow.push({
          id: `node-lib-${tmpl.id}`,
          nodeName: "标准样本库加载",
          role: tmpl.type === "image" ? "执行图像特征库匹配" : "执行声学指纹比对",
          resourceType: tmpl.type === "image" ? "imageLibrary" : "audioLibrary",
          resourceName: sampleLib.name
        });
      }

      // Add skill nodes
      skills.forEach((s, idx) => {
        nodeFlow.push({
          id: `node-skill-${tmpl.id}-${idx}`,
          nodeName: s.name,
          role: "执行专业认知研判",
          resourceType: "tool",
          resourceName: s.name
        });
      });

      // Add agent node
      if (agent) {
        nodeFlow.push({
          id: `node-agent-${tmpl.id}`,
          nodeName: "决策智能体",
          role: "汇总分析并输出结论",
          resourceType: "agent",
          resourceName: agent.name
        });
      }

      return {
        id: tmpl.id,
        name: tmpl.name,
        description: tmpl.description,
        agents: agent ? [agent.name] : [],
        videoLibraries: tmpl.type === "audio" ? (sampleLib ? [sampleLib.name] : []) : [],
        imageLibraries: tmpl.type === "image" ? (sampleLib ? [sampleLib.name] : []) : [],
        audioLibraries: [],
        tools: skills.map(s => s.name),
        supportedModes: ["offline", "realtime"],
        defaultNodeFlow: nodeFlow.length > 0 ? nodeFlow : [
          {
            id: `node-default-${tmpl.id}`,
            nodeName: "通用研判节点",
            role: "执行默认分析流程",
            resourceType: "agent",
            resourceName: agent?.name || "AI 引擎"
          }
        ],
        defaultSummary: tmpl.description
      };
    });
  }, [configs]);

  const [offlineAssets, setOfflineAssets] = useState<OfflineAssetItem[]>([]);
  const [streamConfig, setStreamConfig] = useState<RealtimeStreamConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { streamUrl: "", accessToken: "" };
    }
    try {
      return JSON.parse(saved);
    } catch {
      return { streamUrl: "", accessToken: "" };
    }
  });
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [connectVersion, setConnectVersion] = useState(0);
  const [nextTriggerTime, setNextTriggerTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate>(() => {
    return getPreferredTemplate(dynamicTemplates, "realtime");
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(() => {
    const idx = dynamicTemplates.findIndex((t) => t.id === getPreferredTemplate(dynamicTemplates, "realtime").id);
    return idx !== -1 ? idx : 0;
  });
  const [slideDirection, setSlideDirection] = useState<number>(0);

  useEffect(() => {
    const idx = dynamicTemplates.findIndex((t) => t.id === selectedTemplate.id);
    if (idx !== -1 && idx !== carouselIndex) {
      setCarouselIndex(idx);
    }
  }, [selectedTemplate.id, carouselIndex, dynamicTemplates]);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // 离线和实时独立的状态域
  const [offlineState, setOfflineState] = useState({
    isAnalyzing: false,
    trace: null as AgentAnalysisTrace | null,
    result: null as AgentAnalysisResult | null,
  });

  const [realtimeState, setRealtimeState] = useState({
    isAnalyzing: false,
    trace: null as AgentAnalysisTrace | null,
    result: null as AgentAnalysisResult | null,
    captures: [] as { id: string; image: string; rect: DOMRect | null }[],
    videos: [] as { id: string; url: string; rect: DOMRect | null }[],
    audios: [] as { id: string; url: string; rect: DOMRect | null }[],
  });

  const currentTrace = activeTab === "offline" ? offlineState.trace : realtimeState.trace;
  const currentResult = activeTab === "offline" ? offlineState.result : realtimeState.result;
  const currentIsAnalyzing = activeTab === "offline" ? offlineState.isAnalyzing : realtimeState.isAnalyzing;
  const currentCaptures = activeTab === "offline"
    ? offlineAssets.filter(item => item.mimeType.startsWith("image/") || item.type === "capture").map(item => ({ id: item.id, image: item.dataUrl, rect: null }))
    : realtimeState.captures;
  const currentVideos = activeTab === "offline"
    ? offlineAssets.filter(item => item.mimeType.startsWith("video/")).map(item => ({ id: item.id, url: item.dataUrl, rect: null }))
    : realtimeState.videos;
  const currentAudios = activeTab === "offline"
    ? offlineAssets.filter(item => item.mimeType.startsWith("audio/") || item.type === "audio").map(item => ({ id: item.id, url: item.dataUrl, rect: null }))
    : realtimeState.audios;

  const assetsRef = useRef({ captures: currentCaptures, videos: currentVideos, audios: currentAudios });
  useEffect(() => {
    assetsRef.current = { captures: currentCaptures, videos: currentVideos, audios: currentAudios };
  }, [currentCaptures, currentVideos, currentAudios]);

  const realtimePanelRef = useRef<RealtimeAnalysisPanelPadHandle>(null);
  const agentPanelRef = useRef<AgentAnalysisPanelHandle>(null);
  const timeoutsRef = useRef<number[]>([]);

  const [activeRecordingTask, setActiveRecordingTask] = useState<RecordingTask | null>(() => {
    const saved = localStorage.getItem(ACTIVE_TASK_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const updateCurrentTrace = useCallback(
    (newTrace: AgentAnalysisTrace | null | ((prev: AgentAnalysisTrace | null) => AgentAnalysisTrace | null)) => {
      if (activeTab === "offline") {
        setOfflineState((prev) => ({
          ...prev,
          trace: typeof newTrace === "function" ? newTrace(prev.trace) : newTrace,
        }));
      } else {
        setRealtimeState((prev) => ({
          ...prev,
          trace: typeof newTrace === "function" ? newTrace(prev.trace) : newTrace,
        }));
      }
    },
    [activeTab],
  );

  const updateCurrentResult = useCallback(
    (newResult: AgentAnalysisResult | null) => {
      if (activeTab === "offline") {
        setOfflineState((prev) => ({ ...prev, result: newResult }));
      } else {
        setRealtimeState((prev) => ({ ...prev, result: newResult }));
      }
    },
    [activeTab],
  );

  const updateCurrentIsAnalyzing = useCallback(
    (analyzing: boolean) => {
      if (activeTab === "offline") {
        setOfflineState((prev) => ({ ...prev, isAnalyzing: analyzing }));
      } else {
        setRealtimeState((prev) => ({ ...prev, isAnalyzing: analyzing }));
      }
    },
    [activeTab],
  );

  const analysisMode = useMemo<"offline" | "realtime">(() => activeTab, [activeTab]);

  const canAnalyze =
    analysisMode === "realtime"
      ? realtimeStatus === "ready"
      : offlineAssets.length > 0 && selectedTemplate.supportedModes.includes("offline");

  const resolveRecordingConfig = useCallback((): RecordingConfig => {
    if (activeRecordingTask?.config) {
      return activeRecordingTask.config;
    }
    const draft = localStorage.getItem(DRAFT_CONFIG_KEY);
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch {
        return DEFAULT_RECORDING_CONFIG;
      }
    }
    return DEFAULT_RECORDING_CONFIG;
  }, [activeRecordingTask]);

  const resetAnalysisState = useCallback(
    (targetTab?: AiWorkspaceTab, options: { clearAssets?: boolean; clearAnalysis?: boolean } = { clearAssets: true, clearAnalysis: true }) => {
      const tabToReset = targetTab || activeTab;
      const shouldClearAnalysis = options.clearAnalysis !== false;

      if (agentPanelRef.current) {
        agentPanelRef.current.stopSimulation({ keepState: !shouldClearAnalysis });
      }

      timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      timeoutsRef.current = [];

      if (tabToReset === "offline") {
        if (shouldClearAnalysis) {
          setOfflineState({
            isAnalyzing: false,
            trace: null,
            result: null,
          });
        } else {
          setOfflineState((prev) => ({ ...prev, isAnalyzing: false }));
        }
      } else {
        setRealtimeState((prev) => ({
          isAnalyzing: false,
          trace: shouldClearAnalysis ? null : prev.trace,
          result: shouldClearAnalysis ? null : prev.result,
          captures: options.clearAssets ? [] : prev.captures,
          videos: options.clearAssets ? [] : prev.videos,
          audios: options.clearAssets ? [] : prev.audios,
        }));
      }
      setIsCapturing(false);
    },
    [activeTab],
  );

  const handleStopRecordingTask = useCallback(
    (options: { clearAssets?: boolean; clearAnalysis?: boolean } = { clearAssets: true, clearAnalysis: true }) => {
      setActiveRecordingTask(null);
      localStorage.removeItem(ACTIVE_TASK_KEY);

      resetAnalysisState("realtime", options);

      if (realtimePanelRef.current) {
        realtimePanelRef.current.stopRecording();
      }

      setNextTriggerTime(null);
      setCountdown(null);
      lastTriggeredTimeRef.current = null;
    },
    [resetAnalysisState],
  );

  const handleStartRecordingTask = useCallback(() => {
    const draft = localStorage.getItem(DRAFT_CONFIG_KEY);
    let config = DEFAULT_RECORDING_CONFIG;
    if (draft) {
      try {
        config = JSON.parse(draft);
      } catch (e) {
        console.error("Failed to parse draft config:", e);
      }
    }

    const newTask: RecordingTask = {
      id: Math.random().toString(36).substr(2, 9),
      config,
      status: "active",
      startedAt: new Date().toISOString(),
    };

    lastTriggeredTimeRef.current = null;
    setActiveRecordingTask(newTask);
    localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(newTask));

    const interval = config.triggerInterval * 1000;
    const next = new Date(newTask.startedAt).getTime() + interval;
    setNextTriggerTime(next);
  }, []);

  useEffect(() => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];

    if (activeTab === "offline" && activeRecordingTask) {
      handleStopRecordingTask({ clearAssets: false, clearAnalysis: false });
    }

    setIsCapturing(false);
  }, [activeTab]);

  const handleCaptureOnly = useCallback(
    async (force = false) => {
      if (!activeRecordingTask && !force) return;

      setIsCapturing(true);

      try {
        if (activeTab === "realtime" && realtimePanelRef.current) {
          const recordingConfig = resolveRecordingConfig();
          const rect = realtimePanelRef.current.getContainerRect();

          if (recordingConfig.imageCaptureEnabled) {
            try {
              const image = await realtimePanelRef.current.captureScreenshot();
              if (image && typeof image === "string" && image.length > 0) {
                setRealtimeState((prev) => ({
                  ...prev,
                  captures: [...prev.captures, { id: `cap_${Date.now()}`, image, rect }],
                }));
              }
            } catch (err) {
              console.error("[AiWorkspacePad] Image capture failed:", err);
            }
          }

          if ((recordingConfig.videoEnabled || recordingConfig.audioEnabled) && recordingConfig.duration > 0) {
            await new Promise<void>((resolve, reject) => {
              const startTimeout = window.setTimeout(async () => {
                try {
                  if (!realtimePanelRef.current || !activeRecordingTask) {
                    resolve();
                    return;
                  }

                  if (recordingConfig.videoEnabled) {
                    await realtimePanelRef.current.startRecording({
                      video: true,
                      audio: false,
                      duration: recordingConfig.duration,
                    });

                    await new Promise((r) => {
                      const videoStopTimeout = window.setTimeout(async () => {
                        try {
                          if (realtimePanelRef.current && activeRecordingTask) {
                            const videoUrl = await realtimePanelRef.current.stopRecording();
                            if (videoUrl) {
                              setRealtimeState((prev) => ({
                                ...prev,
                                videos: [...prev.videos, { id: `vid_${Date.now()}`, url: videoUrl, rect }],
                              }));
                            }
                          }
                        } catch (e) {
                          console.error("[AiWorkspacePad] Video recording stop failed:", e);
                        }
                        r(null);
                      }, recordingConfig.duration * 1000 + 500);
                      timeoutsRef.current.push(videoStopTimeout);
                    });
                  }

                  if (recordingConfig.audioEnabled && activeRecordingTask) {
                    await realtimePanelRef.current.startRecording({
                      video: false,
                      audio: true,
                      duration: recordingConfig.duration,
                    });

                    const audioStopTimeout = window.setTimeout(async () => {
                      try {
                        if (realtimePanelRef.current && activeRecordingTask) {
                          const audioUrl = await realtimePanelRef.current.stopRecording();
                          if (audioUrl) {
                            setRealtimeState((prev) => ({
                              ...prev,
                              audios: [...prev.audios, { id: `aud_${Date.now()}`, url: audioUrl, rect }],
                            }));
                          }
                        }
                      } catch (e) {
                        console.error("[AiWorkspacePad] Audio recording stop failed:", e);
                      }
                      resolve();
                    }, recordingConfig.duration * 1000 + 500);
                    timeoutsRef.current.push(audioStopTimeout);
                  } else {
                    resolve();
                  }
                } catch (err) {
                  reject(err);
                }
              }, 300);
              timeoutsRef.current.push(startTimeout);
            });
          }
        }
      } catch (err) {
        console.error("[AiWorkspacePad] Auto capture cycle failed:", err);
      } finally {
        setIsCapturing(false);
      }
    },
    [activeTab, resolveRecordingConfig, activeRecordingTask],
  );

  const handleStartAnalysisOnly = useCallback(
    (force = false) => {
      if (!activeRecordingTask && !force) return;

      try {
        updateCurrentIsAnalyzing(true);
        updateCurrentResult(null);
        updateCurrentTrace(null);
        if (agentPanelRef.current) {
          agentPanelRef.current.startSimulation(false);
        } else {
          updateCurrentIsAnalyzing(false);
        }
      } catch (err) {
        console.error("[AiWorkspacePad] AI Analysis trigger failed:", err);
        updateCurrentIsAnalyzing(false);
      }
    },
    [activeRecordingTask, updateCurrentIsAnalyzing, updateCurrentResult, updateCurrentTrace],
  );

  const handleCaptureAndStart = useCallback(
    async (force = false) => {
      await handleCaptureOnly(force);
      // 延迟 300ms，确保 React 状态更新并完成重绘，避免由于异步状态更新导致大模型层读取到的素材不全
      await new Promise(resolve => setTimeout(resolve, 300));
      handleStartAnalysisOnly(force);
    },
    [handleCaptureOnly, handleStartAnalysisOnly],
  );

  const handleManualStart = useCallback(() => {
    if (activeTab === "offline") {
      if (!canAnalyze || currentIsAnalyzing) return;

      if (agentPanelRef.current) {
        updateCurrentIsAnalyzing(true);
        updateCurrentResult(null);
        updateCurrentTrace(null);
        agentPanelRef.current.startSimulation(true);
      }
    } else {
      handleStartAnalysisOnly(true);
    }
  }, [activeTab, canAnalyze, currentIsAnalyzing, handleStartAnalysisOnly, updateCurrentIsAnalyzing, updateCurrentResult, updateCurrentTrace]);

  const handleSaveRecordingTask = useCallback(
    (config: RecordingConfig) => {
      const isNew = !activeRecordingTask;
      const newTask: RecordingTask = {
        id: activeRecordingTask?.id || Math.random().toString(36).substr(2, 9),
        config,
        status: "active",
        startedAt: activeRecordingTask?.startedAt || new Date().toISOString(),
      };

      if (isNew) {
        lastTriggeredTimeRef.current = null;
      }

      setActiveRecordingTask(newTask);
      localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(newTask));

      if (isNew) {
        const interval = config.triggerInterval * 1000;
        const next = new Date(newTask.startedAt).getTime() + interval;
        setNextTriggerTime(next);
      }
    },
    [activeRecordingTask],
  );

  const lastTriggeredTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeRecordingTask) {
      setNextTriggerTime(null);
      setCountdown(null);
      lastTriggeredTimeRef.current = null;
      return;
    }

    const interval = activeRecordingTask.config.triggerInterval * 1000;
    const startTime = new Date(activeRecordingTask.startedAt).getTime();

    const updateTimer = async () => {
      if (!activeRecordingTask) return;

      const now = Date.now();
      const elapsed = now - startTime;

      const nextSlot = Math.floor(elapsed / interval) + 1;
      const targetTime = startTime + nextSlot * interval;

      setNextTriggerTime(targetTime);

      // 检查生效时段
      const config = activeRecordingTask.config;
      let isWithinRange = true;
      if (config.timeRange) {
        const nowDate = new Date();
        const year = nowDate.getFullYear();
        const month = String(nowDate.getMonth() + 1).padStart(2, '0');
        const day = String(nowDate.getDate()).padStart(2, '0');
        const currentDateStr = `${year}-${month}-${day}`;

        if (config.timeRange.startDate && currentDateStr < config.timeRange.startDate) {
          isWithinRange = false;
        }
        if (config.timeRange.endDate && currentDateStr > config.timeRange.endDate) {
          isWithinRange = false;
        }

        const hours = String(nowDate.getHours()).padStart(2, '0');
        const minutes = String(nowDate.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${hours}:${minutes}`;

        if (config.timeRange.startTime && currentTimeStr < config.timeRange.startTime) {
          isWithinRange = false;
        }
        if (config.timeRange.endTime && currentTimeStr > config.timeRange.endTime) {
          isWithinRange = false;
        }
      }

      // 倒计时显示：距离 targetTime 还有多少秒；若不在生效时段，设为特殊值 -1
      const diff = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setCountdown(isWithinRange ? diff : -1);

      const currentSlotTriggerTime = startTime + Math.floor(elapsed / interval) * interval;

      if (currentSlotTriggerTime >= startTime && lastTriggeredTimeRef.current !== currentSlotTriggerTime) {
        lastTriggeredTimeRef.current = currentSlotTriggerTime;

        if (!isWithinRange) {
          console.log("[AiWorkspacePad] Skipping auto trigger because current time is outside task timeRange");
          return;
        }

        try {
          resetAnalysisState();

          const runCycle = async () => {
            try {
              if (!activeRecordingTask) return;

              await handleCaptureOnly();

              // 延迟 300ms，确保 React 状态更新并完成重绘，避免由于异步状态更新导致大模型层读取到的素材不全
              await new Promise(resolve => setTimeout(resolve, 300));

              if (activeRecordingTask) {
                handleStartAnalysisOnly();
              }
            } catch (err) {
              console.error("[AiWorkspacePad] Auto cycle execution failed:", err);
            }
          };

          runCycle();
        } catch (err) {
          console.error("[AiWorkspacePad] Reset or Cycle start failed:", err);
        }
      }
    };

    const timer = setInterval(updateTimer, 500);
    updateTimer();

    return () => clearInterval(timer);
  }, [activeRecordingTask, currentIsAnalyzing, handleCaptureAndStart]);

  useEffect(() => {
    if (onActiveTaskChange) {
      onActiveTaskChange(!!activeRecordingTask);
    }
  }, [activeRecordingTask, onActiveTaskChange]);

  useEffect(() => {
    return () => {
      // 当组件销毁（即用户关闭或离开实时分析页面）时，自动关闭分析任务，停止录音并清理缓存
      localStorage.removeItem(ACTIVE_TASK_KEY);
      if (onActiveTaskChange) {
        onActiveTaskChange(false);
      }
      if (realtimePanelRef.current) {
        try {
          realtimePanelRef.current.stopRecording();
        } catch (e) {
          console.error("Failed to stop recording on unmount:", e);
        }
      }
      timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [onActiveTaskChange]);

  const handleAddAsset = useCallback((asset: OfflineAssetItem) => {
    setOfflineAssets((prev) => [asset, ...prev]);
  }, []);

  const handleRemoveAsset = useCallback((assetId: string) => {
    setOfflineAssets((prev) => prev.filter((asset) => asset.id !== assetId));
  }, []);

  const handleSelectTemplate = useCallback((template: AgentTemplate) => {
    setSelectedTemplate(template);
  }, []);

  const handleStatusChange = useCallback((status: RealtimeStatus, error?: string | null) => {
    setRealtimeStatus(status);
    setRealtimeError(error || null);
  }, []);

  const triggerRealtimeConnect = useCallback(() => {
    updateCurrentTrace(null);
    updateCurrentResult(null);
    setConnectVersion((prev) => prev + 1);
  }, []);

  const handleManualCapture = useCallback((image: string, rect: DOMRect | null) => {
    setRealtimeState((prev) => ({
      ...prev,
      captures: [...prev.captures, { id: `cap_${Date.now()}`, image, rect }],
    }));
  }, []);

  const handleManualVideo = useCallback((url: string, rect: DOMRect | null) => {
    setRealtimeState((prev) => ({
      ...prev,
      videos: [...prev.videos, { id: `vid_${Date.now()}`, url, rect }],
    }));
  }, []);

  const handleManualAudio = useCallback((url: string, rect: DOMRect | null) => {
    setRealtimeState((prev) => ({
      ...prev,
      audios: [...prev.audios, { id: `aud_${Date.now()}`, url, rect }],
    }));
  }, []);

  const handleRestoreHistory = useCallback(
    (item: AnalysisHistoryItem) => {
      resetAnalysisState();

    setActiveTab(item.mode);
    const template = dynamicTemplates.find((t) => t.id === item.templateId);
    if (template) {
      setSelectedTemplate(template);
    }

      if (item.mode === "offline") {
        setOfflineState({
          isAnalyzing: false,
          trace: item.trace,
          result: item.result,
        });

        // Re-create offlineAssets from history item's captures, videos, and audios
        const restoredAssets: OfflineAssetItem[] = [];
        
        (item.captures || []).forEach((cap) => {
          restoredAssets.push({
            id: cap.id,
            type: "capture",
            name: `图片素材_${cap.id.split('_')[1] || 'restore'}.jpg`,
            mimeType: "image/jpeg",
            dataUrl: cap.image,
            createdAt: new Date(item.timestamp).toISOString(),
            sourceLabel: "历史恢复-图片",
          });
        });

        (item.videos || []).forEach((vid) => {
          restoredAssets.push({
            id: vid.id,
            type: "upload",
            name: `视频素材_${vid.id.split('_')[1] || 'restore'}.mp4`,
            mimeType: "video/mp4",
            dataUrl: vid.url,
            createdAt: new Date(item.timestamp).toISOString(),
            sourceLabel: "历史恢复-视频",
          });
        });

        (item.audios || []).forEach((aud) => {
          restoredAssets.push({
            id: aud.id,
            type: "audio",
            name: `音频素材_${aud.id.split('_')[1] || 'restore'}.wav`,
            mimeType: "audio/wav",
            dataUrl: aud.url,
            createdAt: new Date(item.timestamp).toISOString(),
            sourceLabel: "历史恢复-音频",
          });
        });

        setOfflineAssets(restoredAssets);
      } else {
        setRealtimeState({
          isAnalyzing: false,
          trace: item.trace,
          result: item.result,
          captures: item.captures,
          videos: item.videos,
          audios: item.audios,
        });
      }

      if (agentPanelRef.current) {
        agentPanelRef.current.stopSimulation();
      }
    },
    [resetAnalysisState, setOfflineAssets],
  );

  const handleSimulationComplete = useCallback(
    (simResult: AgentAnalysisResult, simTrace: AgentAnalysisTrace, dynamicThinkingLogs?: string[]) => {
      updateCurrentIsAnalyzing(false);
      updateCurrentResult(simResult);
      updateCurrentTrace(simTrace);

      setHistory((prev) => {
        const newItem: AnalysisHistoryItem = {
          id: simTrace.id,
          timestamp: Date.now(),
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          mode: activeTab,
          captures: [...assetsRef.current.captures],
          videos: [...assetsRef.current.videos],
          audios: [...assetsRef.current.audios],
          trace: simTrace,
          result: simResult,
          thinkingLogs: dynamicThinkingLogs && dynamicThinkingLogs.length > 0 ? dynamicThinkingLogs : getThinkingLogsForTemplate(selectedTemplate.id),
          thinkingStep: 4,
        };

        const newHistory = addToHistory(prev, newItem);
        if (newHistory !== prev) {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
        }
        return newHistory;
      });
    },
    [selectedTemplate, activeTab, updateCurrentIsAnalyzing, updateCurrentResult, updateCurrentTrace],
  );

  const handleRemoveCapture = useCallback((id: string) => {
    setRealtimeState((prev) => ({
      ...prev,
      captures: prev.captures.filter((item) => item.id !== id),
    }));
  }, []);

  const handleRemoveVideo = useCallback((id: string) => {
    setRealtimeState((prev) => ({
      ...prev,
      videos: prev.videos.filter((item) => item.id !== id),
    }));
  }, []);

  const handleRemoveAudio = useCallback((id: string) => {
    setRealtimeState((prev) => ({
      ...prev,
      audios: prev.audios.filter((item) => item.id !== id),
    }));
  }, []);

  const handlePrev = useCallback(() => {
    setSlideDirection(-1);
    setCarouselIndex((prev) => {
      const nextIdx = prev === 0 ? dynamicTemplates.length - 1 : prev - 1;
      const nextTemplate = dynamicTemplates[nextIdx];
      handleSelectTemplate(nextTemplate);
      return nextIdx;
    });
  }, [handleSelectTemplate, dynamicTemplates]);

  const handleNext = useCallback(() => {
    setSlideDirection(1);
    setCarouselIndex((prev) => {
      const nextIdx = prev === dynamicTemplates.length - 1 ? 0 : prev + 1;
      const nextTemplate = dynamicTemplates[nextIdx];
      handleSelectTemplate(nextTemplate);
      return nextIdx;
    });
  }, [handleSelectTemplate, dynamicTemplates]);

  const handleGoTo = useCallback((index: number) => {
    setSlideDirection(index > carouselIndex ? 1 : -1);
    setCarouselIndex(index);
    const nextTemplate = dynamicTemplates[index];
    handleSelectTemplate(nextTemplate);
  }, [carouselIndex, handleSelectTemplate, dynamicTemplates]);

  const getTemplateIcon = useCallback((id: string) => {
    switch (id) {
      case "video-patrol":
        return <Video className="h-4 w-4 text-indigo-400" />;
      case "image-inspector":
        return <Camera className="h-4 w-4 text-amber-400" />;
      case "audio-diagnosis":
        return <Mic className="h-4 w-4 text-rose-400" />;
      default:
        return <PlaySquare className="h-4 w-4 text-blue-400" />;
    }
  }, []);

  return (
    <div className="flex h-full w-full flex-row items-stretch gap-4 overflow-hidden select-none">
      {/* Left side: Main workspace area (65% width) */}
      <div className="flex w-[65%] flex-col gap-4 overflow-hidden">
        {/* Active workspace container */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-800/80 bg-[#111827] p-4 shadow-lg flex flex-col">
          {activeTab === "offline" ? (
            <OfflineAnalysisPanelPad
              assets={offlineAssets}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
            />
          ) : (
            <RealtimeAnalysisPanelPad
              ref={realtimePanelRef}
              config={streamConfig}
              status={realtimeStatus}
              error={realtimeError}
              connectVersion={connectVersion}
              activeTab={activeTab}
              activeRecordingTask={activeRecordingTask}
              nextTriggerTime={nextTriggerTime}
              countdown={countdown}
              onTabChange={setActiveTab}
              onConfigChange={setStreamConfig}
              onStatusChange={handleStatusChange}
              onConnect={triggerRealtimeConnect}
              onSaveRecordingTask={handleSaveRecordingTask}
              onStopRecordingTask={handleStopRecordingTask}
              onManualCapture={handleManualCapture}
              onManualVideo={handleManualVideo}
              onManualAudio={handleManualAudio}
            />
          )}
        </div>

        {/* Horizontal sliding template selector - Replaced with an elegant Carousel to prevent clipping */}
        <div className="shrink-0 rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">
                AI 智能巡检模版
              </h2>
              <span className="text-[10px] text-slate-500 font-medium">
                左右切换浏览与选用业务模式
              </span>
            </div>
            {/* Index indicator */}
            <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800/40 font-mono text-[9px] font-black text-slate-400">
              <span className="text-blue-400">{carouselIndex + 1}</span>
              <span>/</span>
              <span>{dynamicTemplates.length}</span>
            </div>
          </div>

          {/* Carousel Layout wrapper */}
          <div className="flex items-center gap-3 w-full relative">
            {/* Left Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={handlePrev}
              disabled={dynamicTemplates.length <= 1}
              className={`h-10 w-10 shrink-0 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition-all cursor-pointer ${dynamicTemplates.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>

            {/* Slide Viewport */}
            <div className="flex-1 min-w-0 bg-slate-950/40 rounded-xl border border-slate-800/50 p-3.5 h-[115px] overflow-hidden relative flex items-center">
              <AnimatePresence mode="wait" custom={slideDirection}>
                {dynamicTemplates.length > 0 && (
                  <motion.div
                    key={carouselIndex}
                    custom={slideDirection}
                    variants={{
                      enter: (dir: number) => ({
                        x: dir > 0 ? 30 : -30,
                        opacity: 0,
                      }),
                      center: {
                        x: 0,
                        opacity: 1,
                      },
                      exit: (dir: number) => ({
                        x: dir < 0 ? 30 : -30,
                        opacity: 0,
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    className="w-full h-full flex items-center justify-between gap-4 text-xs"
                  >
                    {/* Left Column: Template metadata */}
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                        {getTemplateIcon(dynamicTemplates[carouselIndex].id)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-bold text-slate-100 truncate">
                            {dynamicTemplates[carouselIndex].name}
                          </span>
                          {/* Mode Badge - Simplified to generic classification */}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/40 border border-blue-900/30 text-blue-400 font-bold uppercase tracking-wider scale-95 origin-left animate-pulse">
                            多模态 Agent
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 pr-1">
                          {dynamicTemplates[carouselIndex].description}
                        </p>
                      </div>
                    </div>

                    {/* Right Column: Dynamic Info & Selection button */}
                    <div className="w-[42%] shrink-0 border-l border-slate-800/60 pl-4 h-full flex flex-col justify-between py-0.5">
                      {/* Dependent details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Database className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="font-bold shrink-0">依赖能力:</span>
                          <span className="truncate text-slate-300">
                            {[
                              ...dynamicTemplates[carouselIndex].videoLibraries,
                              ...dynamicTemplates[carouselIndex].imageLibraries,
                              ...dynamicTemplates[carouselIndex].audioLibraries,
                            ].join(" / ") || "系统原生"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="font-bold shrink-0">研判工具:</span>
                          <span className="truncate text-slate-300">
                            {dynamicTemplates[carouselIndex].tools.join(" / ") || "通用工具"}
                          </span>
                        </div>
                      </div>

                      {/* Selector Status Button */}
                      <div className="flex items-center justify-between gap-1.5 mt-1.5">
                        {dynamicTemplates[carouselIndex].id === selectedTemplate.id ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            当前已选用
                          </div>
                        ) : (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectTemplate(dynamicTemplates[carouselIndex])}
                            className="text-[10px] font-black bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-blue-900/20 cursor-pointer"
                          >
                            选用该模版
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={handleNext}
              disabled={dynamicTemplates.length <= 1}
              className={`h-10 w-10 shrink-0 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition-all cursor-pointer ${dynamicTemplates.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-1 mt-0.5 shrink-0">
            {dynamicTemplates.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleGoTo(idx)}
                className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === carouselIndex ? "w-3.5 bg-blue-500" : "w-1 bg-slate-800 hover:bg-slate-700"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right side: Fixed Agent Analysis Panel (35% width) */}
      <div className="w-[35%] h-full overflow-y-auto custom-scrollbar rounded-2xl border border-slate-800 bg-[#111827] shadow-lg">
        <AgentAnalysisPanel
          ref={agentPanelRef}
          activeTab={activeTab}
          aiMode={aiMode}
          selectedTemplate={selectedTemplate}
          offlineAssets={offlineAssets}
          realtimeStatus={realtimeStatus}
          isAnalyzing={currentIsAnalyzing}
          isCapturing={isCapturing}
          trace={currentTrace}
          result={currentResult}
          activeRecordingTask={activeRecordingTask}
          onStartRecordingTask={handleStartRecordingTask}
          onStopRecordingTask={handleStopRecordingTask}
          onStartAnalysis={handleManualStart}
          captures={currentCaptures}
          videos={currentVideos}
          audios={currentAudios}
          onRemoveCapture={handleRemoveCapture}
          onRemoveVideo={handleRemoveVideo}
          onRemoveAudio={handleRemoveAudio}
          nextTriggerTime={nextTriggerTime}
          countdown={countdown}
          onSimulationComplete={handleSimulationComplete}
          history={history}
          onRestoreHistory={handleRestoreHistory}
        />
      </div>
    </div>
  );
};
