import { APP_CONFIG } from '../config.js';
import { db } from './db.js';
import { store } from './store.js';
import { ui } from './ui.js';
import { commandPalette } from './commandPalette.js';

// 애플리케이션 초기화를 담당하는 메인 컨트롤러
class App {
    constructor() {
        this.config = APP_CONFIG;
    }

    // 애플리케이션 시작
    async init() {
        // 1. UI에 기본 설정값 적용 (제목, 테마 등)
        ui.applyInitialConfig(this.config);

        // 2. 데이터베이스 초기화
        try {
            await db.init();
        } catch (error) {
            console.error("Database initialization failed:", error);
            // ui.showError는 ui.js에 없는 함수이므로 주석 처리합니다.
            // ui.showError("데이터베이스를 초기화할 수 없습니다. 앱을 재시작해주세요.");
            return;
        }

        // 3. 데이터베이스에서 초기 데이터 로드
        const [prompts, categories] = await Promise.all([
            db.getAllPrompts(),
            db.getAllCategories()
        ]);

        // 4. 중앙 상태 저장소(Store)에 초기 상태 설정
        store.setState({
            prompts: prompts || [],
            categories: categories || [],
            currentCategoryId: 'all', // 'all', 'unsorted', 또는 카테고리 ID
            selectedPromptId: null,
            viewMode: 'list', // 'list' 또는 'sort'
        });

        // 5. UI 및 커맨드 팔레트 모듈 초기화
        // 스토어를 주입하여 상태 변경 시 UI가 자동으로 업데이트되도록 함
        ui.init(store);
        commandPalette.init(store);

        // --- 추가된 부분 시작 ---
        // Store의 상태 변경을 구독하고 UI 업데이트를 처리합니다.
        store.subscribe(state => {
            if (state.isLoading) {
                ui.showAIDraftLoading();
            }
        });
        // --- 추가된 부분 끝 ---

        // 6. 전역 키보드 단축키 설정
        this.setupGlobalShortcuts();

        console.log("Prompt Vault App Initialized");
    }

    // 전역 단축키 설정
    setupGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K 또는 Cmd+K로 커맨드 팔레트 열기
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                commandPalette.toggle();
            }
            // Ctrl+N 또는 Cmd+N으로 새 프롬프트 생성
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                store.createNewPrompt();
            }
            // Ctrl+S 또는 Cmd+S로 정리 모드 시작
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                store.enterSortMode();
            }
            // ESC 키로 커맨드 팔레트 닫기
            if (e.key === 'Escape') {
                if (!commandPalette.isHidden()) {
                    commandPalette.hide();
                }
            }
        });
    }
}

// DOM이 로드되면 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
