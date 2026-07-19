# 离线与实时分析功能隔离整改说明

## 1. 核心变更点

### 1.1 状态管理域分离 (State Management Isolation)
- **AiAnalysisWorkspace.tsx**: 
  - 将原本共享的 `isAnalyzing`, `trace`, `result`, `captures`, `videos`, `audios` 等状态拆分为 `offlineState` 和 `realtimeState` 两个独立的对象。
  - 通过 `activeTab` 动态映射 `currentTrace`, `currentResult` 等变量供 UI 使用。
  - 引入 `updateCurrentTrace`, `updateCurrentIsAnalyzing` 等辅助函数，确保状态更新严格作用于当前激活的模块。
- **AgentAnalysisPanel.tsx**:
  - 内部状态同步拆分为 `offlineState` 和 `realtimeState`。
  - 确保模拟分析逻辑（startSimulation）只修改对应模式的状态。

### 1.2 生命周期与副作用清理 (Lifecycle & Side-effects)
- **AiAnalysisWorkspace.tsx**:
  - 增加 `useEffect` 监听 `activeTab` 切换。
  - 切换时立即清除所有挂起的定时器 (`timeoutsRef`)。
  - 切换时强制调用 `agentPanelRef.current.stopSimulation()` 停止所有进行中的动画。
- **AgentAnalysisPanel.tsx**:
  - `stopSimulation` 被增强，能够根据当前模式重置对应的所有内部状态。
  - 组件卸载时确保清理 `simulationTimer`。

### 1.3 模块互斥激活 (Mutual Exclusion)
- **AiAnalysisWorkspace.tsx**:
  - 当从 `realtime` 切换到 `offline` 时，如果存在活跃的自动录制任务 (`activeRecordingTask`)，会自动调用 `handleStopRecordingTask()` 彻底关停实时循环，防止后台任务污染离线分析。

### 1.4 DOM 与样式隔离 (DOM Isolation)
- **AgentAnalysisPanel.tsx**:
  - 为根容器添加了 `agent-panel-${activeTab}` 类名。
  - 为结果展示区域添加了 `agent-analysis-results-${activeTab}` 类名。
  - 这为后续可能的样式冲突提供了明确的选择器隔离。

## 2. 交叉测试验证建议

### 2.1 切换测试 (Switching Test)
1. 在 `realtime` 模式下开启“自动分析”，观察一轮循环开始。
2. 在循环进行中（如正在录制或正在分析），点击切换到 `offline`。
3. **预期结果**：
   - 实时模式的倒计时停止。
   - 正在进行的录制或模拟动画立即消失。
   - 离线模式显示纯净的初始状态。
   - 切换回 `realtime` 时，之前生成的素材应依然保留（除非手动重置），但分析应处于停止状态。

### 2.2 并发/干扰测试 (Interference Test)
1. 启动 `offline` 分析。
2. 在分析未完成时，切换到 `realtime` 并手动抓拍。
3. **预期结果**：
   - 抓拍的素材应仅出现在 `realtime` 状态域中。
   - 切换回 `offline`，之前的离线分析进度应继续或显示已完成，不应看到 `realtime` 的素材。

### 2.3 内存与资源测试 (Resource Leak Test)
1. 反复切换标签页 10 次以上。
2. 观察控制台是否有未清理定时器的警告。
3. **预期结果**：
   - 无性能卡顿。
   - 资源占用保持稳定。
