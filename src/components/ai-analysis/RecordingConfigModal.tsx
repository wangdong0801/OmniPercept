import React, { useEffect, useState } from "react";
import { AlertCircle, Calendar, Clock, Folder, Mic, Monitor, Save, Video, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { RecordingConfig } from "../../types";

interface RecordingConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: RecordingConfig) => void;
  onStop?: () => void;
  initialConfig?: RecordingConfig;
  isActive?: boolean;
}

const DEFAULT_CONFIG: RecordingConfig = {
  videoEnabled: true,
  duration: 5, // 默认 5 秒
  audioEnabled: false,
  audioBitrate: 128,
  imageCaptureEnabled: false,
  imageQuality: "HD",
  triggerInterval: 30, // 默认 30 秒
  timeRange: {
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    startTime: "00:00",
    endTime: "23:59",
  },
  storagePath: "", // 默认清空输入框
  storageEnabled: false, // 默认不开启开关
};

const DRAFT_STORAGE_KEY = "recording_config_draft";

export const RecordingConfigModal: React.FC<RecordingConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onStop,
  initialConfig,
  isActive,
}) => {
  const [config, setConfig] = useState<RecordingConfig>(() => {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch (e) {
        return initialConfig || DEFAULT_CONFIG;
      }
    }
    return initialConfig || DEFAULT_CONFIG;
  });

  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 当弹窗打开时，如果传入了 initialConfig，则同步到 state
  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig(initialConfig);
    }
  }, [isOpen, initialConfig]);

  // 保存草稿到本地存储
  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // 监听 ESC 键
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const checkMicPermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicPermission(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermission(true);
    } catch (err) {
      setMicPermission(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!config.videoEnabled && !config.imageCaptureEnabled && !config.audioEnabled) {
      newErrors.general = "请至少开启视频录制、音频录制或图片截取中的一项";
    }
    if ((config.videoEnabled || config.audioEnabled) && (config.duration < 1 || config.duration > 86400)) {
      newErrors.duration = "时长需在 1 秒至 24 小时之间";
    }
    if (config.triggerInterval < 5 || config.triggerInterval > 86400) {
      newErrors.triggerInterval = "触发间隔需在 5 秒至 24 小时之间";
    } else if ((config.videoEnabled || config.audioEnabled) && config.triggerInterval <= config.duration) {
      newErrors.triggerInterval = "触发间隔必须大于录制时长";
    }
    if (config.storageEnabled) {
      if (!config.storagePath.trim()) {
        newErrors.storagePath = "存储路径不能为空";
      } else if (!/^\/[a-zA-Z0-9._/-]+$/.test(config.storagePath)) {
        newErrors.storagePath = "路径格式非法";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      // 如果任务已在运行，则更新运行中的任务配置
      // 如果没有运行，则仅通过 useEffect 中的 draft 保存逻辑保存配置
      if (isActive) {
        onSave(config);
      }
      onClose();
    }
  };

  const updateConfig = (updates: Partial<RecordingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[150]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[120]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-[800px] max-h-[90vh] rounded-3xl border border-slate-800 bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden z-[150]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-1.5">
                  <Video className="h-4 w-4 text-emerald-400" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">监控视频截取录制配置</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                {/* Left Column: Basic Config */}
                <div className="flex flex-col h-full">
                  <section className="flex flex-col h-full space-y-4">
                    <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      基础录制参数 (Basic Recording)
                    </h3>

                    <div className="flex-1 space-y-5 rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
                      {/* Video Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video className={`h-4 w-4 ${config.videoEnabled ? "text-emerald-400" : "text-slate-600"}`} />
                          <span className="text-xs font-semibold text-slate-200">视频录制</span>
                        </div>
                        <button
                          onClick={() => updateConfig({ videoEnabled: !config.videoEnabled })}
                          className={`relative h-5 w-10 rounded-full transition-colors ${config.videoEnabled ? "bg-emerald-600" : "bg-slate-700"
                            }`}
                        >
                          <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${config.videoEnabled ? "left-6" : "left-1"
                            }`} />
                        </button>
                      </div>

                      {config.videoEnabled && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="space-y-5 pt-2"
                        >
                          <div className="space-y-3">
                            <label className="flex items-center justify-between">
                              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                                录制时长 (秒) <span className="text-red-500">*</span>
                              </span>
                              {errors.duration && <span className="text-[10px] text-red-400">{errors.duration}</span>}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="number"
                                value={config.duration}
                                onChange={e => updateConfig({ duration: parseInt(e.target.value) || 0 })}
                                className={`w-20 rounded-lg border bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none transition-colors ${errors.duration ? "border-red-500/50" : "border-slate-800 focus:border-emerald-500/50"
                                  }`}
                              />
                              {[5, 10, 30, 60, 300].map(val => (
                                <button
                                  key={val}
                                  onClick={() => updateConfig({ duration: val })}
                                  className={`rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${config.duration === val
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                    }`}
                                >
                                  {val < 60 ? `${val}s` : val < 3600 ? `${val / 60}m` : `${val / 3600}h`}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Audio Toggle */}
                      <div className="space-y-4 pt-2 border-t border-slate-800/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mic className={`h-4 w-4 ${config.audioEnabled ? "text-emerald-400" : "text-slate-600"}`} />
                            <span className="text-xs font-semibold text-slate-200">音频录制</span>
                          </div>
                          <button
                            onClick={() => {
                              if (!config.audioEnabled) checkMicPermission();
                              updateConfig({ audioEnabled: !config.audioEnabled });
                            }}
                            className={`relative h-5 w-10 rounded-full transition-colors ${config.audioEnabled ? "bg-emerald-600" : "bg-slate-700"
                              }`}
                          >
                            <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${config.audioEnabled ? "left-6" : "left-1"
                              }`} />
                          </button>
                        </div>

                        {config.audioEnabled && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="space-y-3 overflow-hidden"
                          >
                            <div className="grid grid-cols-3 gap-2">
                              {[128, 256, 320].map(rate => (
                                <button
                                  key={rate}
                                  onClick={() => updateConfig({ audioBitrate: rate as any })}
                                  className={`rounded-lg py-2 text-[10px] font-bold transition-all ${config.audioBitrate === rate
                                    ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                                    : "border border-slate-800 bg-slate-900 text-slate-500"
                                    }`}
                                >
                                  {rate}kbps
                                </button>
                              ))}
                            </div>
                            {micPermission === false && (
                              <div className="flex items-start gap-2 rounded-lg bg-red-950/20 p-2 text-[10px] text-red-400 border border-red-900/30">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span>麦克风权限缺失，请在浏览器设置中开启后重试。</span>
                              </div>
                            )}

                            {/* Duration for Audio */}
                            <div className="space-y-3 pt-3 border-t border-slate-800/50">
                              <label className="flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                                  录制时长 (秒) <span className="text-red-500">*</span>
                                </span>
                                {errors.duration && <span className="text-[10px] text-red-400">{errors.duration}</span>}
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="number"
                                  value={config.duration}
                                  onChange={e => updateConfig({ duration: parseInt(e.target.value) || 0 })}
                                  className={`w-20 rounded-lg border bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none transition-colors ${errors.duration ? "border-red-500/50" : "border-slate-800 focus:border-emerald-500/50"
                                    }`}
                                />
                                {[5, 10, 30, 60, 300].map(val => (
                                  <button
                                    key={val}
                                    onClick={() => updateConfig({ duration: val })}
                                    className={`rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${config.duration === val
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                      }`}
                                  >
                                    {val < 60 ? `${val}s` : val < 3600 ? `${val / 60}m` : `${val / 3600}h`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Image Capture Toggle */}
                      <div className="space-y-4 pt-2 border-t border-slate-800/50">
                        <div className="flex items-center justify-between pt-4">
                          <div className="flex items-center gap-2">
                            <Monitor className={`h-4 w-4 ${config.imageCaptureEnabled ? "text-emerald-400" : "text-slate-600"}`} />
                            <span className="text-xs font-semibold text-slate-200">图片截取</span>
                          </div>
                          <button
                            onClick={() => updateConfig({ imageCaptureEnabled: !config.imageCaptureEnabled })}
                            className={`relative h-5 w-10 rounded-full transition-colors ${config.imageCaptureEnabled ? "bg-emerald-600" : "bg-slate-700"
                              }`}
                          >
                            <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${config.imageCaptureEnabled ? "left-6" : "left-1"
                              }`} />
                          </button>
                        </div>

                        {config.imageCaptureEnabled && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="grid grid-cols-3 gap-2 overflow-hidden"
                          >
                            {(["SD", "HD", "Ultra-HD"] as const).map(quality => (
                              <button
                                key={quality}
                                onClick={() => updateConfig({ imageQuality: quality })}
                                className={`rounded-lg py-2 text-[10px] font-bold transition-all ${config.imageQuality === quality
                                  ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                                  : "border border-slate-800 bg-slate-900 text-slate-500"
                                  }`}
                              >
                                {quality === "SD" ? "标清 1080P" : quality === "HD" ? "高清 2K" : "超清 4K"}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </div>


                    </div>
                  </section>
                </div>

                {/* Right Column: Trigger Rules */}
                <div className="flex flex-col h-full">
                  <section className="flex flex-col h-full space-y-4">
                    <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      触发规则配置 (Trigger Rules)
                    </h3>

                    <div className="flex-1 space-y-5 rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
                      {/* Interval */}
                      <div className="space-y-3">
                        <label className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                            触发间隔 <span className="text-red-500">*</span>
                          </span>
                          {errors.triggerInterval && <span className="text-[10px] text-red-400">{errors.triggerInterval}</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="number"
                            value={config.triggerInterval}
                            onChange={e => updateConfig({ triggerInterval: parseInt(e.target.value) || 0 })}
                            className={`w-20 rounded-lg border bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none transition-colors ${errors.triggerInterval ? "border-red-500/50" : "border-slate-800 focus:border-emerald-500/50"
                              }`}
                          />
                          {[10, 30, 60, 300].map(val => (
                            <button
                              key={val}
                              onClick={() => updateConfig({ triggerInterval: val })}
                              className={`rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${config.triggerInterval === val
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                }`}
                            >
                              {val < 60 ? `${val}s` : val < 3600 ? `${val / 60}m` : `${val / 3600}h`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time Range */}
                      <div className="space-y-3 pt-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                          生效时段 <span className="text-red-500">*</span>
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="relative">
                            <input
                              type="date"
                              value={config.timeRange.startDate}
                              onChange={e => updateConfig({ timeRange: { ...config.timeRange, startDate: e.target.value } })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 focus:border-emerald-500/50 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="date"
                              value={config.timeRange.endDate}
                              onChange={e => updateConfig({ timeRange: { ...config.timeRange, endDate: e.target.value } })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 focus:border-emerald-500/50 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="time"
                              value={config.timeRange.startTime}
                              onChange={e => updateConfig({ timeRange: { ...config.timeRange, startTime: e.target.value } })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 focus:border-emerald-500/50 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="time"
                              value={config.timeRange.endTime}
                              onChange={e => updateConfig({ timeRange: { ...config.timeRange, endTime: e.target.value } })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 focus:border-emerald-500/50 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Storage Path Toggle & Config */}
                      <div className="space-y-4 pt-2 border-t border-slate-800/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Folder className={`h-4 w-4 ${config.storageEnabled ? "text-emerald-400" : "text-slate-600"}`} />
                            <span className="text-xs font-semibold text-slate-200">保存自动分析任务数据</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextEnabled = !config.storageEnabled;
                              updateConfig({
                                storageEnabled: nextEnabled,
                                storagePath: nextEnabled ? "" : config.storagePath
                              });
                            }}
                            className={`relative h-5 w-10 rounded-full transition-colors ${config.storageEnabled ? "bg-emerald-600" : "bg-slate-700"
                              }`}
                          >
                            <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${config.storageEnabled ? "left-6" : "left-1"
                              }`} />
                          </button>
                        </div>

                        {config.storageEnabled ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="space-y-3 overflow-hidden pt-1"
                          >
                            <label className="flex items-center justify-between">
                              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                                任务存储路径 <span className="text-red-500">*</span>
                              </span>
                              {errors.storagePath && <span className="text-[10px] text-red-400">{errors.storagePath}</span>}
                            </label>
                            <div className="relative">
                              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                              <input
                                type="text"
                                value={config.storagePath}
                                onChange={e => updateConfig({ storagePath: e.target.value })}
                                placeholder="请输入任务存储路径，如: /data/recordings"
                                className={`w-full rounded-lg border bg-slate-950 pl-10 pr-3 py-2 font-mono text-xs text-slate-100 focus:outline-none transition-colors ${errors.storagePath ? "border-red-500/50" : "border-slate-800 focus:border-emerald-500/50"
                                  }`}
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-normal">
                              提示：开启后必须指定有效的存储路径，自动分析生成的素材将保存至该路径。
                            </p>
                          </motion.div>
                        ) : (
                          <p className="text-[10px] text-slate-500 leading-normal">
                            提示：未开启保存，自动分析生成的分析数据和素材将仅在内存中缓存，页面刷新后将被清空。
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {errors.general && (
                <div className="flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-slate-800 p-6 bg-slate-900/50">
              {/* {isActive && onStop && (
                <button
                  type="button"
                  onClick={() => {
                    onStop();
                    onClose();
                  }}
                  className="flex-1 rounded-lg border border-red-900/50 bg-red-950/20 py-3 text-xs font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-900/40"
                >
                  停止当前任务
                </button>
              )} */}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200"
              >
                取消配置
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500"
              >
                <Save className="h-4 w-4" />
                保存配置
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
