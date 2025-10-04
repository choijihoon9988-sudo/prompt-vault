import { APP_CONFIG } from "../config.js";
import { API_KEYS } from "../api-keys.js";

// 외부 API 연동 또는 복잡한 비즈니스 로직을 처리하는 서비스 모듈
class Services {
    // '전략가 AI'의 프롬프트 초안 생성을 실제 API를 호출하여 수행
    async getAIStrategistDraft(userInput) {
        const fullPrompt = APP_CONFIG.AI_SERVICE.STRATEGIST_AI_PROMPT_TEMPLATE
           .replace('{userInput}', userInput);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4-turbo", // 또는 선호하는 다른 모델
                    messages: [{ role: "user", content: fullPrompt }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error("Failed to fetch AI draft:", error);
            throw error; // 오류를 호출한 쪽으로 다시 던져서 처리하도록 함
        }
    }
}

export const services = new Services();