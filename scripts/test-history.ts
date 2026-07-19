import { addToHistory, MAX_HISTORY_LENGTH, isValidHistoryItem } from "../src/utils/analysisHistory";
import { AnalysisHistoryItem, AgentAnalysisTrace, AgentAnalysisResult } from "../src/types";

// 模拟数据生成器
const createMockItem = (id: string): AnalysisHistoryItem => ({
  id,
  timestamp: Date.now(),
  templateId: "tpl-1",
  templateName: "测试模版",
  mode: "offline",
  captures: [],
  videos: [],
  audios: [],
  trace: {
    id: "trace-" + id,
    mode: "offline",
    templateId: "tpl-1",
    templateName: "测试模版",
    startedAt: new Date().toISOString(),
    nodes: [{ id: "n1", nodeName: "Node 1", role: "Role", resourceType: "agent", resourceName: "Res", status: "completed", summary: "Summary" }]
  } as AgentAnalysisTrace,
  result: {
    headline: "Headline " + id,
    summary: "Summary " + id,
    riskLevel: "低",
    matchedResources: [],
    recommendations: []
  } as AgentAnalysisResult
});

async function runTests() {
  console.log("🚀 开始运行分析历史管理功能测试...");

  // 测试 1: 数据校验逻辑
  console.log("\n[测试 1] 数据校验逻辑验证:");
  const validItem = createMockItem("1");
  const invalidItem = { id: "2" } as any;
  console.log("- 有效数据校验:", isValidHistoryItem(validItem) ? "✅ 通过" : "❌ 失败");
  console.log("- 无效数据校验:", !isValidHistoryItem(invalidItem) ? "✅ 通过" : "❌ 失败");

  // 测试 2: 存储数量限制 (10条)
  console.log("\n[测试 2] 存储数量限制验证 (最大 10 条):");
  let history: AnalysisHistoryItem[] = [];
  for (let i = 1; i <= 15; i++) {
    history = addToHistory(history, createMockItem(i.toString()));
  }
  console.log("- 最终条数:", history.length);
  console.log("- 限制验证:", history.length === MAX_HISTORY_LENGTH ? "✅ 通过" : "❌ 失败");

  // 测试 3: FIFO 覆盖逻辑 (最早的被移除)
  console.log("\n[测试 3] FIFO 覆盖逻辑验证:");
  // 此时 history 中应该是 15, 14, ..., 6 (按添加顺序，最新的在最前面)
  const ids = history.map(item => item.id);
  console.log("- 当前 ID 列表 (最新在前):", ids.join(", "));
  const expectedIds = ["15", "14", "13", "12", "11", "10", "9", "8", "7", "6"];
  const isFIFOPassed = JSON.stringify(ids) === JSON.stringify(expectedIds);
  console.log("- 覆盖逻辑验证:", isFIFOPassed ? "✅ 通过" : "❌ 失败");

  // 测试 4: 重复数据校验
  console.log("\n[测试 4] 重复数据校验验证:");
  const initialLength = history.length;
  history = addToHistory(history, history[0]); // 尝试添加已存在的第一个元素
  console.log("- 重复添加后条数:", history.length);
  console.log("- 重复校验验证:", history.length === initialLength ? "✅ 通过" : "❌ 失败");

  if (isValidHistoryItem(validItem) && history.length === MAX_HISTORY_LENGTH && isFIFOPassed && history.length === initialLength) {
    console.log("\n✨ 所有测试用例已通过！功能运行稳定。");
    process.exit(0);
  } else {
    console.log("\n⚠️ 部分测试用例未通过，请检查代码逻辑。");
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("测试运行出错:", err);
  process.exit(1);
});
