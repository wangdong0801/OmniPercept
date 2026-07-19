import React, { useState, useEffect, useRef } from "react";
import { Bot, Image as ImageIcon, Mic, PlaySquare, Wrench, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { AgentTemplate } from "../../types";

interface TemplateSelectorPanelProps {
  templates: AgentTemplate[];
  selectedTemplateId: string;
  pendingTemplateId?: string | null;
  onSelectTemplate: (template: AgentTemplate) => void;
  disabled?: boolean;
}

const InfoBadge: React.FC<{ icon: React.ReactNode; label: string; items: string[] }> = ({
  icon,
  label,
  items,
}) => {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500/80">
        <span className="text-blue-400/60">{icon}</span>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="relative overflow-hidden rounded-md border border-slate-800 bg-slate-900/40 px-2 py-0.5 text-[10px] text-slate-400 transition-colors"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export const TemplateSelectorPanel: React.FC<TemplateSelectorPanelProps> = ({
  templates,
  selectedTemplateId,
  pendingTemplateId = null,
  onSelectTemplate,
  disabled = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);

  // 响应式处理：根据窗口宽度决定每页显示数量
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setItemsPerPage(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(3);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const maxIndex = Math.max(0, templates.length - itemsPerPage);
  
  // 确保索引不越界
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex);
    }
  }, [maxIndex, currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  const scrollTo = (index: number) => {
    setCurrentIndex(Math.min(maxIndex, Math.max(0, index)));
  };

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < maxIndex;

  // 计算轮播指示器数量
   const totalSteps = templates.length > itemsPerPage ? templates.length - itemsPerPage + 1 : 0;

   // 拖拽处理
   const onDragEnd = (event: any, info: any) => {
     const threshold = 50; // 触发滑动的阈值
     if (info.offset.x < -threshold && canNext) {
       handleNext();
     } else if (info.offset.x > threshold && canPrev) {
       handlePrev();
     }
   };

   return (
    <div className="relative group/carousel w-full flex flex-col gap-3">
      {/* 轮播主体容器 */}
      <div className="relative overflow-hidden -mx-2 px-2 -my-4 py-4">
        <motion.div
          className="flex gap-4 cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }} // 限制拖拽位移由 animate 统一控制
          onDragEnd={onDragEnd}
          animate={{ x: `calc(-${currentIndex} * ((100% - ${(itemsPerPage - 1) * 16}px) / ${itemsPerPage} + 16px))` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {templates.map((template, idx) => {
            const isSelected = template.id === selectedTemplateId;
            const isPending = template.id === pendingTemplateId;
            return (
              <motion.button
                key={template.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !disabled && onSelectTemplate(template)}
                style={{ width: `calc((100% - ${(itemsPerPage - 1) * 16}px) / ${itemsPerPage})` }}
                className={`flex-shrink-0 group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ease-out min-h-[190px] ${
                  isSelected
                    ? "border-blue-500 bg-gradient-to-b from-blue-950/20 to-slate-900/40 shadow-[0_0_25px_rgba(59,130,246,0.18)] ring-1 ring-blue-500/30"
                    : isPending
                      ? "border-amber-500/80 bg-gradient-to-b from-amber-950/20 to-slate-900/40 shadow-[0_0_25px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30"
                      : "border-slate-800/80 bg-slate-950/40 backdrop-blur-sm hover:border-slate-700/80 hover:bg-slate-900/60 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.6)]"
                }`}
              >
                {/* 选中/预约时的顶部发光细条 */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-sky-400 to-blue-600 shadow-[0_1px_8px_rgba(56,189,248,0.4)]" />
                )}
                {isPending && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 shadow-[0_1px_8px_rgba(245,158,11,0.4)]" />
                )}

                {/* 鼠标悬停光圈效果 */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-[-1px] rounded-2xl bg-gradient-to-r from-blue-500/10 via-transparent to-blue-500/10" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06)_0%,transparent_70%)]" />
                </div>

                {/* 背景科技感装饰 */}
                <div className={`absolute -right-8 -top-8 h-20 w-20 rounded-full transition-all duration-700 ${
                  isSelected ? "bg-blue-500/10 blur-2xl scale-125" : isPending ? "bg-amber-500/10 blur-2xl scale-125" : "bg-transparent group-hover:bg-blue-500/5 group-hover:blur-xl"
                }`} />

                <div className="relative z-10 h-full flex flex-col w-full">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className={`text-base font-bold transition-colors duration-300 line-clamp-1 ${
                        isSelected ? "text-blue-400" : isPending ? "text-amber-400" : "text-slate-100 group-hover:text-blue-400"
                      }`}>
                        {template.name}
                      </div>
                      <p className={`text-[11px] leading-relaxed transition-colors duration-300 line-clamp-2 h-8 ${
                        isSelected ? "text-slate-300" : isPending ? "text-slate-300" : "text-slate-500 group-hover:text-slate-400"
                      }`}>
                        {template.description}
                      </p>
                    </div>

                    <div className="relative w-5 h-5 shrink-0">
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                            className="absolute inset-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 shrink-0"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </motion.div>
                        )}
                        {isPending && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                            className="absolute inset-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30 shrink-0"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* 资源依赖库详情 - 适度紧凑 */}
                  <div className={`flex-1 space-y-2 border-t pt-3 transition-colors duration-300 ${
                    isSelected ? "border-blue-500/20" : isPending ? "border-amber-500/20" : "border-slate-800/50"
                  }`}>
                    {(template.videoLibraries.length > 0 ||
                      template.imageLibraries.length > 0 ||
                      template.audioLibraries.length > 0) && (
                        <div className="space-y-1.5">
                          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                            isSelected ? "text-blue-400/80" : isPending ? "text-amber-400/80" : "text-slate-500/70 group-hover:text-slate-400/80"
                          }`}>
                            <PlaySquare className={`h-3 w-3 transition-transform duration-300 ${isSelected ? "text-blue-400" : isPending ? "text-amber-400" : "group-hover:scale-110"}`} />
                            资源依赖库
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[...template.videoLibraries, ...template.imageLibraries, ...template.audioLibraries].slice(0, 3).map((lib) => (
                              <span
                                key={lib}
                                className={`rounded px-2 py-0.5 text-[10px] border transition-all duration-300 ${
                                  isSelected 
                                    ? "border-blue-500/25 bg-blue-500/10 text-blue-300" 
                                    : isPending
                                      ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                      : "border-slate-800/50 bg-slate-900/30 text-slate-500 group-hover:border-slate-700/50 group-hover:text-slate-400"
                                }`}
                              >
                                {lib}
                              </span>
                            ))}
                            {[...template.videoLibraries, ...template.imageLibraries, ...template.audioLibraries].length > 3 && (
                              <span className={`text-[10px] self-center transition-colors duration-300 ${
                                isSelected ? "text-blue-400 font-bold" : isPending ? "text-amber-400 font-bold" : "text-slate-600 group-hover:text-slate-400"
                              }`}>
                                +{(template.videoLibraries.length + template.imageLibraries.length + template.audioLibraries.length) - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* 底部选择状态 */}
                  <div className={`mt-3 flex items-center justify-end border-t pt-2.5 h-7 transition-colors duration-300 ${
                    isSelected ? "border-blue-500/20" : isPending ? "border-amber-500/20" : "border-slate-800/50"
                  }`}>
                    {pendingTemplateId && isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.1)] h-[18px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        当前分析结果
                      </span>
                    ) : pendingTemplateId && isPending ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.1)] h-[18px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        下轮分析生效
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium h-[18px]">
                        <span className={`transition-colors duration-300 ${
                          isSelected 
                            ? "text-blue-400 font-bold" 
                            : isPending 
                              ? "text-amber-400 font-bold" 
                              : "text-slate-500 group-hover:text-slate-400"
                        }`}>
                          {isSelected 
                            ? "当前已选" 
                            : (pendingTemplateId ? "更换下轮模版" : "选择模板")
                          }
                        </span>
                        <div className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                          isSelected 
                            ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" 
                            : isPending
                              ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse"
                              : "bg-slate-700 group-hover:bg-blue-400"
                        }`} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* 左右切换按钮 - 移动到最外层以避免被 overflow-hidden 裁剪 */}
      {templates.length > itemsPerPage && (
        <>
          <button
            onClick={handlePrev}
            disabled={!canPrev}
            className={`absolute left-0 top-[45%] -translate-y-1/2 z-20 h-9 w-9 flex items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 backdrop-blur-md transition-all duration-300 ${
              canPrev ? "opacity-0 group-hover/carousel:opacity-100 translate-x-2" : "opacity-0 pointer-events-none"
            } hover:bg-blue-600 hover:text-white hover:border-blue-500 shadow-xl`}
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleNext}
            disabled={!canNext}
            className={`absolute right-0 top-[45%] -translate-y-1/2 z-20 h-9 w-9 flex items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 backdrop-blur-md transition-all duration-300 ${
              canNext ? "opacity-0 group-hover/carousel:opacity-100 -translate-x-2" : "opacity-0 pointer-events-none"
            } hover:bg-blue-600 hover:text-white hover:border-blue-500 shadow-xl`}
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </>
      )}

      {/* 分页指示器 */}
      {templates.length > itemsPerPage && (
        <div className="flex justify-center items-center gap-2 mt-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`h-1.5 transition-all duration-300 rounded-full ${
                currentIndex === i ? "w-5 bg-blue-500" : "w-1.5 bg-slate-800 hover:bg-slate-700"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

