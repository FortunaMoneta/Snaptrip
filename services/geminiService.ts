import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptAnalysis } from "../types";

const SYSTEM_INSTRUCTION = `
당신은 'Travel Admin Sorter' 앱의 핵심 분석 엔진입니다. 
사용자가 업로드한 영수증 이미지나 텍스트를 분석하여 JSON 구조로 응답하세요.

[분류 규칙]
1. 계층 구조 분석: 상호명에 '호텔, 백화점, 공항, 몰' 등의 위치 정보와 '레스토랑, 카페, 식당, 마트' 등의 업종 정보가 섞여 있다면, 반드시 '업종 정보'를 우선순위로 하여 카테고리를 분류합니다.
2. 카테고리 리스트: [식비, 숙소, 교통, 쇼핑, 관광, 기타] 중 하나로 선택합니다.
3. 위치 기반 좌표: 상호명과 주소를 바탕으로 해당 장소의 대략적인 위도(latitude)와 경도(longitude)를 추정하여 함께 제공하세요. 지리적으로 정확할수록 좋습니다.
4. 시간 추출: 영수증에 시간이 있다면 24시간제(HH:mm) 형식으로 추출하세요. 없다면 12:00을 기본값으로 사용하세요.
`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    merchant_name: { type: Type.STRING, description: "추출된 상호명" },
    category: { 
      type: Type.STRING, 
      enum: ['식비', '숙소', '교통', '쇼핑', '관광', '기타'],
      description: "분류된 카테고리"
    },
    amount: { type: Type.NUMBER, description: "숫자만 추출된 금액" },
    currency: { type: Type.STRING, description: "통화 단위 (예: JPY, KRW, USD)" },
    date: { type: Type.STRING, description: "YYYY-MM-DD 형식" },
    time: { type: Type.STRING, description: "HH:mm 형식의 시간. 없으면 12:00" },
    address: { type: Type.STRING, nullable: true, description: "추출된 주소" },
    latitude: { type: Type.NUMBER, nullable: true, description: "위도 좌표" },
    longitude: { type: Type.NUMBER, nullable: true, description: "경도 좌표" },
    reasoning: { type: Type.STRING, description: "이 카테고리로 분류한 짧은 이유" }
  },
  required: ['merchant_name', 'category', 'amount', 'currency', 'date', 'reasoning']
};

export const analyzeReceipt = async (imageBase64: string | null, textPrompt: string | null): Promise<ReceiptAnalysis> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];

  if (imageBase64) {
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data
      }
    });
  }

  if (textPrompt) {
    parts.push({ text: textPrompt });
  } else if (!imageBase64) {
    throw new Error("이미지나 텍스트 중 하나는 필수입니다.");
  }
  
  if (!textPrompt) {
    parts.push({ text: "이 영수증을 분석해서 정보를 추출해주세요. 반드시 위경도 좌표(latitude, longitude) 정보를 포함하세요." });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    let resultText = response.text;
    if (!resultText) throw new Error("No response from Gemini.");
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(resultText) as ReceiptAnalysis;
    
    if (typeof parsedData.amount === 'string') {
        parsedData.amount = parseFloat((parsedData.amount as string).replace(/,/g, ''));
    }
    if (isNaN(parsedData.amount)) parsedData.amount = 0;

    return parsedData;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("영수증 분석 중 오류가 발생했습니다.");
  }
};

export const geocodeLocation = async (query: string): Promise<{ latitude: number; longitude: number; standardized_address?: string } | null> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `You are a geocoding assistant. Return the latitude and longitude for: "${query}". 
  If the location is ambiguous, choose the most likely popular tourist destination or city center matching the query.
  Also return a standardized address string.`;

  const GEOCODE_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
      latitude: { type: Type.NUMBER },
      longitude: { type: Type.NUMBER },
      standardized_address: { type: Type.STRING }
    },
    required: ['latitude', 'longitude']
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: GEOCODE_SCHEMA
      }
    });
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};
