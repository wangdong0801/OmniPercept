import { useState, useEffect } from "react";
import {
  Sparkles,
  History,
  SlidersHorizontal,
  HelpCircle,
  FileText,
  BrainCircuit,
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  ChevronRight,
  Database,
  ArrowRight,
  Info,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Settings,
  Cpu,
  TrendingUp,
  Activity
} from "lucide-react";
import { SCENARIOS, ScenarioSelector } from "./components/ScenarioSelector";
import { FileUploader } from "./components/FileUploader";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { AiAnalysisWorkspace } from "./components/ai-analysis/AiAnalysisWorkspace";
import { AiAnalysisWorkspacePad } from "./components/ai-analysis/AiAnalysisWorkspacePad";
import { OpsWorkbench } from "./components/OpsWorkbench";
import { Scenario, AnalysisResult, HistoryRecord } from "./types";
import { templatesToScenarios, getStoredConfig } from "./lib/configStore";
import { analyzeWithGemini } from "./utils/geminiService";
import { loadHistoryRecords, saveHistoryRecordLocally, deleteHistoryRecordLocally } from "./utils/historyService";

export default function App() {
  // Main view navigation tab
  const [activeTab, setActiveTab] = useState<"analyze" | "ai" | "history" | "ops">(() => {
    const saved = localStorage.getItem("app_active_tab");
    return (saved as "analyze" | "ai" | "history" | "ops") || "ai";
  });
  // Pad (tablet) mode for AI Analysis
  const [isPadMode, setIsPadMode] = useState<boolean>(false);

  // Sync activeTab to localStorage
  useEffect(() => {
    localStorage.setItem("app_active_tab", activeTab);
  }, [activeTab]);

  // Selected analysis inputs
  const [dynamicScenarios, setDynamicScenarios] = useState<Scenario[]>(() => {
    return templatesToScenarios(getStoredConfig().templates);
  });
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(() => dynamicScenarios[0] || SCENARIOS[0]);

  const handleConfigChanged = () => {
    const updated = templatesToScenarios(getStoredConfig().templates);
    setDynamicScenarios(updated);
  };
  const [fileBase64, setFileBase64] = useState<string>("");
  const [fileMimeType, setFileMimeType] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [uploaderKey, setUploaderKey] = useState<number>(0);

  // Analysis result state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // History state
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState<boolean>(false);
  const [activeHighlightLabel, setActiveHighlightLabel] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<{ configured: boolean; checking: boolean }>({
    configured: true,
    checking: true
  });

  // User custom API key configuration
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    return localStorage.getItem("user_gemini_api_key") || "";
  });
  const [qwenApiKey, setQwenApiKey] = useState<string>(() => {
    return localStorage.getItem("qwen_api_key") || "";
  });
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>("");
  const [tempQwenApiKey, setTempQwenApiKey] = useState<string>("");
  const [showApiKeyPlain, setShowApiKeyPlain] = useState<boolean>(false);
  const [showQwenApiKeyPlain, setShowQwenApiKeyPlain] = useState<boolean>(false);

  // AI model switcher mode
  const [aiMode, setAiMode] = useState<"mock" | "local" | "gemini" | "qwen">(() => {
    return (localStorage.getItem("ultron_ai_mode_v2") as "mock" | "local" | "gemini" | "qwen") || "qwen";
  });

  const [hasActiveTask, setHasActiveTask] = useState<boolean>(() => {
    return !!localStorage.getItem("active_recording_task");
  });

  useEffect(() => {
    localStorage.setItem("ultron_ai_mode_v2", aiMode);
  }, [aiMode]);

  // Load history & system health on mount
  useEffect(() => {
    fetchHistory();
    checkHealth();
  }, []);

  const checkHealth = async () => {
    const hasKey = !!(process.env.GEMINI_API_KEY || localStorage.getItem("user_gemini_api_key"));
    setSystemHealth({
      configured: hasKey,
      checking: false
    });
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const records = loadHistoryRecords();
      setHistoryRecords(records);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    // Auto populate default custom focus placeholder or clear previous
    setCustomPrompt("");
  };

  const handleResetForm = () => {
    setFileBase64("");
    setFileMimeType("");
    setFileName("");
    setCustomPrompt("");
    setAnalysisResult(null);
    setAnalysisError(null);
    setSelectedScenario(SCENARIOS[0]);
    setUploaderKey(prev => prev + 1);
  };

  const handleFileSelected = (base64Data: string, mimeType: string, selectedFileName: string) => {
    setFileBase64(base64Data);
    setFileMimeType(mimeType);
    setFileName(selectedFileName);
    // Clear previous results/errors to let user focus on new upload
    setAnalysisResult(null);
    setAnalysisError(null);

    // Auto switch to appropriate scenario if current selected one doesn't match
    if (mimeType) {
      const isAudio = mimeType.startsWith("audio/");
      const targetType = isAudio ? "audio" : "image";
      if (selectedScenario.type !== targetType) {
        const firstMatching = SCENARIOS.find(s => s.type === targetType);
        if (firstMatching) {
          setSelectedScenario(firstMatching);
        }
      }
    }
  };

  // Perform AI analysis
  const triggerAnalysis = async () => {
    if (!fileBase64 || !fileMimeType) {
      alert("请先上传图像或录制/上传声音文件作为分析素材！");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeWithGemini({
        fileData: fileBase64,
        mimeType: fileMimeType,
        scenarioId: selectedScenario.id,
        scenarioName: selectedScenario.name,
        customPrompt: customPrompt || selectedScenario.defaultPrompt,
        customApiKey: userApiKey || ""
      });

      setAnalysisResult(result);

      // Create a history log entry
      const newRecord: HistoryRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        scenarioId: selectedScenario.id,
        scenarioName: selectedScenario.name,
        fileType: fileMimeType.startsWith("audio/") ? "audio" : "image",
        fileName: fileName,
        fileData: fileBase64,
        mimeType: fileMimeType,
        customPrompt: customPrompt,
        result: result
      };

      // Save to server
      await saveHistoryRecord(newRecord);
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setAnalysisError(err.message || "无法完成多模态数据分析，请检查网络并重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveHistoryRecord = async (record: HistoryRecord) => {
    try {
      const records = saveHistoryRecordLocally(record);
      setHistoryRecords(records);
    } catch (err) {
      console.error("Failed to persist history:", err);
    }
  };

  const deleteHistoryRecord = async (id: string) => {
    try {
      const records = deleteHistoryRecordLocally(id);
      setHistoryRecords(records);
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  return (
    <div className="h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white overflow-hidden">

      {/* Sleek Fixed Top Header */}
      <header className="shrink-0 bg-[#111827]/95 border-b border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.4)]">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5 leading-none tracking-wider uppercase font-mono">
                ULTRONBOT SYSTEM
              </h1>
              <span className="hidden sm:inline-block h-3.5 w-px bg-slate-700"></span>
              <div className="flex items-center gap-1 bg-[#1e293b]/80 border border-slate-800 px-2 py-0.5 rounded text-[9px] font-mono text-slate-300">
                <span>山猫M20-Pro</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-emerald-400 font-bold">在线</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Image & Voice Semantic Analyzer with Gemini 3.5-Flash</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* {activeTab === "ai" && (
            <div className="flex items-center bg-[#111827] p-1 rounded-xl border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setIsPadMode(false)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${!isPadMode
                  ? "bg-blue-600/30 text-blue-400 border border-blue-500/50"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
              >
                桌面研判台
              </button>
              <button
                type="button"
                onClick={() => setIsPadMode(true)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${isPadMode
                  ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/50"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
              >
                平板智能端
              </button>
            </div>
          )} */}

          {/* Tab Controls in Header */}
          <div className="flex items-center bg-[#1f2937]/80 p-1 rounded-xl border border-slate-800">
            {/* <button
              id="nav-tab-analyze"
              type="button"
              onClick={() => setActiveTab("analyze")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === "analyze"
                  ? "bg-blue-600 text-white shadow-md border-transparent"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              智能分析
            </button> */}

             <button
              id="nav-tab-ai"
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === "ai"
                ? "bg-blue-600 text-white shadow-md border-transparent"
                : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              AI分析
            </button>
            <button
              id="nav-tab-ops"
              type="button"
              onClick={() => {
                if (hasActiveTask) {
                  alert("自动分析正在运行中，请先在实时分析控制面板中关闭自动分析！");
                  return;
                }
                setActiveTab("ops");
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                hasActiveTask
                  ? "opacity-40 cursor-not-allowed text-slate-500 hover:text-slate-500"
                  : activeTab === "ops"
                    ? "bg-blue-600 text-white shadow-md border-transparent cursor-pointer"
                    : "text-slate-400 hover:text-slate-200 cursor-pointer"
              }`}
              title={hasActiveTask ? "自动分析运行中，无法切换页面" : undefined}
            >
              <Settings className="h-3.5 w-3.5" />
              运维工作台
            </button>
            {/* <button
              id="nav-tab-history"
              type="button"
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all relative cursor-pointer ${activeTab === "history"
                ? "bg-blue-600 text-white shadow-md border-transparent"
                : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <History className="h-3.5 w-3.5" />
              历史归档
              {historyRecords.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono text-[9px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center border-2 border-[#111827] font-bold">
                  {historyRecords.length}
                </span>
              )}
            </button> */}


          </div>

          {/* AI Mode Selector */}
          <div className="flex bg-[#111827]/80 border border-slate-850 rounded-xl p-0.5 mr-1 gap-0.5">
            {[
              { id: "mock", label: "模拟数据" },
              { id: "gemini", label: "Gemini模型" },
              { id: "qwen", label: "千问大模型" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (hasActiveTask) {
                    alert("自动分析正在运行中，无法切换大模型！请先在实时分析控制面板中关闭自动分析。");
                    return;
                  }
                  setAiMode(option.id as any);
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all select-none ${
                  hasActiveTask && aiMode !== option.id
                    ? "opacity-40 cursor-not-allowed text-slate-500 hover:text-slate-500"
                    : aiMode === option.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/25 cursor-pointer"
                      : "text-slate-400 hover:text-slate-200 cursor-pointer"
                }`}
                title={hasActiveTask ? "自动分析运行中，无法切换大模型" : undefined}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* API Key Configuration Button */}
          <button
            id="btn-toggle-key-config"
            type="button"
            onClick={() => {
              setTempApiKey(userApiKey);
              setTempQwenApiKey(qwenApiKey);
              setShowKeyModal(true);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${(userApiKey || qwenApiKey)
              ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-400 hover:bg-emerald-900/40"
              : "bg-[#1f2937]/80 border-slate-800 text-slate-300 hover:bg-[#2e3b4e] hover:text-white"
              }`}
            title="配置自定义 Gemini & Qwen API Key"
          >
            <Key className={`h-3.5 w-3.5 ${(userApiKey || qwenApiKey) ? "text-emerald-400 animate-pulse" : "text-slate-400"}`} />
            <span>
              {(userApiKey || qwenApiKey) ? "已配专属Key" : "配置 API Key"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Stage - Independently Scrollable */}
      <main
        className={`flex-1 flex flex-col ${activeTab === "ai"
          ? "overflow-hidden px-2 pt-2 pb-4 md:px-3 md:pt-3 md:pb-5 lg:px-4 lg:pt-4 lg:pb-6"
          : "overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6"
          }`}
      >
        <div
          className={`${activeTab === "ai" ? "w-full flex-1 min-h-0" : "max-w-7xl w-full mx-auto space-y-6"
            }`}
        >

          {/* Gemini API Key Configuration Alert */}
          {/* {!systemHealth.checking && !systemHealth.configured && (
            <div className="bg-amber-950/40 border border-amber-900/60 rounded-2xl p-4 flex gap-3 shadow-lg animate-fade-in">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-400">未检测到 GEMINI_API_KEY 配置</h4>
                <p className="text-[11px] text-amber-300/80 leading-relaxed font-medium">
                  当前系统后台未注入 `GEMINI_API_KEY` 环境变量。请在页面右上角的 **Settings &gt; Secrets** 面板中，添加 `GEMINI_API_KEY` 键并提供您的 Google AI Studio 密钥，之后刷新页面。
                </p>
              </div>
            </div>
          )} */}

          {/* Tab 1: Analyzer workspace */}
          {activeTab === "analyze" ? (
            <div className="space-y-6">
              {/* Dashboard Metrics Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                <div className="bg-[#111827]/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                  <div className="p-2.5 bg-blue-950/50 text-blue-400 border border-blue-900/40 rounded-xl">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">研判引擎核心</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5">Gemini 3.5 Flash</span>
                  </div>
                </div>

                <div className="bg-[#111827]/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                  <div className="p-2.5 bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 rounded-xl">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">研判可信均值</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5">
                      {historyRecords.length > 0
                        ? `${(historyRecords.reduce((acc, curr) => acc + curr.result.confidence, 0) / historyRecords.length).toFixed(1)}%`
                        : "94.6%"}
                    </span>
                  </div>
                </div>

                <div className="bg-[#111827]/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                  <div className="p-2.5 bg-amber-950/50 text-amber-400 border border-amber-900/40 rounded-xl">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">研判诊断吞吐量</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5">{historyRecords.length} 组快照已存</span>
                  </div>
                </div>

                <div className="bg-[#111827]/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                  <div className="p-2.5 bg-rose-950/50 text-rose-400 border border-rose-900/40 rounded-xl">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">研判分析耗时</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5">~1.2s 极低延迟</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Input Settings panel */}
                <div className="lg:col-span-7 space-y-5">

                  {/* Step 1: Upload media file */}
                  <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4.5 md:p-5 shadow-lg">
                    <FileUploader
                      key={uploaderKey}
                      onFileSelected={handleFileSelected}
                      selectedScenarioType={fileMimeType ? (fileMimeType.startsWith("audio/") ? "audio" : "image") : "both"}
                      placeholder={selectedScenario.placeholder}
                      isAnalyzing={isAnalyzing}
                      analysisResult={analysisResult}
                      activeHighlightLabel={activeHighlightLabel}
                      setActiveHighlightLabel={setActiveHighlightLabel}
                    />
                  </div>

                  {/* Step 2: Scenario selector */}
                  <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4.5 md:p-5 shadow-lg">
                    <ScenarioSelector
                      scenarios={dynamicScenarios}
                      selectedScenarioId={selectedScenario.id}
                      onSelectScenario={handleSelectScenario}
                      allowedType={fileMimeType ? (fileMimeType.startsWith("audio/") ? "audio" : "image") : "all"}
                    />
                  </div>

                  {/* Step 3: Fine-tuning prompt adjuster (collapsible / hidden by default) */}
                  <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4.5 md:p-5 shadow-lg space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowCustomPrompt(!showCustomPrompt)}
                      className="w-full flex items-center justify-between text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-[11px] font-bold text-blue-400 border border-blue-800/80">3</span>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <SlidersHorizontal className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                          第三步：自定义分析焦点（可选）
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-300 font-semibold bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded-md transition-all border border-slate-700">
                        {showCustomPrompt ? "点击收起参数" : "点击展开配置"}
                        <ChevronRight className={`h-3 w-3 transform transition-transform duration-200 ${showCustomPrompt ? "rotate-90" : ""}`} />
                      </div>
                    </button>

                    {showCustomPrompt && (
                      <div className="space-y-2 animate-fade-in pt-1">
                        <p className="text-[10px] text-slate-400 font-medium">您可以手动输入特定的研判指令，AI 将在安全诊断中高度倾斜和聚焦这些关注要素：</p>
                        <div className="relative">
                          <textarea
                            id="textarea-custom-prompt"
                            rows={3}
                            maxLength={200}
                            placeholder={`请输入您的额外关注要求（例如：\n- 图像：“重点分析该物体的材料质感 and 损坏程度”\n- 音频：“分析说话者是否伴有过度焦虑或隐瞒情绪”）\n\n如果不填，系统将默认采用本场景的最佳推理模版进行分析。`}
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-4.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#0c1220] transition-all resize-none"
                          />
                          <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 font-mono">
                            {customPrompt.length}/200
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Huge Submission trigger button & Reset button */}
                  <div className="pt-2">
                    <div className="flex gap-3">
                      <button
                        id="btn-trigger-ai-analysis"
                        type="button"
                        disabled={isAnalyzing || !fileBase64}
                        onClick={triggerAnalysis}
                        className={`flex-1 py-4 px-6 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all transform active:scale-[0.99] cursor-pointer ${!fileBase64
                          ? "bg-slate-800/40 text-slate-500 border border-slate-800/80 cursor-not-allowed"
                          : isAnalyzing
                            ? "bg-blue-600 animate-pulse cursor-wait"
                            : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                          }`}
                      >
                        {isAnalyzing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            AI 深度神经网络模型正在研判中...
                          </>
                        ) : (
                          <>
                            <BrainCircuit className="h-4.5 w-4.5" />
                            启动 AI 多源研判
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>

                      <button
                        id="btn-reset-form"
                        type="button"
                        onClick={handleResetForm}
                        className="px-5 py-4 bg-slate-800 hover:bg-red-950/50 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/60 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
                        title="清空并重置所有操作区域"
                      >
                        <Trash2 className="h-4 w-4" />
                        重置区域
                      </button>
                    </div>
                    {!fileBase64 && (
                      <p className="text-[10px] text-center text-slate-500 mt-2 font-medium">
                        * 请先通过第一步提供照片或声音素材，再启动 AI 智能研判。
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Output details panel */}
                <div className="lg:col-span-5 lg:sticky lg:top-0">
                  <AnalysisPanel
                    isAnalyzing={isAnalyzing}
                    result={analysisResult}
                    error={analysisError}
                    activeHighlightLabel={activeHighlightLabel}
                    setActiveHighlightLabel={setActiveHighlightLabel}
                    historyRecords={historyRecords}
                  />
                </div>

              </div>
            </div>
          ) : activeTab === "ai" ? (
            isPadMode ? (
              <AiAnalysisWorkspacePad aiMode={aiMode} onActiveTaskChange={setHasActiveTask} />
            ) : (
              <AiAnalysisWorkspace aiMode={aiMode} onActiveTaskChange={setHasActiveTask} />
            )
          ) : activeTab === "ops" ? (
            <OpsWorkbench onConfigChanged={handleConfigChanged} />
          ) : (
            // Tab 3: Records Dashboard
            <div className="animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Database className="h-4.5 w-4.5 text-blue-500" />
                    智能决策分析快照历史
                  </h2>
                  <p className="text-xs text-slate-400">汇总所有已分析的图像/语音结果与结构化建议报告</p>
                </div>

                <span className="text-xs bg-[#1e293b] text-blue-400 font-mono font-bold px-2.5 py-1 rounded-full border border-slate-700">
                  共 {historyRecords.length} 条已存归档
                </span>
              </div>

              <HistoryPanel
                records={historyRecords}
                onDeleteRecord={deleteHistoryRecord}
                onSelectRecord={(rec) => {
                  // If user clicks from list, let's open details inside history modal
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Sleek Fixed Bottom Footer */}
      <footer className="shrink-0 border-t border-slate-800 bg-[#0c1220] py-3.5 px-4 text-center text-[11px] text-slate-500 font-medium z-10">
        <p>© 2026 多模态智能识别分析系统 • 融合多尺度卷积检测与声谱声学多维语义研判</p>
      </footer>

      {/* API Key Configuration Modal Overlay */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-950 flex items-center justify-center border border-blue-800 shrink-0">
                <Key className="h-5 w-5 text-blue-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
                  配置专属 API Key
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  添加您自己的 API 密钥，我们将保存在您当前的本地浏览器（Local Storage），分析请求将在后台直接转发，安全不留痕。
                </p>
              </div>
            </div>

            {/* Gemini Key Input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                您的 GEMINI_API_KEY
              </label>
              <div className="relative flex items-center">
                <input
                  type={showApiKeyPlain ? "text" : "password"}
                  placeholder={systemHealth.configured ? "已配置系统默认 Key（可在此处输入新 Key 覆盖）" : "请输入您的 AI Studio Gemini API Key"}
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-4 pr-11 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeyPlain(!showApiKeyPlain)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showApiKeyPlain ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                获取密钥请访问：<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>
              </p>
            </div>

            {/* Qwen Key Input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                您的 QWEN_API_KEY (通义千问)
              </label>
              <div className="relative flex items-center">
                <input
                  type={showQwenApiKeyPlain ? "text" : "password"}
                  placeholder="请输入您的阿里云 DashScope API Key"
                  value={tempQwenApiKey}
                  onChange={(e) => setTempQwenApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-4 pr-11 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowQwenApiKeyPlain(!showQwenApiKeyPlain)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showQwenApiKeyPlain ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                获取密钥请访问：<a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">阿里云 DashScope 控制台</a>
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("user_gemini_api_key");
                  localStorage.removeItem("qwen_api_key");
                  setUserApiKey("");
                  setQwenApiKey("");
                  setTempApiKey("");
                  setTempQwenApiKey("");
                  setShowKeyModal(false);
                  checkHealth();
                }}
                disabled={!userApiKey && !qwenApiKey}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${(userApiKey || qwenApiKey)
                  ? "bg-red-950/40 border-red-900/60 text-red-400 hover:bg-red-900/40"
                  : "bg-slate-900/40 border-slate-800/80 text-slate-600 cursor-not-allowed"
                  }`}
              >
                清除本地 Key
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-750 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Save Gemini Key
                    const trimmedGemini = tempApiKey.trim();
                    if (trimmedGemini) {
                      localStorage.setItem("user_gemini_api_key", trimmedGemini);
                      setUserApiKey(trimmedGemini);
                    } else {
                      localStorage.removeItem("user_gemini_api_key");
                      setUserApiKey("");
                    }

                    // Save Qwen Key
                    const trimmedQwen = tempQwenApiKey.trim();
                    if (trimmedQwen) {
                      localStorage.setItem("qwen_api_key", trimmedQwen);
                      setQwenApiKey(trimmedQwen);
                    } else {
                      localStorage.removeItem("qwen_api_key");
                      setQwenApiKey("");
                    }

                    setShowKeyModal(false);
                    checkHealth();
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/20 cursor-pointer"
                >
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
