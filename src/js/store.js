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
            searchQuery: '', // [신규] P0: 지능형 탐색을 위한 검색어 상태
            // [신규] 지능형 정리 모드를 위한 상태
            currentSortPrompt: null, // { prompt: Object, suggestions: { best: string, second: string } }
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
    
    // [신규] P0: 검색어 업데이트
    setSearchQuery(query) {
        // 검색 시 상세 뷰는 닫고 목록에 집중
        this.setState({ searchQuery: query, selectedPromptId: null });
    }

    // '새 프롬프트 생성' 시, '캡처 모드'로 진입
    createNewPrompt() {
        this.setState({ viewMode: 'capture', selectedPromptId: null });
    }
    
    // [수정] 새 프롬프트 저장 시, 생성된 ID를 반환하도록 수정
    async saveCapturedPrompt(content) {
        if (!content || content.trim() === '') {
            this.exitCaptureMode();
            return null;
        }

        const originalContent = content.trim();

        // 1. 임시 프롬프트를 만들어 DB에 저장하고 ID 확보
        const tempPrompt = {
            content: originalContent,
            aiDraftContent: '',
            categoryId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title: 'AI 분석 중...',
            summary: '내용을 요약하고 제목을 생성하고 있습니다...',
        };
        const newId = await db.addPrompt(tempPrompt);
        const allPrompts = await db.getAllPrompts();
        
        // 2. UI에 즉시 임시 상태를 표시하여 사용자에게 피드백 제공
        this.setState({
            prompts: allPrompts,
            selectedPromptId: newId,
            currentCategoryId: 'unsorted',
            viewMode: 'list',
        });
        
        // 3. (1단계 AI) 원본 내용을 보존하며 마크다운으로 자동 구조화
        const formattedContent = await services.getAIAutoFormattedText(originalContent);
        
        // 4. (2단계 AI) 구조화된 텍스트를 기반으로 제목과 요약만 생성
        //    (getAIStrategistDraft는 내부적으로 본문도 만들지만, 우린 제목/요약만 사용)
        const metadata = await services.getAIStrategistDraft(formattedContent);

        // 5. 최종 결과로 프롬프트 업데이트 (content는 formattedContent로 교체)
        const promptToUpdate = await db.getPrompt(newId);
        if (promptToUpdate) {
            const finalPrompt = { 
               ...promptToUpdate, 
                content: formattedContent, // AI가 재구성한 '구조'만 반영, 내용은 원본과 동일
                title: metadata.title,
                summary: metadata.summary,
                updatedAt: new Date().toISOString() 
            };
            await db.updatePrompt(finalPrompt);
            const finalList = await db.getAllPrompts();
            
            // 6. 최종적으로 UI 리프레시
            this.setState({ prompts: finalList });
        }
        
        return newId; // [수정] 생성된 ID 반환
    }

    // [신규] P0: 검색 실패 시 즉시 생성 및 AI 호출
    async createPromptFromSearch(query) {
        // 1. 기존 '캡처 저장' 로직을 재활용하여 프롬프트를 생성하고 ID를 받음
        // (saveCapturedPrompt 내부에서 1차 setState가 실행되어 상세 뷰로 이동됨)
        const newId = await this.saveCapturedPrompt(query);
        
        if (newId) {
            // 2. 프롬프트 생성이 완료된 직후, 즉시 '전략가 AI'를 호출
            // (saveCapturedPrompt가 백그라운드에서 제목/요약을 생성하는 동안
            //  여기서는 '전략가 초안'을 생성하여 덮어쓰거나 보강할 수 있음.
            //  현재 명세상 generateAIDraft가 적합함)
            this.generateAIDraft();
        }
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
            // [수정] 명세서에 따라 원본 수정 시, 기존 AI 초안은 무효화되므로 초기화
            const updatedPrompt = {
               ...promptToUpdate,
                content: newContent,
                aiDraftContent: '', // 기존 AI 초안을 비워 유효하지 않음을 표시
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
            const result = await services.getAIStrategistDraft(prompt.content);
            const updatedPrompt = {
                ...prompt, 
                title: result.title,
                summary: result.summary,
                aiDraftContent: result.draft 
            };
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
            const updatedPrompt = {
               ...prompt,
                content: prompt.aiDraftContent,
                aiDraftContent: '',
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

    // 지능형 정리 모드 진입
    async enterSortMode() {
        const { prompts, categories } = this.state;
        const unsortedPrompts = prompts.filter(p => !p.categoryId);
        if (unsortedPrompts.length === 0) {
            alert("정리할 프롬프트가 없습니다.");
            return;
        }

        this.setState({ viewMode: 'sort', selectedPromptId: null, isLoading: true, searchQuery: '' }); // [수정] 정리 모드 진입 시 검색어 초기화
        
        const firstPrompt = unsortedPrompts[0];
        const suggestions = await services.getCategorySuggestions(firstPrompt.content, categories);
        
        this.setState({
            currentSortPrompt: { prompt: firstPrompt, suggestions },
            isLoading: false
        });
    }

    // 리스트 뷰로 복귀
    exitSortMode() {
        this.setState({ viewMode: 'list', currentCategoryId: 'all', currentSortPrompt: null });
    }
    
    // 분류 완료 후 잠시 메시지를 보여주고 복귀
    exitSortModeAfterDelay() {
        setTimeout(() => {
            this.exitSortMode();
        }, 1500);
    }

    // 프롬프트 카테고리 지정 후 다음 프롬프트로 이동
    async assignCategoryAndGoNext(promptId, categoryName) {
        const { prompts, categories } = this.state;
        const category = categories.find(c => c.name === categoryName);
        if (!category) return;

        const promptToUpdate = prompts.find(p => p.id === promptId);
        if (promptToUpdate) {
            const updatedPrompt = { ...promptToUpdate, categoryId: category.id, updatedAt: new Date().toISOString() };
            await db.updatePrompt(updatedPrompt);
            
            const allPrompts = await db.getAllPrompts();
            const remainingUnsorted = allPrompts.filter(p => !p.categoryId);

            this.setState({ prompts: allPrompts, isLoading: true });

            if (remainingUnsorted.length > 0) {
                const nextPrompt = remainingUnsorted[0];
                const suggestions = await services.getCategorySuggestions(nextPrompt.content, categories);
                this.setState({
                    currentSortPrompt: { prompt: nextPrompt, suggestions },
                    isLoading: false
                });
            } else {
                this.setState({ currentSortPrompt: null, isLoading: false });
                this.exitSortModeAfterDelay();
            }
        }
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const store = new Store();