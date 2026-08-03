import { GoogleGenAI, Chat } from "@google/genai";
import { SheetRow, VisibleFields } from '../types';

// FIX: Initialize GoogleGenAI with the API key directly from environment variables
// as per the coding guidelines, assuming it is pre-configured.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const fieldMapping = {
  period: ['시작일', '종료일'],
  inProgressTask: ['핵심과제(진행경과)'],
  plannedTask: ['핵심과제(예정)'],
  mainSchedule: ['주요일정'],
  issue: ['이슈'],
  businessTrip: ['출장(시작일)', '출장(종료일)', '출장내용'],
};

const filterDataByVisibleFields = (data: SheetRow[], visibleFields: VisibleFields): SheetRow[] => {
  return data.map(row => {
    // FIX: Use a type assertion to allow creating an empty object that will be populated dynamically.
    const newRow = {} as SheetRow;
    for (const key in visibleFields) {
      if (visibleFields[key as keyof VisibleFields]) {
        const correspondingSheetKeys = fieldMapping[key as keyof typeof fieldMapping];
        if (correspondingSheetKeys) {
          correspondingSheetKeys.forEach(sheetKey => {
            if (row[sheetKey] !== undefined) {
              newRow[sheetKey] = row[sheetKey];
            }
          });
        }
      }
    }
    // Always include '작성자' as it's a filter, not a display field
    if (row['작성자'] !== undefined) {
        newRow['작성자'] = row['작성자'];
    }
    return newRow;
  });
};

export const startAIChat = (contextData: SheetRow[], visibleFields: VisibleFields): Chat => {
    const filteredContextData = filterDataByVisibleFields(contextData, visibleFields);
    const systemInstruction = `You are a helpful assistant who answers questions based on data from a Google Sheet about project tasks.
Your knowledge is strictly limited to the data provided below.
Please provide concise and helpful answers in Korean.
The data columns are '시작일' (start date), '종료일' (end date), '핵심과제(진행경과)' (key tasks in progress), '핵심과제(예정)' (planned key tasks), '주요일정' (main schedule/event), '이슈' (issues), '출장(시작일)' (business trip start date), '출장(종료일)' (business trip end date), '출장내용' (business trip details), and '작성자' (author).
Do not make up information. If the answer is not in the data, say so in Korean.
You must maintain conversation context.

Here is the data you must use for this conversation:
---
${JSON.stringify(filteredContextData, null, 2)}
---`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });

    return chat;
};


// FIX: Reordered parameters so the optional `customPrompt` comes after the required `visibleFields`.
export const getAIReportSummary = async (data: SheetRow[], visibleFields: VisibleFields, customPrompt?: string): Promise<string> => {
  if (data.length === 0) {
    return "요약할 데이터가 없습니다.";
  }

  const filteredSummaryData = filterDataByVisibleFields(data, visibleFields);

  // Base prompt instructions that are always included
  const basePrompt = `
      You are an expert project manager assistant tasked with summarizing weekly reports based on the provided data.
      The output should be a concise, structured summary in Korean, suitable for a formal report document.
      Use markdown for formatting. Create main sections with bold, numbered headings (e.g., **1. Title**). All content under these headings must be presented as a bulleted list (using a hyphen '-').
      Minimize the use of other special characters and avoid emojis entirely.
      Please provide only the summary content, without any introductory or concluding remarks like "Here is the summary:".
  `;

  // Determine the specific instruction part based on user input
  const userInstruction = customPrompt?.trim()
    ? `The user has provided a specific instruction: "${customPrompt}". Please adapt the summary format to meet this request while still providing a clear, structured Korean summary.`
    : `Please organize the summary into the following sections:
      - **1. 종합 요약 (Overall Summary):** A bulleted list with a brief overview of key activities and progress.
      - **2. 주요 진행상황 (Key Progress):** A bulleted list of significant accomplishments from the '핵심과제(진행경과)' field.
      - **3. 예정된 주요과제 (Upcoming Key Tasks):** A bulleted list of important upcoming tasks from the '핵심과제(예정)' field.
      - **4. 핵심 이슈 (Critical Issues):** A bulleted list of identified issues from the '이슈' field. If there are no issues, state "해당 없음" as a single bullet point.
      - **5. 기타 참고사항 (Other Notes):** A bulleted list of any business trips or other important schedules ('주요일정').`;

  try {
    const prompt = `
      ${basePrompt}

      ${userInstruction}

      Here is the data for the selected period:
      ---
      ${JSON.stringify(filteredSummaryData, null, 2)}
      ---

      Your Summary (in Korean):
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for summary:", error);
    return "AI 요약을 생성하는 중에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};