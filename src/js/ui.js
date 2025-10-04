import { APP_CONFIG } from '../config.js';
import { store } from './store.js';
import { sanitizeHTML, getFirstLine } from './utils.js';

// DOM 조작 및 렌더링을 담당하는 UI 모듈
class UI {
    constructor() {
        // 주요 DOM 요소 캐싱
        this.elements = {
            appTitle: document.getElementById('app-title'),
            favicon: document.querySelector("link[rel*='icon']"),
            categoryNav: document.getElementById('category-nav'),
            promptListContainer: document.getElementById('prompt-list-container'),
            promptList: document.getElementById('prompt-list'),
            promptDetailContainer: document.getElementById('prompt-detail-container'),
            unsortedCountBadge: document.getElementById('unsorted-count-badge'),
            currentCategoryTitle: document.getElementById('current-category-title'),
            promptCount: document.getElementById('prompt-count'),
            newPromptBtn: document.getElementById('new-prompt-btn'),
            sortModeBtn: document.getElementById('sort-mode-btn'),
        };
        this.store = null;
        // [제거] contenteditable 방식을 사용하므로 ID 추적 상태가 더 이상 필요 없습니다.
        this.editingPromptId = null; 
    }

    // 스토어를 주입받고 상태 변경을 구독
    init(storeInstance) {
        this.store = storeInstance;
        this.store.subscribe(this.render.bind(this));
        this.setupEventListeners();
        this.render(); // 초기 렌더링
    }

    // config.js의 설정값을 UI에 최초 적용
    applyInitialConfig(config) {
        document.title = config.GENERAL.SITE_TITLE;
        this.elements.appTitle.textContent = config.GENERAL.SITE_TITLE;
        this.elements.favicon.href = config.GENERAL.FAVICON_URL;
        document.body.style.setProperty('--font-family', config.THEME.FONT_FAMILY);
        document.body.style.setProperty('--primary-color', config.THEME.PRIMARY_COLOR);
        document.body.setAttribute('data-theme', config.THEME.DEFAULT_THEME);
    }
    
