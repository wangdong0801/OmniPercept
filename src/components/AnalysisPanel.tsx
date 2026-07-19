import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  Gauge, 
  Cpu, 
  HelpCircle, 
  ListTodo, 
  FileSearch,
  MessageSquare,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  TrendingUp,
  Award,
  Copy,
  Check,
  Clock,
  ExternalLink
} from "lucide-react";
import { AnalysisResult, HistoryRecord } from "../types";

interface AnalysisPanelProps {
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  error: string | null;
  activeHighlightLabel?: string | null;
  setActiveHighlightLabel?: (label: string | null) => void;
  historyRecords?: HistoryRecord[];
}

const PRE_STEPS = [
  { phase: "文件完整性预处理", detail: "正在加载图像/音频文件、校验数据完整性、剔除信噪噪声并准备解码通道..." },
  { phase: "局部多尺度特征提取", detail: "调用深度分析核心网络。进行多维色彩网格检索或短时傅里叶变换提取高频信号特征..." },
  { phase: "双向语义比对建模", detail: "结合所选特定场景，向云端高维语义空间发起关联，计算物体边界拓扑结构或语音语境声学分布..." },
  { phase: "决策模型逻辑校验", detail: "综合各类概率标签，结合多轮逻辑自检，消除视觉歧义或背景干扰..." },
  { phase: "场景融合与方案定制", detail: "最终整合属性矩阵，依据上下文生成专业应用指引、安全提示与改进建议方案..." }
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  isAnalyzing,
  result,
  error,
  activeHighlightLabel = null,
  setActiveHighlightLabel,
  historyRecords = []
}) => {
  const [activeTab, setActiveTab] = useState<"process" | "result" | "suggestions">("result");
  const [loadingStep, setLoadingStep] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  // Rotate simulated preprocessing steps
  useEffect(() => {
    if (!isAnalyzing) {
      setLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < PRE_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  if (!isAnalyzing && !result && !error) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        <div className="h-16 w-16 bg-slate-950 text-slate-500 rounded-xl flex items-center justify-center border border-slate-850">
          <Sparkles className="h-8 w-8 text-blue-500/40 animate-pulse" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h4 className="text-slate-100 font-semibold text-base">等待上传并启动分析</h4>
          <p className="text-slate-400 text-xs leading-relaxed">
            请在上方选择所需的识别场景，上传图像或提供音频素材后，点击下面的“启动多模态AI分析”按钮。
          </p>
        </div>
      </div>
    );
  }

  // Analyzing/Loading Screen
  if (isAnalyzing) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 shadow-lg space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="h-10 w-10 bg-blue-950/60 text-blue-400 border border-blue-900/40 rounded-xl flex items-center justify-center">
            <Cpu className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h4 className="font-bold text-slate-200 text-sm">正在深度分析处理中...</h4>
            <p className="text-slate-400 text-xs">正在调用 Gemini 3.5-Flash 处理多模态高维通道数据</p>
          </div>
        </div>

        {/* Big Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-400">
              分析阶段: {PRE_STEPS[loadingStep].phase} ({loadingStep + 1}/{PRE_STEPS.length})
            </span>
            <span className="text-slate-400 font-mono">
              {Math.floor(((loadingStep + 1) / PRE_STEPS.length) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${((loadingStep + 1) / PRE_STEPS.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Loading Steps Track */}
        <div className="space-y-3 pt-2">
          {PRE_STEPS.map((step, idx) => {
            const isCompleted = idx < loadingStep;
            const isActive = idx === loadingStep;
            
            return (
              <div 
                key={idx}
                className={`p-3.5 rounded-xl border transition-all duration-300 flex gap-3 ${
                  isActive 
                    ? "bg-slate-950 border-blue-800/80 shadow-md" 
                    : isCompleted 
                    ? "bg-[#131b2e]/60 border-slate-800/80 opacity-60" 
                    : "bg-[#131b2e]/30 border-transparent opacity-35"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : isActive ? (
                    <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-slate-950 border border-slate-800"></div>
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className={`text-xs font-semibold ${isActive ? "text-blue-400" : "text-slate-300"}`}>
                    {step.phase}
                  </div>
                  {isActive && (
                    <p className="text-[11px] text-slate-400 leading-relaxed animate-fade-in">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-900/60 rounded-2xl p-6 shadow-lg space-y-4 animate-fade-in">
        <div className="flex gap-3">
          <div className="p-2 bg-red-900/40 text-red-400 border border-red-800/40 rounded-xl shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-red-400 text-sm">智能分析服务异常</h4>
            <p className="text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        </div>
        <div className="text-[11px] text-red-400/80 bg-slate-950 p-3 rounded-xl border border-red-900/40">
          建议排查：如果您是首次运行，请确认已经在 **设置 &gt; Secrets** 面板中正确配齐了 `GEMINI_API_KEY` 环境变量。
        </div>
      </div>
    );
  }

  // Render Result Screen
  if (!result) return null;

  const handleExportReport = () => {
    const md = `
# ${result.title} 多模态智能诊断报告

**诊断摘要**: ${result.summary}
**系统置信度**: ${result.confidence}% (模型评估为: ${result.confidence >= 85 ? '高度可靠' : result.confidence >= 60 ? '中度可靠，需核对' : '较弱可信，需人工复检'})

## 一、结构化分析指标
${result.results.map(r => `- **${r.label}**: ${r.value}`).join('\n')}

## 二、多层神经推导步骤
${result.processSteps.map((p, i) => `${i + 1}. **${p.phase}**: ${p.detail}`).join('\n')}

## 三、针对性应用指引与安全建议
${result.suggestions.map((s, i) => `${i + 1}. [${s.category}] ${s.text}`).join('\n')}

---
*报告由 Ultronbot System (Gemini 3.5-Flash) 自动生成于 2026年*
    `.trim();
    
    navigator.clipboard.writeText(md).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 85) return { text: "安全可信 (High)", color: "text-emerald-400 bg-emerald-950/60 border-emerald-900/40" };
    if (score >= 60) return { text: "中度核对 (Medium)", color: "text-amber-400 bg-amber-950/60 border-amber-900/40" };
    return { text: "重度告警 (Low)", color: "text-rose-400 bg-rose-950/60 border-rose-900/40" };
  };

  const rating = getConfidenceLevel(result.confidence);

  // Filter history for previous reference matches (excluding currently generated item)
  const sameScenarioHistory = historyRecords
    ? historyRecords
        .filter((rec) => rec.result.title === result.title && rec.timestamp !== historyRecords[0]?.timestamp)
        .slice(0, 2)
    : [];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6 animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-blue-950/60 text-blue-400 text-[10px] font-bold rounded-md uppercase tracking-wider border border-blue-900/40">
              Gemini 强力驱动
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${rating.color}`}>
              {rating.text}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              分析成功
            </span>
          </div>
          <h4 className="text-base md:text-lg font-bold text-slate-100">{result.title}</h4>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
            {result.summary}
          </p>
          
          {/* Action Button: Export Report */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleExportReport}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                isCopied 
                  ? "bg-emerald-950/50 border-emerald-800/80 text-emerald-400" 
                  : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  已复制 Markdown 报告
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  复制完整诊断报告 (Markdown)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Confidence Ring Dial */}
        <div className="bg-slate-950/80 border border-slate-850 rounded-xl py-2.5 px-4 flex items-center gap-3 shrink-0 self-start md:self-auto">
          <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
            {/* Background circle */}
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-slate-800"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-blue-500 transition-all duration-1000 ease-out"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - result.confidence / 100)}`}
              />
            </svg>
            <span className="text-xs font-mono font-bold text-blue-400">{result.confidence}%</span>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-blue-500" /> 识别置信度
            </div>
            <p className="text-[10px] text-slate-500">结合高维拓扑特征概率</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#161f30] p-1 rounded-xl border border-slate-800">
        <button
          id="btn-tab-result"
          type="button"
          onClick={() => setActiveTab("result")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "result"
              ? "bg-blue-600 text-white shadow-md border-transparent"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileCheck className="h-3.5 w-3.5" />
          识别结果
        </button>
        <button
          id="btn-tab-process"
          type="button"
          onClick={() => setActiveTab("process")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "process"
              ? "bg-blue-600 text-white shadow-md border-transparent"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileSearch className="h-3.5 w-3.5" />
          推导分析
        </button>
        <button
          id="btn-tab-suggestions"
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "suggestions"
              ? "bg-blue-600 text-white shadow-md border-transparent"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListTodo className="h-3.5 w-3.5" />
          指导建议 ({result.suggestions.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="pt-2 min-h-[220px]">
        {/* Panel 1: Recognition Attributes */}
        {activeTab === "result" && (
          <div className="space-y-4 animate-fade-in">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              结构化识别指标清单
            </h5>
            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40">
              {result.results.map((item, index) => {
                const isHighlighted = activeHighlightLabel === item.label;
                return (
                  <div 
                    key={index} 
                    className={`p-4 grid grid-cols-1 md:grid-cols-3 gap-2 transition-all duration-350 cursor-pointer ${
                      isHighlighted 
                        ? "bg-blue-950/40 text-blue-100 shadow-[inset_3px_0_0_#3b82f6]" 
                        : "hover:bg-slate-900/40"
                    }`}
                    onMouseEnter={() => setActiveHighlightLabel?.(item.label)}
                    onMouseLeave={() => setActiveHighlightLabel?.(null)}
                  >
                    <div className={`text-xs font-bold flex items-center gap-2 ${isHighlighted ? "text-blue-400" : "text-slate-450"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isHighlighted ? "bg-blue-400 animate-pulse" : "bg-emerald-500"}`}></span>
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-200 md:col-span-2 leading-relaxed font-sans font-medium">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel 2: Analytical Process */}
        {activeTab === "process" && (
          <div className="space-y-4 animate-fade-in">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-blue-500" />
              多层次神经计算与推导细节
            </h5>
            <div className="space-y-3">
              {result.processSteps.map((step, index) => (
                <div key={index} className="flex gap-4 relative">
                  {/* Timeline bar line */}
                  {index < result.processSteps.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-[-16px] w-0.5 bg-slate-800"></div>
                  )}
                  {/* Step counter */}
                  <div className="h-8 w-8 bg-blue-950/60 text-blue-400 font-mono font-bold text-xs rounded-full flex items-center justify-center shrink-0 border border-blue-900/40 relative z-10">
                    {index + 1}
                  </div>
                  {/* Step text info */}
                  <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl flex-1 space-y-1">
                    <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>{step.phase}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Completed</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel 3: Structured suggestions */}
        {activeTab === "suggestions" && (
          <div className="space-y-4 animate-fade-in">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 text-amber-500" />
              针对性行为指导与应用建议
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.suggestions.map((item, index) => (
                <div 
                  key={index} 
                  className="bg-[#131a2d]/85 border border-slate-800 p-4 rounded-xl flex gap-3 shadow-md hover:shadow-lg transition-all animate-fade-in"
                >
                  <div className="h-7 w-7 bg-blue-950/60 text-blue-400 border border-blue-900/40 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/50 border border-blue-900/40 px-1.5 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium pt-1">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Historical Reference Comparison Panel */}
      {sameScenarioHistory.length > 0 && (
        <div className="border-t border-slate-800 pt-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
              往期历史诊断参考对照 ({sameScenarioHistory.length})
            </h5>
            <span className="text-[10px] text-slate-500">自动匹配往期同场景诊断快照</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sameScenarioHistory.map((rec) => (
              <div key={rec.id} className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl flex flex-col justify-between hover:border-slate-800 transition-all text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-mono">
                      {new Date(rec.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/40 px-1 rounded">{rec.result.confidence}% 置信度</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-bold line-clamp-1">{rec.result.title}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-normal">{rec.result.summary}</p>
                </div>
                
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-slate-900 overflow-hidden text-[9px]">
                  {rec.result.results.slice(0, 2).map((item, idx) => (
                    <span key={idx} className="bg-slate-900/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-850 truncate max-w-[110px]" title={`${item.label}: ${item.value}`}>
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
