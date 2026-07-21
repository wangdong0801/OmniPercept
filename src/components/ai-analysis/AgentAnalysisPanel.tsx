import React, { useState, useEffect, useMemo, useRef, useImperativeHandle } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleDashed,
  Cpu,
  PlaySquare,
  Search,
  AlertTriangle,
  Lightbulb,
  Zap,
  Maximize2,
  ExternalLink,
  Download,
  X,
  Camera,
  Trash2,
  Play,
  Film,
  Mic,
  Music,
  History,
  Calendar,
  Clock,
  ChevronRight,
  RotateCcw,
  ChevronDown,
  Brain,
  Network,
} from "lucide-react";
import {
  AgentAnalysisResult,
  AgentAnalysisTrace,
  AgentNodeCall,
  AgentTemplate,
  AiWorkspaceTab,
  AnalysisHistoryItem,
  OfflineAssetItem,
  RecordingTask,
} from "../../types";
import { getStoredConfig } from "../../lib/configStore";
import { analyzeWithGemini } from "../../utils/geminiService";

type RealtimeStatus = "idle" | "connecting" | "ready" | "error";

interface AgentAnalysisPanelProps {
  activeTab: AiWorkspaceTab;
  selectedTemplate: AgentTemplate;
  offlineAssets: OfflineAssetItem[];
  realtimeStatus: RealtimeStatus;
  isAnalyzing: boolean;
  isCapturing?: boolean;
  trace: AgentAnalysisTrace | null;
  result: AgentAnalysisResult | null;
  activeRecordingTask: RecordingTask | null;
  onStartRecordingTask: () => void;
  onStopRecordingTask: () => void;
  onStartAnalysis?: () => void;
  captures: { id: string; image: string; rect: DOMRect | null }[];
  videos: { id: string; url: string; rect: DOMRect | null }[];
  audios: { id: string; url: string; rect: DOMRect | null }[];
  onRemoveCapture?: (id: string) => void;
  onRemoveVideo?: (id: string) => void;
  onRemoveAudio?: (id: string) => void;
  nextTriggerTime?: number | null;
  countdown?: number | null;
  onSimulationComplete?: (result: AgentAnalysisResult, trace: AgentAnalysisTrace, dynamicThinkingLogs?: string[]) => void;
  history?: AnalysisHistoryItem[];
  onRestoreHistory?: (item: AnalysisHistoryItem) => void;
  onReset?: () => void;
  aiMode?: "mock" | "local" | "gemini" | "qwen";
}

export interface AgentAnalysisPanelHandle {
  startSimulation: () => void;
  stopSimulation: () => void;
}

