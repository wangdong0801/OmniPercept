import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
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

interface OfflineAnalysisPanelProps {
  assets: OfflineAssetItem[];
  activeTab: AiWorkspaceTab;
  onTabChange: (tab: AiWorkspaceTab) => void;
  onAddAsset: (asset: OfflineAssetItem) => void;
  onRemoveAsset: (assetId: string) => void;
}

const createAssetId = () => `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const OfflineAnalysisPanel: React.FC<OfflineAnalysisPanelProps> = ({
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
    <div className="h-full flex flex-col space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/50 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-blue-400" />
            AI 分析素材准备
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            切换离线分析或实时分析模式，准备待分析的音视频素材或监控流。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => onTabChange("offline")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${activeTab === "offline" ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                离线分析
              </span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("realtime")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${activeTab === "realtime" ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                实时分析
              </span>
            </button>
          </div>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-2xl border border-slate-800 bg-[#131a2d] p-5 text-left transition-all hover:border-blue-500 hover:bg-blue-950/20"
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-950/70 text-blue-400">
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-slate-100">文件上传</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            可同时上传图片和音频等文件，上传后立即加入素材列表。
          </p>
        </button>

        <button
          type="button"
          onClick={startCamera}
          className="rounded-2xl border border-slate-800 bg-[#131a2d] p-5 text-left transition-all hover:border-amber-500 hover:bg-amber-950/20"
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-950/70 text-amber-400">
            <Camera className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-slate-100">现场拍摄</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            调用现场摄像头采集图像，拍摄后自动加入图片素材列表。
          </p>
        </button>

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`rounded-2xl border p-5 text-left transition-all ${isRecording
            ? "border-rose-500 bg-rose-950/20"
            : "border-slate-800 bg-[#131a2d] hover:border-rose-500 hover:bg-rose-950/20"
            }`}
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-950/70 text-rose-400">
            {isRecording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-100">
              {isRecording ? "停止现场录音" : "启动现场录音"}
            </span>
            {isRecording && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                {formatDuration(recordingSeconds)}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            录音素材只展示名称和类型，点击后可直接播放或删除。
          </p>
        </button>
      </div>

      {isCameraActive && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
            <video ref={videoRef} autoPlay playsInline className="aspect-video w-full object-cover" />
            <div className="absolute left-3 top-3 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              摄像头已连接
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              拍摄并加入列表
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              关闭摄像头
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-3 flex flex-col flex-grow">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            素材列表
          </h4>
        </div>
        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          {assets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-slate-600">
                <Upload className="h-4 w-4" />
              </div>
              <p className="text-xs text-slate-500">暂无素材，可通过上方功能按钮添加。</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 pb-2">
              {assets.map((asset) => {
                const { icon: Icon, color, bg } = getFileIcon(asset.mimeType);
                const isImage = asset.mimeType.startsWith("image/");
                const isVideo = asset.mimeType.startsWith("video/");

                // 提取纯文件名和扩展名
                const lastDotIndex = asset.name.lastIndexOf(".");
                const extension = lastDotIndex !== -1 ? asset.name.slice(lastDotIndex + 1) : asset.mimeType.split("/")[1] || "file";
                const pureName = lastDotIndex !== -1 ? asset.name.slice(0, lastDotIndex) : asset.name;

                return (
                  <div
                    key={asset.id}
                    onClick={() => setPreviewAsset(asset)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 transition-all hover:border-blue-500/50 hover:bg-slate-950/60 hover:shadow-xl hover:shadow-blue-900/5 w-32 h-20"
                  >
                    {/* 预览区域 */}
                    <div className="h-full w-full">
                      {isImage ? (
                        <img
                          src={asset.dataUrl}
                          alt={asset.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : isVideo ? (
                        <div className="flex h-full w-full items-center justify-center bg-slate-900">
                          <video
                            src={asset.dataUrl}
                            className="h-full w-full object-cover opacity-50"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full bg-white/10 p-2 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-white/20">
                              <Play className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-950/30">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${bg} ${color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      )}

                      {/* 悬停时的删除按钮 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAsset(asset.id);
                        }}
                        className="absolute right-1 top-1 z-10 rounded-lg bg-slate-950/60 p-1.5 text-slate-400 opacity-0 backdrop-blur-md transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-[#111827] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-100">{previewAsset.name}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {previewAsset.sourceLabel} · {previewAsset.mimeType}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
              {previewAsset.mimeType.startsWith("image/") ? (
                <img
                  src={previewAsset.dataUrl}
                  alt={previewAsset.name}
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : previewAsset.mimeType.startsWith("video/") ? (
                <video
                  src={previewAsset.dataUrl}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full"
                />
              ) : previewAsset.mimeType.startsWith("audio/") ? (
                <div className="flex w-full flex-col items-center gap-6 p-8">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-pink-950/40 text-pink-400">
                    <Music className="h-12 w-12" />
                  </div>
                  <audio src={previewAsset.dataUrl} controls className="w-full max-w-md" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 p-12">
                  <div className={`flex h-24 w-24 items-center justify-center rounded-3xl ${getFileIcon(previewAsset.mimeType).bg} ${getFileIcon(previewAsset.mimeType).color}`}>
                    {React.createElement(getFileIcon(previewAsset.mimeType).icon, { className: "h-12 w-12" })}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-300">该文件类型暂不支持直接预览</p>
                    <a
                      href={previewAsset.dataUrl}
                      download={previewAsset.name}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
                    >
                      下载文件
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteConfirm(false);
                setAssetToDelete(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[400px] rounded-3xl border border-slate-800 bg-[#0f172a] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-red-500/10 p-1.5">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">确认删除 (Confirm Delete)</h2>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setAssetToDelete(null);
                  }}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-3 text-slate-300">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-sm leading-relaxed">
                    确定要删除该素材吗？此操作不可撤销，删除后将无法在分析列表中找回。
                  </p>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setAssetToDelete(null);
                    }}
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-900 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={confirmRemoveAsset}
                    className="flex-[2] rounded-lg bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-500"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
