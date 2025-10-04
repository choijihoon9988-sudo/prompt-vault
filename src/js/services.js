import { APP_CONFIG } from "../config.js";

// 외부 API 연동 또는 복잡한 비즈니스 로직을 처리하는 서비스 모듈
class Services {
    /**
     * '전략가 AI'가 Google Gemini API를 호출하여 프롬프트 초안을 생성합니다.
     * @param {string} userInput - 사용자가 입력한 원본 텍스트
     * @returns {Promise<string>} AI가 생성한 프롬프트 초안
     */
    async getAIStrategistDraft(userInput) {
        const { API_KEY, MODEL_NAME, STRATEGIST_AI_PROMPT_TEMPLATE } = APP_CONFIG.AI_SERVICE;

        if (!API_KEY || API_KEY === "AIzaSyDSIRzDsbonDZwuDB6RRmYYy-vR2Cqupmg") {
            console.error("API key not found. Please set your API key in config.js");
            return "## ⚠️ API 키 오류\n\n`src/config.js` 파일에 당신의 Google Gemini API 키를 입력해주세요.";
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const fullPrompt = STRATEGIST_AI_PROMPT_TEMPLATE.replace('{userInput}', userInput);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: fullPrompt }]
                    }]
                })
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("API request failed with status:", response.status, errorBody);
                throw new Error(`API 요청 실패: ${response.status} - ${errorBody.error?.message || '알 수 없는 오류'}`);
            }

            const data = await response.json();
            
            // API 응답에서 텍스트 추출
            const draft = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!draft) {
                console.error("Invalid API response structure:", data);
                throw new Error("API로부터 유효한 초안을 받지 못했습니다.");
            }
            
            return draft;

        } catch (error) {
            console.error("AI Draft generation failed:", error);
            return `## ❌ AI 초안 생성 실패\n\n오류가 발생했습니다: ${error.message}\n\n- API 키가 올바른지 확인해주세요.\n- 브라우저 개발자 콘솔(F12)에서 더 자세한 오류를 확인할 수 있습니다.`;
        }
    }
}

export const services = new Services();