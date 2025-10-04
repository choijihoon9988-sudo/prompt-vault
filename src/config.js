// === App Configuration ===
// 이 파일의 값들을 수정하여 당신의 웹 애플리케이션을 커스터마이징하세요.
// 코드의 다른 부분은 수정할 필요가 없습니다.

export const APP_CONFIG = {
  // --- 일반 설정 ---
  GENERAL: {
    SITE_TITLE: "Prompt Vault",
    FAVICON_URL: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>",
  },

  // --- UI 텍스트 설정 ---
  UI_TEXTS: {
    MAIN_TITLE: "Prompt Vault",
    CAPTURE_PLACEHOLDER: "번뜩이는 아이디어를 여기에 기록하세요... (Ctrl+Enter로 저장)",
    SORT_MODE_TITLE: "정리 모드",
    SORT_MODE_PROMPT: "AI가 추천하는 카테고리로 프롬프트를 정리하세요.",
    EMPTY_PROMPTS_MESSAGE: "아직 프롬프트가 없습니다. 첫 아이디어를 기록해보세요!",
    EMPTY_SORT_MODE_MESSAGE: "정리할 프롬프트가 없습니다! ✨",
    COMMAND_PALETTE_PLACEHOLDER: "명령어 검색...",
  },

  // --- AI 서비스 설정 ---
  AI_SERVICE: {
    // [완료] CEO님의 API 키를 여기에 직접 반영했습니다.
    API_KEY: "AIzaSyDSIRzDsbonDZwuDB6RRmYYy-vR2Cqupmg", 
    
    // API 호출에 사용할 모델 이름
    MODEL_NAME: "gemini-2.5-pro",

    // AI가 생성하는 프롬프트 초안의 기본 구조입니다.
    // {userInput} 부분은 사용자의 실제 입력으로 대체됩니다.
    STRATEGIST_AI_PROMPT_TEMPLATE: `
### 🎯 분석 및 재구성 목표
아래의 사용자 원본 아이디어를 분석하여, AI의 성능을 극한으로 끌어낼 수 있는 명확하고 실행 가능한 '전략 프롬프트'로 재창조한다.

### 👤 역할 부여
너는 세계 최고의 프롬프트 엔지니어이자, 특정 분야의 도메인 지식을 즉시 학습하는 AI 전략가다.

### 📝 핵심 재구성 원칙
1.  **의도 파악:** 사용자의 원본 아이디어에서 핵심 목표(Goal)와 원하는 결과물(Output)이 무엇인지 명확하게 정의한다.
2.  **구조화:** '역할 부여', '상황(Context)', '명확한 지시사항', '결과물 형식', '제약 조건' 등 구조화된 프롬프트 형식으로 재구성한다.
3.  **고도화:** 사용자가 미처 생각하지 못했을 추가적인 관점이나 변수를 포함하여 프롬프트의 가치를 극대화한다. "이렇게까지 생각 못했는데?" 라는 반응을 유도해야 한다.

### 🚫 절대 금지사항
-   단순히 문장을 다듬거나 내용을 요약해서는 안 된다.
-   일반적이거나 추상적인 표현을 사용하지 말고, 구체적이고 측정 가능한 지시사항을 사용한다.

---
### 💡 사용자 원본 아이디어
{userInput}
---

### ✨ 재창조된 전략 프롬프트
`,
  },

  // --- 기능 플래그 ---
  FEATURES: {
    ENABLE_MARKDOWN_PARSING: true,
    ENABLE_SYNTAX_HIGHLIGHTING: true,
    ENABLE_SORT_MODE_NOTIFICATIONS: true,
  },

  // --- 테마 및 스타일 설정 ---
  THEME: {
    DEFAULT_THEME: 'dark',
    PRIMARY_COLOR: "#4F46E5", // Indigo
    FONT_FAMILY: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
};