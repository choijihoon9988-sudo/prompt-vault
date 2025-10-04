import { APP_CONFIG } from "../config.js";
import { API_KEYS } from "../api-keys.js";

// 외부 API 연동 또는 복잡한 비즈니스 로직을 처리하는 서비스 모듈
class Services {
    // '전략가 AI'의 프롬프트 초안 생성을 실제 Gemini API를 호출하여 수행
    async getAIStrategistDraft(userInput) {
        const fullPrompt = APP_CONFIG.AI_SERVICE.STRATEGIST_AI_PROMPT_TEMPLATE
           .replace('{userInput}', userInput);

        // Gemini API 엔드포인트 URL
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5pro:generateContent?key=${API_KEYS.GEMINI_API_KEY}`;

        // Gemini API 요청 본문 형식
        const requestBody = {
            contents: [{
                parts: [{
                    text: fullPrompt
                }]
            }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            
            // Gemini 응답 구조에 맞춰 결과 텍스트 추출
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error("API response did not contain candidates.");
            }
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error("Failed to fetch AI draft:", error);
            throw error; // 오류를 호출한 쪽으로 다시 던져서 처리하도록 함
        }
    }
}

export const services = new Services();