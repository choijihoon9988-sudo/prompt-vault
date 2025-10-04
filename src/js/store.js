import { db } from './db.js';
import { services } from './services.js';
// import { ui } from './ui.js'; // 순환 참조 문제를 해결하기 위해 이 줄을 제거합니다.

// 애플리케이션의 모든 상태를 중앙에서 관리하는 'Store'
// UI는 이 Store의 상태가 변경될 때만 업데이트됨 (단방향 데이터 흐름)
class Store {
    constructor() {
        this.state = {
            prompts: [],
            categories: [],
            currentCategoryId: 'all',
            selectedPromptId: null,
            viewMode: 'list', // 'list' | 'sort' | 'capture'
            isLoading: false,
        };
        this.listeners = []; // 상태 변경을 구독할 함수들의 배열
    }

    // 현재 상태를 반환
    getState() {
        return this.state;
    }

    // 상태를 변경하고 모든 리스너에게 알림
    setState(newState) {
        this.state = {...this.state,...newState };
        console.log("State changed:", this.state);
        this.listeners.forEach(listener => listener(this.state));
    }

    // 상태 변경을 감지할 리스너(콜백 함수)를 등록
    subscribe(listener) {
        this.listeners.push(listener);
    }

    // --- Actions: 상태를 변경하는 메서드들 ---

    // 카테고리 변경
    selectCategory(categoryId) {
        this.setState({ currentCategoryId: categoryId, selectedPromptId: null, viewMode: 'list' });
    }

    // 프롬프트 선택
    selectPrompt(promptId) {
        this.setState({ selectedPromptId: promptId, viewMode: 'list' });
    }

    // '새 프롬프트 생성' 시, '캡처 모드'로 진입
    createNewPrompt() {
        this.setState({ viewMode: 'capture', selectedPromptId: null });
    }
    
    // '캡처 모드'에서 입력된 프롬프트를 저장
    async saveCapturedPrompt(content) {
        if (!content || content.trim() === '') {
            this.exitCaptureMode();
            return;
        }

        const newPrompt = {
            content: content.trim(),
            aiDraftContent: '',
            categoryId: null, // '미분류' 상태
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const newId = await db.addPrompt(newPrompt);
        const allPrompts = await db.getAllPrompts();
        // 상태를 업데이트하여 UI가 즉시 반응하도록 함
        this.setState({
            prompts: allPrompts,
            selectedPromptId: newId, // 새로 만든 프롬프트를 선택
            currentCategoryId: 'unsorted', // '미분류' 탭으로 즉시 이동
            viewMode: 'list', // 리스트 뷰로 전환
        });
    }

    // '캡처 모드' 취소
    exitCaptureMode() {
        this.setState({ viewMode: 'list' });
    }

    // 프롬프트 내용 업데이트
    async updateSelectedPromptContent(newContent) {
        const { selectedPromptId, prompts } = this.state;
        if (!selectedPromptId) return;

        const promptToUpdate = prompts.find(p => p.id === selectedPromptId);
        if (promptToUpdate) {
            const updatedPrompt = {
               ...promptToUpdate,
                content: newContent,
                updatedAt: new Date().toISOString(),
            };
            await db.updatePrompt(updatedPrompt);
            const allPrompts = await db.getAllPrompts();
            this.setState({ prompts: allPrompts });
        }
    }

    // '전략가 AI' 초안 생성 요청
    async generateAIDraft() {
        const { selectedPromptId, prompts } = this.state;
        if (!selectedPromptId) return;

        const prompt = prompts.find(p => p.id === selectedPromptId);
        if (prompt) {
            this.setState({ isLoading: true });
            const draft = await services.getAIStrategistDraft(prompt.content);
            const updatedPrompt = {...prompt, aiDraftContent: draft };
            await db.updatePrompt(updatedPrompt);
            const allPrompts = await db.getAllPrompts();
            this.setState({ prompts: allPrompts, isLoading: false });
        }
    }

    // AI 초안을 현재 프롬프트 내용으로 확정
    async confirmAIDraft() {
        const { selectedPromptId, prompts } = this.state;
        if (!selectedPromptId) return;
        const prompt = prompts.find(p => p.id === selectedPromptId);
        if (prompt && prompt.aiDraftContent) {
            // [수정] content를 aiDraftContent로 업데이트하고, aiDraftContent는 비움
            const updatedPrompt = {
               ...prompt,
                content: prompt.aiDraftContent,
                aiDraftContent: '', // AI 초안을 비워서 오른쪽 패널을 숨김
                updatedAt: new Date().toISOString(),
            };
            await db.updatePrompt(updatedPrompt);
            const allPrompts = await db.getAllPrompts();
            this.setState({ prompts: allPrompts });
        }
    }

    // 프롬프트 삭제
    async deleteSelectedPrompt() {
        const { selectedPromptId } = this.state;
        if (!selectedPromptId ||!confirm("정말로 이 프롬프트를 삭제하시겠습니까?")) return;
        
        await db.deletePrompt(selectedPromptId);
        const allPrompts = await db.getAllPrompts();
        this.setState({ prompts: allPrompts, selectedPromptId: null });
    }

    // 정리 모드 진입
    enterSortMode() {
        const unsortedPrompts = this.state.prompts.filter(p =>!p.categoryId);
        if (unsortedPrompts.length > 0) {
            this.setState({ viewMode: 'sort', selectedPromptId: null });
        } else {
            alert("정리할 프롬프트가 없습니다.");
        }
    }

    // 리스트 뷰로 복귀
    exitSortMode() {
        this.setState({ viewMode: 'list', currentCategoryId: 'all' });
    }

    // 프롬프트 카테고리 지정 (정리 모드에서 사용)
    async assignCategoryToPrompt(promptId, categoryId) {
        const promptToUpdate = this.state.prompts.find(p => p.id === promptId);
        if (promptToUpdate) {
            const updatedPrompt = {...promptToUpdate, categoryId: categoryId, updatedAt: new Date().toISOString() };
            await db.updatePrompt(updatedPrompt);
            const allPrompts = await db.getAllPrompts();
            this.setState({ prompts: allPrompts });
        }
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const store = new Store();