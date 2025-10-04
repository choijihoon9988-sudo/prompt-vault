# 프로젝트: Prompt Vault

## 설명
Prompt Vault는 사용자가 프롬프트를 효율적으로 생성, 관리 및 분류할 수 있도록 돕는 웹 애플리케이션입니다. AI 기반 초안 생성 및 카테고리 추천 기능을 통해 생산성을 높이는 것을 목표로 합니다. 모든 데이터는 브라우저의 IndexedDB에 안전하게 저장됩니다.

## 파일 구조 및 역할
- **index.html**: 애플리케이션의 전체적인 UI 구조를 정의하는 메인 페이지입니다.
- **src/css/style.css**: 애플리케이션의 디자인과 레이아웃을 담당하는 스타일시트입니다.
- **src/config.js**: 앱의 제목, 테마, AI 설정 등 커스터마이징 가능한 값들을 모아둔 설정 파일입니다.
- **src/js/main.js**: 애플리케이션의 시작점(Entry Point)입니다. DB 초기화, 데이터 로딩, 모듈 초기화 등 앱의 전반적인 실행 흐름을 관리합니다.
- **src/js/db.js**: IndexedDB와의 상호작용을 추상화하여 데이터 CRUD를 쉽게 처리할 수 있도록 돕는 모듈입니다.
- **src/js/store.js**: 애플리케이션의 모든 상태(State)를 중앙에서 관리하는 단일 소스 저장소(Single Source of Truth)입니다.
- **src/js/ui.js**: DOM 조작, 렌더링, 사용자 인터페이스 업데이트를 전담하는 모듈입니다. store의 상태 변화를 구독하여 화면을 다시 그립니다.
- **src/js/commandPalette.js**: `Ctrl+K` 단축키로 접근 가능한 커맨드 팔레트의 기능과 UI를 관리합니다.
- **src/js/services.js**: 외부 API 연동이나 복잡한 비즈니스 로직을 처리합니다. 현재는 AI 기능 시뮬레이션을 담당합니다.
- **src/js/utils.js**: HTML 이스케이프 처리 등 프로젝트 전반에서 사용되는 유용한 헬퍼 함수들을 모아둔 모듈입니다.

## 변경 기록 (최신순)

### 2025-10-01 (v5)
- **주요 변경사항: 프롬프트 인라인 편집 기능 구현**
- **수정 파일:** `src/js/ui.js`, `src/css/style.css`
- **변경 내용:**
    - **인라인 편집 로직 추가 (ui.js):**
        - 사용자가 프롬프트 상세 내용을 클릭하면, 해당 영역이 즉시 편집 가능한 `<textarea>`로 전환되도록 `renderDetailView` 로직을 수정했습니다.
        - UI 모듈 내에 `editingPromptId` 로컬 상태를 추가하여 현재 편집 중인 프롬프트를 추적합니다.
        - 이벤트 위임을 사용하여 상세 뷰 컨테이너(`promptDetailContainer`)에 `click` 및 `blur` 이벤트 리스너를 추가했습니다.
        - 편집 후 포커스가 사라지면(`blur`), 변경된 내용이 자동으로 `store.updateSelectedPromptContent`를 통해 저장되고 다시 읽기 전용 뷰로 전환됩니다.
    - **UX 개선 (style.css):**
        - `.prompt-content-view`에 `cursor: pointer` 스타일을 추가하여 사용자가 해당 영역을 클릭하여 편집할 수 있음을 시각적으로 인지할 수 있도록 개선했습니다.

---
(이전 변경 기록 생략)