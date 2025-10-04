import { APP_CONFIG } from "../config.js";

// 외부 API 연동 또는 복잡한 비즈니스 로직을 처리하는 서비스 모듈
class Services {
    /**
     * '전략가 AI'가 Google Gemini API를 호출하여 프롬프트 초안을 생성합니다.
     * @param {string} userInput - 사용자가 입력한 원본 텍스트
     * @returns {Promise<{title: string, summary: string, draft: string}>} AI가 생성한 제목, 요약, 초안이 포함된 객체
     */
    async getAIStrategistDraft(userInput) {
        const { API_KEY, MODEL_NAME, STRATEGIST_AI_PROMPT_TEMPLATE } = APP_CONFIG.AI_SERVICE;

        if (!API_KEY || API_KEY === "YOUR_API_KEY") {
            console.error("API key not found. Please set your API key in config.js");
            return {
                title: "API 키 오류",
                summary: "`src/config.js` 파일에 당신의 Google Gemini API 키를 입력해주세요.",
                draft: "## ⚠️ API 키 오류\n\n`src/config.js` 파일에 당신의 Google Gemini API 키를 입력해주세요."
            };
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const fullPrompt = STRATEGIST_AI_PROMPT_TEMPLATE.replace('{userInput}', userInput);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("API request failed with status:", response.status, errorBody);
                throw new Error(`API 요청 실패: ${response.status} - ${errorBody.error?.message || '알 수 없는 오류'}`);
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
                console.error("Invalid API response structure:", data);
                throw new Error("API로부터 유효한 초안을 받지 못했습니다.");
            }
            
            // [수정] AI가 반환한 JSON 문자열을 파싱하여 객체로 변환
            const match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonString = match ? match[1] : rawText;
            const result = JSON.parse(jsonString);

            if (!result.title || !result.summary || !result.draft) {
                 throw new Error("API 응답에 title, summary, draft 필드가 모두 포함되지 않았습니다.");
            }

            return result;

        } catch (error) {
            console.error("AI Draft generation failed:", error);
            return {
                title: "AI 초안 생성 실패",
                summary: `오류가 발생했습니다: ${error.message}`,
                draft: `## ❌ AI 초안 생성 실패\n\n오류가 발생했습니다: ${error.message}\n\n- API 키가 올바른지 확인해주세요.\n- 브라우저 개발자 콘솔(F12)에서 더 자세한 오류를 확인할 수 있습니다.`
            };
        }
    }

    /**
     * AI를 호출하여 프롬프트에 가장 적합한 카테고리 2개를 추천받습니다.
     * @param {string} promptContent - 분석할 프롬프트의 내용
     * @param {Array<Object>} categories - 전체 카테고리 목록
     * @returns {Promise<Object>} 추천된 카테고리 { best: string, second: string }
     */
    async getCategorySuggestions(promptContent, categories) {
        const { API_KEY, MODEL_NAME, CATEGORY_SUGGESTION_PROMPT_TEMPLATE } = APP_CONFIG.AI_SERVICE;

        if (!API_KEY || API_KEY === "YOUR_API_KEY") {
            console.error("API key not found.");
            return { best: categories[0]?.name, second: categories[1]?.name };
        }

        const categoryList = categories.map(c => c.name).join(', ');
        const fullPrompt = CATEGORY_SUGGESTION_PROMPT_TEMPLATE
            .replace('{userInput}', promptContent)
            .replace('{categoryList}', categoryList);

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
            });

            if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) throw new Error("Empty response from AI.");

            // [수정] 더 안전한 JSON 추출 및 파싱
            const match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonString = match ? match[1] : rawText;
            const suggestions = JSON.parse(jsonString);

            const validCategories = categories.map(c => c.name);
            if (!suggestions.best || !suggestions.second || !validCategories.includes(suggestions.best) || !validCategories.includes(suggestions.second)) {
                throw new Error("AI recommended invalid or non-existent categories.");
            }
            
            return suggestions;

        } catch (error) {
            console.error("AI Category Suggestion failed:", error);
            const shuffled = [...categories].sort(() => 0.5 - Math.random());
            return { best: shuffled[0]?.name, second: shuffled[1]?.name };
        }
    }
}

export const services = new Services();
