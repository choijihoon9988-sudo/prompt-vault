import { APP_CONFIG } from "../config.js";

// 외부 API 연동 또는 복잡한 비즈니스 로직을 처리하는 서비스 모듈
class Services {
    // '전략가 AI'의 프롬프트 초안 생성을 시뮬레이션
    getAIStrategistDraft(userInput) {
        return new Promise(resolve => {
            // 설정된 시간만큼 지연시켜 실제 API 호출처럼 보이게 함
            setTimeout(() => {
                // 사용자의 입력을 템플릿에 삽입하여 초안 생성
                const draft = APP_CONFIG.AI_SERVICE.STRATEGIST_AI_PROMPT_TEMPLATE
                   .replace('{userInput}', userInput);
                resolve(draft);
            }, APP_CONFIG.AI_SERVICE.SIMULATED_API_LATENCY_MS);
        });
    }
}

export const services = new Services();