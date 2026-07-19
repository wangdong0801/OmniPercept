import { HistoryRecord } from "../types";
import legacyHistory from "../../data/history.json";

const HISTORY_KEY = "ultronbot_history";

const legacyRecords = (legacyHistory as any) as HistoryRecord[];

export function loadHistoryRecords(): HistoryRecord[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Seed with legacy history initially
    if (Array.isArray(legacyRecords)) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(legacyRecords));
      return legacyRecords;
    }
  } catch (error) {
    console.error("Failed to load history from localStorage:", error);
  }
  return [];
}

export function saveHistoryRecordLocally(record: HistoryRecord): HistoryRecord[] {
  const records = loadHistoryRecords();
  records.unshift(record);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  return records;
}

export function deleteHistoryRecordLocally(id: string): HistoryRecord[] {
  let records = loadHistoryRecords();
  records = records.filter((r) => r.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  return records;
}
