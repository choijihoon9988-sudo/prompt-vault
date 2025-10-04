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
    // 여기에 당신의 Google AI Studio에서 발급받은 API 키를 입력하세요.
    // 중요: 이 키를 외부에 노출하지 마세요.
    GEMINI_API_KEY: "AIzaSyDSIRzDsbonDZwuDB6RRmYYy-vR2Cqupmg",

    // '전략가 AI'가 초안을 생성하는 데 걸리는 시간을 밀리초(ms) 단위로 설정합니다.
    // (실제 API를 사용하므로 이 값은 더 이상 사용되지 않지만, 만약을 위해 남겨둡니다.)
    SIMULATED_API_LATENCY_MS: 800,

    // AI가 추천하는 카테고리의 개수를 설정합니다.
    SUGGESTED_CATEGORIES_COUNT: 3,

    // AI가 생성하는 프롬프트 초안의 기본 구조입니다.
    // {userInput} 부분은 사용자의 실제 입력으로 대체됩니다.
    STRATEGIST_AI_PROMPT_TEMPLATE: `
### 🎯 목표
{userInput} 문제를 해결하기 위한 명확하고 실행 가능한 결과물 도출

### 👤 역할 부여
당신은 해당 분야 최고의 전문가인 [전문가 역할 삽입]입니다.

### 📝 핵심 지시사항
1.  문제의 핵심을 파악하고, 가장 중요한 변수들을 고려하여 답변을 생성해주세요.
2.  결과물은 [원하는 결과물 형식: 보고서, 코드, 표 등] 형식으로 정리해주세요.
3.  [추가적인 제약 조건이나 요구사항 삽입]

### 🚫 주의사항
-   일반적인 정보 나열을 피하고, 구체적인 인사이트를 담아주세요.
-   [피해야 할 답변 스타일이나 내용 삽입]
    `,
  },

  // --- 기능 플래그 ---
  FEATURES: {
    // true로 설정하면, 프롬프트 내용에 마크다운 문법이 적용되어 렌더링됩니다.
    ENABLE_MARKDOWN_PARSING: true,
    // true로 설정하면, 마크다운의 코드 블록에 구문 강조(Syntax Highlighting)가 적용됩니다.
    ENABLE_SYNTAX_HIGHLIGHTING: true,
    // true로 설정하면, 정리되지 않은 프롬프트가 있을 때 주기적으로 알림을 표시합니다. (MVP에서는 UI 힌트로 구현)
    ENABLE_SORT_MODE_NOTIFICATIONS: true,
  },

  // --- 테마 및 스타일 설정 ---
  THEME: {
    // 앱의 기본 테마를 'dark' 또는 'light'로 설정할 수 있습니다.
    DEFAULT_THEME: 'dark',
    // 앱의 주요 색상을 설정합니다.
    PRIMARY_COLOR: "#4F46E5", // Indigo
    FONT_FAMILY: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
};