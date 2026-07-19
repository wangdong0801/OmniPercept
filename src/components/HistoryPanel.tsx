import React, { useState, useEffect } from "react";
import { 
  Search, 
  Trash2, 
  Calendar, 
  Play, 
  FileAudio, 
  ChevronRight, 
  Sparkles, 
  X, 
  Filter, 
  FileText, 
  CheckCircle2, 
  Cpu, 
  ListTodo, 
  Award,
  AlertCircle
} from "lucide-react";
import { HistoryRecord } from "../types";

interface HistoryPanelProps {
  records: HistoryRecord[];
  onDeleteRecord: (id: string) => void;
  onSelectRecord: (record: HistoryRecord) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  records,
  onDeleteRecord,
  onSelectRecord
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<HistoryRecord | null>(null);

  // Filter logic
  const filteredRecords = records.filter((rec) => {
    const matchesSearch = 
      rec.result.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.result.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.fileName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || rec.fileType === typeFilter;
    const matchesScenario = scenarioFilter === "all" || rec.scenarioId === scenarioFilter;

    return matchesSearch && matchesType && matchesScenario;
  });

  // Extract unique scenarios for filter dropdown
  const uniqueScenarios = Array.from(
    new Map(records.map((rec) => [rec.scenarioId, rec.scenarioName])).entries()
  );

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 shadow-lg grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search input */}
        <div className="relative md:col-span-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            id="input-history-search"
            type="text"
            placeholder="搜索标题、场景、属性结果..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2 text-xs text-slate-200 rounded-xl focus:border-blue-500 focus:bg-[#131b2e] focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Media type filter */}
        <div className="flex items-center gap-2 md:col-span-3">
          <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <select
            id="select-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="all" className="bg-[#111827]">所有媒介 (全部)</option>
            <option value="image" className="bg-[#111827]">图像文件 (Images)</option>
            <option value="audio" className="bg-[#111827]">语音录音 (Audios)</option>
          </select>
        </div>

        {/* Scenario filter */}
        <div className="md:col-span-4">
          <select
            id="select-scenario-filter"
            value={scenarioFilter}
            onChange={(e) => setScenarioFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="all" className="bg-[#111827]">所有场景 (全部)</option>
            {uniqueScenarios.map(([id, name]) => (
              <option key={id} value={id} className="bg-[#111827]">{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* History Grid */}
      {filteredRecords.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-12 text-center space-y-3 shadow-lg">
          <AlertCircle className="h-10 w-10 text-slate-600 mx-auto" />
          <div className="space-y-1 max-w-xs mx-auto">
            <h5 className="text-slate-200 font-semibold text-sm">暂无匹配的历史记录</h5>
            <p className="text-slate-400 text-xs leading-relaxed">
              目前没有找到对应的分析快照。快去执行一次全新的多模态场景智能分析吧！
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-900 hover:shadow-lg hover:shadow-blue-950/20 transition-all duration-300 group flex flex-col h-[320px] relative"
            >
              {/* Media Thumbnail Container */}
              <div className="h-32 bg-slate-950 relative overflow-hidden flex items-center justify-center shrink-0 border-b border-slate-850">
                {record.fileType === "image" ? (
                  <img
                    src={record.fileData}
                    alt={record.result.title}
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1.5 text-blue-400 p-4">
                    <FileAudio className="h-10 w-10 animate-pulse text-blue-500" />
                    <span className="text-[9px] text-slate-400 font-mono line-clamp-1 max-w-[200px]">
                      {record.fileName}
                    </span>
                  </div>
                )}

                {/* Badges Overlay */}
                <div className="absolute top-3 left-3 flex gap-1.5 items-center">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    record.fileType === "image" 
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-900/40" 
                      : "bg-blue-950/80 text-blue-400 border-blue-900/40"
                  }`}>
                    {record.fileType === "image" ? "图像" : "声音"}
                  </span>
                  <span className="bg-[#161f30] text-slate-300 border border-slate-800 text-[9px] font-medium px-2 py-0.5 rounded-full">
                    {record.scenarioName}
                  </span>
                </div>

                {/* Score badge */}
                <div className="absolute bottom-3 right-3 bg-blue-900/80 text-blue-400 border border-blue-800/40 font-mono font-bold text-xs py-1 px-2 rounded-lg backdrop-blur-xs flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  {record.result.confidence}%
                </div>
              </div>

              {/* Text Card Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {formatDate(record.timestamp)}
                  </div>
                  <h4 className="font-bold text-slate-200 text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
                    {record.result.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {record.result.summary}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-1">
                  {/* Delete Button */}
                  <button
                    id={`btn-del-record-${record.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("确定要永久删除这条分析记录吗？")) {
                        onDeleteRecord(record.id);
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors shrink-0"
                    title="永久删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Click detail button */}
                  <button
                    id={`btn-view-record-${record.id}`}
                    type="button"
                    onClick={() => setSelectedItem(record)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 group/btn"
                  >
                    查看完整细节
                    <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail overlay */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 z-50 animate-fade-in">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 p-4 md:px-6 md:py-4.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${
                  selectedItem.fileType === "image" ? "bg-emerald-600" : "bg-blue-600"
                }`}>
                  {selectedItem.fileType === "image" ? (
                    <Sparkles className="h-4.5 w-4.5" />
                  ) : (
                    <FileAudio className="h-4.5 w-4.5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm md:text-base line-clamp-1">
                    {selectedItem.result.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span className="text-blue-400">{selectedItem.scenarioName}</span>
                    <span className="text-slate-600">•</span>
                    <span>{formatDate(selectedItem.timestamp)}</span>
                  </div>
                </div>
              </div>

              <button
                id="btn-close-modal"
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Scroll */}
            <div className="overflow-y-auto p-5 md:p-6 space-y-6 flex-1">
              
              {/* Top Split section: File player and metadata summary */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                
                {/* File box */}
                <div className="md:col-span-5 bg-slate-950 rounded-2xl flex items-center justify-center overflow-hidden min-h-[160px] max-h-[220px] p-3 border border-slate-850">
                  {selectedItem.fileType === "image" ? (
                    <img
                      src={selectedItem.fileData}
                      alt={selectedItem.result.title}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-3 w-full">
                      <div className="p-3 bg-blue-950/60 text-blue-400 border border-blue-900/40 rounded-full">
                        <FileAudio className="h-8 w-8" />
                      </div>
                      <audio
                        src={selectedItem.fileData}
                        controls
                        className="w-full max-w-xs h-10 shadow-lg text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* Overview metadata card */}
                <div className="md:col-span-7 bg-slate-950/40 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[10px] bg-blue-950/60 text-blue-400 border border-blue-900/40 font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                      智能快照总结
                    </span>
                    <h4 className="font-bold text-slate-200 text-sm leading-snug">
                      {selectedItem.result.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      {selectedItem.result.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-lg font-bold text-blue-450">
                        {selectedItem.result.confidence}%
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        置信度指标
                      </span>
                    </div>

                    {selectedItem.customPrompt && (
                      <div className="text-[11px] text-slate-500 text-right">
                        包含自定义指令 📝
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom prompt panel */}
              {selectedItem.customPrompt && (
                <div className="bg-amber-950/20 border border-amber-900/30 p-3.5 rounded-2xl text-xs space-y-1">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                    💡 用户当时指定的分析焦点：
                  </div>
                  <p className="text-slate-300 leading-relaxed font-medium italic">
                    “ {selectedItem.customPrompt} ”
                  </p>
                </div>
              )}

              {/* Dynamic Analysis breakdown tabs/sections */}
              <div className="space-y-5">
                {/* 1. Attributes Results */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    识别指标结果（Attributes）
                  </h4>
                  <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40">
                    {selectedItem.result.results.map((item, idx) => (
                      <div key={idx} className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1 hover:bg-slate-900/40 transition-colors">
                        <div className="text-xs font-bold text-slate-400">{item.label}</div>
                        <div className="text-xs text-slate-200 sm:col-span-2 leading-relaxed font-medium">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Analytical Process */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    双向推导神经过程 (Analytical Process)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedItem.result.processSteps.map((step, idx) => (
                      <div key={idx} className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5 flex flex-col justify-between">
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span className="h-5 w-5 bg-blue-950/80 text-blue-400 border border-blue-900/40 font-mono text-[10px] rounded-full flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {step.phase}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                          {step.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Action suggestions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    针对性改进与指导建议（Action Suggestions）
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedItem.result.suggestions.map((item, idx) => (
                      <div key={idx} className="border border-slate-800 p-3.5 rounded-xl flex gap-2.5 bg-[#131a2d]/85 shadow-md">
                        <CheckCircle2 className="h-4.5 w-4.5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/50 border border-blue-900/40 px-1.5 py-0.5 rounded-md">
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
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 border-t border-slate-800 p-4.5 flex justify-end gap-3 shrink-0">
              <button
                id="btn-modal-close-footer"
                type="button"
                onClick={() => setSelectedItem(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold py-2.5 px-5 rounded-xl transition-all cursor-pointer border border-slate-700"
              >
                关闭视图
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
