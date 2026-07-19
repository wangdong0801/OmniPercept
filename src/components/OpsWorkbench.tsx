import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Settings,
  Layers,
  Bot,
  Zap,
  Database,
  Plus,
  Trash2,
  Edit3,
  Save,
  Undo,
  Check,
  PlusCircle,
  FolderOpen,
  HelpCircle,
  Eye,
  Sliders,
  Play,
  ArrowRight,
  Info,
  X,
  Activity,
  Camera,
  Mic,
  Volume2,
  Wrench,
  Workflow,
  Upload
} from "lucide-react";
import {
  AgentConfig,
  SkillConfig,
  SampleLibrary,
  AnalysisTemplate,
  SampleItem,
  WorkflowNode
} from "../types";
import {
  getStoredConfig,
  saveAgents,
  saveSkills,
  saveSampleLibraries,
  saveTemplates
} from "../lib/configStore";

interface OpsWorkbenchProps {
  onConfigChanged: () => void;
}

export const OpsWorkbench: React.FC<OpsWorkbenchProps> = ({ onConfigChanged }) => {
  // Load configuration from local store
  const [configs, setConfigs] = useState(getStoredConfig());
  const [activeSubTab, setActiveSubTab] = useState<"templates" | "libraries" | "agents" | "skills">("templates");

  // State for previewing sample
  const [previewSample, setPreviewSample] = useState<SampleItem | null>(null);

  // Notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Custom Delete Confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "template" | "library" | "agent" | "skill" | "sampleItem" | null;
    id: string;
    name: string;
  }>({
    isOpen: false,
    type: null,
    id: "",
    name: "",
  });

  // Trigger brief floating success indicator
  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // State for active forms
  // 1. Template form state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState<boolean>(false);
  const [templateForm, setTemplateForm] = useState<Partial<AnalysisTemplate>>({
    id: "",
    name: "",
    description: "",
    type: "image",
    agentId: "",
    skillIds: [],
    sampleLibraryId: "",
    sampleLoadRule: "all",
    icon: "ShieldAlert",
    placeholder: "",
    defaultPrompt: ""
  });

  // 2. Library form state
  const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null);
  const [isAddingLibrary, setIsAddingLibrary] = useState<boolean>(false);
  const [libraryForm, setLibraryForm] = useState<Partial<SampleLibrary>>({
    id: "",
    name: "",
    description: "",
    type: "image",
    samples: []
  });

  // 3. Agent form state
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [isAddingAgent, setIsAddingAgent] = useState<boolean>(false);
  const [agentForm, setAgentForm] = useState<Partial<AgentConfig>>({
    id: "",
    name: "",
    model: "gemini-2.5-flash",
    systemInstruction: "",
    temperature: 0.1
  });

  // 4. Skill form state
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [isAddingSkill, setIsAddingSkill] = useState<boolean>(false);
  const [skillForm, setSkillForm] = useState<Partial<SkillConfig>>({
    id: "",
    name: "",
    type: "image",
    description: "",
    customRules: ""
  });

  // 5. Sample Item sub-form (inside Library editing)
  const [isAddingSampleItem, setIsAddingSampleItem] = useState<boolean>(false);
  const [sampleItemForm, setSampleItemForm] = useState<Partial<SampleItem>>({
    id: "",
    name: "",
    type: "image",
    data: "",
    audioData: "",
    description: ""
  });

  // Flowchart node states & dragging state
  const [nodePositions, setNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({
    input: { x: 30, y: 150 },
    skills: { x: 290, y: 50 },
    sample: { x: 590, y: 240 },
    agent: { x: 880, y: 50 },
    output: { x: 1170, y: 150 },
  });
  const [canvasNodes, setCanvasNodes] = useState<WorkflowNode[]>([
    { id: "input", type: "input", name: "1. 物理媒介数据输入", x: 30, y: 150 },
    { id: "skills", type: "skills", name: "2. 专业认知算法挂载", x: 290, y: 50, skillIds: [] },
    { id: "sample", type: "sample", name: "3. 对照参考标准样本库", x: 590, y: 240, sampleLibraryId: "", sampleLoadRule: "all" },
    { id: "agent", type: "agent", name: "4. 诊断决策智能体 (核心)", x: 880, y: 50, agentId: "" },
    { id: "output", type: "output", name: "5. AI 模型研判与生成", x: 1170, y: 150 }
  ]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    type: "canvas" | "node";
    targetId?: string;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportState, setViewportState] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 800,
    clientHeight: 500,
  });
  const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);

  const handleCanvasScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setViewportState({
      scrollLeft: target.scrollLeft,
      scrollTop: target.scrollTop,
      clientWidth: target.clientWidth,
      clientHeight: target.clientHeight,
    });
  };

  useEffect(() => {
    if (canvasRef.current) {
      const el = canvasRef.current;
      setViewportState({
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
      });
    }
  }, [canvasNodes]);

  const getNodeDimensions = (id: string, type: string) => {
    switch (type) {
      case "input": return { w: 230, h: 120, portY: 60 };
      case "skills": return { w: 260, h: 160, portY: 80 };
      case "sample": return { w: 250, h: 155, portY: 75 };
      case "agent": return { w: 260, h: 150, portY: 75 };
      case "output": return { w: 240, h: 140, portY: 70 };
      case "router": return { w: 230, h: 130, portY: 65 };
      case "merge": return { w: 230, h: 130, portY: 65 };
      default: return { w: 240, h: 150, portY: 75 };
    }
  };

  const initializeCanvasNodes = (tmpl: Partial<AnalysisTemplate>) => {
    if (tmpl.nodes && tmpl.nodes.length > 0) {
      setCanvasNodes(tmpl.nodes);
      const positions: { [key: string]: { x: number; y: number } } = {};
      tmpl.nodes.forEach(n => {
        positions[n.id] = { x: n.x, y: n.y };
      });
      setNodePositions(positions);
    } else {
      const defaultNodes: WorkflowNode[] = [
        { id: "input", type: "input", name: "1. 物理媒介数据输入", x: 30, y: 150 },
        { id: "skills", type: "skills", name: "2. 专业认知算法挂载", x: 290, y: 50, skillIds: tmpl.skillIds || [] },
        { id: "sample", type: "sample", name: "3. 对照参考标准样本库", x: 590, y: 240, sampleLibraryId: tmpl.sampleLibraryId || "", sampleLoadRule: tmpl.sampleLoadRule || "all" },
        { id: "agent", type: "agent", name: "4. 诊断决策智能体 (核心)", x: 880, y: 50, agentId: tmpl.agentId || "" },
        { id: "output", type: "output", name: "5. AI 模型研判与生成", x: 1170, y: 150 }
      ];
      setCanvasNodes(defaultNodes);
      setNodePositions({
        input: { x: 30, y: 150 },
        skills: { x: 290, y: 50 },
        sample: { x: 590, y: 240 },
        agent: { x: 880, y: 50 },
        output: { x: 1170, y: 150 },
      });
    }
  };

  const handleAddNode = (type: "skills" | "sample" | "agent" | "router" | "merge", customCoords?: { x: number; y: number }) => {
    const id = `${type}-${Date.now()}`;
    let name = "";
    let extraFields = {};

    switch (type) {
      case "skills":
        name = "自定义算法挂载";
        extraFields = { skillIds: [] };
        break;
      case "sample":
        name = "自定义参考样本库";
        extraFields = { sampleLibraryId: "", sampleLoadRule: "all" };
        break;
      case "agent":
        name = "自定义决策智能体";
        extraFields = { agentId: "" };
        break;
      case "router":
        name = "决策分流判定器";
        extraFields = { routerRule: "依据前置分析特征，条件路由至 A 或 B 分支..." };
        break;
      case "merge":
        name = "多路并联结果汇聚";
        extraFields = { mergeMode: "parallel" };
        break;
    }

    const x = customCoords ? customCoords.x : (400 + (canvasNodes.length % 5) * 45);
    const y = customCoords ? customCoords.y : (150 + (canvasNodes.length % 3) * 45);

    const newNode: WorkflowNode = {
      id,
      type,
      name,
      x,
      y,
      ...extraFields
    };

    setCanvasNodes(prev => [...prev, newNode]);
    setNodePositions(prev => ({
      ...prev,
      [id]: { x, y }
    }));

    triggerNotification(`成功增加新节点: ${name}`);
  };

  const handleDeleteNode = (id: string) => {
    if (id === "input" || id === "output") {
      triggerNotification("基础输入和输出节点为链路终端，无法删除！");
      return;
    }
    setCanvasNodes(prev => prev.filter(n => n.id !== id));

    // Remove connections associated with this node
    const currentConns = templateForm.connections || [];
    const updatedConns = currentConns.filter(c => c.from !== id && c.to !== id);
    setTemplateForm(prev => ({ ...prev, connections: updatedConns }));

    // Clean position dictionary
    const updatedPos = { ...nodePositions };
    delete updatedPos[id];
    setNodePositions(updatedPos);

    triggerNotification("节点及相关链路连接线已成功移除！");
  };

  const [draggingResource, setDraggingResource] = useState<{ type: "agent" | "skill" | "sample"; id: string } | null>(null);

  // Dragging active node in flowchart
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [nodeStart, setNodeStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Connection assembly state
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  const getConnectionCoords = (fromNodeId: string, toNodeId: string) => {
    const fromPos = nodePositions[fromNodeId] || { x: 0, y: 0 };
    const toPos = nodePositions[toNodeId] || { x: 0, y: 0 };

    const fromNodeObj = canvasNodes.find(n => n.id === fromNodeId);
    const toNodeObj = canvasNodes.find(n => n.id === toNodeId);

    const fromType = fromNodeObj?.type || fromNodeId;
    const toType = toNodeObj?.type || toNodeId;

    const fromDims = getNodeDimensions(fromNodeId, fromType);
    const toDims = getNodeDimensions(toNodeId, toType);

    const sx = fromPos.x + fromDims.w;
    const sy = fromPos.y + fromDims.portY;

    const ex = toPos.x;
    const ey = toPos.y + toDims.portY;

    return { sx, sy, ex, ey };
  };

  const handleCreateConnection = (from: string, to: string) => {
    const current = templateForm.connections || [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ];

    // Check if duplicate exists
    if (current.some(c => c.from === from && c.to === to)) {
      triggerNotification("此连接已经存在！");
      setConnectingFrom(null);
      return;
    }

    // Add new connection
    const updated = [...current, { from, to }];
    setTemplateForm(prev => ({ ...prev, connections: updated }));
    setConnectingFrom(null);
    triggerNotification(`连接成功建立: ${from} ➔ ${to}`);
  };

  const handleDeleteConnection = (index: number) => {
    const current = templateForm.connections || [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ];
    const updated = current.filter((_, i) => i !== index);
    setTemplateForm(prev => ({ ...prev, connections: updated }));
    triggerNotification("已成功移除该条流程连接线！");
  };

  const handleClearConnections = () => {
    setTemplateForm(prev => ({ ...prev, connections: [] }));
    triggerNotification("已清空所有链路，请点击端口重新绘制您的研判流程！");
  };

  const handleRestoreStandardFlow = () => {
    setTemplateForm(prev => ({
      ...prev,
      connections: [
        { from: "input", to: "skills" },
        { from: "skills", to: "sample" },
        { from: "sample", to: "agent" },
        { from: "agent", to: "output" }
      ]
    }));
    triggerNotification("已成功恢复标准研判顺序配置！");
  };

  const handleMinimapNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const clickY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const propX = clickX / rect.width;
    const propY = clickY / rect.height;

    const targetScrollLeft = propX * 1500 - viewportState.clientWidth / 2;
    const targetScrollTop = propY * 500 - viewportState.clientHeight / 2;

    if (canvasRef.current) {
      canvasRef.current.scrollLeft = Math.max(0, Math.min(1500 - viewportState.clientWidth, targetScrollLeft));
      canvasRef.current.scrollTop = Math.max(0, Math.min(500 - viewportState.clientHeight, targetScrollTop));
    }
  };

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingMinimap(true);
    handleMinimapNavigate(e);
  };

  const handleMinimapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingMinimap) {
      handleMinimapNavigate(e);
    }
  };

  const handleMinimapMouseUp = () => {
    setIsDraggingMinimap(false);
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    setDraggedNode(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setNodeStart(nodePositions[nodeId] || { x: 0, y: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggedNode) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const newX = Math.max(10, Math.min(1300, nodeStart.x + dx));
    const newY = Math.max(10, Math.min(380, nodeStart.y + dy));

    setNodePositions(prev => ({
      ...prev,
      [draggedNode]: { x: newX, y: newY }
    }));
    setCanvasNodes(prev => prev.map(n => n.id === draggedNode ? { ...n, x: newX, y: newY } : n));
  };

  const handleCanvasMouseUp = () => {
    setDraggedNode(null);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const clickY = e.clientY - rect.top + e.currentTarget.scrollTop;

    setContextMenu({
      x: clickX,
      y: clickY,
      visible: true,
      type: "canvas"
    });
  };

  const resetFlowchartLayout = () => {
    const defaultNodes: WorkflowNode[] = [
      { id: "input", type: "input", name: "1. 物理媒介数据输入", x: 30, y: 150 },
      { id: "skills", type: "skills", name: "2. 专业认知算法挂载", x: 290, y: 50, skillIds: templateForm.skillIds || [] },
      { id: "sample", type: "sample", name: "3. 对照参考标准样本库", x: 590, y: 240, sampleLibraryId: templateForm.sampleLibraryId || "", sampleLoadRule: templateForm.sampleLoadRule || "all" },
      { id: "agent", type: "agent", name: "4. 诊断决策智能体 (核心)", x: 880, y: 50, agentId: templateForm.agentId || "" },
      { id: "output", type: "output", name: "5. AI 模型研判与生成", x: 1170, y: 150 }
    ];
    setCanvasNodes(defaultNodes);
    setNodePositions({
      input: { x: 30, y: 150 },
      skills: { x: 290, y: 50 },
      sample: { x: 590, y: 240 },
      agent: { x: 880, y: 50 },
      output: { x: 1170, y: 150 },
    });
    triggerNotification("已成功重置所有工作流节点的视图布局！");
  };

  // Sync state and notify parent App
  const syncAndNotify = (newConfigs: typeof configs) => {
    setConfigs(newConfigs);
    onConfigChanged();
  };

  // ==================== AGENT HANDLERS ====================
  const handleStartEditAgent = (agent: AgentConfig) => {
    setAgentForm(agent);
    setEditingAgentId(agent.id);
    setIsAddingAgent(false);
  };

  const handleStartAddAgent = () => {
    setAgentForm({
      id: `agent-${Date.now()}`,
      name: "新智脑体 Agent",
      model: "gemini-2.5-flash",
      systemInstruction: "你是一个专业的分析助手...",
      temperature: 0.1
    });
    setIsAddingAgent(true);
    setEditingAgentId(null);
  };

  const handleSaveAgent = () => {
    if (!agentForm.name || !agentForm.id || !agentForm.systemInstruction) {
      alert("请完整填写 Agent 的基本参数和核心系统指令！");
      return;
    }

    let updatedList = [...configs.agents];
    if (isAddingAgent) {
      // Check if ID already exists
      if (configs.agents.some(a => a.id === agentForm.id)) {
        alert("ID已存在，请更换！");
        return;
      }
      updatedList.push(agentForm as AgentConfig);
    } else {
      updatedList = updatedList.map(a => a.id === editingAgentId ? (agentForm as AgentConfig) : a);
    }

    saveAgents(updatedList);
    syncAndNotify({ ...configs, agents: updatedList });
    setEditingAgentId(null);
    setIsAddingAgent(false);
    triggerNotification("Agent 智能体配置保存成功！");
  };

  const handleDeleteAgent = (id: string) => {
    const agent = configs.agents.find(a => a.id === id);
    setDeleteConfirm({
      isOpen: true,
      type: "agent",
      id,
      name: agent?.name || "Agent 智能体",
    });
  };

  // ==================== SKILL HANDLERS ====================
  const handleStartEditSkill = (skill: SkillConfig) => {
    setSkillForm(skill);
    setEditingSkillId(skill.id);
    setIsAddingSkill(false);
  };

  const handleStartAddSkill = () => {
    setSkillForm({
      id: `skill-${Date.now()}`,
      name: "新专业认知技能",
      type: "image",
      description: "一句话阐明该专业诊断能力...",
      customRules: "输入具体的Prompt注入规则，要求Gemini模型必须遵循..."
    });
    setIsAddingSkill(true);
    setEditingSkillId(null);
  };

  const handleSaveSkill = () => {
    if (!skillForm.name || !skillForm.id || !skillForm.customRules) {
      alert("请填写完整的技能名称与 Prompt 规则规范！");
      return;
    }

    let updatedList = [...configs.skills];
    if (isAddingSkill) {
      if (configs.skills.some(s => s.id === skillForm.id)) {
        alert("ID已存在，请更换！");
        return;
      }
      updatedList.push(skillForm as SkillConfig);
    } else {
      updatedList = updatedList.map(s => s.id === editingSkillId ? (skillForm as SkillConfig) : s);
    }

    saveSkills(updatedList);
    syncAndNotify({ ...configs, skills: updatedList });
    setEditingSkillId(null);
    setIsAddingSkill(false);
    triggerNotification("智能 Skill 业务技能保存成功！");
  };

  const handleDeleteSkill = (id: string) => {
    const skill = configs.skills.find(s => s.id === id);
    setDeleteConfirm({
      isOpen: true,
      type: "skill",
      id,
      name: skill?.name || "Skill 业务技能",
    });
  };

  // ==================== SAMPLE LIBRARY HANDLERS ====================
  const handleStartEditLibrary = (lib: SampleLibrary) => {
    setLibraryForm(lib);
    setEditingLibraryId(lib.id);
    setIsAddingLibrary(false);
    setIsAddingSampleItem(false);
  };

  const handleStartAddLibrary = () => {
    setLibraryForm({
      id: `lib-${Date.now()}`,
      name: "标准安全与对照样本库",
      description: "针对特定检测场景的样本图谱或音色库...",
      type: "image",
      samples: []
    });
    setIsAddingLibrary(true);
    setEditingLibraryId(null);
    setIsAddingSampleItem(false);
  };

  const handleSaveLibrary = () => {
    if (!libraryForm.name || !libraryForm.id) {
      alert("请填写样本库的名称与唯一标识 ID！");
      return;
    }

    let updatedList = [...configs.samples];
    if (isAddingLibrary) {
      if (configs.samples.some(l => l.id === libraryForm.id)) {
        alert("ID已存在，请更换！");
        return;
      }
      updatedList.push(libraryForm as SampleLibrary);
    } else {
      updatedList = updatedList.map(l => l.id === editingLibraryId ? (libraryForm as SampleLibrary) : l);
    }

    saveSampleLibraries(updatedList);
    syncAndNotify({ ...configs, samples: updatedList });
    setEditingLibraryId(null);
    setIsAddingLibrary(false);
    triggerNotification("样本库配置更新成功！");
  };

  const handleDeleteLibrary = (id: string) => {
    const lib = configs.samples.find(l => l.id === id);
    setDeleteConfirm({
      isOpen: true,
      type: "library",
      id,
      name: lib?.name || "样本库",
    });
  };

  // SUB-HANDLERS FOR INDIVIDUAL SAMPLES INSIDE A LIBRARY
  const handleAddSampleItem = () => {
    if (!sampleItemForm.name || !sampleItemForm.description) {
      alert("请输入标准对比样本的名称及核验细节说明！");
      return;
    }

    let determinedType: "image" | "audio" | "both" = "image";
    const hasImage = !!sampleItemForm.data;
    const hasAudio = !!sampleItemForm.audioData;

    if (hasImage && hasAudio) {
      determinedType = "both";
    } else if (hasAudio) {
      determinedType = "audio";
    } else {
      determinedType = "image";
    }

    const newItem: SampleItem = {
      id: `sample-${Date.now()}`,
      name: sampleItemForm.name,
      type: determinedType,
      data: sampleItemForm.data || "",
      audioData: sampleItemForm.audioData || "",
      description: sampleItemForm.description
    };

    const updatedSamples = [...(libraryForm.samples || []), newItem];
    const updatedForm = { ...libraryForm, samples: updatedSamples };

    setLibraryForm(updatedForm);
    setIsAddingSampleItem(false);
    setSampleItemForm({ id: "", name: "", type: "image", data: "", audioData: "", description: "" });
    triggerNotification("已将单条多模态样本追加至暂存区，请点击保存库以持久化生效");
  };

  const handleDeleteSampleItem = (itemId: string) => {
    const item = (libraryForm.samples || []).find(s => s.id === itemId);
    setDeleteConfirm({
      isOpen: true,
      type: "sampleItem",
      id: itemId,
      name: item?.name || "标准样本",
    });
  };

  // ==================== TEMPLATE / SCENARIO HANDLERS ====================
  const handleStartEditTemplate = (tmpl: AnalysisTemplate) => {
    const initializedTmpl = {
      ...tmpl,
      connections: tmpl.connections || [
        { from: "input", to: "skills" },
        { from: "skills", to: "sample" },
        { from: "sample", to: "agent" },
        { from: "agent", to: "output" }
      ]
    };
    setTemplateForm(initializedTmpl);
    initializeCanvasNodes(initializedTmpl);
    setEditingTemplateId(tmpl.id);
    setIsAddingTemplate(false);
  };

  const handleStartAddTemplate = () => {
    const newTmpl: AnalysisTemplate = {
      id: `scenario-${Date.now()}`,
      name: "新增生产安全研判场景",
      description: "关于如何运用多源多模态手段，对该场景下的工业安全状况或设备声音进行深度研判...",
      type: "image",
      agentId: configs.agents[0]?.id || "",
      skillIds: [],
      sampleLibraryId: configs.samples[0]?.id || "",
      sampleLoadRule: "all",
      icon: "ShieldAlert",
      placeholder: "第一步：请上传实拍或背景音频...",
      defaultPrompt: "请仔细研判当前多模态素材...",
      connections: [
        { from: "input", to: "skills" },
        { from: "skills", to: "sample" },
        { from: "sample", to: "agent" },
        { from: "agent", to: "output" }
      ]
    };
    setTemplateForm(newTmpl);
    initializeCanvasNodes(newTmpl);
    setIsAddingTemplate(true);
    setEditingTemplateId(null);
  };

  const handleSaveTemplate = () => {
    const firstAgentNode = canvasNodes.find(n => n.type === "agent");
    const firstSampleNode = canvasNodes.find(n => n.type === "sample");
    const skillsNodes = canvasNodes.filter(n => n.type === "skills");
    const aggregatedSkillIds: string[] = Array.from(new Set(skillsNodes.flatMap(n => (n.skillIds || []) as string[])));

    const finalTmpl: AnalysisTemplate = {
      ...(templateForm as AnalysisTemplate),
      nodes: canvasNodes,
      agentId: firstAgentNode?.agentId || templateForm.agentId || configs.agents[0]?.id || "",
      skillIds: aggregatedSkillIds,
      sampleLibraryId: firstSampleNode?.sampleLibraryId || templateForm.sampleLibraryId || "",
      sampleLoadRule: firstSampleNode?.sampleLoadRule || templateForm.sampleLoadRule || "all"
    };

    if (!finalTmpl.name || !finalTmpl.id || !finalTmpl.agentId) {
      alert("请填写模板名称、唯一标识 ID 并关联所需的决策智能体 Agent！");
      return;
    }

    let updatedList = [...configs.templates];
    if (isAddingTemplate) {
      if (configs.templates.some(t => t.id === finalTmpl.id)) {
        alert("ID已存在，请更换！");
        return;
      }
      updatedList.push(finalTmpl);
    } else {
      updatedList = updatedList.map(t => t.id === editingTemplateId ? finalTmpl : t);
    }

    saveTemplates(updatedList);
    syncAndNotify({ ...configs, templates: updatedList });
    setEditingTemplateId(null);
    setIsAddingTemplate(false);
    triggerNotification("业务分析模板已成功封包！已立刻供用户调用");
  };

  const handleDeleteTemplate = (id: string) => {
    const tmpl = configs.templates.find(t => t.id === id);
    setDeleteConfirm({
      isOpen: true,
      type: "template",
      id,
      name: tmpl?.name || "业务分析场景模板",
    });
  };

  const confirmDeleteAction = () => {
    const { type, id } = deleteConfirm;
    if (!type || !id) return;

    if (type === "agent") {
      const updatedList = configs.agents.filter(a => a.id !== id);
      saveAgents(updatedList);
      syncAndNotify({ ...configs, agents: updatedList });
      triggerNotification("Agent 已成功永久删除");
    } else if (type === "skill") {
      const updatedList = configs.skills.filter(s => s.id !== id);
      saveSkills(updatedList);
      syncAndNotify({ ...configs, skills: updatedList });
      triggerNotification("Skill 已成功永久删除");
    } else if (type === "library") {
      const updatedList = configs.samples.filter(l => l.id !== id);
      saveSampleLibraries(updatedList);
      syncAndNotify({ ...configs, samples: updatedList });
      triggerNotification("样本库已删除");
    } else if (type === "template") {
      const updatedList = configs.templates.filter(t => t.id !== id);
      saveTemplates(updatedList);
      syncAndNotify({ ...configs, templates: updatedList });
      triggerNotification("研判场景模板已成功卸载");
    } else if (type === "sampleItem") {
      const updatedSamples = (libraryForm.samples || []).filter(item => item.id !== id);
      setLibraryForm({ ...libraryForm, samples: updatedSamples });
      triggerNotification("已从暂存区移除该样本，需保存库后方可最终生效");
    }

    setDeleteConfirm({ isOpen: false, type: null, id: "", name: "" });
  };

  const handleToggleSkillInTemplate = (skillId: string) => {
    const current = templateForm.skillIds || [];
    let updated: string[];
    if (current.includes(skillId)) {
      updated = current.filter(id => id !== skillId);
    } else {
      updated = [...current, skillId];
    }
    setTemplateForm({ ...templateForm, skillIds: updated });
  };


  return (
    <div className="bg-[#0f172a] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0f172a] border border-white/5 rounded-[2.5rem] p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Dynamic Saving Notification toast */}
      {notification && (
        <div className="fixed top-24 right-8 bg-emerald-500/90 backdrop-blur-md border border-emerald-400/50 text-white font-bold text-xs py-3.5 px-6 rounded-2xl shadow-[0_10px_25px_-5px_rgba(16,185,129,0.3)] z-50 flex items-center gap-2.5 animate-scale-up">
          <div className="bg-white/20 p-1 rounded-full">
            <Check className="h-3.5 w-3.5" />
          </div>
          {notification}
        </div>
      )}

      {/* Title section with O&M Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8 mb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <Settings className="h-6 w-6 text-blue-400 animate-spin-slow" />
            </div>
            运维专家工作台
            <span className="text-xs font-mono text-blue-500/60 bg-blue-500/5 px-2 py-1 rounded-lg border border-blue-500/10 ml-2 font-medium">v2.0 PRO</span>
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            动态定制研判场景。配置高层智能体，挂载专业算法知识，设置标准样本及加载检索算法，自动拼装为终端分析模板。
          </p>
        </div>

        {/* Action button in heading */}
        <div className="flex items-center gap-3 bg-slate-950/40 backdrop-blur-sm border border-white/5 px-4 py-2.5 rounded-2xl shadow-inner group">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Core Engine</span>
            <span className="text-xs text-blue-400 font-mono font-bold">Gemini 3.5 Active</span>
          </div>
          <div className="relative flex items-center justify-center">
            <span className="absolute h-3 w-3 rounded-full bg-blue-500 animate-ping opacity-75"></span>
            <span className="relative h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
          </div>
        </div>
      </div>

      {/* Internal Navigation Subtabs - Dock Style */}
      <div className="flex flex-wrap gap-3 mb-8 bg-slate-950/40 p-1.5 rounded-[1.25rem] border border-white/5 w-fit backdrop-blur-md shadow-inner">
        <button
          type="button"
          onClick={() => { setActiveSubTab("templates"); setEditingTemplateId(null); setIsAddingTemplate(false); }}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${activeSubTab === "templates"
            ? "bg-blue-600 text-white shadow-[0_4px_15px_-3px_rgba(37,99,235,0.4)] scale-[1.02]"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
            }`}
        >
          <Layers className={`h-4 w-4 ${activeSubTab === "templates" ? "text-white" : "text-slate-500"}`} />
          分析模板 (Templates)
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab("libraries"); setEditingLibraryId(null); setIsAddingLibrary(false); }}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${activeSubTab === "libraries"
            ? "bg-blue-600 text-white shadow-[0_4px_15px_-3px_rgba(37,99,235,0.4)] scale-[1.02]"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
            }`}
        >
          <Database className={`h-4 w-4 ${activeSubTab === "libraries" ? "text-white" : "text-slate-500"}`} />
          参考样本 (Samples)
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab("agents"); setEditingAgentId(null); setIsAddingAgent(false); }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${activeSubTab === "agents"
            ? "bg-blue-600 text-white shadow-lg scale-[1.02]"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
            }`}
        >
          <Bot className={`h-4 w-4 ${activeSubTab === "agents" ? "text-white" : "text-slate-500"}`} />
          智能 Agent (Agents)
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab("skills"); setEditingSkillId(null); setIsAddingSkill(false); }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${activeSubTab === "skills"
            ? "bg-blue-600 text-white shadow-lg scale-[1.02]"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
            }`}
        >
          <Zap className={`h-4 w-4 ${activeSubTab === "skills" ? "text-white" : "text-slate-500"}`} />
          专业 Skill (Skills)
        </button>
      </div>

      {/* SUB-PANEL 1: ANALYSIS TEMPLATE CONFIGURATION */}
      {activeSubTab === "templates" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {!editingTemplateId && !isAddingTemplate ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  <div className="text-sm font-bold text-slate-200 tracking-tight">
                    已封包场景模板 <span className="text-blue-400 ml-1 font-mono">{configs.templates.length}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartAddTemplate}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-black py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:shadow-[0_12px_25px_-6px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  定制全新研判模板
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.templates.map((tmpl) => {
                  const associatedAgent = configs.agents.find(a => a.id === tmpl.agentId);
                  const linkedSkillsCount = tmpl.skillIds?.length || 0;
                  const linkedLibrary = configs.samples.find(l => l.id === tmpl.sampleLibraryId);

                  return (
                    <div
                      key={tmpl.id}
                      className="group bg-slate-900/40 backdrop-blur-sm border border-white/5 p-5 rounded-[2rem] flex flex-col justify-between hover:border-blue-500/30 hover:bg-slate-900/60 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] hover:-translate-y-1.5 relative overflow-hidden"
                    >
                      {/* Card Glass Highlight */}
                      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${tmpl.type === "image"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}>
                            {tmpl.type === "image" ? "图像识别" : "音频特征"}
                          </span>
                          <span className="text-[10px] text-slate-600 font-mono font-bold tracking-tighter bg-slate-950/50 px-2 py-0.5 rounded-md">#{tmpl.id.slice(-6)}</span>
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="font-black text-slate-100 text-base tracking-tight group-hover:text-blue-400 transition-colors">{tmpl.name}</h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-medium">{tmpl.description}</p>
                        </div>

                        {/* Associated Specs Info Box - Elevated Display */}
                        <div className="bg-slate-950/60 border border-white/5 p-4 rounded-2xl space-y-3 shadow-inner relative overflow-hidden group/info">
                          <div className="absolute inset-0 bg-blue-500/0 group-hover/info:bg-blue-500/[0.02] transition-colors" />
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-300 font-bold">
                            <div className="p-1 bg-purple-500/10 rounded-lg border border-purple-500/20">
                              <Bot className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                            </div>
                            <span className="text-slate-500 font-medium">专家智能体:</span>
                            <span className="text-slate-200 ml-auto">{associatedAgent?.name || "未绑定"}</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-300 font-bold">
                            <div className="p-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            </div>
                            <span className="text-slate-500 font-medium">挂载技能:</span>
                            <span className="text-slate-200 ml-auto">{linkedSkillsCount} 个</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-300 font-bold">
                            <div className="p-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                              <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            </div>
                            <span className="text-slate-500 font-medium">参考样本:</span>
                            <span className="text-slate-200 ml-auto truncate max-w-[100px]">{linkedLibrary?.name || "未绑定"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Controls footer */}
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5 relative z-10">
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-2 bg-slate-950 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                          title="删除模板"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditTemplate(tmpl)}
                          className="flex-1 ml-3 py-2 bg-blue-500/5 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-400 rounded-xl transition-all duration-300 cursor-pointer text-xs font-black flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          参数装调
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Visual Drag-and-Drop Flowchart Editor Workspace
            <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] pointer-events-none" />

              {/* Local styled animations for the flowchart */}
              <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes flowDash {
                  to {
                    stroke-dashoffset: -30;
                  }
                }
                .animate-flow-dash {
                  stroke-dasharray: 8 5;
                  animation: flowDash 1.2s linear infinite;
                }
                .custom-scrollbar::-webkit-scrollbar {
                  width: 4px;
                  height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.2);
                }
                .grid-bg {
                  background-color: #03050c;
                  background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                  background-size: 30px 30px;
                }
                .flow-node-shadow {
                  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
                }
                .node-active-glow {
                  box-shadow: 0 0 30px rgba(59, 130, 246, 0.2), 0 0 0 2px rgba(59, 130, 246, 0.4);
                }
              `}} />

              {/* Title Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-inner">
                    <Workflow className="h-6 w-6 text-blue-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-slate-100 tracking-tight">
                      {isAddingTemplate ? "定制研判分析工作流模板" : `装调分析模板: ${templateForm.name}`}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">采用可视化拖拽流程组装，连接媒介、算法、样本与决策智能体</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingTemplateId(null); setIsAddingTemplate(false); }}
                  className="text-xs text-slate-400 hover:text-white font-black flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-white/5 px-5 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg active:scale-95 cursor-pointer"
                >
                  <Undo className="h-4 w-4" /> 返回模板列表
                </button>
              </div>

              {/* Step 1: Base Metadata Form */}
              <div className="bg-slate-900/20 backdrop-blur-sm border border-white/5 p-6 rounded-3xl space-y-6 shadow-inner relative group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20 rounded-full group-hover:bg-blue-500/40 transition-colors" />
                <div className="text-xs font-black text-slate-200 flex items-center gap-2 uppercase tracking-widest">
                  <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Sliders className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  第一步：配置分析场景基本信息
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">唯一标识 ID</label>
                    <input
                      type="text"
                      disabled={!isAddingTemplate}
                      value={templateForm.id || ""}
                      onChange={(e) => setTemplateForm({ ...templateForm, id: e.target.value })}
                      className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all disabled:opacity-30 placeholder:text-slate-700"
                      placeholder="如: factory-hazard-custom"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">分析模板名称</label>
                    <input
                      type="text"
                      value={templateForm.name || ""}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
                      placeholder="如: 安全通道阻碍物检测"
                    />
                  </div>
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">业务诊断场景描述</label>
                    <input
                      type="text"
                      value={templateForm.description || ""}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
                      placeholder="一句话写明此模板给用户解决的具体业务痛点和功能定位"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Visual Workflow Designer Container */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="text-xs font-black text-slate-200 flex items-center gap-2 uppercase tracking-widest">
                    <div className="h-6 w-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Layers className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    第二步：多模态研判流画布组装
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-slate-500 font-bold">💡 拖拽左侧要素到画布，连接逻辑触点</span>
                    <button
                      type="button"
                      onClick={resetFlowchartLayout}
                      className="text-slate-400 hover:text-white bg-slate-900 border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all hover:bg-slate-800 active:scale-95 cursor-pointer"
                    >
                      🔄 重置画布布局
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[750px]">
                  {/* Left Sidebar: Components Palette Deck */}
                  <div className="lg:col-span-3 h-full overflow-hidden flex flex-col bg-slate-950/40 backdrop-blur-sm border border-white/5 rounded-[2rem] shadow-inner">
                    <div className="p-6 border-b border-white/5 bg-slate-900/20">
                      <h5 className="text-[11px] font-black text-slate-200 flex items-center gap-2 uppercase tracking-[0.2em]">
                        <Sliders className="h-4 w-4 text-blue-400" />
                        算法要素池
                      </h5>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                      {/* 1. Decision Agents */}
                      <div className="space-y-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Bot className="h-4 w-4 text-purple-400" />
                          决策智能体 ({configs.agents.length})
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {configs.agents.map(agent => {
                            const isCurrent = templateForm.agentId === agent.id;
                            return (
                              <div
                                key={agent.id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggingResource({ type: 'agent', id: agent.id });
                                  e.dataTransfer.setData("application/json", JSON.stringify({ type: 'agent', id: agent.id }));
                                }}
                                onDragEnd={() => setDraggingResource(null)}
                                className={`p-3.5 rounded-2xl border text-xs transition-all duration-300 cursor-grab active:cursor-grabbing group relative ${isCurrent
                                  ? "bg-purple-500/10 border-purple-500/40 text-purple-200 shadow-[0_8px_20px_-5px_rgba(168,85,247,0.2)]"
                                  : "bg-slate-900/40 border-white/5 hover:border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                                  }`}
                              >
                                <div className="font-black flex items-center justify-between">
                                  <span className="truncate max-w-[120px]">{agent.name}</span>
                                  <span className="text-[8px] bg-slate-950 border border-white/5 px-2 py-0.5 rounded-lg text-slate-500 font-black tracking-tighter">
                                    {agent.model.includes("flash") ? "FLASH" : "PRO"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 mt-1.5 font-medium leading-relaxed">{agent.systemInstruction}</p>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                                  <span className="text-[9px] text-slate-600 font-bold uppercase">Ready to bind</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTemplateForm(prev => ({ ...prev, agentId: agent.id }));
                                      triggerNotification(`已绑定决策智能体: ${agent.name}`);
                                    }}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black transition-all shadow-lg active:scale-95 cursor-pointer"
                                  >
                                    {isCurrent ? "已绑定" : "+ 连接"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Analytical Skills */}
                      <div className="space-y-3 pt-4 border-t border-white/5">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-400" />
                          认知分析技能 ({configs.skills.filter(s => s.type === templateForm.type).length})
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {configs.skills.filter(s => s.type === templateForm.type).map(skill => {
                            const isMounted = (templateForm.skillIds || []).includes(skill.id);
                            return (
                              <div
                                key={skill.id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggingResource({ type: 'skill', id: skill.id });
                                  e.dataTransfer.setData("application/json", JSON.stringify({ type: 'skill', id: skill.id }));
                                }}
                                onDragEnd={() => setDraggingResource(null)}
                                className={`p-3.5 rounded-2xl border text-xs transition-all duration-300 cursor-grab active:cursor-grabbing group relative ${isMounted
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-[0_8px_20px_-5px_rgba(245,158,11,0.2)]"
                                  : "bg-slate-900/40 border-white/5 hover:border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                                  }`}
                              >
                                <div className="font-black truncate">{skill.name}</div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 mt-1.5 font-medium leading-relaxed">{skill.description}</p>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                                  <span className="text-[9px] text-slate-600 font-bold uppercase">Attach skill</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleSkillInTemplate(skill.id);
                                      triggerNotification(isMounted ? `已卸载专业技能: ${skill.name}` : `已挂载专业技能: ${skill.name}`);
                                    }}
                                    className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black transition-all shadow-lg active:scale-95 cursor-pointer"
                                  >
                                    {isMounted ? "已挂载" : "+ 挂载"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Sample Libraries */}
                      <div className="space-y-3 pt-4 border-t border-white/5">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Database className="h-4 w-4 text-emerald-400" />
                          标准样本库 ({configs.samples.filter(s => s.type === "both" || s.type === templateForm.type).length})
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {configs.samples.filter(s => s.type === "both" || s.type === templateForm.type).map(lib => {
                            const isCurrent = templateForm.sampleLibraryId === lib.id;
                            return (
                              <div
                                key={lib.id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggingResource({ type: 'sample', id: lib.id });
                                  e.dataTransfer.setData("application/json", JSON.stringify({ type: 'sample', id: lib.id }));
                                }}
                                onDragEnd={() => setDraggingResource(null)}
                                className={`p-3.5 rounded-2xl border text-xs transition-all duration-300 cursor-grab active:cursor-grabbing group relative ${isCurrent
                                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-[0_8px_20px_-5px_rgba(168,85,247,0.2)]"
                                  : "bg-slate-900/40 border-white/5 hover:border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                                  }`}
                              >
                                <div className="font-black flex items-center justify-between">
                                  <span className="truncate max-w-[120px]">{lib.name}</span>
                                  <span className="text-[8px] bg-slate-950 border border-white/5 px-2 py-0.5 rounded-lg text-slate-500 font-black tracking-tighter">
                                    {lib.samples?.length || 0} ITEMS
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 mt-1.5 font-medium leading-relaxed">{lib.description}</p>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                                  <span className="text-[9px] text-slate-600 font-bold uppercase">Sync data</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTemplateForm(prev => ({ ...prev, sampleLibraryId: lib.id }));
                                      triggerNotification(`已连接对照样本库: ${lib.name}`);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black transition-all shadow-lg active:scale-95 cursor-pointer"
                                  >
                                    {isCurrent ? "已连接" : "+ 匹配"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Flowchart Workspace Canvas */}
                  <div className="lg:col-span-9 h-full flex flex-col relative group/canvas">
                    {/* Interactive Help + Floating Add Node Action Toolbar - FIXED AT TOP */}
                    <div className="sticky top-0 z-40 bg-[#02040a] border-t border-x border-white/5 rounded-t-[2rem] px-4 py-3 flex items-center justify-between gap-4 shadow-sm backdrop-blur-md">
                      {/* Interactive Help instructions */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-300">
                        <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>
                          {connectingFrom
                            ? `【组装模式】已选中输出端 [ ${connectingFrom} ]，现在请点击目标节点左侧的【输入圆点】以连接！`
                            : "【拖拽与自定义画布装配】点击节点右侧 [输出圆点] 引出连线，再点击另一节点左侧 [输入圆点] 即可建立自定义工作流！点击线缆即可删除。"}
                        </span>
                        {connectingFrom && (
                          <button
                            type="button"
                            onClick={() => setConnectingFrom(null)}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-mono px-1.5 py-0.5 rounded font-bold transition-all text-[9px]"
                          >
                            取消
                          </button>
                        )}
                      </div>

                      {/* Floating Add Node Action Toolbar */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/50 p-1.5 rounded-lg border border-white/5">
                        <span className="text-[9px] text-slate-400 font-bold px-1 uppercase tracking-wider">增加节点:</span>
                        <button
                          type="button"
                          onClick={() => handleAddNode("skills")}
                          className="bg-amber-950/40 border border-amber-900/50 hover:bg-amber-900/40 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          算法技能
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNode("sample")}
                          className="bg-emerald-950/40 border border-emerald-900/50 hover:bg-emerald-900/40 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Database className="h-3.5 w-3.5" />
                          对照样本库
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNode("agent")}
                          className="bg-purple-950/40 border border-purple-900/50 hover:bg-purple-900/40 text-purple-400 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          智能体
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNode("router")}
                          className="bg-blue-950/40 border border-blue-900/50 hover:bg-blue-900/40 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Workflow className="h-3.5 w-3.5" />
                          决策分流
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNode("merge")}
                          className="bg-pink-950/40 border border-pink-900/50 hover:bg-pink-900/40 text-pink-400 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          并联汇聚
                        </button>
                      </div>
                    </div>

                    <div
                      ref={canvasRef}
                      onScroll={handleCanvasScroll}
                      className="flow-canvas-container relative w-full flex-1 min-h-0 bg-[#02040a] border-b border-x border-white/5 rounded-b-[2rem] overflow-auto [&::-webkit-scrollbar]:hidden shadow-2xl select-none"
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      onContextMenu={handleCanvasContextMenu}
                    >
                      {/* Grid overlay */}
                      <div className="absolute inset-0 w-[1450px] h-[480px] grid-bg pointer-events-none z-0" />


                      {/* SVG Cables Wires layer */}
                      <svg className="absolute inset-0 w-[1450px] h-[480px] pointer-events-none z-0">
                        <defs>
                          <linearGradient id="grad-input-skills" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                          <linearGradient id="grad-skills-sample" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#f59e0b" />
                          </linearGradient>
                          <linearGradient id="grad-sample-agent" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                          <linearGradient id="grad-agent-output" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                          <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Connection Curves */}
                        {(templateForm.connections || [])
                          .filter(conn => canvasNodes.some(n => n.id === conn.from) && canvasNodes.some(n => n.id === conn.to))
                          .map((conn, idx) => {
                            const { sx, sy, ex, ey } = getConnectionCoords(conn.from, conn.to);
                            const dx = Math.abs(ex - sx);
                            const d = `M ${sx} ${sy} C ${sx + dx * 0.45} ${sy}, ${ex - dx * 0.45} ${ey}, ${ex} ${ey}`;

                            // Custom color gradient for different connection targets
                            const targetNode = canvasNodes.find(n => n.id === conn.to);
                            const targetType = targetNode?.type || "output";

                            let strokeColor = "url(#grad-input-skills)";
                            let dotColor = "#10b981";
                            if (targetType === "skills") {
                              strokeColor = "url(#grad-input-skills)";
                              dotColor = "#10b981";
                            } else if (targetType === "sample") {
                              strokeColor = "url(#grad-skills-sample)";
                              dotColor = "#f59e0b";
                            } else if (targetType === "agent") {
                              strokeColor = "url(#grad-sample-agent)";
                              dotColor = "#3b82f6";
                            } else if (targetType === "output") {
                              strokeColor = "url(#grad-agent-output)";
                              dotColor = "#a855f7";
                            } else if (targetType === "router") {
                              strokeColor = "url(#grad-skills-sample)";
                              dotColor = "#3b82f6";
                            } else if (targetType === "merge") {
                              strokeColor = "url(#grad-agent-output)";
                              dotColor = "#ec4899";
                            }

                            const pathId = `dynamic-path-${idx}`;
                            return (
                              <g key={`${conn.from}-${conn.to}-${idx}`}>
                                {/* Selection/Hover helper stroke */}
                                <path
                                  d={d}
                                  stroke="transparent"
                                  strokeWidth="12"
                                  fill="none"
                                  className="cursor-pointer pointer-events-auto"
                                  onClick={() => {
                                    handleDeleteConnection(idx);
                                  }}
                                  title="点击以删除此连接"
                                />
                                {/* Background dark shadow */}
                                <path d={d} stroke="#0f172a" strokeWidth="6" fill="none" />
                                {/* Main animated stroke */}
                                <path
                                  id={pathId}
                                  d={d}
                                  stroke={strokeColor}
                                  strokeWidth="3.5"
                                  fill="none"
                                  className="animate-flow-dash cursor-pointer pointer-events-auto"
                                  filter="url(#glow-filter)"
                                  onClick={() => {
                                    handleDeleteConnection(idx);
                                  }}
                                  title="点击以删除此连接"
                                />
                                {/* Flowing animated dot */}
                                <circle r="4.5" fill={dotColor} className="filter drop-shadow-[0_0_4px_#10b981]">
                                  <animateMotion dur="2.4s" repeatCount="indefinite">
                                    <mpath href={`#${pathId}`} />
                                  </animateMotion>
                                </circle>
                              </g>
                            );
                          })}
                      </svg>

                      {/* --- CONNECTION LINE DELETE BUTTON OVERLAYS --- */}
                      {(templateForm.connections || [])
                        .filter(conn => canvasNodes.some(n => n.id === conn.from) && canvasNodes.some(n => n.id === conn.to))
                        .map((conn, idx) => {
                          const { sx, sy, ex, ey } = getConnectionCoords(conn.from, conn.to);
                          const mx = (sx + ex) / 2;
                          const my = (sy + ey) / 2;
                          return (
                            <button
                              key={`del-conn-btn-${conn.from}-${conn.to}-${idx}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConnection(idx);
                              }}
                              className="absolute flex items-center justify-center w-5 h-5 rounded-full bg-slate-950 border border-slate-800 hover:border-red-500 hover:bg-red-950/60 text-slate-400 hover:text-white transition-all duration-150 z-30 cursor-pointer shadow-lg group hover:scale-125"
                              style={{ left: `${mx - 10}px`, top: `${my - 10}px` }}
                              title="点击删除此条流程连接线"
                            >
                              <X className="h-3 w-3 text-slate-400 group-hover:text-white" />
                            </button>
                          );
                        })}

                      {/* --- DYNAMIC CUSTOM INTERACTIVE CANVAS NODES --- */}
                      {canvasNodes.map((node) => {
                        const activeSkills = (node.skillIds || []).map(id => configs.skills.find(s => s.id === id)).filter(Boolean) as SkillConfig[];
                        const currentLib = configs.samples.find(s => s.id === node.sampleLibraryId);
                        const currentAgent = configs.agents.find(a => a.id === node.agentId);
                        const isGlow = (node.type === "skills" && draggingResource?.type === "skill") ||
                          (node.type === "sample" && draggingResource?.type === "sample") ||
                          (node.type === "agent" && draggingResource?.type === "agent");

                        const pos = nodePositions[node.id] || { x: node.x, y: node.y };

                        return (
                          <div
                            key={node.id}
                            className={`flow-node-container absolute bg-slate-900 border rounded-2xl p-3 flex flex-col justify-between flow-node-shadow transition-all z-10 ${isGlow
                              ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02] bg-amber-950/10"
                              : "border-slate-800 node-active-glow"
                              }`}
                            style={{
                              left: `${pos.x}px`,
                              top: `${pos.y}px`,
                              width: node.type === "skills" ? "260px" :
                                node.type === "sample" ? "250px" :
                                  node.type === "agent" ? "260px" :
                                    node.type === "output" ? "240px" :
                                      node.type === "input" ? "230px" : "230px",
                              minHeight: node.type === "skills" ? "160px" : "130px"
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest(".flow-canvas-container");
                              const rect = canvasEl?.getBoundingClientRect();
                              if (rect) {
                                const clickX = e.clientX - rect.left + (canvasEl?.scrollLeft || 0);
                                const clickY = e.clientY - rect.top + (canvasEl?.scrollTop || 0);
                                setContextMenu({
                                  x: clickX,
                                  y: clickY,
                                  visible: true,
                                  type: "node",
                                  targetId: node.id
                                });
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              try {
                                const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                if (node.type === "skills" && data.type === "skill") {
                                  const current = node.skillIds || [];
                                  if (!current.includes(data.id)) {
                                    setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, skillIds: [...current, data.id] } : n));
                                    triggerNotification("已挂载新诊断技能到该节点！");
                                  } else {
                                    triggerNotification("该专业技能已在此节点挂载。");
                                  }
                                } else if (node.type === "sample" && data.type === "sample") {
                                  setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, sampleLibraryId: data.id } : n));
                                  triggerNotification("该节点已关联样本对比库！");
                                } else if (node.type === "agent" && data.type === "agent") {
                                  setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, agentId: data.id } : n));
                                  triggerNotification("该节点已挂载决策智能体！");
                                } else {
                                  triggerNotification(`节点类型不匹配！当前节点不支持拖入该技能/样本/智能体。`);
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          >
                            {/* Drag Handle Header */}
                            <div
                              className="flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-slate-800 pb-1.5"
                              onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                            >
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider truncate max-w-[150px]">
                                <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                {node.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider scale-90 ${node.type === "input" ? "bg-cyan-950 text-cyan-400" :
                                  node.type === "skills" ? "bg-amber-950 text-amber-400" :
                                    node.type === "sample" ? "bg-emerald-950 text-emerald-400" :
                                      node.type === "agent" ? "bg-purple-950 text-purple-400" :
                                        node.type === "router" ? "bg-blue-950 text-blue-400" :
                                          node.type === "merge" ? "bg-pink-950 text-pink-400" :
                                            "bg-emerald-950 text-emerald-400"
                                  }`}>
                                  {node.type.toUpperCase()}
                                </span>
                                {node.id !== "input" && node.id !== "output" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNode(node.id)}
                                    className="text-slate-500 hover:text-red-400 transition-all p-0.5"
                                    title="删除此节点"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Node Content based on type */}
                            <div className="flex-1 py-2 flex flex-col justify-center">
                              {node.type === "input" && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] text-slate-400">研判媒介类型:</span>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTemplateForm(prev => ({ ...prev, type: "image", skillIds: [], sampleLibraryId: "" }));
                                        triggerNotification("媒介已切换为【图像分析】，对应要素已被重置。");
                                      }}
                                      className={`flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${templateForm.type === "image"
                                        ? "bg-cyan-950/40 border-cyan-800 text-cyan-400"
                                        : "bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300"
                                        }`}
                                    >
                                      <Camera className="h-3.5 w-3.5" />
                                      图像分析
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTemplateForm(prev => ({ ...prev, type: "audio", skillIds: [], sampleLibraryId: "" }));
                                        triggerNotification("媒介已切换为【音频声学】，对应要素已被重置。");
                                      }}
                                      className={`flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${templateForm.type === "audio"
                                        ? "bg-cyan-950/40 border-cyan-800 text-cyan-400"
                                        : "bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300"
                                        }`}
                                    >
                                      <Mic className="h-3.5 w-3.5" />
                                      音频声学
                                    </button>
                                  </div>
                                </div>
                              )}

                              {node.type === "skills" && (
                                <div className="space-y-1.5">
                                  {activeSkills.length > 0 ? (
                                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                      {activeSkills.map(skill => (
                                        <div key={skill.id} className="flex items-center justify-between bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg text-[10px] text-slate-300">
                                          <span className="truncate max-w-[150px] font-bold">{skill.name}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedIds = (node.skillIds || []).filter(id => id !== skill.id);
                                              setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, skillIds: updatedIds } : n));
                                              triggerNotification(`已卸载技能: ${skill.name}`);
                                            }}
                                            className="text-slate-500 hover:text-red-400 font-bold ml-1.5 transition-all"
                                            title="卸载技能"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex-1 border border-dashed border-slate-850 rounded-xl p-2.5 flex flex-col items-center justify-center text-center bg-slate-950/20">
                                      <Zap className="h-4 w-4 text-slate-600 animate-bounce" />
                                      <span className="text-[9px] text-slate-500 mt-1 font-bold">拖动算法技能到此卡片上</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {node.type === "sample" && (
                                <div className="space-y-1.5">
                                  {currentLib ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded-lg border border-slate-850">
                                        <div className="flex flex-col truncate">
                                          <span className="text-[10px] font-bold text-slate-200 truncate">{currentLib.name}</span>
                                          <span className="text-[8px] text-slate-500">{currentLib.samples?.length || 0} 个样本片</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, sampleLibraryId: "" } : n));
                                            triggerNotification("已卸载对照样本库。");
                                          }}
                                          className="text-slate-500 hover:text-red-400 p-0.5"
                                          title="解除绑定"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>

                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">自选检索策略:</span>
                                        <select
                                          value={node.sampleLoadRule || "all"}
                                          onChange={(e) => {
                                            const rule = e.target.value as any;
                                            setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, sampleLoadRule: rule } : n));
                                          }}
                                          className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1 px-1.5 text-[9px] text-emerald-400 font-bold focus:outline-none"
                                        >
                                          <option value="all">全量装载 (All)</option>
                                          <option value="top-3">高相似度 Top-3</option>
                                          <option value="random-1">随机推荐 1 条</option>
                                          <option value="none">暂不关联</option>
                                        </select>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex-1 border border-dashed border-slate-850 rounded-xl p-2.5 flex flex-col items-center justify-center text-center bg-slate-950/20">
                                      <Database className="h-4 w-4 text-slate-600 animate-bounce" />
                                      <span className="text-[9px] text-slate-500 mt-1 font-bold">拖动样本库到此卡片上</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {node.type === "agent" && (
                                <div className="space-y-1.5">
                                  {currentAgent ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded-lg border border-slate-850">
                                        <div className="flex flex-col truncate">
                                          <span className="text-[10px] font-bold text-slate-200 truncate">{currentAgent.name}</span>
                                          <span className="text-[8px] text-slate-400 font-mono">模型: {currentAgent.model}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, agentId: "" } : n));
                                            triggerNotification("已解绑决策智能体。");
                                          }}
                                          className="text-slate-500 hover:text-red-400 p-0.5"
                                          title="解除绑定"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                      <p className="text-[8px] text-slate-500 line-clamp-1 bg-slate-950/40 p-1 rounded border border-slate-850/50">
                                        {currentAgent.systemInstruction}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="flex-1 border border-dashed border-slate-850 rounded-xl p-2 flex flex-col items-center justify-center text-center bg-slate-950/20">
                                      <Bot className="h-4 w-4 text-slate-600 animate-bounce" />
                                      <span className="text-[9px] text-slate-500 mt-1 font-bold">拖动智能体到此卡片上</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {node.type === "router" && (
                                <div className="space-y-1.5">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">分流逻辑判定规则 Prompt:</span>
                                  <textarea
                                    value={node.routerRule || ""}
                                    rows={2}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, routerRule: val } : n));
                                    }}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500 custom-scrollbar resize-none"
                                    placeholder="输入具体的判断规则..."
                                  />
                                </div>
                              )}

                              {node.type === "merge" && (
                                <div className="space-y-1.5">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">汇聚整合算法模式:</span>
                                  <select
                                    value={node.mergeMode || "parallel"}
                                    onChange={(e) => {
                                      const mode = e.target.value as any;
                                      setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, mergeMode: mode } : n));
                                    }}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1 px-1.5 text-[10px] text-pink-400 font-bold focus:outline-none"
                                  >
                                    <option value="parallel">并发融合同步决策 (Parallel)</option>
                                    <option value="sequence">顺序级联迭代审核 (Sequence)</option>
                                  </select>
                                </div>
                              )}

                              {node.type === "output" && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[9px]">
                                    <span className="text-slate-500">拓扑状态:</span>
                                    <span className="text-green-400 font-bold">● 活动就绪</span>
                                  </div>
                                  <p className="text-[8.5px] text-slate-500 leading-tight">
                                    整合多路分支认知成果，输出安全评估报告。
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Connection Ports */}
                            {node.type !== "input" && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (connectingFrom && connectingFrom !== node.id) {
                                    handleCreateConnection(connectingFrom, node.id);
                                  }
                                }}
                                className={`absolute top-[50%] translate-y-[-50%] left-[-7px] h-3.5 w-3.5 rounded-full border border-slate-950 transition-all z-20 ${!!connectingFrom && connectingFrom !== node.id
                                  ? "bg-amber-400 scale-125 animate-ping"
                                  : "bg-slate-700 hover:bg-slate-400 hover:scale-125"
                                  }`}
                                title={connectingFrom ? "点击建立链路连接" : "输入端口"}
                              />
                            )}
                            {node.type !== "output" && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (connectingFrom === node.id) {
                                    setConnectingFrom(null);
                                  } else {
                                    setConnectingFrom(node.id);
                                    triggerNotification(`已选择输出端【${node.name}】。请点击其它节点的输入端（左侧圆点）建立连接`);
                                  }
                                }}
                                className={`absolute top-[50%] translate-y-[-50%] right-[-7px] h-3.5 w-3.5 rounded-full border border-slate-950 shadow-lg transition-all z-20 ${connectingFrom === node.id
                                  ? "bg-amber-400 scale-125 animate-pulse shadow-[0_0_12px_#fbbf24]"
                                  : "bg-slate-500 hover:bg-slate-400 hover:scale-125"
                                  }`}
                                title="引出连接线"
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* --- CONTEXT MENU FOR ADDING OR DELETING CUSTOM NODES --- */}
                      {contextMenu && contextMenu.visible && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent cursor-default"
                            onMouseDown={() => setContextMenu(null)}
                          />
                          <div
                            className="absolute bg-slate-950 border border-slate-850 p-1.5 rounded-2xl shadow-2xl z-50 min-w-[200px] backdrop-blur-md animate-scale-up"
                            style={{
                              left: `${contextMenu.x}px`,
                              top: `${contextMenu.y}px`,
                              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)"
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            {contextMenu.type === "canvas" ? (
                              <div className="space-y-1">
                                <div className="text-[9px] font-bold text-slate-500 uppercase px-2.5 py-1.5 tracking-wider border-b border-slate-900/60 flex items-center gap-1.5">
                                  <Plus className="h-3 w-3 text-blue-400" />
                                  画布快捷菜单
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddNode("skills", { x: contextMenu.x, y: contextMenu.y });
                                    setContextMenu(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-amber-950/45 text-xs text-slate-300 hover:text-amber-300 flex items-center gap-2 transition-all cursor-pointer font-medium"
                                >
                                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                                  + 认知分析技能节点 (Skills)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddNode("sample", { x: contextMenu.x, y: contextMenu.y });
                                    setContextMenu(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-emerald-950/45 text-xs text-slate-300 hover:text-emerald-300 flex items-center gap-2 transition-all cursor-pointer font-medium"
                                >
                                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                                  + 对照参考样本节点 (Sample)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddNode("agent", { x: contextMenu.x, y: contextMenu.y });
                                    setContextMenu(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-purple-950/45 text-xs text-slate-300 hover:text-purple-300 flex items-center gap-2 transition-all cursor-pointer font-medium"
                                >
                                  <Bot className="h-3.5 w-3.5 text-purple-400" />
                                  + 决策诊断智能节点 (Agent)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddNode("router", { x: contextMenu.x, y: contextMenu.y });
                                    setContextMenu(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-blue-950/45 text-xs text-slate-300 hover:text-blue-300 flex items-center gap-2 transition-all cursor-pointer font-medium"
                                >
                                  <Workflow className="h-3.5 w-3.5 text-blue-400" />
                                  + 决策分流判定节点 (Router)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddNode("merge", { x: contextMenu.x, y: contextMenu.y });
                                    setContextMenu(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-pink-950/45 text-xs text-slate-300 hover:text-pink-300 flex items-center gap-2 transition-all cursor-pointer font-medium"
                                >
                                  <Layers className="h-3.5 w-3.5 text-pink-400" />
                                  + 多路并联汇聚节点 (Merge)
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-[9px] font-bold text-slate-500 uppercase px-2.5 py-1.5 tracking-wider border-b border-slate-900/60 flex items-center gap-1.5">
                                  <Wrench className="h-3 w-3 text-purple-400" />
                                  节点快捷操作
                                </div>
                                {contextMenu.targetId === "input" || contextMenu.targetId === "output" ? (
                                  <div className="px-2.5 py-1.5 text-[10px] text-slate-500 italic">
                                    基础终端节点不可删除
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (contextMenu.targetId) {
                                        handleDeleteNode(contextMenu.targetId);
                                      }
                                      setContextMenu(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-red-950/40 text-xs text-red-400 hover:text-red-350 flex items-center gap-2 transition-all cursor-pointer font-medium"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                                    删除此流程节点 (Delete)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* --- GLOBAL WORKFLOW OVERVIEW MINIMAP --- */}
                    <div className="mt-4 shrink-0 bg-[#050811]/60 backdrop-blur-xl border border-white/5 p-5 rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden group/minimap">
                      {/* Decorative elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[60px] pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                            <Eye className="h-5 w-5 text-cyan-400 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-100 flex items-center gap-2 tracking-tight">
                              全局流程资产概览
                              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-mono border border-cyan-500/20 uppercase tracking-widest">
                                Radar
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              实时监控画布节点拓扑。当前已部署: <span className="text-cyan-400 font-bold font-mono">{canvasNodes.length}</span> 节点
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Legend details - Refined */}
                          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-950/40 border border-white/5 rounded-2xl">
                            {[
                              { label: '输入', color: 'bg-cyan-500' },
                              { label: '技能', color: 'bg-amber-500' },
                              { label: '样本', color: 'bg-emerald-500' },
                              { label: 'Agent', color: 'bg-purple-500' },
                              { label: '分流', color: 'bg-blue-500' },
                              { label: '汇聚', color: 'bg-pink-500' },
                              { label: '输出', color: 'bg-rose-500' }
                            ].map((item) => (
                              <span key={item.label} className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                <span className={`w-1.5 h-1.5 rounded-full ${item.color} shadow-[0_0_8px_${item.color.replace('bg-', 'rgba(')},0.4)]`} />
                                {item.label}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (canvasRef.current) {
                                canvasRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                                triggerNotification("视口已重置到画布起点！");
                              }
                            }}
                            className="text-[10px] font-black bg-slate-950 hover:bg-cyan-500 text-slate-400 hover:text-white border border-white/5 hover:border-cyan-400 px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 group/reset"
                          >
                            <Undo className="h-3.5 w-3.5 group-hover/reset:-rotate-45 transition-transform" />
                            重置视角
                          </button>
                        </div>
                      </div>

                      {/* Minimap Track Canvas Area - Elevated HUD Style */}
                      <div
                        className="relative w-full h-[140px] bg-[#020306] border border-white/5 rounded-[1.5rem] overflow-hidden cursor-crosshair group/track select-none shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)]"
                        onMouseDown={handleMinimapMouseDown}
                        onMouseMove={handleMinimapMouseMove}
                        onMouseUp={handleMinimapMouseUp}
                        onMouseLeave={handleMinimapMouseUp}
                      >
                        {/* Advanced Grid Background */}
                        <div className="absolute inset-0 opacity-[0.1] grid-bg pointer-events-none scale-110" />
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500 via-transparent to-transparent" />

                        {/* Scanline Effect */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-40 bg-[length:100%_2px,3px_100%]" />

                        {/* Render tiny representation of current connections as elegant paths */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                          <defs>
                            <linearGradient id="miniLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="rgba(34,211,238,0.2)" />
                              <stop offset="50%" stopColor="rgba(34,211,238,0.5)" />
                              <stop offset="100%" stopColor="rgba(34,211,238,0.2)" />
                            </linearGradient>
                          </defs>
                          {(templateForm.connections || [])
                            .filter(conn => canvasNodes.some(n => n.id === conn.from) && canvasNodes.some(n => n.id === conn.to))
                            .map((conn, idx) => {
                              const fromNode = canvasNodes.find(n => n.id === conn.from);
                              const toNode = canvasNodes.find(n => n.id === conn.to);
                              if (!fromNode || !toNode) return null;

                              const fromPos = nodePositions[fromNode.id] || { x: fromNode.x, y: fromNode.y };
                              const toPos = nodePositions[toNode.id] || { x: toNode.x, y: toNode.y };

                              const sx = (fromPos.x / 1500) * 100;
                              const sy = (fromPos.y / 500) * 100;
                              const ex = (toPos.x / 1500) * 100;
                              const ey = (toPos.y / 500) * 100;

                              return (
                                <line
                                  key={`mini-line-${idx}`}
                                  x1={`${sx}%`}
                                  y1={`${sy}%`}
                                  x2={`${ex}%`}
                                  y2={`${ey}%`}
                                  stroke="url(#miniLineGradient)"
                                  strokeWidth="1"
                                  className="opacity-40"
                                />
                              );
                            })}
                        </svg>

                        {/* Render tiny representation of current nodes - Glowy Dots */}
                        {canvasNodes.map((node) => {
                          const pos = nodePositions[node.id] || { x: node.x, y: node.y };
                          const pctX = (pos.x / 1500) * 100;
                          const pctY = (pos.y / 500) * 100;

                          // Color mapping by type - Enhanced
                          let nodeBg = "from-slate-500 to-slate-600";
                          let shadowColor = "rgba(100,116,139,0.5)";

                          if (node.type === "input") { nodeBg = "from-cyan-400 to-cyan-600"; shadowColor = "rgba(34,211,238,0.5)"; }
                          else if (node.type === "output") { nodeBg = "from-rose-400 to-rose-600"; shadowColor = "rgba(244,63,94,0.5)"; }
                          else if (node.type === "skills") { nodeBg = "from-amber-400 to-amber-600"; shadowColor = "rgba(245,158,11,0.5)"; }
                          else if (node.type === "sample") { nodeBg = "from-emerald-400 to-emerald-600"; shadowColor = "rgba(16,185,129,0.5)"; }
                          else if (node.type === "agent") { nodeBg = "from-purple-400 to-purple-600"; shadowColor = "rgba(168,85,247,0.5)"; }
                          else if (node.type === "router") { nodeBg = "from-blue-400 to-blue-600"; shadowColor = "rgba(59,130,246,0.5)"; }
                          else if (node.type === "merge") { nodeBg = "from-pink-400 to-pink-600"; shadowColor = "rgba(236,72,153,0.5)"; }

                          return (
                            <div
                              key={`mini-node-${node.id}`}
                              className={`absolute rounded-sm bg-gradient-to-br ${nodeBg} opacity-90 transition-all z-20 pointer-events-none`}
                              style={{
                                left: `${pctX}%`,
                                top: `${pctY}%`,
                                width: `${(getNodeDimensions(node.id, node.type).w / 1500) * 100}%`,
                                height: `${(getNodeDimensions(node.id, node.type).h / 500) * 100}%`,
                                boxShadow: `0 0 6px ${shadowColor}`,
                              }}
                            />
                          );
                        })}

                        {/* Render the viewport overlay frame - HUD Viewfinder Style */}
                        {(() => {
                          const frameLeft = (viewportState.scrollLeft / 1500) * 100;
                          const frameTop = (viewportState.scrollTop / 500) * 100;
                          const frameWidth = (viewportState.clientWidth / 1500) * 100;
                          const frameHeight = (viewportState.clientHeight / 500) * 100;

                          return (
                            <div
                              className="absolute border border-cyan-400/50 bg-cyan-400/5 rounded-xl pointer-events-none transition-all z-30 shadow-[0_0_25px_rgba(34,211,238,0.1)] group-hover/track:border-cyan-400"
                              style={{
                                left: `${Math.max(0, Math.min(100 - frameWidth, frameLeft))}%`,
                                top: `${Math.max(0, Math.min(100 - frameHeight, frameTop))}%`,
                                width: `${Math.min(100, frameWidth)}%`,
                                height: `${Math.min(100, frameHeight)}%`,
                              }}
                            >
                              {/* Corner accents */}
                              <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
                              <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
                              <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
                              <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />

                              {/* Center crosshair indicator */}
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 opacity-20 flex items-center justify-center">
                                <div className="absolute w-full h-[1px] bg-cyan-400" />
                                <div className="absolute h-full w-[1px] bg-cyan-400" />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3: Direct fields in expandable layout below flowchart */}
                <div className="bg-slate-900/20 backdrop-blur-sm border border-white/5 p-6 rounded-3xl space-y-6 shadow-inner relative group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20 rounded-full group-hover:bg-blue-500/40 transition-colors" />
                  <div className="text-xs font-black text-slate-200 flex items-center gap-2 uppercase tracking-widest">
                    <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Sliders className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    第三步：装调分析交互提示语参数
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4 space-y-2">
                      <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">UI 容器上传指引占位符</label>
                      <input
                        type="text"
                        value={templateForm.placeholder || ""}
                        onChange={(e) => setTemplateForm({ ...templateForm, placeholder: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
                        placeholder="如: 第一步：请点击或拖拽上传车间黄线通道实拍图像..."
                      />
                    </div>
                    <div className="md:col-span-8 space-y-2">
                      <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">基础智能分析指令 Prompt (作为研判底层注入)</label>
                      <textarea
                        value={templateForm.defaultPrompt || ""}
                        rows={3}
                        onChange={(e) => setTemplateForm({ ...templateForm, defaultPrompt: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700 custom-scrollbar resize-none"
                        placeholder="写入 AI 的底层默认分析 Prompt 规整指南"
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-4 border-t border-white/5 pt-8">
                  <button
                    type="button"
                    onClick={() => { setEditingTemplateId(null); setIsAddingTemplate(false); }}
                    className="bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-black py-3 px-8 rounded-xl border border-white/5 transition-all cursor-pointer active:scale-95"
                  >
                    取消装调
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-black py-3 px-10 rounded-xl transition-all shadow-[0_10px_25px_-8px_rgba(37,99,235,0.5)] hover:shadow-[0_15px_30px_-8px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 flex items-center gap-2.5 cursor-pointer active:scale-95"
                  >
                    <Save className="h-4 w-4" />
                    保存并封包研判工作流模板
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-PANEL 2: SAMPLE LIBRARY MAINTENANCE */}
      {activeSubTab === "libraries" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {!editingLibraryId && !isAddingLibrary ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-transparent p-5 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-xl relative overflow-hidden group/header">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 group-hover/header:rotate-12 transition-transform duration-500">
                    <Database className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-100 tracking-tight uppercase">
                      标准分析及诊断参考样本库 <span className="text-emerald-400 font-mono ml-2">[{configs.samples.length}]</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 tracking-wide">维护用于大模型对比推理的专业领域视觉/音频基准数据集</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartAddLibrary}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-black py-3 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] hover:shadow-[0_15px_30px_-8px_rgba(16,185,129,0.7)] hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  创设新样本库
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {configs.samples.map((lib) => (
                  <div
                    key={lib.id}
                    className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[1.5rem] flex flex-col justify-between hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] hover:-translate-y-1.5 relative overflow-hidden"
                  >
                    {/* 3D Glass Effects */}
                    <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] group-hover:bg-emerald-500/10 transition-colors" />
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border shadow-sm ${lib.type === "image"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10"
                          : lib.type === "audio"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/10"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-500/10"
                          }`}>
                          {lib.type === "image" ? "图像资产" : lib.type === "audio" ? "音频指纹" : "混合"}
                        </span>
                        <div className="px-2 py-0.5 bg-slate-950/60 border border-white/5 rounded-full shadow-inner">
                          <span className="text-[9px] text-slate-500 font-mono font-black tracking-tighter">
                            <span className="text-emerald-400">{lib.samples?.length || 0}</span> DATA
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="font-black text-slate-100 text-sm tracking-tight group-hover:text-emerald-400 transition-colors truncate">
                          {lib.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium italic">
                          {lib.description || '暂无描述信息...'}
                        </p>
                      </div>

                      {/* Mini thumbnails - Elevated Display */}
                      <div className="bg-slate-950/80 border border-white/5 p-3 rounded-2xl flex items-center gap-2.5 overflow-x-auto custom-scrollbar shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group/info">
                        {lib.samples && lib.samples.map((item, idx) => (
                          <button
                            type="button"
                            key={item.id || idx}
                            onClick={() => setPreviewSample(item)}
                            className="h-12 w-12 rounded-xl bg-slate-900 border border-white/5 hover:border-emerald-500/60 shrink-0 overflow-hidden flex items-center justify-center text-[10px] text-slate-500 font-mono cursor-pointer transition-all duration-500 relative group/thumb hover:-translate-y-1 hover:shadow-xl active:scale-90"
                            title={`预览: ${item.name}`}
                          >
                            {item.data ? (
                              <>
                                <img src={item.data} className="h-full w-full object-cover group-hover/thumb:scale-125 transition-transform duration-700" alt="sample" referrerPolicy="no-referrer" />
                                {item.audioData && (
                                  <div className="absolute bottom-1 right-1 bg-emerald-500 p-0.5 rounded shadow-lg animate-pulse">
                                    <Volume2 className="h-2 w-2 text-white" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-emerald-500/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all duration-500 backdrop-blur-[1px]">
                                  <Eye className="h-4 w-4 text-white drop-shadow-lg" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Mic className="h-4 w-4 text-emerald-400" />
                                <span className="text-[7px] font-black tracking-widest text-emerald-500/80 uppercase">Wave</span>
                              </div>
                            )}
                          </button>
                        ))}
                        {(!lib.samples || lib.samples.length === 0) && (
                          <div className="text-[9px] text-slate-600 italic py-2 font-bold w-full text-center tracking-widest opacity-50">EMPTY</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-5 border-t border-white/5 relative z-10">
                      <button
                        type="button"
                        onClick={() => handleDeleteLibrary(lib.id)}
                        className="p-2.5 bg-slate-950 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-slate-600 hover:text-red-400 rounded-xl transition-all duration-300 cursor-pointer shadow-lg active:scale-90"
                        title="删除样本库"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditLibrary(lib)}
                        className="flex-1 ml-3 py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-400 rounded-xl transition-all duration-500 cursor-pointer text-[10px] font-black flex items-center justify-center gap-2 shadow-lg group/btn"
                      >
                        <Edit3 className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
                        样本维护
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Edit Library Form and individual samples manager
            <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-emerald-500/5 blur-[100px] pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner">
                    <Database className="h-6 w-6 text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-slate-100 tracking-tight">
                      {isAddingLibrary ? "📂 创建全新参考对比样本库" : `📂 维护样本库: ${libraryForm.name}`}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">维护用于大模型对比推理的专业领域标准对比实证样本或声学特征文件</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingLibraryId(null); setIsAddingLibrary(false); }}
                  className="text-xs text-slate-400 hover:text-white font-black flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-white/5 px-5 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg active:scale-95 cursor-pointer"
                >
                  <Undo className="h-4 w-4" /> 返回列表
                </button>
              </div>

              {/* Base Metadata Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">唯一识别 ID</label>
                  <input
                    type="text"
                    disabled={!isAddingLibrary}
                    value={libraryForm.id || ""}
                    onChange={(e) => setLibraryForm({ ...libraryForm, id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all disabled:opacity-40 placeholder:text-slate-700"
                    placeholder="例如: lib-hazard-ppe"
                  />
                </div>

                <div className="md:col-span-5 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">标准对照库名称</label>
                  <input
                    type="text"
                    value={libraryForm.name || ""}
                    onChange={(e) => setLibraryForm({ ...libraryForm, name: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-700"
                    placeholder="例如: 压力表异常读数基准样本库"
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">支持的样本形态</label>
                  <select
                    disabled={!isAddingLibrary}
                    value={libraryForm.type || "image"}
                    onChange={(e) => setLibraryForm({ ...libraryForm, type: e.target.value as any })}
                    className="w-full bg-slate-950/80 border border-white/5 text-slate-100 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <option value="image">图像文件 (Images)</option>
                    <option value="audio">声音录音 (Audios)</option>
                  </select>
                </div>

                <div className="md:col-span-12 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">样本库描述</label>
                  <textarea
                    rows={2}
                    value={libraryForm.description || ""}
                    onChange={(e) => setLibraryForm({ ...libraryForm, description: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all resize-none placeholder:text-slate-700 custom-scrollbar"
                    placeholder="简要说明此库主要存储哪些比对维度的实证样本..."
                  />
                </div>
              </div>

              {/* INDIVIDUAL SAMPLES LIST SECTION */}
              <div className="border-t border-white/5 pt-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs font-black text-slate-200 flex items-center gap-2 uppercase tracking-widest">
                    <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    已关联对比样本片（共 {libraryForm.samples?.length || 0} 个）
                  </div>
                  {!isAddingSampleItem && (
                    <button
                      type="button"
                      onClick={() => setIsAddingSampleItem(true)}
                      className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] hover:shadow-[0_12px_25px_-6px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 active:scale-95 cursor-pointer animate-fade-in"
                    >
                      <Plus className="h-4 w-4" />
                      追加新单例样本
                    </button>
                  )}
                </div>

                {/* Adding new item panel */}
                {isAddingSampleItem && (
                  <div className="bg-slate-950/80 border border-white/5 p-6 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden group/newitem">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400/40" />
                    <div className="text-xs font-black text-emerald-400 flex items-center gap-2 uppercase tracking-widest border-b border-white/5 pb-4">
                      <PlusCircle className="h-4 w-4" />
                      新增标准对比参考样本 (支持图像或音频素材)
                    </div>

                    <div className="space-y-6">
                      {/* Name input */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">样本对比项名称</label>
                        <input
                          type="text"
                          value={sampleItemForm.name || ""}
                          onChange={(e) => setSampleItemForm({ ...sampleItemForm, name: e.target.value })}
                          className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-700"
                          placeholder="例如: 压力表超量程红色警戒范例 / 电机主轴承滚道磨损高频尖锐啸叫音"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Image file section */}
                        <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl space-y-4">
                          <span className="text-[10px] font-black text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                            <Camera className="h-4 w-4 text-cyan-400" />
                            1. 参考标准对比图片 (可选)
                          </span>

                          <input
                            type="text"
                            value={sampleItemForm.data || ""}
                            onChange={(e) => setSampleItemForm({ ...sampleItemForm, data: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
                            placeholder="输入 HTTPS 图像地址 或 选择本地上传"
                          />

                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id="new-sample-image-uploader"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (!file.type.startsWith("image/")) {
                                  alert("请上传有效的图片格式文件！");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setSampleItemForm(prev => ({
                                    ...prev,
                                    data: reader.result as string,
                                    name: prev.name || file.name.split('.')[0]
                                  }));
                                  triggerNotification(`已载入本地图片: ${file.name}`);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <label
                              htmlFor="new-sample-image-uploader"
                              className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-emerald-500/30 text-slate-200 text-[10px] font-black rounded-xl cursor-pointer transition-all select-none shadow-md hover:-translate-y-0.5"
                            >
                              <Upload className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                              选择本地图片
                            </label>

                            {sampleItemForm.data && (
                              <button
                                type="button"
                                onClick={() => setSampleItemForm(prev => ({ ...prev, data: "" }))}
                                className="text-red-400 hover:text-red-300 text-[10px] font-bold bg-red-950/30 hover:bg-red-950/50 border border-red-900/20 px-3 py-1.5 rounded-lg transition-all"
                              >
                                清除图片
                              </button>
                            )}
                          </div>

                          {/* Image preview box */}
                          {sampleItemForm.data && (
                            <div className="border border-white/5 bg-slate-950 p-2 rounded-xl flex items-center justify-center max-h-[140px] overflow-hidden shadow-inner">
                              <img src={sampleItemForm.data} className="max-h-[120px] object-contain rounded-lg" alt="Uploaded Thumbnail" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>

                        {/* Audio file section */}
                        <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl space-y-4">
                          <span className="text-[10px] font-black text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                            <Mic className="h-4 w-4 text-blue-400" />
                            2. 参考标准对比声音 (可选)
                          </span>

                          <input
                            type="text"
                            value={sampleItemForm.audioData || ""}
                            onChange={(e) => setSampleItemForm({ ...sampleItemForm, audioData: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
                            placeholder="输入 HTTPS 音频地址 或 选择本地上传"
                          />

                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              id="new-sample-audio-uploader"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (!file.type.startsWith("audio/")) {
                                  alert("请上传有效的音频格式文件！");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setSampleItemForm(prev => ({
                                    ...prev,
                                    audioData: reader.result as string,
                                    name: prev.name || file.name.split('.')[0]
                                  }));
                                  triggerNotification(`已载入本地音频: ${file.name}`);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <label
                              htmlFor="new-sample-audio-uploader"
                              className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-emerald-500/30 text-slate-200 text-[10px] font-black rounded-xl cursor-pointer transition-all select-none shadow-md hover:-translate-y-0.5"
                            >
                              <Upload className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                              选择本地音频
                            </label>

                            {sampleItemForm.audioData && (
                              <button
                                type="button"
                                onClick={() => setSampleItemForm(prev => ({ ...prev, audioData: "" }))}
                                className="text-red-400 hover:text-red-300 text-[10px] font-bold bg-red-950/30 hover:bg-red-950/50 border border-red-900/20 px-3 py-1.5 rounded-lg transition-all"
                              >
                                清除音频
                              </button>
                            )}
                          </div>

                          {/* Audio player box */}
                          {sampleItemForm.audioData && (
                            <div className="border border-white/5 bg-slate-950 p-2 rounded-xl shadow-inner">
                              <audio src={sampleItemForm.audioData} controls className="w-full h-8 rounded" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description input */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">样本特征规范与诊断特征描述</label>
                        <textarea
                          rows={3}
                          value={sampleItemForm.description || ""}
                          onChange={(e) => setSampleItemForm({ ...sampleItemForm, description: e.target.value })}
                          className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all resize-none leading-relaxed placeholder:text-slate-700 custom-scrollbar"
                          placeholder="在此详细说明该标准样板的工艺状态或频段声学特征。专家智能体在进行实时分析诊断时，会自动检索对比本描述规范！"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsAddingSampleItem(false)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] font-black py-2 px-5 rounded-lg border border-white/5 cursor-pointer transition-all active:scale-95"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSampleItem}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black py-2 px-6 rounded-lg cursor-pointer transition-all shadow-md active:scale-95"
                      >
                        追加进比对队列
                      </button>
                    </div>
                  </div>
                )}

                {/* Samples stack table list */}
                <div className="space-y-3">
                  {(!libraryForm.samples || libraryForm.samples.length === 0) ? (
                    <div className="text-center p-8 bg-slate-950/60 border border-white/5 rounded-2xl text-slate-500 text-xs italic tracking-wide">
                      此样本库中目前没有任何比对标准案例，请点击右上方“追加新单例样本”开始录入。
                    </div>
                  ) : (
                    libraryForm.samples.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-4 bg-slate-900/40 backdrop-blur-sm border border-white/5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between hover:border-emerald-500/35 hover:bg-slate-900/60 transition-all duration-300 shadow-sm relative overflow-hidden group/item"
                      >
                        <div className="flex items-center gap-4 flex-1 overflow-hidden">
                          {/* Left media visualizer with hover indicator */}
                          <button
                            type="button"
                            onClick={() => setPreviewSample(item)}
                            className="h-16 w-16 rounded-xl bg-slate-950 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center text-xl hover:border-emerald-500/60 transition-all cursor-pointer relative group/thumb shadow-md"
                            title="点击放大预览/播放"
                          >
                            {libraryForm.type === "image" && item.data ? (
                              <>
                                <img src={item.data} className="h-full w-full object-cover group-hover/thumb:scale-110 transition-transform duration-500" alt="sample preview" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye className="h-4 w-4" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-lg group-hover/thumb:scale-110 transition-transform">🎙️</span>
                                <span className="text-[8px] font-mono text-emerald-500/80 font-bold tracking-widest uppercase">Wave</span>
                              </div>
                            )}
                          </button>

                          <div className="space-y-1 flex-1 overflow-hidden">
                            <span className="text-sm font-black text-slate-100 group-hover/item:text-emerald-400 transition-colors block">{item.name}</span>
                            <p className="text-xs text-slate-400 leading-relaxed font-medium line-clamp-2">{item.description}</p>

                            {/* Inline Audio Player for audio samples */}
                            {libraryForm.type === "audio" && item.data && (
                              <div className="pt-2 max-w-xs sm:max-w-md">
                                <audio
                                  src={item.data}
                                  controls
                                  className="w-full h-8 rounded-lg opacity-85 hover:opacity-100 transition-opacity bg-slate-950 border border-white/5"
                                />
                              </div>
                            )}

                            <span className="text-[9px] text-slate-600 font-mono line-clamp-1 block pt-1 select-all">资源路径: {item.data ? (item.data.startsWith("data:") ? "本地 Base64 数据编码" : item.data) : "未关联物理实体数据"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:self-center shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 mt-3 sm:mt-0">
                          <button
                            type="button"
                            onClick={() => setPreviewSample(item)}
                            className="p-2.5 bg-slate-950 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-xl transition-all cursor-pointer shadow-md"
                            title="预览/播放样本"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSampleItem(item.id)}
                            className="p-2.5 bg-slate-950 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-xl transition-all cursor-pointer shadow-md"
                            title="永久移除样本"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Master save footer */}
              <div className="flex justify-end gap-4 border-t border-white/5 pt-8">
                <button
                  type="button"
                  onClick={() => { setEditingLibraryId(null); setIsAddingLibrary(false); }}
                  className="bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-black py-3 px-8 rounded-xl border border-white/5 transition-all cursor-pointer active:scale-95"
                >
                  放弃修改
                </button>
                <button
                  type="button"
                  onClick={handleSaveLibrary}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black py-3 px-10 rounded-xl transition-all shadow-[0_10px_25px_-8px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_30px_-8px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 flex items-center gap-2.5 cursor-pointer active:scale-95"
                >
                  <Save className="h-4 w-4" />
                  保存整个样本库配置
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-PANEL 3: AI AGENT CONFIGURATION */}
      {activeSubTab === "agents" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {!editingAgentId && !isAddingAgent ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-transparent p-5 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-xl relative overflow-hidden group/header">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-purple-500/20 border border-purple-500/30 group-hover/header:rotate-12 transition-transform duration-500">
                    <Bot className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-100 tracking-tight uppercase">
                      专家模型智能体核心资产 <span className="text-purple-400 font-mono ml-2">[{configs.agents.length}]</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 tracking-wide">配置具备特定业务逻辑认知与推理能力的 AI Agent 实例</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartAddAgent}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-black py-3 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-[0_10px_25px_-8px_rgba(168,85,247,0.6)] hover:shadow-[0_15px_30px_-8px_rgba(168,85,247,0.7)] hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  创建新智能体 (Agent)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {configs.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[1.5rem] flex flex-col justify-between hover:border-purple-500/40 hover:bg-slate-900/70 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] hover:-translate-y-1.5 relative overflow-hidden"
                  >
                    {/* 3D Glass Effects */}
                    <div className="absolute -top-16 -right-16 w-32 h-32 bg-purple-500/5 rounded-full blur-[40px] group-hover:bg-purple-500/10 transition-colors" />
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-lg font-mono font-black tracking-[0.1em] shadow-sm">
                          {agent.model.split('-').slice(0, 2).join('-').toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2 bg-slate-950/60 border border-white/5 px-2 py-1 rounded-xl shadow-inner">
                          <div className="flex flex-col items-end">
                            <span className="text-[6px] text-slate-500 font-black uppercase tracking-tighter">Temp</span>
                            <span className="text-[9px] text-purple-400 font-mono font-bold leading-none">{agent.temperature}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-black text-slate-100 text-sm tracking-tight group-hover:text-purple-400 transition-colors flex items-center gap-2 truncate">
                          <div className="h-6 w-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner">
                            <Bot className="h-3.5 w-3.5 text-purple-400" />
                          </div>
                          {agent.name}
                        </h4>
                        <div className="bg-slate-950/80 border border-white/5 p-4 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden group/info min-h-[80px] flex flex-col justify-center">
                          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]" />
                          <div className="text-[10px] text-slate-400 font-medium line-clamp-3 leading-relaxed italic relative z-10">
                            "{agent.systemInstruction}"
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-5 border-t border-white/5 relative z-10">
                      <button
                        type="button"
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-2.5 bg-slate-950 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-slate-600 hover:text-red-400 rounded-xl transition-all duration-300 cursor-pointer shadow-lg active:scale-90"
                        title="删除智能体"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditAgent(agent)}
                        className="flex-1 ml-3 py-2.5 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white border border-purple-500/30 hover:border-purple-400 rounded-xl transition-all duration-500 cursor-pointer text-[10px] font-black flex items-center justify-center gap-2 shadow-lg group/btn"
                      >
                        <Edit3 className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
                        微调人设
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Edit Agent Form
            <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-500/5 blur-[100px] pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <Bot className="h-4 w-4 text-purple-400 animate-pulse" />
                  </div>
                  <h4 className="font-black text-sm text-slate-200 uppercase tracking-wide">
                    {isAddingAgent ? "创建全新诊断智能体" : `微调 Agent: ${agentForm.name}`}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingAgentId(null); setIsAddingAgent(false); }}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-350 bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-white/10 px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Undo className="h-3.5 w-3.5" /> 返回列表
                </button>
              </div>

              {/* Form entries */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                <div className="md:col-span-4 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">智能体唯一 ID</label>
                  <input
                    type="text"
                    disabled={!isAddingAgent}
                    value={agentForm.id || ""}
                    onChange={(e) => setAgentForm({ ...agentForm, id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all disabled:opacity-40 placeholder:text-slate-700"
                    placeholder="例如: agent-custom-ppe"
                  />
                </div>

                <div className="md:col-span-5 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">智能体角色命名</label>
                  <input
                    type="text"
                    value={agentForm.name || ""}
                    onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all placeholder:text-slate-700"
                    placeholder="例如: 红外测温热像深度诊断 Agent"
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">大语言模型基座</label>
                  <select
                    value={agentForm.model || "gemini-2.5-flash"}
                    onChange={(e) => setAgentForm({ ...agentForm, model: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 text-slate-100 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all cursor-pointer"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5-Flash (推荐，高灵敏低时延)</option>
                    <option value="gemini-3.5-flash">Gemini 3.5-Flash (下一代，体验版)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1-Pro (深度精密分析)</option>
                  </select>
                </div>

                {/* System Instruction (HUGE) */}
                <div className="md:col-span-12 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">
                    系统内置人设与核心推理指令 (System Instruction)
                  </label>
                  <textarea
                    rows={8}
                    value={agentForm.systemInstruction || ""}
                    onChange={(e) => setAgentForm({ ...agentForm, systemInstruction: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-4 text-xs text-slate-100 font-mono leading-relaxed resize-y placeholder:text-slate-700 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all custom-scrollbar"
                    placeholder="请输入非常具体的、指导大模型执行多步推理分析的人设指令。"
                  />
                </div>

                {/* Temperature slider */}
                <div className="md:col-span-12 space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">模型采样发散度 (Temperature)</label>
                    <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">{agentForm.temperature}</span>
                  </div>
                  <div className="relative w-full h-2 bg-slate-950 rounded-full border border-white/5 flex items-center">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                      style={{ width: `${(agentForm.temperature ?? 0.1) * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={agentForm.temperature ?? 0.1}
                      onChange={(e) => setAgentForm({ ...agentForm, temperature: parseFloat(e.target.value) })}
                      className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer outline-none focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-125"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-600 font-mono font-bold">
                    <span>0.0 (绝对精准/适合读取仪表)</span>
                    <span>0.5 (适度平衡)</span>
                    <span>1.0 (极度发散)</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-white/5 pt-6 relative z-10">
                <button
                  type="button"
                  onClick={() => { setEditingAgentId(null); setIsAddingAgent(false); }}
                  className="bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200 text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveAgent}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all shadow-[0_10px_20px_-8px_rgba(168,85,247,0.5)] hover:shadow-[0_12px_24px_-6px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  保存 Agent 设定
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-PANEL 4: SPECIALIZED SKILLS MAINTENANCE */}
      {activeSubTab === "skills" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {!editingSkillId && !isAddingSkill ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent p-5 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-xl relative overflow-hidden group/header">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 group-hover/header:rotate-12 transition-transform duration-500">
                    <Zap className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-100 tracking-tight uppercase">
                      专业领域注入技能与微指令库 <span className="text-amber-400 font-mono ml-2">[{configs.skills.length}]</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 tracking-wide">定制用于增强大模型在特定垂直领域执行精度与合规性的指令集</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartAddSkill}
                  className="bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-black py-3 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-[0_10px_25px_-8px_rgba(245,158,11,0.6)] hover:shadow-[0_15px_30px_-8px_rgba(245,158,11,0.7)] hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  定制业务 Skill 技能
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {configs.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[1.5rem] flex flex-col justify-between hover:border-amber-500/40 hover:bg-slate-900/70 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] hover:-translate-y-1.5 relative overflow-hidden"
                  >
                    {/* 3D Glass Effects */}
                    <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-500/5 rounded-full blur-[40px] group-hover:bg-amber-500/10 transition-colors" />
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border shadow-sm ${skill.type === "image"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/10"
                          }`}>
                          {skill.type === "image" ? "视觉 Skill" : "声学 Skill"}
                        </span>
                        <div className="px-2 py-0.5 bg-slate-950/60 border border-white/5 rounded-full shadow-inner">
                          <span className="text-[9px] text-slate-500 font-mono font-bold tracking-tighter">#{skill.id.slice(-6)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-black text-slate-100 text-sm tracking-tight group-hover:text-amber-400 transition-colors flex items-center gap-2 truncate">
                          <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
                            <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                          </div>
                          {skill.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium italic">
                          {skill.description || '暂无描述...'}
                        </p>
                      </div>

                      {/* Display prompt rules inside code block - Elevated Display */}
                      <div className="bg-slate-950/80 border border-white/5 p-4 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden group/info">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                        <div className="text-[10px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap max-h-[100px] overflow-y-auto custom-scrollbar relative z-10 scroll-smooth">
                          {skill.customRules}
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-20" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-5 border-t border-white/5 relative z-10">
                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(skill.id)}
                        className="p-2.5 bg-slate-950 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-slate-600 hover:text-red-400 rounded-xl transition-all duration-300 cursor-pointer shadow-lg active:scale-90"
                        title="删除技能"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditSkill(skill)}
                        className="flex-1 ml-3 py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/30 hover:border-amber-400 rounded-xl transition-all duration-500 cursor-pointer text-[10px] font-black flex items-center justify-center gap-2 shadow-lg group/btn"
                      >
                        <Edit3 className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
                        编辑指令
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Edit Skill Form
            <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-amber-500/5 blur-[100px] pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Zap className="h-4 w-4 text-amber-400 animate-pulse" />
                  </div>
                  <h4 className="font-black text-sm text-slate-200 uppercase tracking-wide">
                    {isAddingSkill ? "定制算法专业新 Skill 技能" : `编写 Skill: ${skillForm.name}`}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingSkillId(null); setIsAddingSkill(false); }}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-350 bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-white/10 px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Undo className="h-3.5 w-3.5" /> 返回列表
                </button>
              </div>

              {/* Form details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                <div className="md:col-span-4 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">业务技能唯一 ID</label>
                  <input
                    type="text"
                    disabled={!isAddingSkill}
                    value={skillForm.id || ""}
                    onChange={(e) => setSkillForm({ ...skillForm, id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all disabled:opacity-40 placeholder:text-slate-700"
                    placeholder="例如: skill-custom-ocr"
                  />
                </div>

                <div className="md:col-span-5 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">技能名称</label>
                  <input
                    type="text"
                    value={skillForm.name || ""}
                    onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all placeholder:text-slate-700"
                    placeholder="例如: 表盘反射眩光过滤认知"
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">技能应用通道类型</label>
                  <select
                    value={skillForm.type || "image"}
                    onChange={(e) => setSkillForm({ ...skillForm, type: e.target.value as any })}
                    className="w-full bg-slate-950/80 border border-white/5 text-slate-100 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all cursor-pointer"
                  >
                    <option value="image">图像诊断 (Image Skills)</option>
                    <option value="audio">声音听力诊断 (Audio Skills)</option>
                  </select>
                </div>

                <div className="md:col-span-12 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">技能主要职能简介</label>
                  <input
                    type="text"
                    value={skillForm.description || ""}
                    onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-xs text-slate-100 font-bold focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all placeholder:text-slate-700"
                    placeholder="用一句话描述此专业技能会在模型处理中发挥怎样的约束或格式提取功能"
                  />
                </div>

                {/* Prompt Injection Rules text area */}
                <div className="md:col-span-12 space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">
                    业务逻辑与 Prompt 注入规则约束 (Custom Prompt Rules)
                  </label>
                  <textarea
                    rows={6}
                    value={skillForm.customRules || ""}
                    onChange={(e) => setSkillForm({ ...skillForm, customRules: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-4 text-xs text-slate-100 font-mono leading-relaxed placeholder:text-slate-700 focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all custom-scrollbar resize-y"
                    placeholder="请输入当模型搭载此业务 Skill 时，需要拼装到 Prompt 内的具体业务规则和指导约束。"
                  />
                  <p className="text-[9px] text-slate-500 leading-relaxed italic">
                    * 编写示例：1. 强制在 JSON 结果项中添加特定的校验百分比；2. 设定必须核对的具体危险源清单；3. 限制返回建议时使用符合工厂标准的专用警示标语。
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-white/5 pt-6 relative z-10">
                <button
                  type="button"
                  onClick={() => { setEditingSkillId(null); setIsAddingSkill(false); }}
                  className="bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200 text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveSkill}
                  className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all shadow-[0_10px_20px_-8px_rgba(245,158,11,0.5)] hover:shadow-[0_12px_24px_-6px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  保存 Skill 规则
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sample Preview Modal Overlay */}
      {previewSample && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between p-4.5 border-b border-slate-850 bg-slate-950/40">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-500 animate-pulse" />
                标准样本详情预览
              </span>
              <button
                type="button"
                onClick={() => setPreviewSample(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden p-4 flex flex-col gap-4 justify-center items-center min-h-[180px]">
                {previewSample.data && (
                  <img
                    src={previewSample.data}
                    alt={previewSample.name}
                    className="max-h-64 object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                )}

                {previewSample.audioData && (
                  <div className="flex flex-col items-center gap-2 w-full pt-2 border-t border-slate-900/60">
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-mono">
                      <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                      标准对比音频播放器
                    </div>
                    <audio src={previewSample.audioData} controls className="w-full max-w-sm h-10 shadow-lg bg-slate-900" autoPlay />
                  </div>
                )}

                {!previewSample.data && !previewSample.audioData && (
                  <div className="text-xs text-slate-500 italic">暂无有效多模态媒介数据</div>
                )}
              </div>

              <div className="space-y-1.5 bg-slate-950/40 border border-slate-900 p-4 rounded-xl">
                <div className="text-xs font-bold text-slate-200">{previewSample.name}</div>
                <div className="text-[11px] text-slate-450 leading-relaxed whitespace-pre-line">{previewSample.description}</div>
                <div className="text-[9px] text-slate-600 font-mono pt-1.5 flex flex-col gap-0.5">
                  <div>资源类型: {previewSample.type === "image" ? "图像" : previewSample.type === "audio" ? "声音" : "多模态双资源"}</div>
                  {previewSample.data && <div className="truncate">图片路径: {previewSample.data.startsWith("data:") ? "Base64 编码数据" : previewSample.data}</div>}
                  {previewSample.audioData && <div className="truncate">音频路径: {previewSample.audioData.startsWith("data:") ? "Base64 编码数据" : previewSample.audioData}</div>}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/40 border-t border-slate-850 p-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPreviewSample(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-5 rounded-xl transition-all shadow-md cursor-pointer"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay */}
      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-[#0b0f19] border border-red-500/20 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_20px_50px_rgba(239,68,68,0.15)]"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5 bg-slate-950/40">
                <span className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                  <Trash2 className="h-4.5 w-4.5 text-red-500 animate-pulse" />
                  确认删除操作
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: "", name: "" })}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl shrink-0">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-100">
                      确定删除 <span className="text-red-400">"{deleteConfirm.name}"</span> 吗？
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {deleteConfirm.type === "agent" && "若有分析模板引用此 Agent 智能体，删除后将可能导致研判分析功能出错。"}
                      {deleteConfirm.type === "skill" && "此操作将永久卸载并删除该 Skill 业务技能。挂载它的场景分析模板将失去该技能能力。"}
                      {deleteConfirm.type === "library" && "此操作将永久清空并删除该样本对比库，不可逆恢复。"}
                      {deleteConfirm.type === "template" && "此操作将从系统中卸载并注销该研判场景模板，用户将无法在主交互界面进行选择或分析。"}
                      {deleteConfirm.type === "sampleItem" && "此操作会将样本素材从当前的编辑列表中移除，您需要点击“保存库”操作以确保修改持久化生效。"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 border-t border-white/5 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: "", name: "" })}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold py-2.5 px-5 rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAction}
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-red-950/40 cursor-pointer active:scale-95"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
