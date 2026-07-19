import { AgentConfig, SkillConfig, SampleLibrary, AnalysisTemplate, Scenario } from "../types";

// Default Agents
export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: "agent-safety-expert",
    name: "安全督导高级专家 Agent",
    model: "gemini-2.5-flash",
    systemInstruction: "你是一个高级多模态安全督导检测大师。你需要根据现场图像，对车间通道畅通情况、物品码放状态以及任何可能发生的绊倒、滑倒、高空坠物等物理危险源进行高灵敏度研判。必须给出清晰的逐步推论过程，对异常隐患进行空间定界，并提出严谨的整改意见与安全隐患等级评估（特级、一级、二级、常态）。",
    temperature: 0.1
  },
  {
    id: "agent-ppe-auditor",
    name: "PPE 穿戴合规审计 Agent",
    model: "gemini-2.5-flash",
    systemInstruction: "你是一个专业的工厂个人防护装备 (PPE) 智能穿戴审计专家。你需要精准分析图像中所有的现场作业人员，仔细对照安全帽（红黄蓝白不同工种）、防静电反光背心、防尘面罩、护目镜和绝缘防护手套。指出哪些人员存在缺失，给出具体的人数、不合规行为描述，以及对应的职业安全警示 and 纠偏建议。",
    temperature: 0.15
  },
  {
    id: "agent-instrument-specialist",
    name: "工业仪器仪表读数与故障研判 Agent",
    model: "gemini-2.5-flash",
    systemInstruction: "你是一个高精度工业仪表数显及控制面板诊断专家。你需要仔细识别圆盘指针仪表、数显液晶屏、红绿黄状态故障指示灯。计算阀门开关角度或仪表指针指向，评估压力/温度是否进入红色警戒区或黄色超载区，并说明设备运行状态以及突发状况下的断电隔离安全建议。",
    temperature: 0.05
  },
  {
    id: "agent-sound-analyzer",
    name: "声学频谱信号分析与诊断 Agent",
    model: "gemini-2.5-flash",
    systemInstruction: "你是一个高级工业声谱与环境噪音诊断专家。你需要通过分析音频的声学特征，寻找高频尖锐摩擦、低频沉闷撞击、不规则震颤等轴承或齿轮故障迹象，或者过滤环境底噪，识别空气泄漏啸叫、行车过载蜂鸣或突发气体喷射声。给出可能的故障源位置与紧急应对措施。",
    temperature: 0.2
  }
];

// Default Skills
export const DEFAULT_SKILLS: SkillConfig[] = [
  {
    id: "skill-hazard-locating",
    name: "多维危险源定界与定位",
    type: "image",
    description: "重点检查黄线内通道，识别废料堆积或液体泄漏的空间相对方位。",
    customRules: "1. 重点扫描车间通道黄线标志线内的区域；\n2. 寻找任何绊倒/滑倒隐患（如油污积水、线缆杂乱、散落零件、多余木托盘）；\n3. 描述隐患相对于摄像头画面的方位（如: 左前侧、中心通道中段）。"
  },
  {
    id: "skill-ppe-classification",
    name: "劳保穿戴合规多分类比对",
    type: "image",
    description: "交叉核对作业人员的安全帽与反光服，生成合规率统计表。",
    customRules: "1. 列出图像中检测到的所有人头数，并标记为 Worker #1, Worker #2 等；\n2. 检查每一位 Worker 是否穿戴：安全帽、反光服、防护手套；\n3. 给出该车间班组的整体 PPE 穿戴合规率百分比（例如: 83%）。"
  },
  {
    id: "skill-ocr-gauge",
    name: "仪表 OCR 与刻度换算校准",
    type: "image",
    description: "进行数字提取与指针角度量程换算，检测指标状态。",
    customRules: "1. 识别图片中所有的刻度盘、液位计、数显屏；\n2. 根据指针相对于零位和满量程的角度，估算其百分比与实际物理读数；\n3. 明确判断该数值是否超出正常工艺区间。"
  },
  {
    id: "skill-spectrum-denoise",
    name: "车间环境底噪自适应滤波",
    type: "audio",
    description: "隔离和滤除强烈的旋转机械稳态低频噪声，突显瞬态异常声学事件。",
    customRules: "1. 先把音频中的空压机、冷水机等稳态高分贝背景底噪进行虚拟滤波；\n2. 重点捕获高频啸叫（>5kHz）或间歇性金属敲击声；\n3. 提取瞬态信号的能量突变特征并评估报警必要性。"
  },
  {
    id: "skill-leakage-detection",
    name: "高压气体泄漏超声频段诊断",
    type: "audio",
    description: "根据音频中的高频持续“嗤嗤”特征，诊断气动管网或阀门微量泄露。",
    customRules: "1. 专门检索持续的高频湍流嗤嗤声，区分于正常排气阀的瞬间排气；\n2. 推算气压泄露的大致量级；\n3. 提示运维人员检查特定高压管路接头或储气罐法兰。"
  }
];

