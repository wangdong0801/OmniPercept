import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Image as ImageIcon, 
  Volume2, 
  Mic, 
  Square, 
  X, 
  RefreshCw, 
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Camera
} from "lucide-react";

import { AnalysisResult } from "../types";

const getStableCoordinates = (label: string, index: number) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const left = 15 + (Math.abs(hash) % 55); // 15% to 70%
  const top = 20 + (Math.abs(hash >> 3) % 45);  // 20% to 65%
  const width = 15 + (Math.abs(hash >> 6) % 25); // 15% to 40%
  const height = 12 + (Math.abs(hash >> 9) % 20); // 12% to 32%
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
};

const getStableAudioTime = (label: string, index: number) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const startSec = Math.abs(hash) % 5; // 0 to 4 sec
  const duration = 2 + (Math.abs(hash >> 3) % 4); // 2 to 5 sec
  return { start: `00:0${startSec}`, end: `00:0${startSec + duration}` };
};

interface FileUploaderProps {
  onFileSelected: (base64Data: string, mimeType: string, fileName: string) => void;
  selectedScenarioType: "image" | "audio" | "both";
  placeholder: string;
  isAnalyzing?: boolean;
  analysisResult?: AnalysisResult | null;
  activeHighlightLabel?: string | null;
  setActiveHighlightLabel?: (label: string | null) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  selectedScenarioType,
  placeholder,
  isAnalyzing = false,
  analysisResult = null,
  activeHighlightLabel = null,
  setActiveHighlightLabel
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordingWaves, setRecordingWaves] = useState<number[]>([15, 25, 12, 45, 30, 60, 20, 15, 35, 10]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Camera states & refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Auto clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      cameraStreamRef.current = stream;
      setIsCameraActive(true);
      // Wait for React to render the video element, then bind stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 150);
    } catch (err: any) {
      console.error("Failed to access camera:", err);
      setRecordError("无法启动摄像头。请确保在浏览器中授予了摄像头权限。");
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const base64Data = canvas.toDataURL("image/jpeg");
          const generatedFileName = `现场拍照_${new Date().toLocaleTimeString("zh-CN")}.jpg`;
          
          setFileName(generatedFileName);
          setFileMime("image/jpeg");
          setFilePreview(base64Data);
          onFileSelected(base64Data, "image/jpeg", generatedFileName);
          stopCamera();
        }
      } catch (err) {
        console.error("Capture failed:", err);
        setRecordError("拍摄照片失败，请重试或直接上传文件。");
      }
    }
  };

  // Handle timer during recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Simple voice meter visual effect
      waveIntervalRef.current = setInterval(() => {
        setRecordingWaves(() => 
          Array.from({ length: 14 }, () => Math.floor(Math.random() * 55) + 10)
        );
      }, 120);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
      setRecordingDuration(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    };
  }, [isRecording]);

  const processFile = (file: File) => {
    if (!file) return;

    // Check type constraints
    const isImageFile = file.type.startsWith("image/");
    const isAudioFile = file.type.startsWith("audio/");

    if (selectedScenarioType === "image" && !isImageFile) {
      alert("当前场景需要上传图片文件（如 PNG, JPEG, WEBP 等）！");
      return;
    }
    if (selectedScenarioType === "audio" && !isAudioFile) {
      alert("当前场景需要上传音频文件（如 MP3, WAV, M4A 等）！");
      return;
    }
    if (selectedScenarioType === "both" && !isImageFile && !isAudioFile) {
      alert("请上传有效的工厂现场图像（PNG, JPEG, WEBP）或异常运转音频（WAV, MP3, M4A）！");
      return;
    }

    setFileName(file.name);
    setFileMime(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      setFilePreview(base64Data);
      onFileSelected(base64Data, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    stopCamera();
    stopRecording();
    setFilePreview(null);
    setFileName(null);
    setFileMime(null);
    setRecordError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Callback clear state
    onFileSelected("", "", "");
  };

  // Live voice recording logic
  const startRecording = async () => {
    setRecordError(null);
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine format
      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/ogg" };
      }
      if (!MediaRecorder.isTypeSupported("audio/ogg")) {
        options = { mimeType: "" }; // default browser format
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const generatedFileName = `语音录音_${new Date().toLocaleTimeString("zh-CN")}.webm`;
        
        setFileName(generatedFileName);
        setFileMime(audioBlob.type);

        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = reader.result as string;
          setFilePreview(base64Data);
          onFileSelected(base64Data, audioBlob.type, generatedFileName);
        };
        reader.readAsDataURL(audioBlob);

        // Turn off microphone tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // Slice size
      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to access microphone:", err);
      setRecordError("无法启动麦克风。请确保已在浏览器中授予麦克风权限。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-[11px] font-bold text-blue-400 border border-blue-800/80">1</span>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            第一步：上传或录制 analysis 素材
          </h3>
        </div>
        {(selectedScenarioType === "audio" || selectedScenarioType === "both") && (
          <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 bg-blue-950/40 border border-blue-900/40 px-2 py-0.5 rounded-md self-start sm:self-auto">
            <Mic className="h-3 w-3" /> 支持实时麦克风录音
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Main interactive loading block */}
        <div 
          className={`md:col-span-12 rounded-xl border-2 border-dashed transition-all duration-300 relative ${
            dragActive ? "border-blue-500 bg-blue-950/20" : "border-slate-800 bg-slate-950"
          } ${filePreview ? "py-4 px-6" : "p-8 text-center"}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <input
            id="hidden-file-input"
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={selectedScenarioType === "image" ? "image/*" : selectedScenarioType === "audio" ? "audio/*" : "image/*,audio/*"}
            onChange={handleChange}
          />

          {!filePreview && !isRecording && !isCameraActive && (
            <div className="p-2">
              <p className="text-xs text-slate-400 font-semibold mb-4 text-center">
                {placeholder || "请选择以下最便捷的方式之一，提供现场诊断素材："}
              </p>
              
              <div className={`grid grid-cols-1 ${
                selectedScenarioType === "image" || selectedScenarioType === "audio" ? "sm:grid-cols-2" : "sm:grid-cols-3"
              } gap-4 max-w-4xl mx-auto`}>
                
                {/* 1. File Upload Button */}
                {(selectedScenarioType === "image" || selectedScenarioType === "both" || selectedScenarioType === "all") && (
                  <button
                    type="button"
                    onClick={onButtonClick}
                    className="flex flex-col items-center justify-center p-6 bg-[#131a2d] border border-slate-800 hover:border-blue-500 hover:bg-blue-950/30 rounded-2xl transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-lg hover:shadow-blue-950/20"
                  >
                    <div className="p-3.5 bg-blue-950/60 text-blue-400 rounded-full group-hover:bg-blue-900/60 group-hover:scale-105 transition-all">
                      <Upload className="h-6 w-6" />
                    </div>
                    <span className="mt-3 text-xs font-bold text-slate-200">
                      上传现场照片
                    </span>
                    <span className="mt-1 text-[10px] text-slate-500">
                      支持拖拽或直接选择本地图片文件
                    </span>
                  </button>
                )}

                {selectedScenarioType === "audio" && (
                  <button
                    type="button"
                    onClick={onButtonClick}
                    className="flex flex-col items-center justify-center p-6 bg-[#131a2d] border border-slate-800 hover:border-blue-500 hover:bg-blue-950/30 rounded-2xl transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-lg hover:shadow-blue-950/20"
                  >
                    <div className="p-3.5 bg-blue-950/60 text-blue-400 rounded-full group-hover:bg-blue-900/60 group-hover:scale-105 transition-all">
                      <Upload className="h-6 w-6" />
                    </div>
                    <span className="mt-3 text-xs font-bold text-slate-200">
                      上传现场音频
                    </span>
                    <span className="mt-1 text-[10px] text-slate-500">
                      支持拖拽或选择本地声音文件
                    </span>
                  </button>
                )}

                {/* 2. Live Camera Button */}
                {(selectedScenarioType === "image" || selectedScenarioType === "both" || selectedScenarioType === "all") && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center p-6 bg-[#131a2d] border border-slate-800 hover:border-amber-500 hover:bg-amber-950/30 rounded-2xl transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-lg hover:shadow-amber-950/20"
                  >
                    <div className="p-3.5 bg-amber-950/60 text-amber-400 rounded-full group-hover:bg-amber-900/60 group-hover:scale-105 transition-all">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="mt-3 text-xs font-bold text-slate-200">
                      现场相机拍照
                    </span>
                    <span className="mt-1 text-[10px] text-slate-500">
                      直接开启车间摄像头进行拍摄
                    </span>
                  </button>
                )}

                {/* 3. Live Audio recording Button */}
                {(selectedScenarioType === "audio" || selectedScenarioType === "both" || selectedScenarioType === "all") && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex flex-col items-center justify-center p-6 bg-[#131a2d] border border-slate-800 hover:border-rose-500 hover:bg-rose-950/30 rounded-2xl transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-lg hover:shadow-rose-950/20"
                  >
                    <div className="p-3.5 bg-rose-950/60 text-rose-400 rounded-full group-hover:bg-rose-900/60 group-hover:scale-105 transition-all">
                      <Mic className="h-6 w-6" />
                    </div>
                    <span className="mt-3 text-xs font-bold text-slate-200">
                      启动现场录音
                    </span>
                    <span className="mt-1 text-[10px] text-slate-500">
                      开启麦克风抓取车间异常噪音
                    </span>
                  </button>
                )}

              </div>
            </div>
          )}

          {/* Active Camera capturing state */}
          {isCameraActive && (
            <div className="flex flex-col items-center justify-center py-4 space-y-4 max-w-md mx-auto">
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                {/* Visual Scanner HUD effect */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-bounce z-10"></div>
                <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse z-10">
                  <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                  车间相机已连线
                </div>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex gap-3 justify-center w-full">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-full transition-all cursor-pointer border border-slate-700"
                >
                  <X className="h-4 w-4" />
                  关闭相机
                </button>
                
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-6 py-2.5 rounded-full shadow-lg shadow-blue-950/40 hover:scale-[1.02] transition-all cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  拍摄并保存
                </button>
              </div>
            </div>
          )}

          {/* Active Voice Recording state */}
          {isRecording && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="relative">
                {/* Visual pulse rings */}
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-25 scale-150"></div>
                <div className="h-14 w-14 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md relative z-10">
                  <Mic className="h-6 w-6 animate-bounce" />
                </div>
              </div>

              <div className="space-y-1 text-center">
                <p className="text-sm font-bold text-slate-200">正在录音...</p>
                <p className="text-xl font-mono font-semibold text-red-500">
                  {formatDuration(recordingDuration)}
                </p>
              </div>

              {/* Sound waves graphic */}
              <div className="flex items-center gap-1 h-12 py-2">
                {recordingWaves.map((height, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-all duration-100"
                    style={{ height: `${height}%` }}
                  ></span>
                ))}
              </div>

              <button
                id="btn-stop-record"
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-medium px-4 py-2 rounded-full border border-slate-700 transition-all duration-200"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                停止并保存录音
              </button>
            </div>
          )}

          {/* File selected and Preview state */}
          {filePreview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded-lg">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-100 line-clamp-1 max-w-xs md:max-w-md">
                      {fileName}
                    </h4>
                    <p className="text-[10px] font-mono text-slate-500">
                      {(fileMime || "未知媒体").toUpperCase()}
                    </p>
                  </div>
                </div>

                <button
                  id="btn-clear-file"
                  type="button"
                  onClick={clearFile}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
                  title="移除此素材"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Media Preview Render */}
              <div className="flex flex-col items-center bg-slate-950 rounded-xl overflow-hidden p-3 border border-slate-850 select-none w-full">
                {fileMime?.startsWith("image/") ? (
                  <div className="relative overflow-hidden rounded-lg w-full flex justify-center max-h-80">
                    <img
                      src={filePreview}
                      alt="Uploaded preview"
                      className="max-h-72 object-contain rounded-lg shadow-md border border-slate-850"
                    />
                    
                    {/* Active Scanning Animation */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-blue-600/5 pointer-events-none overflow-hidden rounded-lg">
                        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_12px_#3b82f6] animate-laser"></div>
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(59,130,246,0.15)_95%)] bg-[size:100%_20px] pointer-events-none opacity-30"></div>
                      </div>
                    )}

                    {/* Interactive Target Bounding Box Overlays */}
                    {analysisResult && !isAnalyzing && (
                      <div className="absolute inset-0 pointer-events-none select-none">
                        {analysisResult.results.map((item, index) => {
                          const coords = getStableCoordinates(item.label, index);
                          const isHighlighted = activeHighlightLabel === item.label;
                          return (
                            <div
                              key={index}
                              className="absolute border-2 rounded transition-all duration-300 pointer-events-auto cursor-pointer"
                              style={{
                                left: coords.left,
                                top: coords.top,
                                width: coords.width,
                                height: coords.height,
                                borderColor: isHighlighted ? "#3b82f6" : "rgba(59, 130, 246, 0.4)",
                                backgroundColor: isHighlighted ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.03)",
                                boxShadow: isHighlighted ? "0 0 12px rgba(59, 130, 246, 0.6)" : "none",
                                zIndex: isHighlighted ? 20 : 10,
                              }}
                              onMouseEnter={() => setActiveHighlightLabel?.(item.label)}
                              onMouseLeave={() => setActiveHighlightLabel?.(null)}
                            >
                              {/* Label tag indicator */}
                              <div className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white transition-all duration-300 ${
                                isHighlighted ? "bg-blue-600 scale-105" : "bg-blue-900/80 text-blue-200"
                              }`}>
                                {item.label}
                              </div>
                              
                              {/* Bounding box corners HUD */}
                              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-blue-400"></div>
                              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-blue-400"></div>
                              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-blue-400"></div>
                              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-blue-400"></div>
                              
                              {/* Tooltip detail block */}
                              <div className={`absolute bottom-[-50px] left-1/2 transform -translate-x-1/2 bg-slate-950/95 border border-slate-800 text-slate-200 text-[10px] p-2 rounded-lg transition-all duration-300 pointer-events-none w-44 shadow-xl text-center z-30 leading-normal ${
                                isHighlighted ? "opacity-100 scale-100" : "opacity-0 scale-95"
                              }`}>
                                <span className="font-bold text-blue-400 block mb-0.5">{item.label}</span>
                                <span className="line-clamp-2 text-slate-300">{item.value}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 space-y-4 w-full">
                    <div className="relative">
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 scale-125"></div>
                      )}
                      <div className={`p-4 rounded-full border transition-all duration-300 ${
                        isAnalyzing 
                          ? "bg-blue-950/50 text-blue-400 border-blue-800/80 animate-pulse" 
                          : "bg-blue-950/40 text-blue-400 border-blue-900/40"
                      }`}>
                        <FileAudio className={`h-10 w-10 ${isAnalyzing ? "animate-bounce" : ""}`} />
                      </div>
                    </div>

                    {/* Scanning spectrum animation */}
                    {isAnalyzing && (
                      <div className="flex flex-col items-center justify-center space-y-2 py-1 w-full max-w-xs">
                        <div className="flex items-center gap-1 h-6 justify-center">
                          {Array.from({ length: 15 }).map((_, i) => (
                            <span
                              key={i}
                              className="w-1 rounded-full bg-blue-500 animate-pulse"
                              style={{
                                animationDelay: `${i * 0.08}s`,
                                height: `${10 + Math.random() * 85}%`
                              }}
                            ></span>
                          ))}
                        </div>
                        <span className="text-[10px] text-blue-400/80 font-mono tracking-wider animate-pulse text-center">正在智能解析音频声学特征...</span>
                      </div>
                    )}

                    {/* Native player */}
                    <audio
                      src={filePreview}
                      controls
                      className="w-full max-w-md h-11 shadow-md rounded-lg"
                    />

                    {/* Interactive timeline details below player */}
                    {analysisResult && !isAnalyzing && (
                      <div className="w-full max-w-lg mt-3 bg-slate-950/60 border border-slate-850 rounded-xl p-3.5 space-y-2.5 animate-fade-in text-left">
                        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                          <Volume2 className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                          声学诊断特征频段异常标记
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {analysisResult.results.map((item, index) => {
                            const time = getStableAudioTime(item.label, index);
                            const isHighlighted = activeHighlightLabel === item.label;
                            return (
                              <div
                                key={index}
                                className={`p-2.5 rounded-lg border transition-all duration-300 cursor-pointer ${
                                  isHighlighted
                                    ? "bg-blue-950/40 border-blue-800/80 shadow-md shadow-blue-950/15"
                                    : "bg-slate-900/40 border-slate-850 hover:border-slate-800"
                                }`}
                                onMouseEnter={() => setActiveHighlightLabel?.(item.label)}
                                onMouseLeave={() => setActiveHighlightLabel?.(null)}
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className={`font-bold transition-colors ${isHighlighted ? "text-blue-400" : "text-slate-300"}`}>
                                    {item.label}
                                  </span>
                                  <span className="font-mono bg-slate-850 px-1.5 py-0.2 rounded text-[9px] text-slate-400">
                                    {time.start} - {time.end}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                  {item.value}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Prompt */}
          {recordError && (
            <div className="mt-3 p-3 bg-red-950/40 text-red-400 text-xs rounded-xl flex items-start gap-2 border border-red-900/50">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{recordError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
