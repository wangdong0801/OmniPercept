import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BrainCircuit, Camera, Mic, Radio, RefreshCw, Sparkles, Trash2 } from "lucide-react";
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
import { OfflineAnalysisPanel } from "./OfflineAnalysisPanel";
import { RealtimeAnalysisPanel, RealtimeAnalysisPanelHandle } from "./RealtimeAnalysisPanel";
import { TemplateSelectorPanel } from "./TemplateSelectorPanel";
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

interface AiAnalysisWorkspaceProps {
  aiMode?: "mock" | "local" | "gemini" | "qwen";
  onActiveTaskChange?: (active: boolean) => void;
}

export const AiAnalysisWorkspace: React.FC<AiAnalysisWorkspaceProps> = ({ aiMode = "mock", onActiveTaskChange }) => {
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
  const [pendingTemplate, setPendingTemplate] = useState<AgentTemplate | null>(null);
  const pendingTemplateRef = useRef<AgentTemplate | null>(null);
  useEffect(() => {
    pendingTemplateRef.current = pendingTemplate;
  }, [pendingTemplate]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // 分离 offline 和 realtime 的独立状态域
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

  // 映射当前 activeTab 的状态供组件内部和外部使用
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

  const realtimePanelRef = useRef<RealtimeAnalysisPanelHandle>(null);
  const agentPanelRef = useRef<AgentAnalysisPanelHandle>(null);
  const timeoutsRef = useRef<number[]>([]);

  const [activeRecordingTask, setActiveRecordingTask] = useState<RecordingTask | null>(() => {
    const saved = localStorage.getItem(ACTIVE_TASK_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  // --- 状态隔离帮助函数 ---
  const updateCurrentTrace = useCallback((newTrace: AgentAnalysisTrace | null | ((prev: AgentAnalysisTrace | null) => AgentAnalysisTrace | null)) => {
    if (activeTab === "offline") {
      setOfflineState(prev => ({
        ...prev,
        trace: typeof newTrace === 'function' ? newTrace(prev.trace) : newTrace
      }));
    } else {
      setRealtimeState(prev => ({
        ...prev,
        trace: typeof newTrace === 'function' ? newTrace(prev.trace) : newTrace
      }));
    }
  }, [activeTab]);

  const updateCurrentResult = useCallback((newResult: AgentAnalysisResult | null) => {
    if (activeTab === "offline") {
      setOfflineState(prev => ({ ...prev, result: newResult }));
    } else {
      setRealtimeState(prev => ({ ...prev, result: newResult }));
    }
  }, [activeTab]);

  const updateCurrentIsAnalyzing = useCallback((analyzing: boolean) => {
    if (activeTab === "offline") {
      setOfflineState(prev => ({ ...prev, isAnalyzing: analyzing }));
    } else {
      setRealtimeState(prev => ({ ...prev, isAnalyzing: analyzing }));
    }
  }, [activeTab]);

  const analysisMode = useMemo<"offline" | "realtime">(() => {
    return activeTab;
  }, [activeTab]);

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

  const resetAnalysisState = useCallback((targetTab?: AiWorkspaceTab, options: { clearAssets?: boolean; clearAnalysis?: boolean } = { clearAssets: true, clearAnalysis: true }) => {
    const tabToReset = targetTab || activeTab;
    const shouldClearAnalysis = options.clearAnalysis !== false;

    // 停止正在进行的模拟动画和定时器
    if (agentPanelRef.current) {
      agentPanelRef.current.stopSimulation({ keepState: !shouldClearAnalysis });
    }

    // 清除 Workspace 层的异步任务
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];

    // 重置业务数据状态
    if (tabToReset === "offline") {
      if (shouldClearAnalysis) {
        setOfflineState({
          isAnalyzing: false,
          trace: null,
          result: null,
        });
        if (options.clearAssets !== false) {
          setOfflineAssets([]);
        }
      } else {
        setOfflineState(prev => ({ ...prev, isAnalyzing: false }));
      }
    } else {
      setRealtimeState(prev => ({
        isAnalyzing: false,
        trace: shouldClearAnalysis ? null : prev.trace,
        result: shouldClearAnalysis ? null : prev.result,
        captures: options.clearAssets ? [] : prev.captures,
        videos: options.clearAssets ? [] : prev.videos,
        audios: options.clearAssets ? [] : prev.audios,
      }));
    }
    setIsCapturing(false);
  }, [activeTab]);

  const handleStopRecordingTask = useCallback((options: { clearAssets?: boolean; clearAnalysis?: boolean } = { clearAssets: true, clearAnalysis: true }) => {
    setActiveRecordingTask(null);
    localStorage.removeItem(ACTIVE_TASK_KEY);
    setPendingTemplate(null);

    // 立即终止当前所有流程，并显式指定重置实时模式状态
    resetAnalysisState("realtime", options);

    // 停止实时录制流程（如果还在跑）
    if (realtimePanelRef.current) {
      realtimePanelRef.current.stopRecording();
    }

    setNextTriggerTime(null);
    setCountdown(null);
    lastTriggeredTimeRef.current = null;
  }, [resetAnalysisState]);

  const handleStartRecordingTask = useCallback(() => {
    // 优先使用草稿配置，否则使用默认配置
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

    // 强制重置触发时间，确保 useEffect 能检测到并立即执行第一轮
    lastTriggeredTimeRef.current = null;
    setActiveRecordingTask(newTask);
    localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(newTask));

    // 初始化倒计时，等待倒计时结束后触发分析执行
    const interval = config.triggerInterval * 1000;
    const next = new Date(newTask.startedAt).getTime() + interval;
    setNextTriggerTime(next);
  }, []);

  // 当标签页切换时，仅停止背景采集任务，但不中断已经开始的模拟分析流程
  useEffect(() => {
    // 停止 Workspace 层的采集定时器（如倒计时等）
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];

    // 注意：不再调用 agentPanelRef.current.stopSimulation()
    // 这样可以让 AgentAnalysisPanel 内部捕获的背景分析流程继续执行完毕

    // 如果从实时模式切出，且存在活跃录制任务，则停止它（实现模块互斥）
    if (activeTab === "offline" && activeRecordingTask) {
      // 切换模式时，仅停止背景任务，不清除已捕获素材，也不重置实时分析结果
      handleStopRecordingTask({ clearAssets: false, clearAnalysis: false });
    }

    setIsCapturing(false);
  }, [activeTab]);

  const handleCaptureOnly = useCallback(async (force = false) => {
    if (!activeRecordingTask && !force) return; // 熔断机制：若任务已关闭则不再执行

    setIsCapturing(true);

    try {
      if (activeTab === "realtime" && realtimePanelRef.current) {
        const recordingConfig = resolveRecordingConfig();
        const rect = realtimePanelRef.current.getContainerRect();

        // 1. 截图捕获
        if (recordingConfig.imageCaptureEnabled) {
          try {
            const image = await realtimePanelRef.current.captureScreenshot();
            if (image && typeof image === "string" && image.length > 0) {
              setRealtimeState(prev => ({
                ...prev,
                captures: [...prev.captures, { id: `cap_${Date.now()}`, image, rect }]
              }));
            }
          } catch (err) {
            console.error("[AiWorkspace] Image capture failed:", err);
            // 记录日志并跳过，不中断后续视频录制
          }
        }

        // 2. 启动录制流程
        if ((recordingConfig.videoEnabled || recordingConfig.audioEnabled) && recordingConfig.duration > 0) {
          await new Promise<void>((resolve, reject) => {
            const startTimeout = window.setTimeout(async () => {
              try {
                if (!realtimePanelRef.current || !activeRecordingTask) {
                  resolve();
                  return;
                }

                // 录制视频
                if (recordingConfig.videoEnabled) {
                  await realtimePanelRef.current.startRecording({
                    video: true,
                    audio: false,
                    duration: recordingConfig.duration
                  });

                  await new Promise(r => {
                    const videoStopTimeout = window.setTimeout(async () => {
                      try {
                        if (realtimePanelRef.current && activeRecordingTask) {
                          const videoUrl = await realtimePanelRef.current.stopRecording();
                          if (videoUrl) {
                            setRealtimeState(prev => ({
                              ...prev,
                              videos: [...prev.videos, { id: `vid_${Date.now()}`, url: videoUrl, rect }]
                            }));
                          }
                        }
                      } catch (e) {
                        console.error("[AiWorkspace] Video recording stop failed:", e);
                      }
                      r(null);
                    }, recordingConfig.duration * 1000 + 500);
                    timeoutsRef.current.push(videoStopTimeout);
                  });
                }

                // 录制音频
                if (recordingConfig.audioEnabled && activeRecordingTask) {
                  await realtimePanelRef.current.startRecording({
                    video: false,
                    audio: true,
                    duration: recordingConfig.duration
                  });

                  const audioStopTimeout = window.setTimeout(async () => {
                    try {
                      if (realtimePanelRef.current && activeRecordingTask) {
                        const audioUrl = await realtimePanelRef.current.stopRecording();
                        if (audioUrl) {
                          setRealtimeState(prev => ({
                            ...prev,
                            audios: [...prev.audios, { id: `aud_${Date.now()}`, url: audioUrl, rect }]
                          }));
                        }
                      }
                    } catch (e) {
                      console.error("[AiWorkspace] Audio recording stop failed:", e);
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
      console.error("[AiWorkspace] Auto capture cycle failed:", err);
      // 记录错误日志，当前环节出错不影响整体循环，由外部捕获
    } finally {
      setIsCapturing(false);
    }
  }, [activeTab, resolveRecordingConfig, activeRecordingTask]);

  const handleStartAnalysisOnly = useCallback((force = false) => {
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
      console.error("[AiWorkspace] AI Analysis trigger failed:", err);
      updateCurrentIsAnalyzing(false);
    }
  }, [activeRecordingTask, updateCurrentIsAnalyzing, updateCurrentResult, updateCurrentTrace]);

  const handleCaptureAndStart = useCallback(async (force = false) => {
    // 手动触发依然保持顺序执行
    await handleCaptureOnly(force);
    // 延迟 300ms，确保 React 状态更新并完成重绘，避免由于异步状态更新导致大模型层读取到的素材不全
    await new Promise(resolve => setTimeout(resolve, 300));
    handleStartAnalysisOnly(force);
  }, [handleCaptureOnly, handleStartAnalysisOnly]);

  const handleManualStart = useCallback(() => {
    if (activeTab === "offline") {
      if (!canAnalyze || currentIsAnalyzing) return;

      // 离线模式：直接启动模拟分析
      if (agentPanelRef.current) {
        updateCurrentIsAnalyzing(true);
        updateCurrentResult(null);
        updateCurrentTrace(null);
        agentPanelRef.current.startSimulation(true);
      }
    } else {
      // 实时模式：点击启动分析是手动行为，只执行一次分析，不开启自动分析循环
      handleStartAnalysisOnly(true);
    }
  }, [
    activeTab,
    canAnalyze,
    currentIsAnalyzing,
    handleStartAnalysisOnly,
    updateCurrentIsAnalyzing,
    updateCurrentResult,
    updateCurrentTrace,
  ]);

  const handleSaveRecordingTask = useCallback((config: RecordingConfig) => {
    const isNew = !activeRecordingTask;
    const newTask: RecordingTask = {
      id: activeRecordingTask?.id || Math.random().toString(36).substr(2, 9),
      config,
      status: "active",
      startedAt: activeRecordingTask?.startedAt || new Date().toISOString(),
    };

    if (isNew) {
      // 强制重置触发时间，确保 useEffect 能检测到并立即执行第一轮
      lastTriggeredTimeRef.current = null;
    }

    setActiveRecordingTask(newTask);
    localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(newTask));

    // 如果是新开启，初始化倒计时显示
    if (isNew) {
      const interval = config.triggerInterval * 1000;
      const next = new Date(newTask.startedAt).getTime() + interval;
      setNextTriggerTime(next);
    }
  }, [activeRecordingTask]);

  const lastTriggeredTimeRef = useRef<number | null>(null);

  // 自动分析触发逻辑
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

      // 目标触发点：当前的 slot + 1
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

      // 触发条件：当前时间已经到达或超过了当前的 slot 边界
      const currentSlotTriggerTime = startTime + Math.floor(elapsed / interval) * interval;

      if (currentSlotTriggerTime >= startTime && lastTriggeredTimeRef.current !== currentSlotTriggerTime) {
        lastTriggeredTimeRef.current = currentSlotTriggerTime;

        if (!isWithinRange) {
          console.log("[AiWorkspace] Skipping auto trigger because current time is outside task timeRange");
          return;
        }

        try {
          // 切换到预约的模版
          if (pendingTemplateRef.current) {
            setSelectedTemplate(pendingTemplateRef.current);
            setPendingTemplate(null);
          }

          // 1. 倒计时收尾：重置当前分析窗口的所有状态
          resetAnalysisState();

          // 2. 自动启动下一轮循环：素材采集 -> 上传 -> AI分析
          // 这里使用异步执行，确保流程连续性
          const runCycle = async () => {
            try {
              if (!activeRecordingTask) return;

              // A. 素材采集与上传
              await handleCaptureOnly();

              // 延迟 300ms，确保 React 状态更新并完成重绘，避免由于异步状态更新导致大模型层读取到的素材不全
              await new Promise(resolve => setTimeout(resolve, 300));

              // B. 立即触发 AI 分析流程
              if (activeRecordingTask) {
                handleStartAnalysisOnly();
              }
            } catch (err) {
              console.error("[AiWorkspace] Auto cycle execution failed:", err);
              // 异常处理：记录日志并等待下一轮循环，避免流程中断
            }
          };

          runCycle();
        } catch (err) {
          console.error("[AiWorkspace] Reset or Cycle start failed:", err);
        }
      }
    };

    const timer = setInterval(updateTimer, 500); // 提高检查频率至 500ms 以获得更精准的倒计时归零触发
    updateTimer();

    return () => clearInterval(timer);
  }, [activeRecordingTask, currentIsAnalyzing, handleCaptureAndStart]);

  useEffect(() => {
    if (onActiveTaskChange) {
      onActiveTaskChange(!!activeRecordingTask);
    }
  }, [activeRecordingTask, onActiveTaskChange]);

  // 手动分析结束时，若存在预约的新模版，则立即生效切换
  useEffect(() => {
    if (!currentIsAnalyzing && pendingTemplate && !activeRecordingTask) {
      setSelectedTemplate(pendingTemplate);
      setPendingTemplate(null);
    }
  }, [currentIsAnalyzing, pendingTemplate, activeRecordingTask]);

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
    if (activeRecordingTask || currentIsAnalyzing) {
      if (template.id === selectedTemplate.id) {
        setPendingTemplate(null);
      } else {
        setPendingTemplate(template);
      }
    } else {
      setSelectedTemplate(template);
      setPendingTemplate(null);
    }
  }, [activeRecordingTask, currentIsAnalyzing, selectedTemplate.id]);

  const handleStatusChange = useCallback((status: RealtimeStatus, error?: string | null) => {
    setRealtimeStatus(status);
    setRealtimeError(error || null);
  }, []);

  const triggerRealtimeConnect = useCallback(() => {
    updateCurrentTrace(null);
    updateCurrentResult(null);
    setConnectVersion((prev) => prev + 1);
  }, []);

  const resetWorkspace = useCallback(() => {
    handleStopRecordingTask({ clearAssets: true }); // 重置工作区时应清空所有数据
    setOfflineAssets([]);
  }, [handleStopRecordingTask]);

  const startAnalysis = useCallback(() => {
    if (!canAnalyze || currentIsAnalyzing) return;

    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];
    updateCurrentIsAnalyzing(true);
    updateCurrentResult(null);

    const startedAt = new Date().toISOString();
    const initialNodes: AgentNodeCall[] = selectedTemplate.defaultNodeFlow.map((node) => ({
      ...node,
      status: "waiting",
      summary: "",
    }));

    const nextTrace: AgentAnalysisTrace = {
      id: `trace_${Date.now()}`,
      mode: analysisMode,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      startedAt,
      nodes: initialNodes,
    };
    updateCurrentTrace(nextTrace);

    initialNodes.forEach((node, index) => {
      const timeout = window.setTimeout(() => {
        updateCurrentTrace((current) => {
          if (!current) return current;
          const updatedNodes = current.nodes.map((item, nodeIndex) => {
            if (nodeIndex < index) {
              return item.status === "completed" ? item : { ...item, status: "completed" };
            }
            if (nodeIndex === index) {
              return {
                ...item,
                status: "completed",
                summary: buildNodeSummary(node, analysisMode, selectedTemplate, offlineAssets),
              };
            }
            return item;
          });
          return { ...current, nodes: updatedNodes };
        });

        if (index === initialNodes.length - 1) {
          const finalTimeout = window.setTimeout(() => {
            const finalResult = buildResult(analysisMode, selectedTemplate, offlineAssets);
            updateCurrentResult(finalResult);
            updateCurrentIsAnalyzing(false);

            // 离线模式保存到历史记录
            setHistory((prev) => {
              const offCaptures = offlineAssets.filter(item => item.mimeType.startsWith("image/") || item.type === "capture").map(item => ({ id: item.id, image: item.dataUrl, rect: null }));
              const offVideos = offlineAssets.filter(item => item.mimeType.startsWith("video/")).map(item => ({ id: item.id, url: item.dataUrl, rect: null }));
              const offAudios = offlineAssets.filter(item => item.mimeType.startsWith("audio/") || item.type === "audio").map(item => ({ id: item.id, url: item.dataUrl, rect: null }));
              const newItem: AnalysisHistoryItem = {
                id: nextTrace.id,
                timestamp: Date.now(),
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                mode: analysisMode,
                captures: offCaptures,
                videos: offVideos,
                audios: offAudios,
                trace: {
                  ...nextTrace,
                  nodes: nextTrace.nodes.map(n => ({ ...n, status: "completed" as const, summary: n.summary || buildNodeSummary(n, analysisMode, selectedTemplate, offlineAssets) }))
                },
                result: finalResult,
                thinkingLogs: getThinkingLogsForTemplate(selectedTemplate.id),
                thinkingStep: 4,
              };
              const newHistory = addToHistory(prev, newItem);
              if (newHistory !== prev) {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
              }
              return newHistory;
            });
          }, 420);
          timeoutsRef.current.push(finalTimeout);
        }
      }, (index + 1) * 850);
      timeoutsRef.current.push(timeout);
    });
  }, [canAnalyze, currentIsAnalyzing, selectedTemplate, analysisMode, offlineAssets, updateCurrentIsAnalyzing, updateCurrentResult, updateCurrentTrace]);

  const handleManualCapture = useCallback((image: string, rect: DOMRect | null) => {
    setRealtimeState(prev => ({
      ...prev,
      captures: [...prev.captures, { id: `cap_${Date.now()}`, image, rect }]
    }));
  }, []);
  const handleManualVideo = useCallback((url: string, rect: DOMRect | null) => {
    setRealtimeState(prev => ({
      ...prev,
      videos: [...prev.videos, { id: `vid_${Date.now()}`, url, rect }]
    }));
  }, []);
  const handleManualAudio = useCallback((url: string, rect: DOMRect | null) => {
    setRealtimeState(prev => ({
      ...prev,
      audios: [...prev.audios, { id: `aud_${Date.now()}`, url, rect }]
    }));
  }, []);

  const handleRestoreHistory = useCallback((item: AnalysisHistoryItem) => {
    // 停止当前所有流程
    resetAnalysisState();

    // 还原数据
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

    // 通知 AgentPanel 结束模拟（如果是从模拟状态还原）
    if (agentPanelRef.current) {
      agentPanelRef.current.stopSimulation();
    }
  }, [resetAnalysisState, setOfflineAssets]);

  const handleSimulationComplete = useCallback((simResult: AgentAnalysisResult, simTrace: AgentAnalysisTrace, dynamicThinkingLogs?: string[]) => {
    updateCurrentIsAnalyzing(false);
    updateCurrentResult(simResult);
    updateCurrentTrace(simTrace);

    // 立即保存到历史记录
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
  }, [selectedTemplate, activeTab, updateCurrentIsAnalyzing, updateCurrentResult, updateCurrentTrace]);

  const handleRemoveCapture = useCallback((id: string) => {
    setRealtimeState(prev => ({
      ...prev,
      captures: prev.captures.filter(item => item.id !== id)
    }));
  }, []);

  const handleRemoveVideo = useCallback((id: string) => {
    setRealtimeState(prev => ({
      ...prev,
      videos: prev.videos.filter(item => item.id !== id)
    }));
  }, []);

  const handleRemoveAudio = useCallback((id: string) => {
    setRealtimeState(prev => ({
      ...prev,
      audios: prev.audios.filter(item => item.id !== id)
    }));
  }, []);

  return (
    <div className="flex h-full flex-col gap-6 lg:flex-row lg:items-stretch">
      <div className="flex flex-col gap-5 lg:h-full lg:w-[calc(60%-12px)] overflow-y-auto pr-1">
        {/* 输入模式切换已迁移至面板内部 */}
        <div className="flex-grow flex flex-col rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-lg">
          {activeTab === "offline" && (
            <OfflineAnalysisPanel
              assets={offlineAssets}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
            />
          )}

          {activeTab === "realtime" && (
            <RealtimeAnalysisPanel
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

        {/* 分析模版选择 - 移动到顶部 */}
        <div className="flex flex-col shrink-0 rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-lg">
          <div className="mb-4 shrink-0">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              分析模版选择
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              根据业务场景选择合适的 AI Agent 模版，模版预设了不同的分析能力和工具链。
            </p>
          </div>

          <TemplateSelectorPanel
            templates={dynamicTemplates}
            selectedTemplateId={selectedTemplate.id}
            pendingTemplateId={pendingTemplate?.id}
            onSelectTemplate={handleSelectTemplate}
            disabled={false}
          />
        </div>
      </div>

      <div className="h-full lg:w-[calc(40%-12px)]">
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
          onReset={resetAnalysisState}
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