// Default Sample Libraries
export const DEFAULT_SAMPLES: SampleLibrary[] = [
  {
    id: "lib-hazard-samples",
    name: "通道安全与物理隐患图谱样本库",
    description: "工厂车间物理隐患标准对比库，包含废料乱堆、积水油污等反面教材。",
    type: "image",
    samples: [
      {
        id: "hazard-sample-1",
        name: "通道木托盘占用标准隐患",
        type: "image",
        data: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80",
        description: "在主安全走道正中间随意放置了2个闲置木托盘，严重遮挡安全疏散路线，属于典型绊倒危险，评级：二级隐患。"
      },
      {
        id: "hazard-sample-2",
        name: "加工区域线缆裸露凌乱",
        type: "image",
        data: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80",
        description: "机床旁侧动力电缆未入线槽，在走道交叉口呈凌乱散落状态，无警示带阻隔，极易导致人员摔伤与短路火灾，评级：一级隐患。"
      }
    ]
  },
  {
    id: "lib-ppe-samples",
    name: "PPE 个人防护规范比对样本库",
    description: "展示红黄蓝绿安全帽标准佩戴、面罩与反光背心合规穿戴对比样本。",
    type: "image",
    samples: [
      {
        id: "ppe-sample-1",
        name: "规范穿戴：反光衣与黄色安全帽",
        type: "image",
        data: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80",
        description: "标准现场装配人员：规范扣紧下颚带的黄色安全帽、高可视度橙色反光服。属于完美合规样本。"
      },
      {
        id: "ppe-sample-2",
        name: "违规穿戴：未戴帽作业",
        type: "image",
        data: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
        description: "检测到人员正在进行接线操作，虽然穿着了工作服，但头顶未佩戴安全帽，头顶上方有桥架吊装物，存在高空坠物砸伤风险，违规状态。"
      }
    ]
  },
  {
    id: "lib-gauge-samples",
    name: "阀门状态与压力表读数对照库",
    description: "精密工业指针压力表及各类阀门在常态、超负荷、故障警示状态下的仪表指示样本。",
    type: "image",
    samples: [
      {
        id: "gauge-sample-1",
        name: "指针压力表过载指示样本",
        type: "image",
        data: "https://images.unsplash.com/photo-1590986424791-2355375a0a55?auto=format&fit=crop&w=400&q=80",
        description: "工业高压蒸汽管路压力表：当前指针已突破红线区（达到 2.4 MPa），处于极其危险的过压临界状态，必须立即开启泄压阀！"
      },
      {
        id: "gauge-sample-2",
        name: "设备阀门关闭状态样本",
        type: "image",
        data: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
        description: "主蒸汽管道手轮阀门：转盘呈完全右旋锁死状态，限位销落锁，确认此段管路已被安全切断隔离。"
      }
    ]
  },
  {
    id: "lib-sound-anomaly",
    name: "传动轴承磨损与异常异响音色库",
    description: "包含旋转机械摩擦、松动、周期性敲击异响的标准声谱说明。",
    type: "audio",
    samples: [
      {
        id: "audio-sample-1",
        name: "高频滚动轴承游隙摩擦音",
        type: "audio",
        data: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // fallback demo link
        description: "特征：伴有高频金属撕扯声与砂石滚动噪音，时域波形存在不规则尖峰脉冲，常出现于电机负荷运转达2000小时以上，轴承滚珠滚道严重剥落。"
      },
      {
        id: "audio-sample-2",
        name: "传送带电机外壳松动共振杂音",
        type: "audio",
        data: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", // fallback demo link
        description: "特征：在100Hz至250Hz低频段具有极高的稳态共鸣能量，随转速增加而声压级呈倍数级放大，属于设备地脚螺栓松脱引发的机械共振。"
      }
    ]
  },
  {
    id: "lib-sound-alarm",
    name: "工业高分贝灾害警报标准特征库",
    description: "车间火灾报警声、应急疏散警笛、突发高压泄气的声音对比库。",
    type: "audio",
    samples: [
      {
        id: "audio-sample-3",
        name: "车间消防高亢断续啸叫声",
        type: "audio",
        data: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        description: "特征：频率在 1000Hz 左右往复周期扫频，声级超过 95dB，属于消防主机触发的标准疏散警笛。"
      },
      {
        id: "audio-sample-4",
        name: "管道高压气体泄露尖锐嗤嗤音",
        type: "audio",
        data: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        description: "特征：在 15kHz 以上的超声频段及 8kHz 以上的高频段具备广谱噪声分布，声音表现为不间断的、气流喷射般的锐利啸叫。"
      }
    ]
  }
];