// 打字机组件
const TypewriterText: React.FC<{
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  className?: string;
  skip?: boolean;
}> = ({ text, speed = 20, delay = 0, onComplete, className, skip = false }) => {
  const [displayedText, setDisplayedText] = useState(skip ? text : "");
  const [started, setStarted] = useState(skip);

  useEffect(() => {
    if (skip) {
      setDisplayedText(text);
      setStarted(true);
      onComplete?.();
      return;
    }
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay, skip, text, onComplete]);

  useEffect(() => {
    if (skip || !started || !text) return;

    let index = text.startsWith(displayedText) ? displayedText.length : 0;
    const timer = setInterval(() => {
      if (index >= text.length) {
        clearInterval(timer);
        onComplete?.();
        return;
      }
      setDisplayedText(text.slice(0, index + 1));
      index++;
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete, started, skip, displayedText]);

  return <span className={`whitespace-pre-wrap ${className || ""}`}>{displayedText}</span>;
};

const statusIconMap = {
  waiting: <CircleDashed className="h-4 w-4 text-slate-500" />,
  running: <Activity className="h-4 w-4 animate-pulse text-amber-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
};

const resourceColorMap = {
  agent: "text-violet-300 bg-violet-950/30 border-violet-900/40",
  videoLibrary: "text-blue-300 bg-blue-950/30 border-blue-900/40",
  imageLibrary: "text-emerald-300 bg-emerald-950/30 border-emerald-900/40",
  audioLibrary: "text-cyan-300 bg-cyan-950/30 border-cyan-900/40",
  tool: "text-amber-300 bg-amber-950/30 border-amber-900/40",
};

// 模拟场景数据
export const getScenarioForTemplate = (templateId: string, selectedTemplate?: AgentTemplate) => {
  if (templateId === "factory-hazard") {
    return {
      id: "factory-hazard-scenario",
      name: "通道遮挡与环境隐患排查",
      nodes: [
        {
          id: "node-lib-factory-hazard",
          nodeName: "标准样本库加载",
          role: "执行图像特征库匹配",
          resourceType: "imageLibrary" as const,
          resourceName: "通道安全与物理隐患图谱样本库",
          status: "completed" as const,
          summary: "检索《通道安全与物理隐患图谱样本库》，加载木托盘占用、裸露电缆等2组标准物理隐患反面对照样本。针对当前上传的素材图像，建立自适应灰度梯度比对矩阵。",
        },
        {
          id: "node-skill-factory-hazard-0",
          nodeName: "多维危险源定界与定位",
          role: "执行专业认知研判",
          resourceType: "tool" as const,
          resourceName: "多维危险源定界与定位",
          status: "completed" as const,
          summary: "扫描绿色安全通道及黄色标志线边界。在主通道中后段右侧，检测到异常像素团块与轮廓遮挡，确认为闲置木托盘及杂乱堆放的废料纸箱，占用安全疏散路线超40%。",
          evidenceUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80",
        },
        {
          id: "node-agent-factory-hazard",
          nodeName: "决策智能体",
          role: "汇总分析并输出结论",
          resourceType: "agent" as const,
          resourceName: "安全督导高级专家 Agent",
          status: "completed" as const,
          summary: "调用高级安全研判模型进行多维会商。判定该隐患属于典型的『安全走道障碍物占用』及『绊倒/滑倒中高危风险源』。依据职业安全防灾感知规则，将安全隐患等级评估为二级隐患。",
        }
      ],
      result: {
        headline: "通道研判：主安全通道存在严重木托盘与废料杂物占用",
        summary: "安全督导 Agent 在现场照片的主通道中后段（黄线区域内）检测到未及时清运的闲置木托盘和纸箱，导致绿色通道物理有效宽度缩减，存在极高的人员绊倒及逃生阻碍隐患。",
        riskLevel: "高" as const,
        matchedResources: ["通道安全与物理隐患图谱样本库", "多维危险源定界与定位", "安全督导高级专家 Agent"],
        recommendations: [
          "立刻指派区域班组长前往主通道中后段，清空占用通道的闲置木托盘与废旧纸箱；",
          "落实车间划线管理，要求所有工位产生的固体废料必须日产日清、置于指定防灾集装箱；",
          "强化现场巡检人员的黄线合规意识，确保绿色疏散通道物理净宽度不少于 1.5 米。"
        ],
      },
    };
  } else if (templateId === "factory-ppe") {
    return {
      id: "factory-ppe-scenario",
      name: "个人防护装备 (PPE) 穿戴合规检测",
      nodes: [
        {
          id: "node-lib-factory-ppe",
          nodeName: "标准样本库加载",
          role: "执行图像特征库匹配",
          resourceType: "imageLibrary" as const,
          resourceName: "PPE 个人防护规范比对样本库",
          status: "completed" as const,
          summary: "检索《PPE 个人防护规范比对样本库》，加载标准安全帽（黄、红、白各工种）及高可视度反光衣、绝缘防护手套的标准多角度特征层，用于建立细粒度多分类模型分类边界。",
        },
        {
          id: "node-skill-factory-ppe-0",
          nodeName: "劳保穿戴合规多分类比对",
          role: "执行专业认知研判",
          resourceType: "tool" as const,
          resourceName: "劳保穿戴合规多分类比对",
          status: "completed" as const,
          summary: "检测出当前画面共有 3 位作业人员（Worker #1, Worker #2, Worker #3）。通过多目标框分类器：Worker #1、#2 均佩戴安全帽及反光服。Worker #3 头顶未佩戴安全帽，双手暴露，存在致命高空砸伤和物理机械擦伤隐患。",
          evidenceUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
        },
        {
          id: "node-agent-factory-ppe",
          nodeName: "决策智能体",
          role: "汇总分析并输出结论",
          resourceType: "agent" as const,
          resourceName: "PPE 穿戴合规审计 Agent",
          status: "completed" as const,
          summary: "汇总多分类比对细节进行合规性审计。计算该班组整体 PPE 穿戴合规率为 66.7%。针对违规的 Worker #3 指出其头顶上方有高空桥架敷设作业，属于一级违规，必须进行物理隔离纠偏。",
        }
      ],
      result: {
        headline: "PPE 审计：检测到部分人员未佩戴安全帽与手套作业",
        summary: "PPE 审计 Agent 检测到现场 3 位作业人员中，有 1 人（Worker #3）在未戴安全帽、未戴防护手套的情况下进行近距离机械操作。此时头顶有起重机/桥架吊装风险，属于高风险违规行为。",
        riskLevel: "高" as const,
        matchedResources: ["PPE 个人防护规范比对样本库", "劳保穿戴合规多分类比对", "PPE 穿戴合规审计 Agent"],
        recommendations: [
          "立即责令该工段长进行现场停工整顿，要求 Worker #3 补齐安全帽与防化绝缘手套后方可返工；",
          "在机组入口显眼处增设『进入此区域必须全套 PPE』声光警示牌，并开启 AI 摄像头联动喊话功能；",
          "将此 PPE 违规事件记录到班组安全月度绩效考核，扣减不合规班组相应安全积分。"
        ],
      },
    };
  } else if (templateId === "factory-gauge") {
    return {
      id: "factory-gauge-scenario",
      name: "仪器仪表读数与状态灯警报研判",
      nodes: [
        {
          id: "node-lib-factory-gauge",
          nodeName: "标准样本库加载",
          role: "执行图像特征库匹配",
          resourceType: "imageLibrary" as const,
          resourceName: "阀门状态与压力表读数对照库",
          status: "completed" as const,
          summary: "加载高压管道压力表超压、过温临界读数与红色警戒扇区指示图谱。建立边缘圆形 HOUGH 变换及指针指向角度数学运算矩阵。",
        },
        {
          id: "node-skill-factory-gauge-0",
          nodeName: "仪表 OCR 与刻度换算校准",
          role: "执行专业认知研判",
          resourceType: "tool" as const,
          resourceName: "仪表 OCR 与刻度换算校准",
          status: "completed" as const,
          summary: "检测出画面中的主管道指针式高压蒸汽压力表。通过中心指针对零位刻度的夹角换算，得出其实际读数为 2.45 MPa（该量程满档为 3.0 MPa），指针已明显越过红线超压指示区。",
          evidenceUrl: "https://images.unsplash.com/photo-1590986424791-2355375a0a55?auto=format&fit=crop&w=400&q=80",
        },
        {
          id: "node-agent-factory-gauge",
          nodeName: "决策智能体",
          role: "汇总分析并输出结论",
          resourceType: "agent" as const,
          resourceName: "工业仪器仪表读数与故障研判 Agent",
          status: "completed" as const,
          summary: "工业级会商诊断。研判当前 2.45 MPa 已构成蒸汽管路超载临界警报，如果不紧急采取物理泄压或切断前级源头，极易在 10 分钟内导致管道法兰爆裂。评级：特级高危工艺故障。",
        }
      ],
      result: {
        headline: "仪表研判：主高压管路压力表已严重过压突破红线",
        summary: "仪表诊断 Agent 读取到现场蒸汽压力表数值高达 2.45 MPa，已进入 2.2 MPa 的红色超载警戒区。物理模型显示管道壁应力处于极限状态，存在阀门喷射和高压气体泄漏特级风险。",
        riskLevel: "高" as const,
        matchedResources: ["阀门状态与压力表读数对照库", "仪表 OCR 与刻度换算校准", "工业仪器仪表读数与故障研判 Agent"],
        recommendations: [
          "启动紧急泄压操作：物理微开副泄压阀降低干线蒸汽气压至 1.6 MPa 安全范围；",
          "立刻联动切断该支路配电箱的加压泵动力电源，执行断电隔离与上锁挂牌 (LOTO) 措施；",
          "指派仪表维护人员携带手持式声学成像仪，排查由于超压引起的干线法兰微量应力开裂或漏气。"
        ],
      },
    };
  } else if (templateId === "factory-audio-anomaly" || templateId === "audio-diagnosis") {
    return {
      id: "factory-audio-anomaly-scenario",
      name: "机械异常噪音与设备运转诊断",
      nodes: [
        {
          id: "node-lib-factory-audio-anomaly",
          nodeName: "标准样本库加载",
          role: "执行声学指纹比对",
          resourceType: "audioLibrary" as const,
          resourceName: "传动轴承磨损与异常异响音色库",
          status: "completed" as const,
          summary: "载入滚动轴承剥落、传送带偏心、风机共振等 4 类稳态与瞬态声学谱指纹。建立短时傅里叶变换 (STFT) 与频谱包络识别算子。",
        },
        {
          id: "node-skill-factory-audio-anomaly-0",
          nodeName: "车间环境底噪自适应滤波",
          role: "执行专业认知研判",
          resourceType: "tool" as const,
          resourceName: "车间环境底噪自适应滤波",
          status: "completed" as const,
          summary: "对音频进行 120Hz 梳状滤波器滤波，滤除风机和旋转电机低频背景噪音。在 2400Hz 处捕捉到具有高能量强度的摩擦调幅冲击脉冲，且伴随 15Hz 的滚动体旋转调制信号。",
          evidenceUrl: "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=spectrogram+frequency+sound+wave+bearing+fault+industrial&image_size=landscape_16_9",
        },
        {
          id: "node-agent-factory-audio-anomaly",
          nodeName: "决策智能体",
          role: "汇总分析并输出结论",
          resourceType: "agent" as const,
          resourceName: "声学频谱信号分析与诊断 Agent",
          status: "completed" as const,
          summary: "声谱分析与因果寿命推导。诊断该 2400Hz 强烈异响属于典型的滚动轴承内圈滚道或滚珠严重缺油导致的高温干磨损。热力学和运动学模型评估，继续运转极易在短时间内导致轴承烧结抱死，发生主轴断裂。",
        }
      ],
      result: {
        headline: "声学诊断：滚动轴承内圈严重剥落并处于缺油干摩擦啸叫状态",
        summary: "声学异常诊断 Agent 分析输入的现场声音，高精准剥离环境噪声后，检测到典型的机械滚动摩擦冲击阶次。确定轴承劣化已达 4 级阶段，摩擦生热极大，判定为高风险劣化故障。",
        riskLevel: "高" as const,
        matchedResources: ["传动轴承磨损与异常异响音色库", "车间环境底噪自适应滤波", "声学频谱信号分析与诊断 Agent"],
        recommendations: [
          "申请计划性停机并安排润滑检修：向该电机轴承注油孔加注高粘度二硫化钼极压润滑滑脂；",
          "在计划停机期间，使用振动传感器对电机外壳和底座进行双向频谱复测，排除偏心对中缺陷；",
          "若补脂后噪音未见降低，表明轴承滚道已发生金属剥落物理坏死，需在 48 小时内更换轴承。"
        ],
      },
    };
  } else if (templateId === "factory-audio-alarm") {
    return {
      id: "factory-audio-alarm-scenario",
      name: "车间突发警报声与气体泄露侦测",
      nodes: [
        {
          id: "node-lib-factory-audio-alarm",
          nodeName: "标准样本库加载",
          role: "执行声学指纹比对",
          resourceType: "audioLibrary" as const,
          resourceName: "工业高分贝灾害警报标准特征库",
          status: "completed" as const,
          summary: "加载消防警报周期扫频、气体超声泄露、过载突发蜂鸣的声音标准包络线。建立声级响度、突发比率与宽频频响分析算子。",
        },
        {
          id: "node-skill-factory-audio-alarm-0",
          nodeName: "车间环境底噪自适应滤波",
          role: "执行专业认知研判",
          resourceType: "tool" as const,
          resourceName: "车间环境底噪自适应滤波",
          status: "completed" as const,
          summary: "有效滤除环境底噪后，在 8000Hz 至 16000Hz 超高频区间检测到持续高分贝的湍流嗤嗤噪声包络（响度超过 78dB），该波形表现出高强度的持续湍流特征，确认为压缩气体管道微量应力漏气。",
          evidenceUrl: "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=metal+surface+microscopic+crack+fatigue+industrial+inspection&image_size=landscape_16_9",
        },
        {
          id: "node-agent-factory-audio-alarm",
          nodeName: "决策智能体",
          role: "汇总分析并输出结论",
          resourceType: "agent" as const,
          resourceName: "声学频谱信号分析与诊断 Agent",
          status: "completed" as const,
          summary: "应急会商研判。结合 8-16kHz 频段超高频持续特征，诊断该异响为高压气动法兰或软管微小泄漏，推算气动泄漏量为 1.2 m³/min。评级：中高危气体管路失效风险。",
        }
      ],
      result: {
        headline: "声学研判：车间局部气动主线管道发生高压持续泄露",
        summary: "声谱分析 Agent 在环境背景声中高灵敏检出超高频段湍流嗤嗤异响，判断为高压气体主线管道局部接头、法兰或减压阀橡胶软管开裂老化引起的持续高速气体外泄，影响管网终端稳定性。",
        riskLevel: "中" as const,
        matchedResources: ["工业高分贝灾害警报标准特征库", "车间环境底噪自适应滤波", "声学频谱信号分析与诊断 Agent"],
        recommendations: [
          "使用便携式高精度超声波测漏仪对 3 号干线所有弯头、三通接头作物理涂抹测漏或声像定位；",
          "微量调节上游主管路截止阀，在停机检修前适当降低主管道额定工作气压（例如从 0.8 MPa 降至 0.6 MPa）；",
          "若软管破裂严重，应立刻更换同规格的工业高耐压不锈钢包缠橡胶软管，避免发生突发爆裂伤害。"
        ],
      },
    };
  } else if (templateId === "video-patrol") {
    return {
      id: "video-patrol-scenario",
      name: "实时视频流行为巡检",
      nodes: [
        {
          id: "n1",
          nodeName: "实时监控分析",
          role: "监控扫描",
          resourceType: "videoLibrary" as const,
          resourceName: "实时监控分析库",
          status: "completed" as const,
          summary: "对视频监控流进行像素序列差分分析，实时扫描高危区域 A-04，捕获多帧连续的运动异常，排除了由于光影造成的偶然干扰。",
        },
        {
          id: "n2",
          nodeName: "关键帧比对",
          role: "特征交叉",
          resourceType: "imageLibrary" as const,
          resourceName: "关键帧复核图片库",
          status: "completed" as const,
          summary: "将捕获 of 疑似目标特征与工业异常数据库进行高维图像比对，识别相似烟雾散射偏振特征，识别置信度达到 91.5%。",
          evidenceUrl: "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=industrial+fire+smoke+detection+thermal+view+security+camera&image_size=landscape_16_9",
        },
        {
          id: "n3",
          nodeName: "时间线追踪",
          role: "事件追踪",
          resourceType: "tool" as const,
          resourceName: "事件时间轴工具",
          status: "completed" as const,
          summary: "调用时间轴工具序列化当前事件序列，自动生成高精度时序异常演变线索，为应急处置人员提供毫秒级时间回溯。",
        }
      ],
      result: {
        headline: "视频巡检：确认发生早期烟火异常（烟雾阶段）",
        summary: "视频巡检 Agent 在监控流 A-04 画面持续检测到明显的散发烟雾波浪，边缘轮廓特征与阴燃火灾模型吻合，已自动标记异常位置并生成预警指令。",
        riskLevel: "高" as const,
        matchedResources: ["实时监控分析库", "关键帧复核图片库", "区域防灾感知预备引擎"],
        recommendations: [
          "立即派驻现场巡检人员携带移动应急设备前往 A-04 区域复核",
          "联动开启该区域的排烟阀门及强排风系统",
          "向总调度室推送二级高优告警卡片并实时锁定监控视口"
        ],
      },
    };
  } else {
    // 动态回退模式：支持用户任意新增或修改的自定义研判模版
    const name = selectedTemplate?.name || "自定义智能研判流程";
    const defaultFlow = selectedTemplate?.defaultNodeFlow || [];

    const nodes = defaultFlow.map((node, index) => {
      let summary = `执行节点《${node.nodeName}》，针对当前巡检素材进行${node.role || "专业分析"}，特征识别度高，状态校验通过。`;
      if (node.resourceType === "imageLibrary" || node.resourceType === "videoLibrary" || node.resourceType === "audioLibrary") {
        summary = `成功检索并载入《${node.resourceName}》，加载相关标准多模态对照样本。针对当前上传的素材图像/音频，建立自适应灰度梯度或声谱比对矩阵，完成基准特征校对。`;
      } else if (node.resourceType === "tool") {
        summary = `运行技能模块《${node.resourceName}》，根据流式推理规程对输入的素材介质进行特定特征的细粒度连通区域提取、边缘检测与相对定位。`;
      } else if (node.resourceType === "agent") {
        summary = `调度决策智能体《${node.resourceName}》进行最后的综合会商研判。在多模态大模型的因果推理框架支持下，整合前面各节点输出的特征，评定事件影响与最终安全隐患等级。`;
      }

      return {
        id: node.id || `node-dyn-${index}`,
        nodeName: node.nodeName,
        role: node.role,
        resourceType: node.resourceType,
        resourceName: node.resourceName,
        status: "completed" as const,
        summary,
        evidenceUrl: index === 1 && selectedTemplate?.imageLibraries?.length ? "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=metal+surface+microscopic+crack+fatigue+industrial+inspection&image_size=landscape_16_9" : undefined
      };
    });

    if (nodes.length === 0) {
      nodes.push({
        id: "dyn-node-default",
        nodeName: "通用决策研判节点",
        role: "智能汇总分析",
        resourceType: "agent" as const,
        resourceName: "AI 决策中枢",
        status: "completed" as const,
        summary: "根据当前自定义模板的多模态研判规程，对上传的离线工件或现场图像文件执行全局卷积分类及目标定界算法，确认各项安全指标。",
        evidenceUrl: undefined
      });
    }

    return {
      id: `${templateId}-scenario`,
      name,
      nodes,
      result: {
        headline: `${name}：多模态流程一键分析完成`,
        summary: `AI智能体决策中枢已根据《${name}》定义的流式决策网络，对您上传的离线素材进行了全节点深度审计。目前现场整体运行平稳，发现局部有待优化的操作状态，建议安排专项跟踪。`,
        riskLevel: "中" as const,
        matchedResources: nodes.map(n => n.resourceName),
        recommendations: [
          `根据《${name}》智能中枢评定，请定期校验相关设备与作业指标，预防突发工艺或安全偏差；`,
          "将本次研判命中的核心比对特征记录到部门巡检数据库，形成该工位专有安全历史档案；",
          "结合决策智能体的输出意见，落实工段安全责任主体并部署二次纠偏监控。"
        ],
      }
    };
  }
};

export const getThinkingLogsForTemplate = (templateId: string, templateName?: string) => {
  if (templateId === "factory-hazard" || (templateName && templateName.includes("通道"))) {
    return [
      "正在读取并分析现场通道图像，对准黄线内绿色通道区域进行自适应裁剪...",
      "执行《多维危险源定界与定位》技能：智能检索走道内的木托盘、油污、杂物堆积...",
      "调取《通道安全与物理隐患图谱样本库》：比对标准障碍物特征与线缆裸露反面教材...",
      "调用《安全督导高级专家 Agent》进行深度推理，评估通道堵塞及物理危险源隐患等级...",
      "最终研判：自动标注异常隐患坐标，输出通道整改、临时隔离与安全防范建议清单..."
    ];
  } else if (templateId === "factory-ppe" || (templateName && templateName.includes("PPE")) || (templateName && templateName.includes("穿戴"))) {
    return [
      "正在扫描图像中的人脸与躯干区域，自适应定位所有的作业工位和流动人员...",
      "执行《劳保穿戴合规多分类比对》技能：分类检测安全帽、反光背心及防护手套穿戴状态...",
      "调取《PPE 个人防护规范比对样本库》：高精度核对各工种安全帽（红色/蓝色/黄色）佩戴规范...",
      "调用《PPE 穿戴合规审计 Agent》对所有人头和身躯穿戴状态作交叉核验，计算合规率...",
      "最终审计：标记违规位置，生成班组 PPE 合规率统计表，输出专项警示与防静电操作指南..."
    ];
  } else if (templateId === "factory-gauge" || (templateName && templateName.includes("仪表")) || (templateName && templateName.includes("读数"))) {
    return [
      "正在识别图像中的各类工业仪表、控制面板，增强压力刻度盘与数显屏的对比度...",
      "执行《仪表 OCR 与刻度换算校准》技能：高精度计算指针相对于零刻度的角度，估算数值...",
      "调取《阀门状态与压力表读数对照库》：核对过压临界或设备阀门开关方向等红线警示样本...",
      "调用《工业仪器仪表读数与故障研判 Agent》：智能诊断压力/温度参数是否处于超温、超载红色危险区...",
      "最终生成报告：输出当前仪器实时物理读数，标记异常数值，生成阀门截止与断电隔离应急措施..."
    ];
  } else if (templateId === "factory-audio-anomaly" || templateId === "audio-diagnosis" || (templateName && templateName.includes("噪音")) || (templateName && templateName.includes("异响"))) {
    return [
      "正在载入设备运转现场录音，运用带通滤波器自适应滤除高频风噪声和电网干扰底噪...",
      "执行《车间环境底噪自适应滤波》技能：提取音频梅尔频率倒谱系数 (MFCC)，分析频谱包络...",
      "调取《传动轴承磨损与异常异响音色库》：检索滚动轴承摩擦、传送带低频松动共振等标准谱...",
      "调用《声学频谱信号分析与诊断 Agent》：推算传动副内部摩擦剧烈等级及剩余安全运转寿命...",
      "最终诊断：锁定故障特征频率（如 2400Hz 调幅），输出轴承润滑或部件紧固计划排程建议..."
    ];
  } else if (templateId === "factory-audio-alarm" || (templateName && templateName.includes("警报")) || (templateName && templateName.includes("气"))) {
    return [
      "正在载入车间背景录音，开启大动态范围声谱提取，智能滤除压缩机连续稳态噪声...",
      "执行《高压气体泄漏超声频段诊断》技能：检索 8kHz 以上高频持续湍流嗤嗤声，区分瞬态排气...",
      "调取《工业高分贝灾害警报标准特征库》：比对消防高亢周期扫频声、应急警笛与气动泄露谱图...",
      "调用《声学频谱信号分析与诊断 Agent》：智能研判环境噪音声级，诊断微量超声波气压泄漏...",
      "最终研判：输出突发漏气或灾害报警声识别结果，锁定泄漏量级，并生成消防联动与隔离疏散指引..."
    ];
  } else if (templateId === "video-patrol" || (templateName && templateName.includes("视频"))) {
    return [
      "正在读取并降噪实时监控流的连续关键帧，增强画面边缘特征...",
      "事件识别：正在对比实时画面中的高频移动、异型轨迹与突发行为特征...",
      "结合时空感知模型：校验监控所在区域历史运行状态及热度变化趋势...",
      "决策评估：运行轻量级多模态概率网格模型，评定当前异常行为或烟火误报概率...",
      "研判输出：生成实时安全警示事件时间线、推荐消防或巡逻响应预案..."
    ];
  } else {
    // 动态自定义模版思考日志
    const name = templateName || "自定义多模态研判";
    return [
      `正在读取分析介质，初始化《${name}》流程的流式节点拓扑网络...`,
      "载入底层研判依赖，同步加载配置的认知技能算子与关联参考样本数据库...",
      "并发调度技能检测：运行空间标记、异常轮廓提取及多分类模式交叉核验...",
      "多轮思考会商：调度专属决策智能体，结合历史常态与边界规则对故障/异常作最终解算...",
      "决策归档：智能汇总全拓扑节点运行诊断，输出结构化安全评估报告与纠正建议清单..."
    ];
  }
};

export const buildGeminiPrompt = (templateId: string): string => {
  try {
    const configs = getStoredConfig();
    const tmpl = configs.templates.find((t) => t.id === templateId);
    if (!tmpl) return "";

    const agent = configs.agents.find((a) => a.id === tmpl.agentId);
    const skills = (tmpl.skillIds || [])
      .map((sid) => configs.skills.find((s) => s.id === sid))
      .filter((s): s is any => !!s);
    const sampleLib = configs.samples.find((s) => s.id === tmpl.sampleLibraryId);

    let prompt = `【分析模版】\n模版名称：${tmpl.name}\n模版描述：${tmpl.description}\n`;
    if (tmpl.defaultPrompt) {
      prompt += `分析指令规则：${tmpl.defaultPrompt}\n`;
    }

    if (agent) {
      prompt += `\n【核心智能体角色与设定】\n智能体名称：${agent.name}\n系统设定指令：${agent.systemInstruction}\n`;
    }

    if (skills.length > 0) {
      prompt += `\n【使用的研判技能与定制规则】\n`;
      skills.forEach((skill, idx) => {
        prompt += `${idx + 1}. 技能 [${skill.name}]：${skill.description}\n`;
        if (skill.customRules) {
          prompt += `   - 定制执行规则：${skill.customRules}\n`;
        }
      });
    }

    if (sampleLib && sampleLib.samples.length > 0) {
      prompt += `\n【比对样本参考标准】\n样本库：${sampleLib.name}\n样本库说明：${sampleLib.description}\n标准对照样本列表：\n`;
      sampleLib.samples.forEach((sample, idx) => {
        prompt += `   样本 ${idx + 1} [${sample.name}]：${sample.description}\n`;
      });
    }

    prompt += `\n【响应格式要求】
请严格按照以下步骤进行分析：
1. 首先进行内部深度思考和步骤研判。
2. **关键步骤**：在完成所有思考后，输出一个绝对唯一的分隔符：---
3. **最终结论**：在分隔符 --- 之后，**只允许**输出一个扁平的、合法的 JSON 对象。

**严禁事项：**
- 严禁输出嵌套的 JSON（如在 JSON 内部又开始一个新的 { ）。
- 严禁包含 Markdown 代码块标签（\`\`\`json）。
- 严禁包含任何前缀（如 "Answer:"）或后缀。

JSON 对象必须严格符合以下扁平结构：
{
  "headline": "检测结论标题",
  "riskLevel": "高 / 中 / 低",
  "summary": "详细分析摘要（支持 \\n 换行）",
  "matchedResources": ["资源标签 1", "资源标签 2"],
  "recommendations": ["处置建议 1", "处置建议 2"]
}

注意：系统将尝试提取 --- 之后最长的合法 JSON 块。请确保格式严谨。`;

    return prompt;
  } catch (error) {
    console.error("Failed to build Gemini prompt:", error);
    return "";
  }
};

export const AgentAnalysisPanel = React.forwardRef<AgentAnalysisPanelHandle, AgentAnalysisPanelProps>((
  {
    activeTab,
    selectedTemplate,
    offlineAssets,
    realtimeStatus,
    isAnalyzing: externalIsAnalyzing,
    isCapturing,
    trace: externalTrace,
    result: externalResult,
    activeRecordingTask,
    onStartRecordingTask,
    onStopRecordingTask,
    onStartAnalysis,
    captures,
    videos,
    audios,
    onRemoveCapture,
    onRemoveVideo,
    onRemoveAudio,
    nextTriggerTime,
    countdown,
    onSimulationComplete,
    history = [],
    onRestoreHistory,
    onReset,
    aiMode = "mock",
  },
  ref
) => {
  // 分离 offline 和 realtime 的内部独立状态域
  const [offlineState, setOfflineState] = useState({
    isAnalyzing: false,
    trace: null as AgentAnalysisTrace | null,
    result: null as AgentAnalysisResult | null,
    currentRunningNodeIndex: -1,
    showFinalResult: false,
    isThinking: false,
    thinkingStep: 0,
    dynamicThinkingLogs: [] as string[],
    dynamicResultText: "",
    hasError: false,
    errorMessage: "",
    isWaitingForApi: false,
  });

  const [realtimeState, setRealtimeState] = useState({
    isAnalyzing: false,
    trace: null as AgentAnalysisTrace | null,
    result: null as AgentAnalysisResult | null,
    currentRunningNodeIndex: -1,
    showFinalResult: false,
    isThinking: false,
    thinkingStep: 0,
    dynamicThinkingLogs: [] as string[],
    dynamicResultText: "",
    hasError: false,
    errorMessage: "",
    isWaitingForApi: false,
  });

  // 映射当前 activeTab 的状态
  const internalIsAnalyzing = activeTab === "offline" ? offlineState.isAnalyzing : realtimeState.isAnalyzing;
  const internalTrace = activeTab === "offline" ? offlineState.trace : realtimeState.trace;
  const internalResult = activeTab === "offline" ? offlineState.result : realtimeState.result;
  const currentRunningNodeIndex = activeTab === "offline" ? offlineState.currentRunningNodeIndex : realtimeState.currentRunningNodeIndex;
  const showFinalResult = activeTab === "offline" ? offlineState.showFinalResult : realtimeState.showFinalResult;
  const isThinking = activeTab === "offline" ? offlineState.isThinking : realtimeState.isThinking;
  const thinkingStep = activeTab === "offline" ? offlineState.thinkingStep : realtimeState.thinkingStep;
  const dynamicThinkingLogs = activeTab === "offline" ? offlineState.dynamicThinkingLogs : realtimeState.dynamicThinkingLogs;
  const dynamicResultText = activeTab === "offline" ? offlineState.dynamicResultText : realtimeState.dynamicResultText;
  const hasError = activeTab === "offline" ? offlineState.hasError : realtimeState.hasError;
  const errorMessage = activeTab === "offline" ? offlineState.errorMessage : realtimeState.errorMessage;
  const internalIsWaitingForApi = activeTab === "offline" ? offlineState.isWaitingForApi : realtimeState.isWaitingForApi;

  const [isThoughtExpanded, setIsThoughtExpanded] = useState(true);

  // 深度思考开始时自动展开，思考完成后自动折叠起来
  useEffect(() => {
    if (isThinking) {
      setIsThoughtExpanded(true);
    } else {
      setIsThoughtExpanded(false);
    }
  }, [isThinking]);

  const [flyingAsset, setFlyingAsset] = useState<{ type: "image" | "video" | "audio"; rect: DOMRect } | null>(null);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoredTraceId, setRestoredTraceId] = useState<string | null>(null);
  const conclusionRef = useRef<HTMLDivElement>(null);

  // 当重新启动分析时，重置 restoredTraceId
  const isAnalyzing = externalIsAnalyzing || internalIsAnalyzing;
  useEffect(() => {
    if (isAnalyzing) {
      setRestoredTraceId(null);
    }
  }, [isAnalyzing]);

  const onSimulationCompleteRef = useRef(onSimulationComplete);
  useEffect(() => {
    onSimulationCompleteRef.current = onSimulationComplete;
  }, [onSimulationComplete]);
  const historyRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>(`session_${Math.random().toString(36).substring(2, 11)}`);

  const handleDownloadHistory = () => {
    if (history.length === 0) return;
    const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), history }, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai_analysis_history_${safeTimestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  // 当分析开始时自动关闭历史下拉菜单
  useEffect(() => {
    if (!!activeRecordingTask || internalIsAnalyzing || externalIsAnalyzing) {
      setShowHistoryDropdown(false);
    }
  }, [activeRecordingTask, internalIsAnalyzing, externalIsAnalyzing]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 追踪已完成动画的素材 ID
  const [completedAnimationIds, setCompletedAnimationIds] = useState<Set<string>>(new Set());

  const [showFullscreen, setShowFullscreen] = useState<{ image: string } | null>(null);
  const [showVideoModal, setShowVideoModal] = useState<{ url: string } | null>(null);
  const [showAudioModal, setShowAudioModal] = useState<{ url: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const assetsContainerRef = useRef<HTMLDivElement>(null);
  const nextSlotRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thinkingScrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const userHasScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  const [offlineTimer, setOfflineTimer] = useState<NodeJS.Timeout | null>(null);
  const [realtimeTimer, setRealtimeTimer] = useState<NodeJS.Timeout | null>(null);

  // 最终分析结论的打字机控制状态
  const [conclusionPhase, setConclusionPhase] = useState<number>(0);
  const [typedResourcesCount, setTypedResourcesCount] = useState<number>(0);
  const [typedRecsCount, setTypedRecsCount] = useState<number>(0);
  const [shouldTypeResult, setShouldTypeResult] = useState<boolean>(false);

  const resetConclusionTyping = (fresh: boolean) => {
    setConclusionPhase(fresh ? 0 : 99);
    setTypedResourcesCount(fresh ? 0 : 999);
    setTypedRecsCount(fresh ? 0 : 999);
    setShouldTypeResult(fresh);
  };

  // --- 状态更新帮助函数 ---
  const updateInternalState = React.useCallback((updates: Partial<typeof offlineState>, mode?: AiWorkspaceTab) => {
    const targetMode = mode || activeTab;
    if (targetMode === "offline") {
      setOfflineState(prev => ({ ...prev, ...updates }));
    } else {
      setRealtimeState(prev => ({ ...prev, ...updates }));
    }
  }, [activeTab]);

  const updateInternalTrace = React.useCallback((newTrace: AgentAnalysisTrace | null | ((prev: AgentAnalysisTrace | null) => AgentAnalysisTrace | null), mode?: AiWorkspaceTab) => {
    const targetMode = mode || activeTab;
    if (targetMode === "offline") {
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

  // 暴露给父组件
  useImperativeHandle(ref, () => ({
    startSimulation,
    stopSimulation: (options?: { keepState?: boolean; mode?: AiWorkspaceTab }) => stopSimulation(options),
  }));

  // 保持 completedAnimationIds 与当前素材同步，自动删除已移除的素材 ID
  useEffect(() => {
    const allIds = new Set([
      ...captures.map(c => c.id),
      ...videos.map(v => v.id),
      ...audios.map(a => a.id),
    ]);
    let changed = false;
    const next = new Set<string>();
    completedAnimationIds.forEach(id => {
      if (allIds.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    });
    if (changed) {
      setCompletedAnimationIds(next);
    }
  }, [captures, videos, audios]);

  // 监听素材变化，触发飞行图标动画
  useEffect(() => {
    const newIds = captures.filter(c => !completedAnimationIds.has(c.id));
    if (newIds.length === 0) return;

    // 场景 A: 批量恢复、历史还原、或没有在抓拍中的初次渲染
    if (isRestoring || !isCapturing || newIds.length > 1) {
      setCompletedAnimationIds(prev => {
        const next = new Set(prev);
        captures.forEach(c => next.add(c.id));
        return next;
      });
      return;
    }

    // 场景 B: 正常单次抓拍
    const lastCap = captures[captures.length - 1];
    if (lastCap && newIds.some(n => n.id === lastCap.id)) {
      if (lastCap.rect) {
        setFlyingAsset({ type: "image", rect: lastCap.rect });
      } else {
        setCompletedAnimationIds(prev => {
          const next = new Set(prev);
          next.add(lastCap.id);
          return next;
        });
      }
    }
  }, [captures, isCapturing, isRestoring]);

  useEffect(() => {
    const newIds = videos.filter(v => !completedAnimationIds.has(v.id));
    if (newIds.length === 0) return;

    // 批量恢复、历史还原或没有在抓拍中
    if (isRestoring || !isCapturing || newIds.length > 1) {
      setCompletedAnimationIds(prev => {
        const next = new Set(prev);
        videos.forEach(v => next.add(v.id));
        return next;
      });
      return;
    }

    const lastVid = videos[videos.length - 1];
    if (lastVid && newIds.some(n => n.id === lastVid.id)) {
      if (lastVid.rect) {
        setFlyingAsset({ type: "video", rect: lastVid.rect });
      } else {
        setCompletedAnimationIds(prev => {
          const next = new Set(prev);
          next.add(lastVid.id);
          return next;
        });
      }
    }
  }, [videos, isCapturing, isRestoring]);

  useEffect(() => {
    const newIds = audios.filter(a => !completedAnimationIds.has(a.id));
    if (newIds.length === 0) return;

    // 批量恢复、历史还原或没有在抓拍中
    if (isRestoring || !isCapturing || newIds.length > 1) {
      setCompletedAnimationIds(prev => {
        const next = new Set(prev);
        audios.forEach(a => next.add(a.id));
        return next;
      });
      return;
    }

    const lastAud = audios[audios.length - 1];
    if (lastAud && newIds.some(n => n.id === lastAud.id)) {
      if (lastAud.rect) {
        setFlyingAsset({ type: "audio", rect: lastAud.rect });
      } else {
        setCompletedAnimationIds(prev => {
          const next = new Set(prev);
          next.add(lastAud.id);
          return next;
        });
      }
    }
  }, [audios, isCapturing, isRestoring]);

  const trace = externalTrace || internalTrace;
  const result = externalResult || internalResult;
  const isHistoryRestored = !!(trace?.id && restoredTraceId && trace.id === restoredTraceId);
  const actualShouldTypeResult = shouldTypeResult && !isHistoryRestored;

  useEffect(() => {
    if (showFinalResult && (result || dynamicResultText)) {
      if (isHistoryRestored) {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      } else {
        conclusionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [showFinalResult, result, dynamicResultText, isHistoryRestored]);

  useEffect(() => {
    if (showFinalResult && result && conclusionPhase === 2) {
      if (!result.matchedResources || result.matchedResources.length === 0 || typedResourcesCount >= result.matchedResources.length) {
        setConclusionPhase(3);
      }
    }
  }, [conclusionPhase, typedResourcesCount, result, showFinalResult]);

  useEffect(() => {
    if (!isAnalyzing && trace?.id && !shouldTypeResult) {
      resetConclusionTyping(false);
    }
  }, [isAnalyzing, trace?.id, shouldTypeResult]);

  // 当外部传入 result 且不在分析中时（通常是还原历史记录），自动展示最终结果
  useEffect(() => {
    if (externalResult && !isAnalyzing) {
      updateInternalState({ showFinalResult: true });
    }
  }, [externalResult, isAnalyzing]);

  // 当外部的 trace 改变（例如用户还原历史记录），我们自动从历史记录中恢复深度思考的显示状态
  useEffect(() => {
    if (trace && !isAnalyzing) {
      const matched = history.find(item => item.id === trace.id);
      if (matched) {
        const restoredStep = matched.thinkingStep !== undefined ? matched.thinkingStep : 4;
        updateInternalState({
          thinkingStep: restoredStep,
          isThinking: false,
          showFinalResult: true,
        });
        setIsThoughtExpanded(false); // 深度思考已输出完毕，默认保持折叠状态
      }
    }
  }, [trace?.id, isAnalyzing, history]);

  // 当开始进行分析或思考时，重置用户手动向上滚动的标志
  useEffect(() => {
    if (isAnalyzing || isThinking) {
      userHasScrolledUpRef.current = false;
      lastScrollTopRef.current = 0;
    }
  }, [isAnalyzing, isThinking]);

  // 监听容器 scroll 事件，用于判定用户是否手动往上滚动了
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;

      // 如果是由自动滚动引起的，我们不计入用户手动滚动
      if (isAutoScrollingRef.current) {
        lastScrollTopRef.current = currentScrollTop;
        return;
      }

      // 如果未触底，且 scrollTop 相对上一次减少了（向上滚了超过 5 像素），则认为用户手动向上滚动了
      const isAtBottom = scrollHeight - currentScrollTop - clientHeight < 15;
      if (!isAtBottom && currentScrollTop < lastScrollTopRef.current - 5) {
        userHasScrolledUpRef.current = true;
      } else if (isAtBottom) {
        // 如果用户手动滚回到了底部，恢复自动跟随滚动
        userHasScrolledUpRef.current = false;
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // 自动滚动到底部，追踪最新内容（视角一直追随最新文字输出）
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const isActivelyOutputting = isAnalyzing || isThinking || (showFinalResult && shouldTypeResult && conclusionPhase < 4);

    const performScroll = () => {
      if (isActivelyOutputting && !userHasScrolledUpRef.current) {
        isAutoScrollingRef.current = true;
        // 直接赋值高度，保证 100% 极速、精确地贴合最新视图
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 50);
      }
    };

    performScroll();

    // 监听容器大小或子节点变化（如打字机、流式输出导致的布局改变）
    const observer = new ResizeObserver(() => {
      performScroll();
    });

    observer.observe(scrollContainer);
    return () => {
      observer.disconnect();
    };
  }, [
    trace?.nodes,
    showFinalResult,
    currentRunningNodeIndex,
    isAnalyzing,
    isThinking,
    thinkingStep,
    dynamicThinkingLogs,
    dynamicResultText,
    conclusionPhase,
    typedResourcesCount,
    typedRecsCount,
    shouldTypeResult
  ]);

  // 深度思考局部滚动条自动探底，实现视角紧跟打字/最新推演内容
  useEffect(() => {
    const scrollContainer = thinkingScrollRef.current;
    if (!scrollContainer) return;

    const performScroll = () => {
      if (isThinking) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    };

    performScroll();

    const observer = new ResizeObserver(() => {
      performScroll();
    });

    observer.observe(scrollContainer);
    return () => {
      observer.disconnect();
    };
  }, [isThinking, dynamicThinkingLogs, thinkingStep, isThoughtExpanded]);

  const currentModeLabel = activeTab === "realtime" ? "实时分析" : "离线分析";
  const canRun = useMemo(() => {
    if (activeTab === "offline") {
      return offlineAssets.length > 0;
    }
    // 实时模式下，要求必须先有采集到的素材（截图、视频或音频）才能启动分析
    // 这样可以避免用户点击“启动分析”时意外触发自动截图，让流程更可控
    return captures.length > 0 || videos.length > 0 || audios.length > 0;
  }, [activeTab, offlineAssets.length, captures.length, videos.length, audios.length]);

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 判断是否存在手动添加的素材
  const hasManualAssets = useMemo(() => {
    if (activeTab === "offline") {
      return offlineAssets.length > 0;
    }
    // 实时模式下，检查是否有手动截图、录像或音频
    return captures.length > 0 || videos.length > 0 || audios.length > 0;
  }, [activeTab, offlineAssets, captures, videos, audios]);

  // 停止模拟逻辑与彻底重置状态
  const stopSimulation = (options: { keepState?: boolean; mode?: AiWorkspaceTab } = { keepState: false }) => {
    const targetMode = options.mode || activeTab;

    if (targetMode === "offline") {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        clearInterval(offlineTimer as any);
        setOfflineTimer(null);
      }
    } else {
      if (realtimeTimer) {
        clearTimeout(realtimeTimer);
        clearInterval(realtimeTimer as any);
        setRealtimeTimer(null);
      }
    }

    if (!options.keepState) {
      // 重置对应模式相关的内部状态
      updateInternalState({
        isAnalyzing: false,
        trace: null,
        result: null,
        showFinalResult: false,
        currentRunningNodeIndex: -1,
        isThinking: false,
        thinkingStep: 0,
        dynamicThinkingLogs: [],
        dynamicResultText: "",
        hasError: false,
        errorMessage: "",
        isWaitingForApi: false,
      }, targetMode);
    } else {
      // 仅停止分析状态，保留 trace 和 result
      updateInternalState({
        isAnalyzing: false,
        isThinking: false,
        isWaitingForApi: false,
      }, targetMode);
    }

    // 注意：不再这里重置 completedAnimationIds，因为它反映的是素材的“已入场”状态
    // 素材的实际清理由 useEffect 监听 captures.length === 0 来处理
    setFlyingAsset(null);

    // 关闭所有预览弹窗
    setShowFullscreen(null);
    setShowVideoModal(null);
    setShowAudioModal(null);
  };

  // --- 真实接口调用逻辑 ---
  const callLocalAiApi = async (targetMode: AiWorkspaceTab) => {
    try {
      // 1. 准备请求参数
      const formData = new FormData();

      // 提取 message (可以使用当前模板的描述或留空)
      formData.append("message", "");

      // vision_mode: 根据当前模板映射
      // 映射规则: "video-patrol" -> "安全帽检测", "image-inspector" -> "地面油污检测", "audio-diagnosis" -> "反光衣检测"
      let visionMode = "地面油污检测";
      if (selectedTemplate.id === "video-patrol") visionMode = "安全帽检测";
      if (selectedTemplate.id === "image-inspector") visionMode = "地面油污检测";
      if (selectedTemplate.id === "audio-diagnosis") visionMode = "反光衣检测";
      // formData.append("vision_mode", '');

      formData.append("language", "中文");
      formData.append("session_id", sessionIdRef.current);
      formData.append("task_name", selectedTemplate.name);
      formData.append("task_type", "custom");

      // 生成丰富的 Prompt，包含模板、智能体、技能和样本信息
      const richPrompt = buildGeminiPrompt(selectedTemplate.id);
      formData.append("custom_prompt", richPrompt || selectedTemplate.description);

      // 处理文件上传 (支持实时与离线模式)
      let fileUrl = "";
      let fileName = "file.jpg";

      if (targetMode === "offline") {
        if (offlineAssets.length > 0) {
          const asset = offlineAssets[0];
          fileUrl = asset.dataUrl;
          fileName = asset.name || (asset.mimeType.includes("audio") ? "audio.m4a" : "image.jpg");
        }
      } else {
        if (captures.length > 0) {
          fileUrl = captures[captures.length - 1].image;
          fileName = "capture.jpg";
        } else if (videos.length > 0) {
          fileUrl = videos[videos.length - 1].url;
          fileName = "video.mp4";
        } else if (audios.length > 0) {
          fileUrl = audios[audios.length - 1].url;
          fileName = "audio.m4a";
        }
      }

      if (fileUrl) {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        formData.append("file", blob, fileName);
      } else {
        throw new Error("未找到可分析的素材文件");
      }

      // 2. 初始化状态
      const scenario = getScenarioForTemplate(selectedTemplate.id);
      const initialTrace: AgentAnalysisTrace = {
        id: "api-" + Date.now(),
        mode: targetMode,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        startedAt: new Date().toISOString(),
        nodes: scenario.nodes.map(node => ({
          ...node,
          status: "waiting",
          summary: ""
        })),
      };

      updateInternalState({
        isAnalyzing: true,
        isThinking: true,
        dynamicThinkingLogs: [],
        dynamicResultText: "",
        showFinalResult: false,
        trace: initialTrace,
        hasError: false,
        errorMessage: "",
      }, targetMode);
      setIsThoughtExpanded(true);
      resetConclusionTyping(true);

      // 3. 并行执行：API 请求 与 模拟流程 (深度思考 + 节点执行)
      let apiFinished = false;
      let simulationFinished = false;
      let finalTraceData: AgentAnalysisTrace | null = null;
      let localResult: AgentAnalysisResult | null = null;

      const checkAndFinalize = () => {
        if (apiFinished && simulationFinished) {
          const currentResult = localResult || {
            headline: "AI 分析完成",
            summary: "通过本地大模型接口生成的分析报告",
            riskLevel: "低",
            matchedResources: [],
            recommendations: [],
          };
          updateInternalState({
            isAnalyzing: false,
            isWaitingForApi: false,
            result: currentResult,
            showFinalResult: true,
          }, targetMode);
          if (onSimulationCompleteRef.current && finalTraceData) {
            onSimulationCompleteRef.current(currentResult, finalTraceData);
          }
        } else if (simulationFinished && !apiFinished) {
          // 模拟过程执行完毕，但接口还没响应，显示等待动画
          updateInternalState({ isWaitingForApi: true }, targetMode);
        }
      };

      // 3a. 模拟深度思考计时器 (4秒)
      let currentStep = 0;
      const thinkingInterval = setInterval(() => {
        currentStep++;
        if (currentStep <= 4) {
          updateInternalState({ thinkingStep: currentStep }, targetMode);
        } else {
          clearInterval(thinkingInterval);
          updateInternalState({ isThinking: false }, targetMode);
          setIsThoughtExpanded(false);
          // 深度思考结束，开始模拟节点执行
          executeNodesSimulation();
        }
      }, 1000);

      // 3b. 模拟节点执行流程
      const executeNodesSimulation = () => {
        let currentIndex = 0;
        const nodes = initialTrace.nodes;

        const executeNextNode = () => {
          if (currentIndex >= nodes.length) {
            // 所有节点执行完毕
            simulationFinished = true;
            finalTraceData = {
              ...initialTrace,
              nodes: nodes.map(n => ({ ...n, status: "completed" as const }))
            };
            checkAndFinalize();
            return;
          }

          const nodeIndex = currentIndex;
          updateInternalState({ currentRunningNodeIndex: nodeIndex }, targetMode);

          updateInternalTrace((prev) => {
            if (!prev) return null;
            const newNodes = [...prev.nodes];
            newNodes[nodeIndex] = { ...newNodes[nodeIndex], status: "running" };
            return { ...prev, nodes: newNodes };
          }, targetMode);

          setTimeout(() => {
            updateInternalTrace((prev) => {
              if (!prev) return null;
              const newNodes = [...prev.nodes];
              newNodes[nodeIndex] = {
                ...newNodes[nodeIndex],
                status: "completed",
                summary: scenario.nodes[nodeIndex].summary || "分析节点执行完成。"
              };
              return { ...prev, nodes: newNodes };
            }, targetMode);

            currentIndex++;
            setTimeout(executeNextNode, 1500);
          }, 2000);
        };

        executeNextNode();
      };

      // 3c. 发起真实 API 请求并获取结论
      const response = await fetch("http://10.0.0.79:9000/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "API request failed");
      }
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isFinalResult = false;
      let fullResultText = "";
      let allReceivedText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 接口完全响应完毕后处理结果
          // 如果模型一直没输出 ---，则尝试从全文中提取 JSON
          const targetText = isFinalResult ? fullResultText : allReceivedText;

          if (targetText.trim()) {
            try {
              // 深度搜索合法的 JSON 对象
              const tryParseJson = (str: string): any => {
                const stack: number[] = [];
                for (let i = 0; i < str.length; i++) {
                  if (str[i] === "{") {
                    stack.push(i);
                  } else if (str[i] === "}") {
                    const start = stack.pop();
                    if (start !== undefined) {
                      const candidate = str.slice(start, i + 1);
                      try {
                        const parsed = JSON.parse(candidate);
                        // 验证是否包含核心字段
                        if (parsed && typeof parsed === "object" && (parsed.headline || parsed.summary)) {
                          return parsed;
                        }
                      } catch (e) {
                        // 继续尝试
                      }
                    }
                  }
                }
                return null;
              };

              const parsed = tryParseJson(targetText);

              if (parsed) {
                const mappedResult: AgentAnalysisResult = {
                  headline: parsed.headline || "分析完成",
                  summary: parsed.summary || "未提供详细摘要",
                  riskLevel: parsed.riskLevel || "低",
                  matchedResources: parsed.matchedResources || [],
                  recommendations: parsed.recommendations || [],
                };

                localResult = mappedResult;
                updateInternalState({
                  result: mappedResult,
                  dynamicResultText: "",
                }, targetMode);

                if (finalTraceData) {
                  (finalTraceData as any).result = mappedResult;
                }
              } else {
                throw new Error("No valid JSON structure found");
              }
            } catch (e) {
              // 如果不是 JSON 格式，则退回到普通的打字机文本模式
              // 尝试从 allReceivedText 中提取最后的 Answer 之后的部分
              let fallbackText = targetText;
              const answerIdx = targetText.lastIndexOf("Answer:");
              if (answerIdx !== -1) {
                fallbackText = targetText.slice(answerIdx + 7).trim();
              }

              const cleanText = fallbackText
                .replace(/```json|```/g, "")
                .replace(/\\r\\n/g, "\n")
                .replace(/\\n/g, "\n")
                .replace(/\*\*.*?\*\*/g, (match) => match.replace(/\*\*/g, ""))
                .trim();

              localResult = {
                headline: "分析结论",
                summary: cleanText,
                riskLevel: "低",
                matchedResources: [],
                recommendations: [],
              };
              updateInternalState({
                dynamicResultText: cleanText,
              }, targetMode);
            }
          }
          apiFinished = true;
          checkAndFinalize();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          allReceivedText += data + "\n"; // 始终保存原始全量文本作为备份

          if (data === "---") {
            isFinalResult = true;
            continue;
          }

          if (data.startsWith(">")) {
            continue;
          } else if (isFinalResult) {
            // 处理字面量换行符
            const cleanData = data
              .replace(/<br\s*\/?>/gi, "\n")
              .replace(/\\r\\n/g, "\n")
              .replace(/\\n/g, "\n");
            fullResultText += cleanData;
          }
        }
      }
    } catch (error: any) {
      console.error("Local AI API Error:", error);
      updateInternalState({
        isAnalyzing: false,
        isThinking: false,
        isWaitingForApi: false,
        hasError: true,
        errorMessage: error.message || "未知错误"
      }, targetMode);
    }
  };

  // 真实 Gemini API 接口调用逻辑
  const callGeminiAiApi = async (targetMode: AiWorkspaceTab) => {
    let thinkingInterval: NodeJS.Timeout | null = null;
    try {
      // 1. 获取要发送的素材
      let fileUrl = "";
      let mimeType = "";
      let fileName = "file.jpg";

      if (targetMode === "offline") {
        if (offlineAssets.length > 0) {
          fileUrl = offlineAssets[0].dataUrl;
          mimeType = offlineAssets[0].mimeType;
          fileName = offlineAssets[0].name;
        }
      } else {
        if (captures.length > 0) {
          fileUrl = captures[captures.length - 1].image;
          mimeType = "image/jpeg";
          fileName = "capture.jpg";
        } else if (videos.length > 0) {
          fileUrl = videos[videos.length - 1].url;
          mimeType = "video/mp4";
          fileName = "video.mp4";
        } else if (audios.length > 0) {
          fileUrl = audios[audios.length - 1].url;
          mimeType = "audio/m4a";
          fileName = "audio.m4a";
        }
      }

      if (!fileUrl) {
        throw new Error("请先提供分析素材（如图片或音频）");
      }

      const scenario = getScenarioForTemplate(selectedTemplate.id);
      const initialTrace: AgentAnalysisTrace = {
        id: "gemini-" + Date.now(),
        mode: targetMode,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        startedAt: new Date().toISOString(),
        nodes: scenario.nodes.map((n) => ({ ...n, status: "waiting", summary: "" })),
      };

      updateInternalState({
        isAnalyzing: true,
        isThinking: true,
        thinkingStep: 0,
        dynamicThinkingLogs: [], // empty array allows getThinkingLogsForTemplate fallback
        dynamicResultText: "",
        showFinalResult: false,
        trace: initialTrace,
        hasError: false,
        errorMessage: "",
      }, targetMode);
      setIsThoughtExpanded(true);
      resetConclusionTyping(true);

      // Convert URL to Base64
      let base64Data = "";
      if (fileUrl.startsWith("data:")) {
        base64Data = fileUrl;
      } else {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const fullPrompt = buildGeminiPrompt(selectedTemplate.id);

      let apiFinished = false;
      let simulationFinished = false;
      let finalTraceData: AgentAnalysisTrace | null = null;
      let finalResultData: AgentAnalysisResult | null = null;
      let geminiResponseData: any = null;
      let apiError: any = null;

      const checkAndFinalize = () => {
        if (apiError) {
          updateInternalState({
            isAnalyzing: false,
            isThinking: false,
            hasError: true,
            errorMessage: apiError.message || "Gemini 分析模型调用异常，请重试"
          }, targetMode);
          return;
        }

        if (apiFinished && simulationFinished) {
          const currentResult = finalResultData || {
            headline: "Gemini 研判完成",
            summary: "分析未检测到严重隐患，系统运行状态正常。",
            riskLevel: "低",
            matchedResources: [],
            recommendations: [],
          };
          updateInternalState({
            isAnalyzing: false,
            isWaitingForApi: false,
            result: currentResult,
            showFinalResult: true,
          }, targetMode);
          if (onSimulationCompleteRef.current && finalTraceData) {
            onSimulationCompleteRef.current(currentResult, finalTraceData);
          }
        } else if (simulationFinished && !apiFinished) {
          // 模拟过程执行完毕，但接口还没响应，显示等待动画
          updateInternalState({ isWaitingForApi: true }, targetMode);
        }
      };

      const executeNodesSimulation = () => {
        const steps = geminiResponseData?.processSteps || [
          { phase: "样本库加载", detail: "已成功加载并比对标准危险源样本图谱。" },
          { phase: "图像特征检测", detail: "多重算子识别完成，提取可能隐患的关键区域。" },
          { phase: "高级督导决策", detail: "经由安全督导智能体协同判断，输出最终决策建议。" }
        ];

        let currentIndex = 0;
        const executeNextNode = () => {
          if (currentIndex >= scenario.nodes.length) {
            simulationFinished = true;
            // 构造最终 trace 记录
            finalTraceData = {
              id: initialTrace.id,
              mode: initialTrace.mode,
              templateId: initialTrace.templateId,
              templateName: initialTrace.templateName,
              startedAt: initialTrace.startedAt,
              nodes: scenario.nodes.map((n, idx) => {
                const currentSteps = geminiResponseData?.processSteps || steps;
                const stepDetail = currentSteps[idx] || currentSteps[currentSteps.length - 1];
                return {
                  ...n,
                  status: "completed" as const,
                  summary: stepDetail ? stepDetail.detail : n.summary
                };
              }),
            };
            checkAndFinalize();
            return;
          }

          const nodeToExecuteIndex = currentIndex;
          updateInternalState({ currentRunningNodeIndex: nodeToExecuteIndex }, targetMode);

          updateInternalTrace((prev) => {
            if (!prev) return null;
            const newNodes = [...prev.nodes];
            newNodes[nodeToExecuteIndex] = { ...newNodes[nodeToExecuteIndex], status: "running" };
            return { ...prev, nodes: newNodes };
          }, targetMode);

          const timer = setTimeout(() => {
            updateInternalTrace((prev) => {
              if (!prev) return null;
              const newNodes = [...prev.nodes];
              const nodeData = scenario.nodes[nodeToExecuteIndex];
              const currentSteps = geminiResponseData?.processSteps || steps;
              const stepDetail = currentSteps[nodeToExecuteIndex] || currentSteps[currentSteps.length - 1];

              if (nodeData) {
                newNodes[nodeToExecuteIndex] = {
                  ...newNodes[nodeToExecuteIndex],
                  status: "completed",
                  summary: stepDetail ? stepDetail.detail : nodeData.summary
                };
              }
              return { ...prev, nodes: newNodes };
            }, targetMode);

            currentIndex++;
            const nextTimer = setTimeout(executeNextNode, 1500);
            if (targetMode === "offline") setOfflineTimer(nextTimer);
            else setRealtimeTimer(nextTimer);
          }, 2000);

          if (targetMode === "offline") setOfflineTimer(timer);
          else setRealtimeTimer(timer);
        };

        executeNextNode();
      };

      // 2. 深度思考 4 秒，每秒增加 tick
      let currentStep = 0;
      thinkingInterval = setInterval(() => {
        currentStep++;
        if (currentStep <= 4) {
          updateInternalState({ thinkingStep: currentStep }, targetMode);
        } else {
          if (thinkingInterval) clearInterval(thinkingInterval);
          updateInternalState({ isThinking: false }, targetMode);
          setIsThoughtExpanded(false);
          // 深度思考完毕，立即响应分析过程
          executeNodesSimulation();
        }
      }, 1000);

      const configs = getStoredConfig();
      const tmpl = configs.templates.find((t) => t.id === selectedTemplate.id);
      const agent = tmpl ? configs.agents.find((a) => a.id === tmpl.agentId) : null;
      const activeModel = agent?.model || "gemini-2.5-flash";

      // Call client-side analyzeWithGemini
      analyzeWithGemini({
        fileData: base64Data,
        mimeType: mimeType || "image/jpeg",
        scenarioId: selectedTemplate.id,
        scenarioName: selectedTemplate.name,
        customPrompt: fullPrompt,
        model: activeModel,
      })
        .then((data) => {
          geminiResponseData = data;
          const currentSteps = geminiResponseData?.processSteps || [
            { phase: "样本库加载", detail: "已成功加载并比对标准危险源样本图谱。" },
            { phase: "图像特征检测", detail: "多重算子识别完成，提取可能隐患的关键区域。" },
            { phase: "高级督导决策", detail: "经由安全督导智能体协同判断，输出最终决策建议。" }
          ];

          finalResultData = {
            headline: geminiResponseData.title || "Gemini 研判完成",
            summary: geminiResponseData.summary || "分析未检测到严重隐患，系统运行状态正常。",
            riskLevel: geminiResponseData.confidence > 75 ? "高" : geminiResponseData.confidence > 40 ? "中" : "低",
            matchedResources: (geminiResponseData.results || []).map((r: any) => `${r.label}: ${r.value}`),
            recommendations: (geminiResponseData.suggestions || []).map((s: any) => s.text),
          };

          finalTraceData = {
            id: initialTrace.id,
            mode: initialTrace.mode,
            templateId: initialTrace.templateId,
            templateName: initialTrace.templateName,
            startedAt: initialTrace.startedAt,
            nodes: scenario.nodes.map((n, idx) => {
              const stepDetail = currentSteps[idx] || currentSteps[currentSteps.length - 1];
              return {
                ...n,
                status: "completed" as const,
                summary: stepDetail ? stepDetail.detail : n.summary
              };
            }),
          };

          apiFinished = true;
          checkAndFinalize();
        })
        .catch((err) => {
          apiError = err;
          if (thinkingInterval) clearInterval(thinkingInterval);
          checkAndFinalize();
        });

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (thinkingInterval) clearInterval(thinkingInterval);
      updateInternalState({
        isAnalyzing: false,
        isThinking: false,
        hasError: true,
        errorMessage: error.message || "Gemini 分析模型调用异常，请重试或检查专属 API Key"
      }, targetMode);
    }
  };

  // 真实 千问大模型 接口调用逻辑
  const callQwenAiApi = async (targetMode: AiWorkspaceTab) => {
    try {
      // 1. 获取所有要发送的素材
      const mediaItems: { url: string; type: "image" | "video" | "audio" }[] = [];

      if (targetMode === "offline") {
        offlineAssets.forEach(asset => {
          if (asset.mimeType.startsWith("image/")) {
            mediaItems.push({ url: asset.dataUrl, type: "image" });
          } else if (asset.mimeType.startsWith("video/")) {
            mediaItems.push({ url: asset.dataUrl, type: "video" });
          } else if (asset.mimeType.startsWith("audio/")) {
            mediaItems.push({ url: asset.dataUrl, type: "audio" });
          }
        });
      } else {
        captures.forEach(c => mediaItems.push({ url: c.image, type: "image" }));
        videos.forEach(v => mediaItems.push({ url: v.url, type: "video" }));
        audios.forEach(a => mediaItems.push({ url: a.url, type: "audio" }));
      }

      if (mediaItems.length === 0) {
        throw new Error("请先提供分析素材（如图片、视频或音频）");
      }

      const scenario = getScenarioForTemplate(selectedTemplate.id);
      const initialTrace: AgentAnalysisTrace = {
        id: "qwen-" + Date.now(),
        mode: targetMode,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        startedAt: new Date().toISOString(),
        nodes: scenario.nodes.map((n) => ({ ...n, status: "waiting", summary: "" })),
      };

      updateInternalState({
        isAnalyzing: true,
        isThinking: true,
        thinkingStep: 0,
        dynamicThinkingLogs: [],
        dynamicResultText: "",
        showFinalResult: false,
        trace: initialTrace,
        hasError: false,
        errorMessage: "",
      }, targetMode);
      setIsThoughtExpanded(true);
      resetConclusionTyping(true);

      const richPrompt = buildGeminiPrompt(selectedTemplate.id);
      // 彻底移除所有可能的空格和无效字符，API Key 应当是连续的
      const rawApiKey = localStorage.getItem("qwen_api_key") || "sk-ws-H.EDYRHDL.Se7K.MEUCIQD6kcSRZe-h1F43m7lJMhaDw8LL_LGg1pxIOXQwvyLdYwIgAz6HRcYN3qHW31nwX-wUdi961QejFMdXgzaZjqbsHWs";
      const apiKey = rawApiKey.trim();

      const baseUrl = "https://ws-t4w9zybkwmpgja5b.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

      // 构造 content 数组（支持多模态及多文件并发）
      const contentPayload: any[] = [
        { type: "text", text: richPrompt || selectedTemplate.description }
      ];

      // 转换为 Base64，远程 API 无法访问本地 blob/file URL
      for (const item of mediaItems) {
        let base64Data = "";
        if (item.url.startsWith("data:")) {
          base64Data = item.url;
        } else {
          const res = await fetch(item.url);
          const blob = await res.blob();
          base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }

        if (item.type === "image") {
          contentPayload.push({ type: "image_url", image_url: { url: base64Data } });
        }
        // else if (item.type === "video") {
        //   contentPayload.push({ type: "video_url", video_url: { url: base64Data } });
        // } else if (item.type === "audio") {
        //   contentPayload.push({ type: "audio_url", audio_url: { url: base64Data } });
        // }
      }
      contentPayload.unshift({ type: "text", text: '思考输出的文字不要超过100字，思考过程控制在5秒以内。' })
      // Prepare messages
      const messages = [
        {
          role: "user",
          content: contentPayload
        }
      ];

      console.log("Qwen Requesting with Key (first 15 chars):", apiKey.substring(0, 15));

      // 根据输入素材类型决定调用的模型
      // qwen-omni-turbo: 支持文本、图片、音频和视频的全面多模态
      // qwen-vl-max-latest: 支持文本、图片、视频
      // qwen-audio-turbo: 支持文本、音频
      // qwen3.7-plus: 纯文本
      let targetModel = "qwen3.7-plus"; // 默认使用支持最全的 omni 模型

      const hasVideo = mediaItems.some(item => item.type === "video");
      const hasAudio = mediaItems.some(item => item.type === "audio");
      const hasImage = mediaItems.some(item => item.type === "image");

      // 如果有音频或者各种混合，最安全的是用 omni-turbo
      // 也可以根据具体情况细分：
      // if (hasAudio && !hasVideo && !hasImage) {
      //   targetModel = "qwen-audio-turbo"; // 纯音频可以走专门的音频模型
      // } else if (hasVideo && !hasAudio) {
      //   targetModel = "qwen-vl-max-latest"; // 视频+图片 可以走 VL 模型
      // } else if (hasImage && !hasVideo && !hasAudio) {
      //   targetModel = "qwen3.7-plus"; // 纯图片走 VL 模型
      // }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-WorkSpace": "ws-t4w9zybkwmpgja5b", // 增加 Workspace ID 显式 Header
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          stream: true,
          // reasoning_effort: "low",
          extra_body: { enable_thinking: true }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Qwen API Error Response:", errorData);
        throw new Error(errorData.error?.message || `千问 API 调用失败 (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let reasoningContent = "";

      let apiFinished = false;
      let simulationFinished = false;
      let nodesSimulationStarted = false;
      let finalTraceData: AgentAnalysisTrace | null = null;
      let finalResultData: AgentAnalysisResult | null = null;
      let apiError: any = null;

      const checkAndFinalize = () => {
        if (apiError) {
          updateInternalState({
            isAnalyzing: false,
            isThinking: false,
            hasError: true,
            errorMessage: apiError.message || "千问模型调用异常"
          }, targetMode);
          return;
        }

        if (apiFinished && simulationFinished) {
          const currentResult = finalResultData || {
            headline: "千问研判报告",
            summary: "研判完成，系统运行状态正常。",
            riskLevel: "低",
            matchedResources: [],
            recommendations: [],
          };
          updateInternalState({
            isAnalyzing: false,
            isWaitingForApi: false,
            result: currentResult,
            showFinalResult: true,
          }, targetMode);
          if (onSimulationCompleteRef.current && finalTraceData) {
            onSimulationCompleteRef.current(currentResult, finalTraceData, reasoningContent ? [reasoningContent] : undefined);
          }
        } else if (simulationFinished && !apiFinished) {
          // 模拟过程执行完毕，但接口还没响应，显示等待动画
          updateInternalState({ isWaitingForApi: true }, targetMode);
        }
      };

      const startNodesSimulation = () => {
        if (nodesSimulationStarted) return;
        nodesSimulationStarted = true;

        updateInternalState({
          isThinking: false,
        }, targetMode);
        setIsThoughtExpanded(false);

        let currentIndex = 0;
        const executeNextNode = () => {
          if (currentIndex >= scenario.nodes.length) {
            simulationFinished = true;
            finalTraceData = {
              id: initialTrace.id,
              mode: initialTrace.mode,
              templateId: initialTrace.templateId,
              templateName: initialTrace.templateName,
              startedAt: initialTrace.startedAt,
              nodes: scenario.nodes.map((n) => ({
                ...n,
                status: "completed" as const,
                summary: n.summary || "分析节点执行完成。"
              })),
            };
            checkAndFinalize();
            return;
          }

          const nodeToExecuteIndex = currentIndex;
          updateInternalState({ currentRunningNodeIndex: nodeToExecuteIndex }, targetMode);

          updateInternalTrace((prev) => {
            if (!prev) return null;
            const newNodes = [...prev.nodes];
            newNodes[nodeToExecuteIndex] = { ...newNodes[nodeToExecuteIndex], status: "running" };
            return { ...prev, nodes: newNodes };
          }, targetMode);

          const timer = setTimeout(() => {
            updateInternalTrace((prev) => {
              if (!prev) return null;
              const newNodes = [...prev.nodes];
              const nodeData = scenario.nodes[nodeToExecuteIndex];

              if (nodeData) {
                newNodes[nodeToExecuteIndex] = {
                  ...newNodes[nodeToExecuteIndex],
                  status: "completed",
                  summary: nodeData.summary || "分析节点执行完成。"
                };
              }
              return { ...prev, nodes: newNodes };
            }, targetMode);

            currentIndex++;
            const nextTimer = setTimeout(executeNextNode, 1500);
            if (targetMode === "offline") setOfflineTimer(nextTimer);
            else setRealtimeTimer(nextTimer);
          }, 2000);

          if (targetMode === "offline") setOfflineTimer(timer);
          else setRealtimeTimer(timer);
        };

        executeNextNode();
      };

      if (!reader) throw new Error("无法读取响应流");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices?.[0]?.delta;

              if (delta) {
                if (delta.reasoning_content) {
                  reasoningContent += delta.reasoning_content;
                  updateInternalState({
                    dynamicThinkingLogs: [reasoningContent]
                  }, targetMode);
                }

                if (delta.content) {
                  // 深度思考完毕，立即响应分析过程
                  startNodesSimulation();
                  fullContent += delta.content;
                }
              }
            } catch (e) {
              console.error("Error parsing Qwen stream chunk:", e);
            }
          }
        }
      }

      // Ensure nodes simulation is started just in case reasoning was empty or ended
      startNodesSimulation();

      // After stream finishes, parse fullContent for JSON
      const tryParseJson = (str: string): any => {
        const stack: number[] = [];
        for (let i = 0; i < str.length; i++) {
          if (str[i] === "{") {
            stack.push(i);
          } else if (str[i] === "}") {
            const start = stack.pop();
            if (start !== undefined) {
              const candidate = str.slice(start, i + 1);
              try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === "object" && (parsed.headline || parsed.summary)) {
                  return parsed;
                }
              } catch (e) { }
            }
          }
        }
        return null;
      };

      const parsed = tryParseJson(fullContent);
      if (parsed) {
        finalResultData = {
          headline: parsed.headline || "分析完成",
          summary: parsed.summary || "未提供详细摘要",
          riskLevel: parsed.riskLevel || "低",
          matchedResources: parsed.matchedResources || [],
          recommendations: parsed.recommendations || [],
        };
      } else {
        // Fallback to plain text
        finalResultData = {
          headline: "千问研判报告",
          summary: fullContent,
          riskLevel: "低",
          matchedResources: [],
          recommendations: [],
        };
      }

      apiFinished = true;
      checkAndFinalize();

    } catch (error: any) {
      console.error("Qwen API Error:", error);
      updateInternalState({
        isAnalyzing: false,
        isThinking: false,
        hasError: true,
        errorMessage: error.message || "千问模型调用异常"
      }, targetMode);
    }
  };

  // 模拟分析逻辑
  const startSimulation = (isManual: boolean = false) => {
    const targetMode = activeTab;

    if (aiMode === "qwen") {
      callQwenAiApi(targetMode);
      return;
    }

    if (aiMode === "local") {
      callLocalAiApi(targetMode);
      return;
    }

    if (aiMode === "gemini") {
      callGeminiAiApi(targetMode);
      return;
    }

    const scenario = getScenarioForTemplate(selectedTemplate.id);

    // 1. 初始化状态：启动分析、直接开启深度思考、此时还没有节点开始运行
    updateInternalState({
      isAnalyzing: true,
      result: null,
      showFinalResult: false,
      currentRunningNodeIndex: -1,
      isThinking: true,
      thinkingStep: 0,
    }, targetMode);
    setIsThoughtExpanded(true);
    resetConclusionTyping(true);

    // 初始化 trace
    const initialTrace: AgentAnalysisTrace = {
      id: "sim-" + Date.now(),
      mode: targetMode,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      startedAt: new Date().toISOString(),
      nodes: scenario.nodes.map((n) => ({ ...n, status: "waiting", summary: "" })),
    };
    updateInternalTrace(initialTrace, targetMode);

    // 逐步执行节点
    let currentIndex = 0;
    const executeNextNode = () => {
      if (currentIndex >= scenario.nodes.length) {
        // 节点全部执行结束，隐藏思考中状态，展示最终结果
        updateInternalState({
          isAnalyzing: false,
          result: scenario.result,
          showFinalResult: true,
        }, targetMode);

        if (onSimulationCompleteRef.current && scenario.result) {
          const finalTrace: AgentAnalysisTrace = {
            id: initialTrace.id,
            mode: initialTrace.mode,
            templateId: initialTrace.templateId,
            templateName: initialTrace.templateName,
            startedAt: initialTrace.startedAt,
            nodes: scenario.nodes.map(n => ({ ...n, status: "completed" as const })),
          };
          onSimulationCompleteRef.current(scenario.result, finalTrace);
        }
        return;
      }

      const nodeToExecuteIndex = currentIndex;
      updateInternalState({ currentRunningNodeIndex: nodeToExecuteIndex }, targetMode);

      updateInternalTrace((prev) => {
        if (!prev) return null;
        const newNodes = [...prev.nodes];
        newNodes[nodeToExecuteIndex] = { ...newNodes[nodeToExecuteIndex], status: "running" };
        return { ...prev, nodes: newNodes };
      }, targetMode);

      const timer = setTimeout(() => {
        updateInternalTrace((prev) => {
          if (!prev) return null;
          const newNodes = [...prev.nodes];
          const nodeData = scenario.nodes[nodeToExecuteIndex];
          if (nodeData) {
            newNodes[nodeToExecuteIndex] = {
              ...newNodes[nodeToExecuteIndex],
              status: "completed",
              summary: nodeData.summary
            };
          }
          return { ...prev, nodes: newNodes };
        }, targetMode);

        currentIndex++;
        const nextTimer = setTimeout(executeNextNode, 1500);
        if (targetMode === "offline") setOfflineTimer(nextTimer);
        else setRealtimeTimer(nextTimer);
      }, 2500);
      if (targetMode === "offline") setOfflineTimer(timer);
      else setRealtimeTimer(timer);
    };

    // 2. 深度思考 4 秒的计时器，在最开始触发
    let currentStep = 0;
    const thinkingInterval = setInterval(() => {
      currentStep++;
      if (currentStep <= 4) {
        updateInternalState({ thinkingStep: currentStep }, targetMode);
      } else {
        clearInterval(thinkingInterval);

        // 思考完成，重置 isThinking 为 false 或者是仍然保留为已完成状态让用户查看
        updateInternalState({
          isThinking: false,
        }, targetMode);

        // 深度思考完成，自动折叠
        setIsThoughtExpanded(false);

        // 深度思考完成，现在开始输出节点分析过程
        executeNextNode();
      }
    }, 1000);

    if (targetMode === "offline") setOfflineTimer(thinkingInterval as any);
    else setRealtimeTimer(thinkingInterval as any);
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (offlineTimer) clearTimeout(offlineTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
    };
  }, [offlineTimer, realtimeTimer]);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-lg agent-panel-${activeTab}`}
    >
      {/* 头部总览区域 */}
      <div className="relative border-b border-slate-800/60 p-4">
        {/* 历史记录按钮 */}
        <div className="absolute right-4 top-4" ref={historyRef}>
          <button
            type="button"
            disabled={!!activeRecordingTask || internalIsAnalyzing || externalIsAnalyzing}
            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${!!activeRecordingTask || internalIsAnalyzing || externalIsAnalyzing
              ? "cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600 opacity-50"
              : `cursor-pointer active:scale-90 ${showHistoryDropdown
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-700 hover:text-slate-200"
              }`
              }`}
            title={!!activeRecordingTask || internalIsAnalyzing || externalIsAnalyzing ? "分析进行中，无法查看历史" : "查看分析历史记录"}
          >
            <History className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-300">
              <Bot className="h-3.5 w-3.5" />
              AI 智能分析中枢
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-100">{selectedTemplate.name}</h3>
          </div>
          <div className="flex flex-col items-end gap-2 pt-10">
            {/* 自动分析倒计时展示 */}
            {activeRecordingTask && countdown !== null && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-md ${countdown === -1
                ? "border-amber-900/30 bg-amber-950/20 text-amber-400"
                : "border-blue-900/30 bg-blue-950/20 text-blue-400"
                }`}>
                <div className="flex flex-col items-end">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${countdown === -1 ? "text-amber-400/70" : "text-blue-400/70"}`}>
                    {countdown === -1 ? "Task Status" : "Next Trigger In"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Zap className={`h-3 w-3 ${countdown === -1 ? "fill-amber-500 text-amber-500 animate-pulse" : "fill-blue-500 text-blue-500 animate-pulse"}`} />
                    <span className="font-mono text-sm font-black tabular-nums">
                      {countdown === -1 ? "不在生效时段" : formatCountdown(countdown)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {canRun && (
              <>
                {!isAnalyzing && (!result && !dynamicResultText || hasError) && !activeRecordingTask && (
                  <button
                    type="button"
                    disabled={!canRun}
                    onClick={() => {
                      if (onStartAnalysis) {
                        onStartAnalysis();
                      } else {
                        startSimulation(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 shrink-0 ${canRun
                      ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                      : "bg-slate-700/50 text-white/30 cursor-not-allowed border border-slate-700"
                      }`}
                  >
                    <Zap className={`h-4 w-4 ${canRun ? "fill-current" : ""}`} />
                    {hasError ? "重新启动分析" : "启动分析"}
                  </button>
                )}
                {!isAnalyzing && (result || dynamicResultText) && !hasError && !activeRecordingTask && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canRun}
                      onClick={() => {
                        if (onStartAnalysis) {
                          onStartAnalysis();
                        } else {
                          startSimulation(true);
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 shrink-0 ${canRun
                        ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 cursor-pointer"
                        : "bg-slate-700/50 text-white/30 cursor-not-allowed border border-slate-700"
                        }`}
                      title="直接再次触发分析"
                    >
                      <Zap className={`h-4 w-4 ${canRun ? "fill-current" : ""}`} />
                      重新分析
                    </button>
                    <button
                      id="btn-reset-form"
                      type="button"
                      onClick={() => {
                        stopSimulation();
                        if (onReset) {
                          onReset();
                        } else {
                          onStopRecordingTask();
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-red-950/50 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/60 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
                      title="清空并重置所有操作区域"
                    >
                      <RotateCcw className="h-4 w-4" />
                      重置区域
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 分析过程区域 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 scrollbar-hide relative flex flex-col"
      >
        {/* 文件图标移动动画叠加层 */}
        <AnimatePresence>
          {flyingAsset && (
            <motion.div
              initial={{
                position: "fixed",
                top: flyingAsset.rect.top + flyingAsset.rect.height / 2 - 20,
                left: flyingAsset.rect.left + flyingAsset.rect.width / 2 - 20,
                scale: 0.5,
                opacity: 0,
                zIndex: 1000,
              }}
              animate={{
                top: (nextSlotRef.current?.getBoundingClientRect().top || assetsContainerRef.current?.getBoundingClientRect().top || 0) + 20,
                left: (nextSlotRef.current?.getBoundingClientRect().left || assetsContainerRef.current?.getBoundingClientRect().left || 0) + 44,
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.5,
                opacity: 0,
                transition: { duration: 0.2 }
              }}
              transition={{
                type: "spring",
                damping: 20,
                stiffness: 150,
                duration: 0.6 // 控制在 0.5-0.8s 区间
              }}
              onAnimationComplete={() => {
                const lastCap = captures[captures.length - 1];
                const lastVid = videos[videos.length - 1];
                const lastAud = audios[audios.length - 1];

                setCompletedAnimationIds(prev => {
                  const next = new Set(prev);
                  if (flyingAsset.type === "image" && lastCap) next.add(lastCap.id);
                  if (flyingAsset.type === "video" && lastVid) next.add(lastVid.id);
                  if (flyingAsset.type === "audio" && lastAud) next.add(lastAud.id);
                  return next;
                });
                setFlyingAsset(null);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-md border ${flyingAsset.type === "image"
                ? "bg-blue-600/90 border-blue-400 text-white"
                : flyingAsset.type === "video"
                  ? "bg-purple-600/90 border-purple-400 text-white"
                  : "bg-cyan-600/90 border-cyan-400 text-white"
                }`}
            >
              {flyingAsset.type === "image" && <Camera className="h-5 w-5" />}
              {flyingAsset.type === "video" && <Film className="h-5 w-5" />}
              {flyingAsset.type === "audio" && <Mic className="h-5 w-5" />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 展示素材缩略图 - 仅在实时分析模式下显示 */}
        {activeTab === "realtime" && (
          <div ref={assetsContainerRef} className={`flex flex-wrap gap-3 ${hasManualAssets ? 'mb-4' : ''}`}>
            {/* 图片缩略图 - 仅在动画完成后显示 */}
            {captures.map((cap) => (
              completedAnimationIds.has(cap.id) && (
                <motion.div
                  key={cap.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-block"
                >
                  <div
                    className="relative h-20 w-32 cursor-zoom-in overflow-hidden rounded-lg border border-slate-800 group shadow-lg"
                    onClick={() => setShowFullscreen({ image: cap.image })}
                  >
                    <img src={cap.image} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" alt="Captured Snapshot" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="h-4 w-4 text-white" />
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCapture?.(cap.id);
                      }}
                      className="absolute right-1 top-1 z-10 rounded bg-slate-900/60 p-1 text-slate-400 opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:text-white group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    <div className="absolute right-1.5 bottom-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                    </div>
                    <div className="absolute left-1.5 bottom-1.5 rounded bg-black/60 px-1 py-0.5 backdrop-blur-sm">
                      <Camera className="h-2.5 w-2.5 text-blue-400" />
                    </div>
                  </div>
                </motion.div>
              )
            ))}

            {/* 视频缩略图 - 动画完成后显示 */}
            {videos.map((vid) => (
              completedAnimationIds.has(vid.id) && (
                <motion.div
                  key={vid.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-block"
                >
                  <div
                    className="relative h-20 w-32 cursor-pointer overflow-hidden rounded-lg border border-slate-800 group shadow-lg bg-slate-900"
                    onClick={() => setShowVideoModal({ url: vid.url })}
                  >
                    {/* 使用第一张截图作为视频预览图，如果没有则使用视频图标 */}
                    {captures.length > 0 ? (
                      <img src={captures[0].image} className="h-full w-full object-cover opacity-60" alt="Video Thumbnail" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-950">
                        <Film className="h-6 w-6 text-slate-700" />
                      </div>
                    )}

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveVideo?.(vid.id);
                      }}
                      className="absolute right-1 top-1 z-10 rounded bg-slate-900/60 p-1 text-slate-400 opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:text-white group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/80 text-white shadow-lg transition-transform group-hover:scale-110">
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute left-1.5 bottom-1.5 rounded bg-black/60 px-1 py-0.5 backdrop-blur-sm">
                      <Film className="h-2.5 w-2.5 text-purple-400" />
                    </div>
                  </div>
                </motion.div>
              )
            ))}

            {/* 音频缩略图 - 动画完成后显示 */}
            {audios.map((aud) => (
              completedAnimationIds.has(aud.id) && (
                <motion.div
                  key={aud.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-block"
                >
                  <div
                    className="relative h-20 w-32 cursor-pointer overflow-hidden rounded-lg border border-slate-800 group shadow-lg bg-slate-900"
                    onClick={() => setShowAudioModal({ url: aud.url })}
                  >
                    <div className="flex h-full w-full items-center justify-center bg-slate-950">
                      <div className="relative">
                        <Music className="h-6 w-6 text-cyan-500/50" />
                        <div className="absolute -inset-1 rounded-full border border-cyan-500/20 animate-ping" />
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAudio?.(aud.id);
                      }}
                      className="absolute right-1 top-1 z-10 rounded bg-slate-900/60 p-1 text-slate-400 opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:text-white group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600/80 text-white shadow-lg transition-transform group-hover:scale-110">
                        <Mic className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="absolute left-1.5 bottom-1.5 rounded bg-black/60 px-1 py-0.5 backdrop-blur-sm">
                      <Mic className="h-2.5 w-2.5 text-cyan-400" />
                    </div>
                  </div>
                </motion.div>
              )
            ))}

            {/* 动态占位符：用于计算下一个素材的飞入位置。有飞入动画时撑开空间，平时宽高为0不占空间，保持在文档流中以确保下一次飞入定位极其精准 */}
            <div
              ref={nextSlotRef}
              className={`opacity-0 pointer-events-none ${flyingAsset ? "h-20 w-32" : "h-0 w-0 overflow-hidden"}`}
              aria-hidden="true"
            />
          </div>
        )}

        {/* 全屏大图预览 */}
        <AnimatePresence>
          {showFullscreen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFullscreen(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
              >
                <img src={showFullscreen.image} className="h-auto w-auto max-h-[85vh] object-contain" alt="Fullscreen Analysis" />
                <div className="absolute right-4 top-4">
                  <button
                    onClick={() => setShowFullscreen(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 视频回放弹窗 */}
        <AnimatePresence>
          {showVideoModal && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowVideoModal(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
              >
                <video
                  src={showVideoModal.url}
                  controls
                  autoPlay
                  className="h-auto w-auto max-h-[85vh] object-contain"
                />
                <div className="absolute right-4 top-4">
                  <button
                    onClick={() => setShowVideoModal(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 音频播放弹窗 */}
        <AnimatePresence>
          {showAudioModal && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAudioModal(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-8 shadow-2xl"
              >
                <div className="mb-6 flex flex-col items-center gap-4 text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/10">
                    <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
                    <Mic className="h-10 w-10 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">音频素材播放</h3>
                    <p className="text-xs text-slate-500 mt-1">已捕获的现场实时音频流</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800">
                  <audio
                    src={showAudioModal.url}
                    controls
                    autoPlay
                    className="w-full"
                  />
                </div>

                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setShowAudioModal(null)}
                    className="rounded-full bg-slate-800 px-6 py-2 text-sm font-bold text-slate-100 hover:bg-slate-700 transition-colors"
                  >
                    关闭预览
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 加载与捕获状态提示 */}
        {(isAnalyzing || isCapturing) && !trace && (
          <div className="flex min-h-[200px] flex-col items-center justify-center space-y-4 rounded-2xl border border-blue-900/20 bg-blue-950/5 p-8 shadow-inner">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-blue-500/20" />
              <div className="absolute top-0 h-12 w-12 animate-spin rounded-full border-2 border-t-blue-500" />
              <Cpu className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-100">
                {isCapturing ? "正在采集素材" : "正在初始化 Agent 节点"}
              </div>
              <div className="mt-1 text-[10px] text-slate-500 max-w-[200px] mx-auto">
                {isCapturing ? "系统正在截取实时画面并录制音频/视频..." : "正在分配算力资源并加载知识库..."}
              </div>
            </div>
          </div>
        )}

        {/* 错误状态提示与重试/重置按钮 (无 trace 时显示) */}
        {hasError && !trace && (
          <div className="flex min-h-[200px] flex-col items-center justify-center space-y-4 rounded-2xl border border-red-900/20 bg-red-950/5 p-8 shadow-inner animate-in fade-in duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-red-400">分析执行失败</div>
              <div className="mt-1 text-[10px] text-slate-500 max-w-[280px] mx-auto whitespace-pre-wrap break-all font-mono">
                {errorMessage}
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                disabled={!canRun}
                onClick={() => {
                  if (onStartAnalysis) {
                    onStartAnalysis();
                  } else {
                    startSimulation(true);
                  }
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 shrink-0 ${canRun
                  ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 cursor-pointer"
                  : "bg-slate-700/50 text-white/30 cursor-not-allowed border border-slate-700"
                  }`}
              >
                <Zap className={`h-4 w-4 ${canRun ? "fill-current" : ""}`} />
                重新分析
              </button>
              <button
                type="button"
                onClick={() => {
                  stopSimulation();
                  if (onReset) {
                    onReset();
                  } else {
                    onStopRecordingTask();
                  }
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-red-950/50 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/60 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                重置区域
              </button>
            </div>
          </div>
        )}

        {!trace && !isAnalyzing && !isCapturing && !hasError && (
          <div className="flex flex-1 min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-950/50 text-blue-400">
              <PlaySquare className="h-7 w-7" />
            </div>
            <div className="text-sm font-semibold text-slate-100">等待启动 AI 分析</div>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
              {canRun
                ? "当前输入条件已满足，点击右上方按钮开始执行多节点思维链分析。"
                : "请先准备离线素材，或完成实时监控连接后再启动分析。"}
            </p>
          </div>
        )}

        {trace && (
          <div className={`space-y-4 pb-4 agent-analysis-results-${activeTab}`}>
            {/* 深度思考过程 */}
            {(isThinking || thinkingStep > 0 || dynamicThinkingLogs.length > 0) && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-md">
                <button
                  type="button"
                  onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/30 hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {isThinking ? (
                        <>
                          <div className="absolute -inset-1 rounded-full bg-blue-500/20 animate-ping" />
                          <Brain className="h-4 w-4 text-blue-400 animate-pulse" />
                        </>
                      ) : (
                        <Brain className="h-4 w-4 text-blue-500/80" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-200">
                      {isThinking ? "深度思考中..." : "已完成深度思考"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isThinking && (
                      <span className="text-[10px] text-blue-400 animate-pulse font-mono">
                        THINKING...
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isThoughtExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isThoughtExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-slate-800/40 text-[11px] leading-relaxed font-mono">
                        {(() => {
                          const matchedItem = history.find(h => h.id === trace?.id);
                          const logs = dynamicThinkingLogs.length > 0 ? dynamicThinkingLogs : ((matchedItem && matchedItem.thinkingLogs) || getThinkingLogsForTemplate(selectedTemplate.id));

                          // 过滤/清洗无用或未渲染的各种标签，让排版清爽
                          const cleanText = (text: string) => {
                            if (!text) return "";
                            return text
                              .replace(/<\/?think>/gi, "") // 过滤 <think> 和 </think>
                              .replace(/```[a-zA-Z]*/g, "") // 过滤 markdown 代码块标签 ```javascript 等
                              .replace(/```/g, "") // 过滤 ```
                              .replace(/【深度思考】/g, "")
                              .trim();
                          };

                          // 判断是否为流式深度思考大文本（长文本或者是单一的 reasoning_content）
                          const isLongReasoning = logs.length === 1 && logs[0].length > 120;

                          if (isLongReasoning) {
                            const cleanedContent = cleanText(logs[0]);
                            if (!cleanedContent) return null;

                            return (
                              <div className="relative mt-2">
                                <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded bg-blue-500/30" />
                                <div
                                  ref={thinkingScrollRef}
                                  className="pl-3.5 py-1 text-blue-400 text-xs font-sans tracking-wide leading-relaxed whitespace-pre-wrap max-h-[100px] overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800"
                                >
                                  {cleanedContent}
                                </div>
                                {isThinking && (
                                  <div className="mt-2.5 pl-3.5 flex items-center gap-2 text-[10.5px] text-blue-300/90 font-sans tracking-wide">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                    </span>
                                    <span>AI 正在进一步推演并生成研判思路...</span>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // 否则，按原样或微调后的样式输出多条短 Logs
                          return (
                            <div
                              ref={thinkingScrollRef}
                              className="space-y-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800"
                            >
                              {logs.map((log, logIdx) => {
                                const isPast = showFinalResult || (!isThinking && thinkingStep > 0) || (dynamicThinkingLogs.length === 0 && thinkingStep > logIdx) || (dynamicThinkingLogs.length > 0 && logIdx < dynamicThinkingLogs.length - 1);
                                const isCurrent = isThinking && ((dynamicThinkingLogs.length === 0 && thinkingStep === logIdx) || (dynamicThinkingLogs.length > 0 && logIdx === dynamicThinkingLogs.length - 1));
                                if (!isPast && !isCurrent) return null;

                                return (
                                  <motion.div
                                    key={logIdx}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="mt-1 shrink-0 font-bold">
                                      {isPast ? (
                                        <span className="text-emerald-500 font-mono">✓</span>
                                      ) : (
                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                                      )}
                                    </span>
                                    <span className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-blue-400 ${isCurrent ? "font-semibold animate-pulse" : "opacity-90"}`}>
                                      {cleanText(log)}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {trace.nodes
              .filter(node => node.status !== "waiting")
              .map((node, index, filteredNodes) => (
                <div key={node.id} className="relative flex gap-4">
                  {index < filteredNodes.length - 1 && (
                    <div className={`absolute left-[15px] top-8 bottom-[-16px] w-[2px] ${node.status === "completed" ? "bg-blue-600/50" : "bg-slate-800"
                      }`} />
                  )}
                  <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-500 ${node.status === "completed"
                    ? "border-blue-500 bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                    : node.status === "running"
                      ? "border-amber-500 bg-amber-950/50 text-amber-400 animate-pulse"
                      : "border-slate-800 bg-slate-900 text-slate-500"
                    }`}>
                    {node.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className={`flex-1 rounded-2xl border p-4 transition-all duration-500 ${node.status === "running"
                    ? "border-amber-500/50 bg-amber-950/10 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                    : node.status === "completed"
                      ? "border-slate-800 bg-slate-900/40"
                      : "border-slate-800/30 bg-transparent opacity-50"
                    }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {statusIconMap[node.status]}
                        <span className="text-xs font-bold text-slate-100">{node.nodeName}</span>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${resourceColorMap[node.resourceType]}`}
                      >
                        {node.resourceType} · {node.resourceName}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-blue-400/80">
                      <Search className="h-3 w-3" />
                      角色：{node.role}
                    </div>
                    <div className="mt-2.5 text-xs leading-relaxed text-slate-400">
                      {node.status === "running" ? (
                        <div className="flex items-center gap-1">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-amber-400" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-amber-400 [animation-delay:0.2s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-amber-400 [animation-delay:0.4s]" />
                          <span className="ml-1 italic text-amber-400/70">正在调取知识库并生成分析摘要...</span>
                        </div>
                      ) : node.status === "completed" ? (
                        <TypewriterText text={node.summary} speed={15} skip={isHistoryRestored} />
                      ) : (
                        <span className="italic text-slate-600">等待节点激活...</span>
                      )}
                    </div>

                    {/* Evidence Display Area (Removed image as requested to show only text) */}
                  </div>
                </div>
              ))}

            {/* 最终结果输出 - 回到滚动区域作为整体展示 */}
            {internalIsWaitingForApi && (
              <div className="mt-4 flex flex-col items-center justify-center p-8 rounded-2xl border border-blue-500/20 bg-blue-950/5 animate-pulse">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
                  </div>
                </div>
                <p className="mt-4 text-xs font-bold text-blue-400 tracking-widest uppercase">
                  正在同步远程模型深度研判结论...
                </p>
                <div className="mt-2 flex gap-1">
                  <span className="h-1 w-1 rounded-full bg-blue-500 animate-bounce [animation-delay:0s]" />
                  <span className="h-1 w-1 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1 w-1 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {showFinalResult && (result || dynamicResultText) && (
              <div ref={conclusionRef} className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-950/20 p-5 shadow-[0_0_20px_rgba(37,99,235,0.1)]">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <Lightbulb className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">分析结论</h4>
                    </div>
                    {(result?.riskLevel || dynamicResultText) && (
                      <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${result?.riskLevel === "高" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        result?.riskLevel === "中" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                          "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        风险等级：{result?.riskLevel || "自动分析"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {dynamicResultText ? (
                      <div className="prose prose-invert max-w-none">
                        <div className="text-xs leading-relaxed text-slate-200 font-sans">
                          <TypewriterText text={dynamicResultText} speed={10} skip={isHistoryRestored} />
                        </div>
                      </div>
                    ) : result ? (
                      <>
                        {/* 1. 检测摘要 Headline */}
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-blue-400">检测摘要</div>
                          <p className="mt-1.5 text-sm font-bold leading-relaxed text-slate-100">
                            {actualShouldTypeResult ? (
                              <TypewriterText
                                text={result.headline}
                                speed={30}
                                onComplete={() => {
                                  if (conclusionPhase === 0) setConclusionPhase(1);
                                }}
                              />
                            ) : (
                              <span>{result.headline}</span>
                            )}
                          </p>

                          {/* 2. 检测摘要 Summary (Phase 1+) */}
                          {(!actualShouldTypeResult || conclusionPhase >= 1) && (
                            <p className="mt-2 text-xs leading-relaxed text-slate-400">
                              {actualShouldTypeResult ? (
                                <TypewriterText
                                  text={result.summary}
                                  speed={15}
                                  onComplete={() => {
                                    if (conclusionPhase === 1) setConclusionPhase(2);
                                  }}
                                />
                              ) : (
                                <span>{result.summary}</span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Interactive Mapping Badge */}
                        <div className="mt-4 flex items-center justify-start border-t border-slate-800/60 pt-4">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 text-[10px] font-semibold text-blue-400 cursor-pointer active:scale-95 transition-all shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                          >
                            <Network className="h-3 w-3 animate-pulse text-blue-400" />
                            <span>知识图谱关联</span>
                          </button>
                        </div>

                        {/* 3. 匹配资源与处置建议 (Phase 2+) */}
                        {(!actualShouldTypeResult || conclusionPhase >= 2) && (
                          <div className="grid grid-cols-2 gap-4 border-t border-slate-850 pt-4 mt-4 animate-in fade-in duration-500">
                            {/* 匹配资源 */}
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">匹配资源</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {result.matchedResources.map((res, i) => {
                                  if (actualShouldTypeResult && i > typedResourcesCount) return null;
                                  if (actualShouldTypeResult && i === typedResourcesCount) {
                                    return (
                                      <span key={i} className="rounded bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-700">
                                        <TypewriterText
                                          text={res}
                                          speed={40}
                                          onComplete={() => {
                                            setTypedResourcesCount(prev => prev + 1);
                                          }}
                                        />
                                      </span>
                                    );
                                  }
                                  return (
                                    <span key={i} className="rounded bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-700">
                                      {res}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 处置建议 (Phase 3+) */}
                            {(!actualShouldTypeResult || conclusionPhase >= 3) && (
                              <div className="animate-in fade-in duration-500">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">处置建议</div>
                                <ul className="mt-2 space-y-1">
                                  {result.recommendations.map((rec, i) => {
                                    if (actualShouldTypeResult && i > typedRecsCount) return null;
                                    if (actualShouldTypeResult && i === typedRecsCount) {
                                      return (
                                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                                          <TypewriterText
                                            text={rec}
                                            speed={25}
                                            onComplete={() => {
                                              setTypedRecsCount(prev => prev + 1);
                                              if (i === result.recommendations.length - 1) {
                                                setConclusionPhase(4);
                                              }
                                            }}
                                          />
                                        </li>
                                      );
                                    }
                                    return (
                                      <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                                        {rec}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* 错误状态提示与重试/重置按钮 (有 trace 时显示在底部的结论区之前) */}
            {hasError && (
              <div className="mt-4 flex flex-col items-center justify-center space-y-4 rounded-2xl border border-red-900/20 bg-red-950/5 p-8 shadow-inner animate-in fade-in duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-red-400">分析执行失败</div>
                  <div className="mt-1 text-[10px] text-slate-500 max-w-[280px] mx-auto whitespace-pre-wrap break-all font-mono">
                    {errorMessage}
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    disabled={!canRun}
                    onClick={() => {
                      if (onStartAnalysis) {
                        onStartAnalysis();
                      } else {
                        startSimulation(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 shrink-0 ${canRun
                      ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 cursor-pointer"
                      : "bg-slate-700/50 text-white/30 cursor-not-allowed border border-slate-700"
                      }`}
                  >
                    <Zap className={`h-4 w-4 ${canRun ? "fill-current" : ""}`} />
                    重新分析
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopSimulation();
                      if (onReset) {
                        onReset();
                      } else {
                        onStopRecordingTask();
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-red-950/50 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/60 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重置区域
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右侧抽屉式历史记录面板 */}
      <AnimatePresence>
        {showHistoryDropdown && (
          <>
            {/* 全屏背景虚化遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowHistoryDropdown(false)}
              className="fixed inset-0 z-[150] bg-slate-950/60 backdrop-blur-md"
            />

            {/* 右侧抽屉内容 */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[160] w-full max-w-[380px] bg-[#0b0f19] border-l border-slate-800 shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-800/85 px-4 py-4 bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-100">分析历史归档</h4>
                    <p className="text-[10px] text-slate-500 font-medium">查看并恢复历史多模态研判状态</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-950/40 border border-blue-900/30 px-2 py-0.5 text-[9px] font-bold text-blue-400">
                    {history.length} 条记录
                  </span>
                  {/* <button
                    type="button"
                    disabled={history.length === 0}
                    onClick={handleDownloadHistory}
                    title={history.length === 0 ? "暂无历史可下载" : "下载历史记录（JSON）"}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 active:scale-95 transition-all ${history.length === 0
                      ? "cursor-not-allowed opacity-40"
                      : "hover:text-slate-100 hover:bg-slate-850"
                      }`}
                  >
                    <Download className="h-4 w-4" />
                  </button> */}
                  <button
                    type="button"
                    onClick={() => setShowHistoryDropdown(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-100 hover:bg-slate-850 active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Drawer List Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/50 border border-slate-800/80 text-slate-500">
                      <History className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">暂无历史分析数据</p>
                      <p className="text-[10px] text-slate-500 mt-1">启动智能分析后，系统会自动保存成果</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {history.map((item, idx) => (
                      <motion.button
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        key={item.id}
                        onClick={() => {
                          setIsRestoring(true);
                          setRestoredTraceId(item.trace?.id || item.id);
                          onRestoreHistory?.(item);
                          setShowHistoryDropdown(false);
                          setTimeout(() => setIsRestoring(false), 300);
                        }}
                        className="group w-full rounded-xl border border-slate-800/85 bg-slate-900/30 p-3.5 text-left transition-all hover:border-blue-500/30 hover:bg-slate-900/70 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-200 truncate">{item.templateName}</span>
                              {item.mode === "realtime" ? (
                                <span className="rounded bg-blue-950/50 px-1.5 py-0.5 text-[8px] font-black text-blue-400 border border-blue-900/30">实时</span>
                              ) : (
                                <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 text-[8px] font-black text-emerald-400 border border-emerald-900/30">离线</span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-3 text-[9px] text-slate-500 font-mono">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(item.timestamp).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800/30 text-slate-500 transition-colors group-hover:bg-blue-600/10 group-hover:text-blue-400 border border-slate-800/40">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>

                        {/* Visual Previews and Summary headline */}
                        <div className="mt-3 bg-slate-950/40 border border-slate-800/30 rounded-lg p-2.5 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-500 shrink-0 uppercase tracking-wider">采集素材</span>
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {[
                                ...(item.captures || []).map(c => ({ type: "image" as const, id: c.id, url: c.image })),
                                ...(item.videos || []).map(v => ({ type: "video" as const, id: v.id, url: v.url })),
                                ...(item.audios || []).map(a => ({ type: "audio" as const, id: a.id, url: a.url }))
                              ].slice(0, 4).map((media) => (
                                <div key={media.id} className="h-5 w-8 overflow-hidden rounded-[3px] border border-slate-950 ring-1 ring-slate-800/80 shrink-0 shadow bg-slate-900 flex items-center justify-center">
                                  {media.type === "image" ? (
                                    <img src={media.url} className="h-full w-full object-cover" alt="" />
                                  ) : media.type === "video" ? (
                                    <div className="flex items-center justify-center h-full w-full bg-indigo-950 text-indigo-400">
                                      <Film className="h-2.5 w-2.5 shrink-0" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-full w-full bg-pink-950 text-pink-400">
                                      <Music className="h-2.5 w-2.5 shrink-0" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {(!item.captures || item.captures.length === 0) && (!item.videos || item.videos.length === 0) && (!item.audios || item.audios.length === 0) && (
                                <span className="text-[9px] text-slate-600 italic">无素材</span>
                              )}
                              {((item.captures?.length || 0) + (item.videos?.length || 0) + (item.audios?.length || 0)) > 4 && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[8px] font-bold text-slate-400 ring-1 ring-slate-850 shrink-0">
                                  +{((item.captures?.length || 0) + (item.videos?.length || 0) + (item.audios?.length || 0)) - 4}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="border-t border-slate-800/40 my-0.5"></div>
                          <div className="flex items-start gap-1">
                            <span className="text-[9px] font-bold text-slate-500 shrink-0 uppercase tracking-wider mt-0.5">分析结论</span>
                            <span className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed flex-1 pl-1">
                              {item.result?.headline || "未生成结论"}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-slate-800/80 bg-slate-950/30 px-4 py-3 shrink-0 flex items-center justify-between">
                <span className="text-[9px] text-slate-600">
                  数据将持久化保存于本地浏览器缓存
                </span>
                <span className="text-[9px] text-slate-500 font-medium">
                  最多保留 10 条
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});
