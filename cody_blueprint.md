프로젝트: Prompt Vault
설명
Prompt Vault는 사용자가 프롬프트를 효율적으로 생성, 관리 및 분류할 수 있도록 돕는 웹 애플리케이션입니다. AI 기반 초안 생성 및 카테고리 추천 기능을 통해 생산성을 높이는 것을 목표로 합니다. 모든 데이터는 브라우저의 IndexedDB에 안전하게 저장됩니다.

파일 구조 및 역할
index.html: 애플리케이션의 전체적인 UI 구조를 정의하는 메인 페이지입니다.

src/css/style.css: 애플리케이션의 디자인과 레이아웃을 담당하는 스타일시트입니다.

src/config.js: 앱의 제목, 테마, AI 설정 등 커스터마이징 가능한 값들을 모아둔 설정 파일입니다.

src/js/main.js: 애플리케이션의 시작점(Entry Point)입니다. DB 초기화, 데이터 로딩, 모듈 초기화 등 앱의 전반적인 실행 흐름을 관리합니다.

src/js/db.js: IndexedDB와의 상호작용을 추상화하여 데이터 CRUD를 쉽게 처리할 수 있도록 돕는 모듈입니다.

src/js/store.js: 애플리케이션의 모든 상태(State)를 중앙에서 관리하는 단일 소스 저장소(Single Source of Truth)입니다.

src/js/ui.js: DOM 조작, 렌더링, 사용자 인터페이스 업데이트를 전담하는 모듈입니다. store의 상태 변화를 구독하여 화면을 다시 그립니다.

src/js/commandPalette.js: Ctrl+K 단축키로 접근 가능한 커맨드 팔레트의 기능과 UI를 관리합니다.

src/js/services.js: 외부 API 연동이나 복잡한 비즈니스 로직을 처리합니다. 현재는 AI 기능 시뮬레이션을 담당합니다.

src/js/utils.js: HTML 이스케이프 처리 등 프로젝트 전반에서 사용되는 유용한 헬퍼 함수들을 모아둔 모듈입니다.

변경 기록 (최신순)
2025-10-05 (v10)
주요 변경사항: '새 프롬프트 생성' 버튼 클릭 오류 수정

수정 파일: src/js/main.js

변경 내용:

단축키 오류 수정 (main.js): setupGlobalShortcuts 함수 내에서 '새 프롬프트 생성' 단축키(Ctrl+N)가 store.createNewPrompt()를 호출하도록 수정했습니다. 기존 코드의 오타(newPromptButton -> newPromptBtn)를 바로잡아 버튼 클릭이 정상적으로 동작하도록 했습니다.

코드 정리 (main.js): 가독성 향상을 위해 불필요한 store 구독 관련 코드를 제거했습니다.

2025-10-05 (v9)
주요 변경사항: AI 기반 자동 제목 및 요약 기능 (Cognitive-Load Reducer) 구현

수정 파일: src/js/db.js, src/config.js, src/js/services.js, src/js/store.js, src/js/ui.js

변경 내용:

DB 스키마 변경 (db.js): prompts 저장소에 title과 summary 필드를 추가하고, 데이터베이스 버전을 3으로 업그레이드했습니다.

AI 프롬프트 수정 (config.js): '전략가 AI'가 '추천 제목(title)', '핵심 요약(summary)', '전략 프롬프트(draft)'를 포함한 JSON 객체를 반환하도록 STRATEGIST_AI_PROMPT_TEMPLATE을 전면 수정했습니다.

API 서비스 로직 수정 (services.js): getAIStrategistDraft 함수가 AI로부터 받은 JSON 형식의 텍스트를 파싱하여 {title, summary, draft} 객체로 반환하도록 수정했습니다.

상태 관리 로직 수정 (store.js): generateAIDraft 액션이 AI로부터 받은 title과 summary를 상태에 함께 저장하고, confirmAIDraft 액션이 이를 최종 확정하도록 로직을 수정했습니다.

UI 렌더링 로직 수정 (ui.js): 좌측 프롬프트 목록(prompt-card)이 p.title과 p.summary를 표시하도록 renderListView 함수를 수정했습니다. title이나 summary가 없는 구형 데이터를 위해 기존 방식(본문 첫 줄, 내용 일부)으로 표시하는 폴백(Fallback) 로직을 적용했습니다.

(이전 변경 기록 생략)