// Default Templates (which form Scenarios dynamically for users!)
export const DEFAULT_TEMPLATES: AnalysisTemplate[] = [
  {
    id: "factory-hazard",
    name: "通道遮挡与环境隐患排查",
    description: "智能研判安全通道（黄线内/绿色通道）是否畅通，是否存在废料堆积、油污油水泄漏、线缆杂乱等绊倒/滑倒安全隐患。",
    type: "image",
    agentId: "agent-safety-expert",
    skillIds: ["skill-hazard-locating"],
    sampleLibraryId: "lib-hazard-samples",
    sampleLoadRule: "all",
    icon: "ShieldAlert",
    placeholder: "第一步：请点击或拖拽上传车间通道、加工区 or 仓储区现场实拍图像...",
    defaultPrompt: "请仔细检查此工厂车间图像，判断安全通道（黄线内或划定区域）是否畅通无阻，是否有任何可能导致绊倒、滑倒的杂物堆放、工具乱丢、积水、液体/油污泄露等安全隐患，并输出具体隐患项、隐患位置、推荐整改意见与安全等级评定。",
    connections: [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ]
  },
  {
    id: "factory-ppe",
    name: "个人防护装备 (PPE) 穿戴合规检测",
    description: "检测现场人员是否合规佩戴安全帽、防静电工作服、防尘口罩、护目镜 or 绝缘防护手套。",
    type: "image",
    agentId: "agent-ppe-auditor",
    skillIds: ["skill-ppe-classification"],
    sampleLibraryId: "lib-ppe-samples",
    sampleLoadRule: "all",
    icon: "UserCheck",
    placeholder: "第一步：请点击或拖拽上传包含车间现场作业人员的清晰图像...",
    defaultPrompt: "请分析图像中的车间作业人员，判断其是否规范佩戴了安全帽、工作服、口罩、绝缘手套或防护镜等必需的个人防护装备（PPE），指出未合规佩戴人员的具体位置，并在结果中明确指出缺失装备，给出警示与安全操作规范整改建议。",
    connections: [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ]
  },
  {
    id: "factory-gauge",
    name: "仪器仪表读数与状态灯警报研判",
    description: "读取机床仪表盘指针位置、数显屏幕读数、或者红绿黄状态灯，智能判断是否超载、超压或存在红灯报警运行故障。",
    type: "image",
    agentId: "agent-instrument-specialist",
    skillIds: ["skill-ocr-gauge"],
    sampleLibraryId: "lib-gauge-samples",
    sampleLoadRule: "top-3",
    icon: "Activity",
    placeholder: "第一步：请点击或拖拽上传压力/温度仪表、机床控制板、配电箱或报警指示灯图像...",
    defaultPrompt: "请仔细研判图像中的工业设备、仪器仪表或控制面板，识别并读取关键的压力/温度指针数值、数显液晶读数、或红绿黄状态指示灯，研判是否有超温、超压、报警红灯闪烁等设备运行异常，并指出安全操作和断电建议。",
    connections: [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ]
  },
  {
    id: "factory-audio-anomaly",
    name: "机械异常噪音与设备运转诊断",
    description: "对电机、泵体、加工主轴或传送带的运转声音进行声学诊断，智能检测是否存在轴承磨损、齿轮撞击或异常松动鸣响。",
    type: "audio",
    agentId: "agent-sound-analyzer",
    skillIds: ["skill-spectrum-denoise"],
    sampleLibraryId: "lib-sound-anomaly",
    sampleLoadRule: "random-1",
    icon: "Wrench",
    placeholder: "第一步：请录制或上传机械运转时的现场音频文件（MP3/WAV）...",
    defaultPrompt: "请对这段机械运转音频进行声谱声学特征分析，检查是否存在高频尖锐摩擦、沉闷撞击声、异常颤音、或转速不稳杂音等疑似机械故障，并给出可能的设备故障部位（如轴承、齿轮、电机）与紧迫整改建议。",
    connections: [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ]
  },
  {
    id: "factory-audio-alarm",
    name: "车间突发警报声与气体泄露侦测",
    description: "监测整体环境背景分贝，智能识别并过滤车间内的消防啸叫、气体泄漏嗤嗤声、行车倒车警报音或异常冲击破裂声。",
    type: "audio",
    agentId: "agent-sound-analyzer",
    skillIds: ["skill-spectrum-denoise", "skill-leakage-detection"],
    sampleLibraryId: "lib-sound-alarm",
    sampleLoadRule: "all",
    icon: "Volume2",
    placeholder: "第一步：请录制或上传车间背景音或警报突发时的现场音频文件...",
    defaultPrompt: "请诊断此车间背景音频，判断环境噪音声级是否超出职业安全标准，并识别音频中是否含有突发的消防警笛、气体泄露啸叫、行车过载蜂鸣或突发撞击爆裂等异响警报，输出环境安全性评估与应急处置指引。",
    connections: [
      { from: "input", to: "skills" },
      { from: "skills", to: "sample" },
      { from: "sample", to: "agent" },
      { from: "agent", to: "output" }
    ]
  }
];

