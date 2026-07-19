import React from "react";
import { 
  ShieldAlert, 
  UserCheck, 
  Activity, 
  Wrench, 
  Volume2, 
  Camera, 
  Mic,
  Sliders
} from "lucide-react";
import { Scenario } from "../types";

// Factory production safety focus scenarios
export const SCENARIOS: Scenario[] = [
  {
    id: "factory-hazard",
    name: "通道遮挡与环境隐患排查",
    description: "智能研判安全通道（黄线内/绿色通道）是否畅通，是否存在废料堆积、油污油水泄漏、线缆杂乱等绊倒/滑倒安全隐患。",
    icon: "ShieldAlert",
    placeholder: "第一步：请点击或拖拽上传车间通道、加工区或仓储区现场实拍图像...",
    type: "image",
    defaultPrompt: "请仔细检查此工厂车间图像，判断安全通道（黄线内或划定区域）是否畅通无阻，是否有任何可能导致绊倒、滑倒的杂物堆放、工具乱丢、积水、液体/油污泄露等安全隐患，并输出具体隐患项、隐患位置、推荐整改意见与安全等级评定。"
  },
  {
    id: "factory-ppe",
    name: "个人防护装备 (PPE) 穿戴合规检测",
    description: "检测现场人员是否合规佩戴安全帽、防静电工作服、防尘口罩、护目镜或绝缘防护手套。",
    icon: "UserCheck",
    placeholder: "第一步：请点击或拖拽上传包含车间现场作业人员的清晰图像...",
    type: "image",
    defaultPrompt: "请分析图像中的车间作业人员，判断其是否规范佩戴了安全帽、工作服、口罩、绝缘手套或防护镜等必需的个人防护装备（PPE），指出未合规佩戴人员的具体位置，并在结果中明确指出缺失装备，给出警示与安全操作规范整改建议。"
  },
  {
    id: "factory-gauge",
    name: "仪器仪表读数与状态灯警报研判",
    description: "读取机床仪表盘指针位置、数显屏幕读数、或者红绿黄状态灯，智能判断是否超载、超压或存在红灯报警运行故障。",
    icon: "Activity",
    placeholder: "第一步：请点击或拖拽上传压力/温度仪表、机床控制板、配电箱或报警指示灯图像...",
    type: "image",
    defaultPrompt: "请仔细研判图像中的工业设备、仪器仪表或控制面板，识别并读取关键的压力/温度指针数值、数显液晶读数、或红绿黄状态指示灯，研判是否有超温、超压、报警红灯闪烁等设备运行异常，并指出安全操作和断电建议。"
  },
  {
    id: "factory-audio-anomaly",
    name: "机械异常噪音与设备运转诊断",
    description: "对电机、泵体、加工主轴或传送带的运转声音进行声学诊断，智能检测是否存在轴承磨损、齿轮撞击或异常松动鸣响。",
    icon: "Wrench",
    placeholder: "第一步：请录制或上传机械运转时的现场音频文件（MP3/WAV）...",
    type: "audio",
    defaultPrompt: "请对这段机械运转音频进行声谱声学特征分析，检查是否存在高频尖锐摩擦、沉闷撞击声、异常颤音、或转速不稳杂音等疑似机械故障，并给出可能的设备故障部位（如轴承、齿轮、电机）与紧迫整改建议。"
  },
  {
    id: "factory-audio-alarm",
    name: "车间突发警报声与气体泄露侦测",
    description: "监测整体环境背景分贝，智能识别并过滤车间内的消防啸叫、气体泄漏嗤嗤声、行车倒车警报音或异常冲击破裂声。",
    icon: "Volume2",
    placeholder: "第一步：请录制或上传车间背景音或警报突发时的现场音频文件...",
    type: "audio",
    defaultPrompt: "请诊断此车间背景音频，判断环境噪音声级是否超出职业安全标准，并识别音频中是否含有突发的消防警笛、气体泄露啸叫、行车过载蜂鸣或突发撞击爆裂等异响警报，输出环境安全性评估与应急处置指引。"
  }
];

interface ScenarioSelectorProps {
  scenarios?: Scenario[];
  selectedScenarioId: string;
  onSelectScenario: (scenario: Scenario) => void;
  allowedType: "all" | "image" | "audio";
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  scenarios = SCENARIOS,
  selectedScenarioId,
  onSelectScenario,
  allowedType
}) => {
  // Render corresponding icon beautifully
  const renderIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case "ShieldAlert":
        return <ShieldAlert className={className} />;
      case "UserCheck":
        return <UserCheck className={className} />;
      case "Activity":
        return <Activity className={className} />;
      case "Wrench":
        return <Wrench className={className} />;
      case "Volume2":
        return <Volume2 className={className} />;
      case "Camera":
        return <Camera className={className} />;
      case "Mic":
        return <Mic className={className} />;
      default:
        return <ShieldAlert className={className} />;
    }
  };

  const filteredScenarios = scenarios.filter(s => {
    if (allowedType === "all") return true;
    return s.type === allowedType;
  });

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-[11px] font-bold text-blue-400 border border-blue-800/80">2</span>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            第二步：匹配安全分析场景
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">
          请选择与您第一步所传素材相符的检测场景
        </span>
      </div>

      {/* Combined Horizontal Layout: side-by-side square buttons expanding when selected */}
      <div className="flex flex-wrap items-center gap-2">
        {filteredScenarios.map((scenario) => {
          const isSelected = scenario.id === selectedScenarioId;
          return (
            <button
              key={scenario.id}
              id={`btn-square-scenario-${scenario.id}`}
              type="button"
              onClick={() => onSelectScenario(scenario)}
              title={scenario.name}
              className={`transition-all duration-300 ease-out flex items-center justify-center cursor-pointer border ${
                isSelected
                  ? "flex-1 md:flex-initial md:w-auto px-4 py-3 rounded-xl bg-blue-950/80 border-blue-500 text-blue-300 shadow-md gap-2 min-w-[200px]"
                  : "h-12 w-12 rounded-xl bg-slate-900 border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-700 shadow-sm"
              }`}
            >
              <div className={`shrink-0 ${isSelected ? "text-blue-400" : "text-slate-400"}`}>
                {renderIcon(scenario.icon, isSelected ? "h-5 w-5" : "h-5.5 w-5.5")}
              </div>
              
              {isSelected && (
                <div className="flex items-center justify-between w-full overflow-hidden whitespace-nowrap animate-fade-in text-left">
                  <span className="text-xs font-bold tracking-tight truncate pr-1">
                    {scenario.name}
                  </span>
                  <span className={`text-[8px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ${
                    scenario.type === "image" 
                      ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60" 
                      : "bg-sky-950/60 text-sky-400 border border-sky-800/60"
                  }`}>
                    {scenario.type === "image" ? "图" : "音"}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