    // [최종 업그레이드] 이벤트 리스너를 contenteditable + Turndown 방식으로 변경
    setupEventListeners() {
        // 정적 버튼 이벤트
        this.elements.newPromptBtn.addEventListener('click', () => this.store.createNewPrompt());
        this.elements.sortModeBtn.addEventListener('click', () => this.store.enterSortMode());

        this.elements.categoryNav.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-id]');
            if (li) this.store.selectCategory(li.dataset.id === 'all' || li.dataset.id === 'unsorted' ? li.dataset.id : parseInt(li.dataset.id));
        });

        this.elements.promptList.addEventListener('click', (e) => {
            const promptCard = e.target.closest('.prompt-card[data-id]');
            if (promptCard) this.store.selectPrompt(parseInt(promptCard.dataset.id));
        });
        
        this.elements.promptDetailContainer.addEventListener('click', (e) => {
             const targetId = e.target.closest('button')?.id;
             switch(targetId) {
                 case 'generate-ai-draft-btn': this.store.generateAIDraft(); break;
                 case 'delete-prompt-btn': this.store.deleteSelectedPrompt(); break;
                 case 'confirm-ai-draft-btn': this.store.confirmAIDraft(); break;
                 case 'exit-sort-mode-btn': this.store.exitSortMode(); break;
             }

             const suggestionBtn = e.target.closest('.category-suggestion-btn[data-cat-id]');
             if (suggestionBtn) this.handleSortModeAction(suggestionBtn.dataset.catId);
             
             // 클릭 시 뷰를 편집 가능한 상태로 전환
             const contentView = e.target.closest('.original-panel .prompt-content-view');
             if (contentView && contentView.getAttribute('contenteditable') !== 'true') {
                 contentView.setAttribute('contenteditable', 'true');
                 contentView.focus();
             }
        });
        
        // 포커스가 해제될 때(blur) 내용을 저장
        this.elements.promptDetailContainer.addEventListener('blur', (e) => {
            const contentView = e.target.closest('.prompt-content-view[contenteditable="true"]');
            if (contentView) {
                contentView.setAttribute('contenteditable', 'false');
                
                // Turndown 라이브러리를 사용하여 수정된 HTML을 마크다운으로 변환
                const turndownService = new TurndownService();
                const newMarkdown = turndownService.turndown(contentView.innerHTML);
                
                // 변환된 마크다운을 저장하여 서식을 완벽하게 보존
                this.store.updateSelectedPromptContent(newMarkdown);
            }
        }, true); // 캡처 단계에서 이벤트를 처리하여 안정성을 높임
    }


    // 상태가 변경될 때마다 호출되는 마스터 렌더링 함수
    render(state) {
        if (!state) state = this.store.getState();
        
        this.renderSidebar(state);
        
        this.elements.promptListContainer.classList.remove('inactive');
        
        switch(state.viewMode) {
            case 'sort': this.renderSortModeView(state); break;
            case 'capture': this.renderCaptureView(state); break;
            default: this.renderListView(state); break;
        }
    }

    renderSidebar({ categories, prompts, currentCategoryId }) {
        const unsortedCount = prompts.filter(p => !p.categoryId).length;
        
        let categoryHtml = `<ul>
            <li data-id="all" class="${currentCategoryId === 'all' ? 'active' : ''}">모든 프롬프트</li>
            <li data--id="unsorted" class="${currentCategoryId === 'unsorted' ? 'active' : ''}">미분류</li>
            ${categories.map(cat => `<li data-id="${cat.id}" class="${currentCategoryId === cat.id ? 'active' : ''}">${sanitizeHTML(cat.name)}</li>`).join('')}
        </ul>`;
        
        this.elements.categoryNav.innerHTML = categoryHtml;
        this.elements.unsortedCountBadge.textContent = unsortedCount;
        this.elements.sortModeBtn.classList.toggle('highlight', unsortedCount > 0 && APP_CONFIG.FEATURES.ENABLE_SORT_MODE_NOTIFICATIONS);
    }

    renderListView(state) {
        const { prompts, categories, currentCategoryId, selectedPromptId } = state;

        let filteredPrompts = [];
        let categoryTitle = "";
        if (currentCategoryId === 'all') {
            filteredPrompts = prompts;
            categoryTitle = "모든 프롬프트";
        } else if (currentCategoryId === 'unsorted') {
            filteredPrompts = prompts.filter(p => !p.categoryId);
            categoryTitle = "미분류";
        } else {
            filteredPrompts = prompts.filter(p => p.categoryId === currentCategoryId);
            const cat = categories.find(c => c.id === currentCategoryId);
            categoryTitle = cat ? cat.name : "알 수 없는 카테고리";
        }

        this.elements.currentCategoryTitle.textContent = sanitizeHTML(categoryTitle);
        this.elements.promptCount.textContent = `${filteredPrompts.length}개`;
        
        this.elements.promptList.innerHTML = filteredPrompts.length === 0 && currentCategoryId !== 'all' && currentCategoryId !== 'unsorted'
            ? `<p class="placeholder" style="padding: 1rem;">비어있는 카테고리입니다.</p>`
            : filteredPrompts.map(p => `
                <div class="prompt-card ${p.id === selectedPromptId ? 'active' : ''}" data-id="${p.id}">
                    <div class="prompt-card-title">${sanitizeHTML(getFirstLine(p.content))}</div>
                    <div class="prompt-card-preview">${sanitizeHTML(p.content)}</div>
                </div>
            `).join('');
        
        this.renderDetailView(state);
    }

    // 상세 뷰 렌더링 로직 (textarea 전환 로직 제거)
    renderDetailView(state) {
        const { prompts, selectedPromptId, isLoading } = state;
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

        if (!selectedPrompt) {
            this.elements.promptDetailContainer.innerHTML = `<div id="detail-view-placeholder" class="placeholder">...</div>`;
            return;
        }

        // 항상 marked.js로 파싱된 HTML 뷰를 렌더링
        const originalContentHtml = APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING
            ? marked.parse(selectedPrompt.content)
            : `<pre>${sanitizeHTML(selectedPrompt.content)}</pre>`;
        const originalPanelContent = `<div class="prompt-content-view">${originalContentHtml}</div>`;

        let mainViewHtml;
        if (selectedPrompt.aiDraftContent || isLoading) {
            const aiDraftContentHtml = isLoading ? this.renderAIDraftLoading() : this.renderAIDraft(selectedPrompt);
            mainViewHtml = `
                <div class="detail-split-container">
                    <div class="prompt-view-panel original-panel">
                        <h3>원본</h3><div class="prompt-content-wrapper">${originalPanelContent}</div>
                    </div>
                    <div class="prompt-view-panel ai-draft-panel">
                        <h3>✨ 전략가 AI 추천 초안</h3><div class="prompt-content-wrapper">${aiDraftContentHtml}</div>
                    </div>
                </div>`;
        } else {
            mainViewHtml = `
                <div class="prompt-view-panel original-panel full-width">
                    <h3>원본</h3><div class="prompt-content-wrapper">${originalPanelContent}</div>
                </div>`;
        }
        
        this.elements.promptDetailContainer.innerHTML = `
            <div id="detail-view">
                <div class="detail-header">
                    <small>최종 수정: ${new Date(selectedPrompt.updatedAt).toLocaleString()}</small>
                    <div class="detail-header-actions">
                        <button id="generate-ai-draft-btn" ${isLoading ? 'disabled' : ''}>${isLoading ? '생성 중...' : '✨ AI 초안 생성'}</button>
                        <button id="delete-prompt-btn">삭제</button>
                    </div>
                </div>
                ${mainViewHtml}
            </div>`;
        
        if (APP_CONFIG.FEATURES.ENABLE_SYNTAX_HIGHLIGHTING) {
            this.elements.promptDetailContainer.querySelectorAll('pre code').forEach(hljs.highlightElement);
        }
    }
    
    renderAIDraft(prompt) {
        if (!prompt.aiDraftContent) return '';
        const draftHtml = APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING
            ? marked.parse(prompt.aiDraftContent)
            : `<pre>${sanitizeHTML(prompt.aiDraftContent)}</pre>`;

        return `<div class="prompt-content-view">${draftHtml}</div>
                <div class="ai-draft-container"><button id="confirm-ai-draft-btn" class="sidebar-btn">이 버전으로 확정하기</button></div>`;
    }

    renderAIDraftLoading() {
        return `<div class="ai-draft-header"><div class="loading-spinner"></div> AI가 초안을 생성하는 중...</div>`;
    }
    
    renderCaptureView() {
        this.elements.promptListContainer.classList.add('inactive');
        this.elements.promptList.innerHTML = '';
        this.elements.currentCategoryTitle.textContent = "새 아이디어";
        this.elements.promptCount.textContent = "캡처 중...";

        this.elements.promptDetailContainer.innerHTML = `
            <div id="capture-view"><input type="text" id="capture-input" placeholder="${APP_CONFIG.UI_TEXTS.CAPTURE_PLACEHOLDER}"></div>`;

        const input = document.getElementById('capture-input');
        input.focus();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.store.saveCapturedPrompt(e.target.value);
            if (e.key === 'Escape') this.store.exitCaptureMode();
        });
    }

    renderSortModeView({ prompts, categories }) {
        const unsortedPrompts = prompts.filter(p => !p.categoryId);
        this.elements.promptList.innerHTML = '';
        this.elements.currentCategoryTitle.textContent = "정리 모드";
        this.elements.promptCount.textContent = `${unsortedPrompts.length}개 남음`;

        if (unsortedPrompts.length === 0) {
            this.elements.promptDetailContainer.innerHTML = `<div id="sort-mode-view" class="placeholder">...</div>`;
            return;
        }

        const currentPrompt = unsortedPrompts[0];
        const suggestedCategories = [...categories].sort(() => 0.5 - Math.random()).slice(0, 3);

        this.elements.promptDetailContainer.innerHTML = `<div id="sort-mode-view">...</div>`;
    }

    handleSortModeAction(categoryId) {
        const unsortedPrompts = this.store.getState().prompts.filter(p => !p.categoryId);
        if (unsortedPrompts.length === 0) return;
        const currentPrompt = unsortedPrompts[0];
        if (categoryId === 'new') {
            const newCategoryName = prompt("새 카테고리 이름을 입력하세요:");
            if (newCategoryName) alert(`'${newCategoryName}' 카테고리가 생성되어 할당되었습니다. (스토어 액션 구현 필요)`);
        } else {
            this.store.assignCategoryToPrompt(currentPrompt.id, parseInt(categoryId));
        }
    }
}

export const ui = new UI();