// Helper to load config from localStorage with fallback
export function getStoredConfig() {
  const agentsStr = localStorage.getItem("ultron_agents");
  const skillsStr = localStorage.getItem("ultron_skills");
  const samplesStr = localStorage.getItem("ultron_samples");
  const templatesStr = localStorage.getItem("ultron_templates");

  let agents = agentsStr ? JSON.parse(agentsStr) : DEFAULT_AGENTS;
  const skills = skillsStr ? JSON.parse(skillsStr) : DEFAULT_SKILLS;
  const samples = samplesStr ? JSON.parse(samplesStr) : DEFAULT_SAMPLES;
  const templates = templatesStr ? JSON.parse(templatesStr) : DEFAULT_TEMPLATES;

  // Migrate deprecated or high-demand models to stable alternatives
  let migrated = false;
  agents = agents.map((agent: any) => {
    if (agent.model === "gemini-3.5-flash") {
      agent.model = "gemini-2.5-flash";
      migrated = true;
    } else if (agent.model === "gemini-1.5-pro" || agent.model === "gemini-pro") {
      agent.model = "gemini-3.1-pro-preview";
      migrated = true;
    }
    return agent;
  });

  if (migrated || !agentsStr) localStorage.setItem("ultron_agents", JSON.stringify(agents));
  if (!skillsStr) localStorage.setItem("ultron_skills", JSON.stringify(DEFAULT_SKILLS));
  if (!samplesStr) localStorage.setItem("ultron_samples", JSON.stringify(DEFAULT_SAMPLES));
  if (!templatesStr) localStorage.setItem("ultron_templates", JSON.stringify(DEFAULT_TEMPLATES));

  return { agents, skills, samples, templates };
}

// Save helpers
export function saveAgents(agents: AgentConfig[]) {
  localStorage.setItem("ultron_agents", JSON.stringify(agents));
}

export function saveSkills(skills: SkillConfig[]) {
  localStorage.setItem("ultron_skills", JSON.stringify(skills));
}

export function saveSampleLibraries(samples: SampleLibrary[]) {
  localStorage.setItem("ultron_samples", JSON.stringify(samples));
}

export function saveTemplates(templates: AnalysisTemplate[]) {
  localStorage.setItem("ultron_templates", JSON.stringify(templates));
}

// Map templates back to Scenario type for ScenarioSelector consumption
export function templatesToScenarios(templates: AnalysisTemplate[]): Scenario[] {
  return templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    placeholder: t.placeholder,
    type: t.type === "image" ? "image" : t.type === "audio" ? "audio" : "both",
    defaultPrompt: t.defaultPrompt,
    agentId: t.agentId,
    skillIds: t.skillIds,
    sampleLibraryId: t.sampleLibraryId,
    sampleLoadRule: t.sampleLoadRule,
    connections: t.connections,
    nodes: t.nodes
  }));
}
