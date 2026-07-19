export interface ProcessStep {
  phase: string;
  detail: string;
}

export interface ResultItem {
  label: string;
  value: string;
}

export interface SuggestionItem {
  category: string;
  text: string;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  confidence: number;
  processSteps: ProcessStep[];
  results: ResultItem[];
  suggestions: SuggestionItem[];
}

export interface HistoryRecord {
  id: string;
  timestamp: string; // ISO date string
  scenarioId: string;
  scenarioName: string;
  fileType: "image" | "audio";
  fileName: string;
  fileData: string; // Base64 representation or cropped preview
  mimeType: string;
  customPrompt?: string;
  result: AnalysisResult;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  placeholder: string;
  type: "image" | "audio" | "both";
  defaultPrompt?: string;
  
  // Dynamic fields from Analysis Template matching Scenario
  agentId?: string;
  skillIds?: string[];
  sampleLibraryId?: string;
  sampleLoadRule?: "all" | "top-3" | "random-1" | "none";
  connections?: { from: string; to: string }[];
  nodes?: WorkflowNode[];
}

export interface WorkflowNode {
  id: string;
  type: "input" | "output" | "skills" | "sample" | "agent" | "router" | "merge";
  name: string;
  x: number;
  y: number;
  agentId?: string;
  skillIds?: string[];
  sampleLibraryId?: string;
  sampleLoadRule?: "all" | "top-3" | "random-1" | "none";
  routerRule?: string;
  mergeMode?: "sequence" | "parallel";
}

export interface SampleItem {
  id: string;
  name: string;
  type: "image" | "audio" | "both";
  data?: string; // Base64 image payload
  audioData?: string; // Base64 audio payload
  description: string;
}

export interface SampleLibrary {
  id: string;
  name: string;
  description: string;
  type: "image" | "audio" | "both";
  samples: SampleItem[];
}

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  systemInstruction: string;
  temperature: number;
}

export interface SkillConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  customRules: string;
}

export interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  type: "image" | "audio";
  agentId: string;
  skillIds: string[];
  sampleLibraryId?: string;
  sampleLoadRule: "all" | "top-3" | "random-1" | "none";
  icon: string;
  placeholder: string;
  defaultPrompt?: string;
  connections?: { from: string; to: string }[];
  nodes?: WorkflowNode[];
}

export type AiWorkspaceTab = "offline" | "realtime";

export type OfflineAssetType = "upload" | "capture" | "audio";

export interface OfflineAssetItem {
  id: string;
  type: OfflineAssetType;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
  sourceLabel: string;
}

export interface RealtimeStreamConfig {
  streamUrl: string;
  accessToken: string;
}

export interface RecordingConfig {
  videoEnabled: boolean; // 是否开启视频录制
  duration: number; // 录制时长 (秒)
  audioEnabled: boolean; // 是否开启音频录制
  audioBitrate: 128 | 256 | 320; // 音频码率 (kbps)
  imageCaptureEnabled: boolean; // 是否开启图片截取
  imageQuality: "SD" | "HD" | "Ultra-HD"; // 图片画质
  triggerInterval: number; // 触发间隔 (分钟)
  timeRange: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  };
  storagePath: string; // 存储路径
  storageEnabled?: boolean; // 是否开启任务数据保存
}

export interface RecordingTask {
  id: string;
  config: RecordingConfig;
  status: "active" | "completed" | "error";
  startedAt: string;
}

export type ResourceType = "agent" | "videoLibrary" | "imageLibrary" | "audioLibrary" | "tool";

export type NodeStatus = "waiting" | "running" | "completed" | "error";

export interface AgentNodeCall {
  id: string;
  nodeName: string;
  role: string;
  resourceType: ResourceType;
  resourceName: string;
  status: NodeStatus;
  summary: string;
  evidenceUrl?: string; // 新增：截取的图片或视频证据 URL
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  agents: string[];
  videoLibraries: string[];
  imageLibraries: string[];
  audioLibraries: string[];
  tools: string[];
  supportedModes: Array<"offline" | "realtime">;
  defaultNodeFlow: Omit<AgentNodeCall, "status" | "summary">[];
  defaultSummary: string;
}

export interface AgentAnalysisTrace {
  id: string;
  mode: "offline" | "realtime";
  templateId: string;
  templateName: string;
  startedAt: string;
  nodes: AgentNodeCall[];
}

export interface AgentAnalysisResult {
  headline: string;
  summary: string;
  riskLevel: "低" | "中" | "高";
  matchedResources: string[];
  recommendations: string[];
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: number;
  templateId: string;
  templateName: string;
  mode: AiWorkspaceTab;
  captures: { id: string; image: string; rect: DOMRect | null }[];
  videos: { id: string; url: string; rect: DOMRect | null }[];
  audios: { id: string; url: string; rect: DOMRect | null }[];
  trace: AgentAnalysisTrace | null;
  result: AgentAnalysisResult | null;
  markdownResult?: string;
  thinkingLogs?: string[];
  thinkingStep?: number;
}
