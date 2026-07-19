import { GoogleGenAI, Type } from "@google/genai";

export async function analyzeWithGemini(params: {
  fileData: string;
  mimeType: string;
  scenarioId: string;
  scenarioName: string;
  customPrompt: string;
  model?: string;
  customApiKey?: string | null;
}) {
  const { fileData, mimeType, scenarioName, customPrompt, model, customApiKey } = params;

  // Resolve API Key
  const apiKey = customApiKey || localStorage.getItem("user_gemini_api_key") || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) {
    throw new Error("Gemini API 密钥未配置。请在页面右上角设置中添加 API Key，或通过后台环境变量注入。");
  }

  // Initialize client
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build-client",
      },
    },
  });

  const cleanMimeType = mimeType.split(";")[0];
  const isAudio = cleanMimeType.startsWith("audio/");
  const isImage = cleanMimeType.startsWith("image/");

  const base64Clean = fileData.includes(";base64,")
    ? fileData.split(";base64,")[1]
    : fileData;

  let systemInstruction = "";
  if (isImage) {
    systemInstruction = `你是一个高级多模态视觉分析大师。你需要根据用户选择的场景[${scenarioName}]对上传的图片进行深度识别、推导和专业分析。
请严格遵循以下指南：
1. 分析过程：必须模拟并给出至少3个清晰的逐步推导分析阶段（如：图像特征检测、局部区域缩放、多维度语义模型比对、最终决策）。
2. 分析结果：根据所选场景输出结构化的识别属性与结果。
3. 改进与操作建议：给出至少3条与场景高度契合的实用建议或注意事项。
4. 自定义偏向：如果用户提供了自定义指令：“${customPrompt || '无'}”，请在分析时重点关注该指令指向的维度。`;
  } else if (isAudio) {
    systemInstruction = `你是一个高级音频特征与语音识别分析大师。你需要根据用户选择的场景[${scenarioName}]对上传的音频/录音进行深度识别、翻译/听写、情绪与声学特征分析。
请严格遵循以下指南：
1. 分析过程：必须模拟并给出至少3个清晰的逐步推导分析阶段（如：音轨频谱预处理、短时能量/倒谱特征提取、语义声学模型结合、情绪意图映射）。
2. 分析结果：提供语音转文字听写、情绪基调检测、说话人特征及核心意图。
3. 改进与操作建议：给出至少3条高度契合音频内容的对应建议或回复建议。
4. 自定义偏向：如果用户提供了自定义指令：“${customPrompt || '无'}”，请在分析时重点关注该指令指向的维度。`;
  } else {
    systemInstruction = `你是一个高级多模态智能分析师。请针对上传的文件 and 场景[${scenarioName}]进行全方位深度结构化分析与诊断。`;
  }

  const mediaPart = {
    inlineData: {
      mimeType: cleanMimeType,
      data: base64Clean,
    },
  };

  const textPart = {
    text: `分析输入文件。当前场景：${scenarioName}。用户补充关注点：${customPrompt || "无"}`
  };

  const primaryModel = model || "gemini-2.5-flash";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "识别目标的主要名称或核心内容概括（不超过15个字）" },
      summary: { type: Type.STRING, description: "一句话简明扼要的总结" },
      confidence: { type: Type.INTEGER, description: "识别置信度分数，范围 0 到 100" },
      processSteps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            phase: { type: Type.STRING, description: "分析阶段名称" },
            detail: { type: Type.STRING, description: "对该分析阶段在此输入文件上的具体执行逻辑和推导过程" }
          },
          required: ["phase", "detail"]
        }
      },
      results: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "识别属性名称（例如：主要物品、色彩倾向、听写文字、情绪基调等）" },
            value: { type: Type.STRING, description: "该属性对应的具体识别结果" }
          },
          required: ["label", "value"]
        }
      },
      suggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "建议类别，例如：使用建议、注意事项、下一步行动等" },
            text: { type: Type.STRING, description: "具体的建议内容描述" }
          },
          required: ["category", "text"]
        }
      }
    },
    required: ["title", "summary", "confidence", "processSteps", "results", "suggestions"]
  };

  try {
    const response = await client.models.generateContent({
      model: primaryModel,
      contents: { parts: [mediaPart, textPart] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    if (!response.text) {
      throw new Error("Gemini returned empty text response");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    if (primaryModel !== "gemini-2.5-flash") {
      console.warn("Primary model failed, trying fallback gemini-2.5-flash...", error);
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [mediaPart, textPart] },
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });
      if (!response.text) {
        throw new Error("Gemini returned empty text response");
      }
      return JSON.parse(response.text);
    } else {
      throw error;
    }
  }
}
