
import { GoogleGenAI, Type } from "@google/genai";
import { LabelExtractionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractLabelInfo(base64Image: string): Promise<LabelExtractionResult> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the product label in this image and extract the following information.
    The label is likely for a medical product (e.g., peritoneal dialysis solution).
    Return the data in a strict JSON format.
    
    Fields to extract:
    1. thaiName: The Thai name of the product (e.g., น้ำยาล้างไตทางช่องท้อง).
    2. englishName: The English name of the product.
    3. batchNo: The Batch number (often labeled as "Batch No." or "Lot").
    4. mfd: Manufacture date. Return in YYYY-MM-DD format if possible.
    5. exp: Expiry date. Return in YYYY-MM-DD format if possible.
    6. manufacturer: The name of the manufacturing company.
    
    If any field is not found, return an empty string for that field.
    Only return the JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thaiName: { type: Type.STRING },
            englishName: { type: Type.STRING },
            batchNo: { type: Type.STRING },
            mfd: { type: Type.STRING },
            exp: { type: Type.STRING },
            manufacturer: { type: Type.STRING },
          },
          required: ["thaiName", "englishName", "batchNo", "mfd", "exp", "manufacturer"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as LabelExtractionResult;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to process the label. Please ensure the image is clear.");
  }
}
