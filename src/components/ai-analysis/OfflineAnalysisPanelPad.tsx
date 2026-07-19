import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  FileAudio,
  FileText,
  FileVideo,
  FileSpreadsheet,
  FileBox,
  File as FileIcon,
  Image as ImageIcon,
  Mic,
  Play,
  Radio,
  Square,
  Trash2,
  Upload,
  X,
  Music,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { AiWorkspaceTab, OfflineAssetItem } from "../../types";

interface OfflineAnalysisPanelPadProps {
  assets: OfflineAssetItem[];
  activeTab: AiWorkspaceTab;
  onTabChange: (tab: AiWorkspaceTab) => void;
  onAddAsset: (asset: OfflineAssetItem) => void;
  onRemoveAsset: (assetId: string) => void;
}

const createAssetId = () => `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const OfflineAnalysisPanelPad: React.FC<OfflineAnalysisPanelPadProps> = ({
  assets,
  activeTab,
  onTabChange,
  onAddAsset,
  onRemoveAsset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<OfflineAssetItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
      stopRecording();
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingSeconds(0);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      cameraStreamRef.current = stream;
      setIsCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 120);
    } catch (err) {
      console.error("Failed to open camera:", err);
      setError("无法启动摄像头，请检查浏览器权限或设备是否被占用。");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("拍照失败，无法获取画布上下文。");
        return;
      }
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      const asset: OfflineAssetItem = {
        id: createAssetId(),
        type: "capture",
        name: `现场拍摄_${new Date().toLocaleTimeString("zh-CN")}.jpg`,
        mimeType: "image/jpeg",
        dataUrl,
        createdAt: new Date().toISOString(),
        sourceLabel: "现场拍摄",
      };
      onAddAsset(asset);
      stopCamera();
    } catch (err) {
      console.error("Failed to capture photo:", err);
      setError("现场拍摄失败，请重试。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const reader = new FileReader();
        reader.onload = () => {
          const asset: OfflineAssetItem = {
            id: createAssetId(),
            type: "audio",
            name: `现场录音_${new Date().toLocaleTimeString("zh-CN")}.${(recorder.mimeType || "audio/webm").split("/")[1] || "webm"}`,
            mimeType: audioBlob.type,
            dataUrl: String(reader.result || ""),
            createdAt: new Date().toISOString(),
            sourceLabel: "现场录音",
          };
          onAddAsset(asset);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to record audio:", err);
      setError("无法启动录音，请检查浏览器麦克风权限。");
    }
  };

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        let sourceLabel = "文件上传";
        if (file.type.startsWith("image/")) sourceLabel = "文件上传-图片";
        else if (file.type.startsWith("audio/")) sourceLabel = "文件上传-音频";
        else if (file.type.startsWith("video/")) sourceLabel = "文件上传-视频";
        else sourceLabel = "文件上传-文档";

        const asset: OfflineAssetItem = {
          id: createAssetId(),
          type: "upload",
          name: file.name,
          mimeType: file.type,
          dataUrl: String(reader.result || ""),
          createdAt: new Date().toISOString(),
          sourceLabel,
        };
        onAddAsset(asset);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAsset = (assetId: string) => {
    setAssetToDelete(assetId);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveAsset = () => {
    if (assetToDelete) {
      onRemoveAsset(assetToDelete);
      setShowDeleteConfirm(false);
      setAssetToDelete(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return { icon: ImageIcon, color: "text-purple-400", bg: "bg-purple-950/40" };
    }
    if (mimeType.startsWith("video/")) {
      return { icon: FileVideo, color: "text-indigo-400", bg: "bg-indigo-950/40" };
    }
    if (mimeType.startsWith("audio/")) {
      return { icon: Music, color: "text-pink-400", bg: "bg-pink-950/40" };
    }
    if (mimeType.includes("pdf")) {
      return { icon: FileText, color: "text-red-400", bg: "bg-red-950/40" };
    }
    if (mimeType.includes("word") || mimeType.includes("office-document.wordprocessingml")) {
      return { icon: FileText, color: "text-blue-400", bg: "bg-blue-950/40" };
    }
    if (mimeType.includes("excel") || mimeType.includes("spreadsheetml")) {
      return { icon: FileSpreadsheet, color: "text-emerald-400", bg: "bg-emerald-950/40" };
    }
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
      return { icon: FileVideo, color: "text-orange-400", bg: "bg-orange-950/40" };
    }
    if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("7z")) {
      return { icon: FileBox, color: "text-amber-400", bg: "bg-amber-950/40" };
    }
    return { icon: FileIcon, color: "text-slate-400", bg: "bg-slate-800/40" };
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between gap-3 text-xs">
      {/* Tab Switcher - Generous 44px min targets */}
      <div className="flex flex-col gap-2 pb-2 border-b border-slate-800/50 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1 w-full">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onTabChange("offline")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "offline"
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Camera className="h-4 w-4" />
            离线分析 (Offline)
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onTabChange("realtime")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "realtime"
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="h-4 w-4" />
            实时分析 (Realtime)
          </motion.button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        className="hidden"
        onChange={(event) => processFiles(event.target.files)}
      />

      {/* Quick Action Cards - Large, Touch Friendly, with Pressed scale feedback */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-2xl border border-slate-800 bg-[#131a2d] p-2.5 text-center transition-all hover:border-blue-500/50 hover:bg-blue-950/10 flex flex-col items-center justify-center min-h-[85px]"
        >
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-950/70 text-blue-400">
            <Upload className="h-4 w-4" />
          </div>
          <div className="text-[11px] font-bold text-slate-100">文件上传</div>
          <p className="mt-0.5 text-[9px] text-slate-500 line-clamp-1">本地图片/音频文件</p>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={startCamera}
          className="rounded-2xl border border-slate-800 bg-[#131a2d] p-2.5 text-center transition-all hover:border-amber-500/50 hover:bg-amber-950/10 flex flex-col items-center justify-center min-h-[85px]"
        >
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-950/70 text-amber-400">
            <Camera className="h-4 w-4" />
          </div>
          <div className="text-[11px] font-bold text-slate-100">现场拍摄</div>
          <p className="mt-0.5 text-[9px] text-slate-500 line-clamp-1">后置/前置拍照采集</p>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={isRecording ? stopRecording : startRecording}
          className={`rounded-2xl border p-2.5 text-center transition-all flex flex-col items-center justify-center min-h-[85px] ${
            isRecording
              ? "border-rose-500 bg-rose-950/30"
              : "border-slate-800 bg-[#131a2d] hover:border-rose-500/50 hover:bg-rose-950/10"
          }`}
        >
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-950/70 text-rose-400">
            {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-100">
              {isRecording ? "停止录音" : "现场录音"}
            </span>
            {isRecording && (
              <span className="rounded-full bg-rose-500/20 px-1 py-0.5 text-[8px] font-black text-rose-300">
                {formatDuration(recordingSeconds)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[9px] text-slate-500 line-clamp-1">高清语音采集</p>
        </motion.button>
      </div>

      {isCameraActive && (
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black">
            <video ref={videoRef} autoPlay playsInline className="aspect-video w-full object-cover" />
            <div className="absolute left-3 top-3 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              摄像头已启用
            </div>
          </div>
          <div className="flex gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={capturePhoto}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 active:bg-blue-700 shadow-md"
            >
              拍照并添加
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={stopCamera}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              取消
            </motion.button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Asset List Grid - No Hover dependence, Always-on touch friendly controls */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-2.5 flex flex-col flex-1 min-h-[90px] h-0">
        <div className="mb-1.5 flex items-center justify-between shrink-0">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            素材资源库 ({assets.length})
          </h4>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          {assets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/60 bg-slate-950/40 text-center p-3">
              <Upload className="h-4 w-4 text-slate-600 mb-1" />
              <p className="text-[10px] text-slate-500">暂无素材，请先通过上方按钮采集或上传。</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 items-center justify-start min-h-full py-1 w-full">
              {assets.map((asset) => {
                const { icon: Icon, color, bg } = getFileIcon(asset.mimeType);
                const isImage = asset.mimeType.startsWith("image/");
                const isVideo = asset.mimeType.startsWith("video/");

                return (
                  <motion.div
                    key={asset.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setPreviewAsset(asset)}
                    className="relative cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 transition-all hover:border-blue-500/30 w-[170px] h-[120px] shadow-lg flex flex-col"
                  >
                    {/* Preview Wrapper */}
                    <div className="relative flex-1 min-h-0 w-full overflow-hidden">
                      {isImage ? (
                        <img
                          src={asset.dataUrl}
                          alt={asset.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : isVideo ? (
                        <div className="flex h-full w-full items-center justify-center bg-slate-900">
                          <video
                            src={asset.dataUrl}
                            playsInline
                            className="h-full w-full object-cover opacity-50"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full bg-white/20 p-1.5 backdrop-blur-md">
                              <Play className="h-3.5 w-3.5 text-white" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-950/20">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                        </div>
                      )}

                      {/* Always Visible Delete Button for Tablets (No hover needed, prominent upper-right corner tap target) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAsset(asset.id);
                        }}
                        className="absolute right-1.5 top-1.5 z-10 rounded-lg bg-red-600/95 p-1 text-white shadow-lg active:scale-90 transition-transform flex items-center justify-center hover:bg-red-500"
                        style={{ minWidth: "26px", minHeight: "26px" }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Elegant overlay / bottom bar showing the item name */}
                    <div className="bg-slate-950 px-2 py-1.5 shrink-0 border-t border-slate-800/60 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-slate-300 font-bold truncate flex-1 leading-none">
                        {asset.name}
                      </span>
                      <span className="text-[7.5px] bg-slate-900 px-1 py-0.5 rounded text-slate-500 border border-slate-800/40 uppercase shrink-0 tracking-wider">
                        {asset.mimeType.split("/")[0]}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal - Large close targets, playsInline on preview video */}
      {previewAsset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#111827] p-4 shadow-2xl flex flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-100">{previewAsset.name}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {previewAsset.sourceLabel} · {previewAsset.mimeType}
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setPreviewAsset(null)}
                className="rounded-xl p-2.5 bg-slate-800 text-slate-400 hover:text-slate-200"
                style={{ minWidth: "44px", minHeight: "44px" }}
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>
            <div className="flex-1 min-h-[220px] max-h-[50vh] flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2">
              {previewAsset.mimeType.startsWith("image/") ? (
                <img
                  src={previewAsset.dataUrl}
                  alt={previewAsset.name}
                  className="max-h-[45vh] max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : previewAsset.mimeType.startsWith("video/") ? (
                <video
                  src={previewAsset.dataUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[45vh] max-w-full"
                />
              ) : previewAsset.mimeType.startsWith("audio/") ? (
                <div className="flex w-full flex-col items-center gap-4 p-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-950/40 text-pink-400">
                    <Music className="h-8 w-8" />
                  </div>
                  <audio src={previewAsset.dataUrl} controls className="w-full max-w-md" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${getFileIcon(previewAsset.mimeType).bg} ${getFileIcon(previewAsset.mimeType).color}`}>
                    {React.createElement(getFileIcon(previewAsset.mimeType).icon, { className: "h-8 w-8" })}
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">此格式暂不支持在平板上直接预览</p>
                    <a
                      href={previewAsset.dataUrl}
                      download={previewAsset.name}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                      下载到本地
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteConfirm(false);
                setAssetToDelete(null);
              }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-[360px] rounded-3xl border border-slate-800 bg-[#0f172a] p-5 shadow-2xl overflow-hidden z-[260]"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg bg-red-500/10 p-1.5">
                  <Trash2 className="h-4 w-4 text-red-400" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">确认删除该素材</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                删除后将无法恢复或在 AI 节点研判中调用，确定要删除吗？
              </p>
              <div className="mt-5 flex gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setAssetToDelete(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-3 text-xs font-bold text-slate-400 hover:text-slate-200"
                  style={{ minHeight: "44px" }}
                >
                  取消
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmRemoveAsset}
                  className="flex-[2] rounded-xl bg-red-600 py-3 text-xs font-bold text-white shadow-md shadow-red-950/50"
                  style={{ minHeight: "44px" }}
                >
                  确定删除
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
