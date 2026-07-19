import { AnalysisHistoryItem } from "../types";

export const MAX_HISTORY_LENGTH = 10;

/**
 * 校验分析记录是否有效
 */
export const isValidHistoryItem = (item: Partial<AnalysisHistoryItem>): item is AnalysisHistoryItem => {
  if (!item) {
    console.warn("History item is null or undefined");
    return false;
  }
  
  // 必须包含的核心字段
  const hasCoreFields = !!(
    item.id &&
    item.timestamp &&
    item.templateId &&
    item.templateName &&
    item.mode &&
    item.trace &&
    item.result
  );

  if (!hasCoreFields) {
    console.warn("History item missing core fields:", {
      id: !!item.id,
      timestamp: !!item.timestamp,
      templateId: !!item.templateId,
      templateName: !!item.templateName,
      mode: !!item.mode,
      trace: !!item.trace,
      result: !!item.result
    });
    return false;
  }

  // 进一步校验 trace 和 result 的内部结构
  const isTraceValid = !!(item.trace?.nodes && item.trace.nodes.length > 0);
  const isResultValid = !!(item.result?.headline && item.result.summary);

  if (!isTraceValid || !isResultValid) {
    console.warn("History item trace or result invalid:", { isTraceValid, isResultValid });
  }

  return isTraceValid && isResultValid;
};

/**
 * 添加新的分析记录到列表，并维持 10 条限制 (FIFO)
 */
export const addToHistory = (
  currentHistory: AnalysisHistoryItem[],
  newItem: AnalysisHistoryItem
): AnalysisHistoryItem[] => {
  console.log("Attempting to add to history:", newItem.id);

  // 数据有效性校验
  if (!isValidHistoryItem(newItem)) {
    console.error("Invalid analysis history item, skipping save.");
    return currentHistory;
  }

  // 避免重复添加 (通过 ID 校验)
  if (currentHistory.some(item => item.id === newItem.id)) {
    console.log("Item already exists in history, skipping:", newItem.id);
    return currentHistory;
  }

  // 将新数据放入列表最前面
  const updatedHistory = [newItem, ...currentHistory];
  console.log("Successfully added to history. New count:", Math.min(updatedHistory.length, MAX_HISTORY_LENGTH));

  // 严格限制总数，超出时移除最早的数据 (末尾数据)
  return updatedHistory.slice(0, MAX_HISTORY_LENGTH);
};
