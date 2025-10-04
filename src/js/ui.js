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
            categoryTabs: document.getElementById('category-tabs'),
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
        this.editingPromptId = null;
        this.clickTimer = null; // 더블클릭과 싱글클릭을 구분하기 위한 타이머
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
    
    // [최종 수정] 이벤트 리스너 로직을 통합하여 안정성 확보
    setupEventListeners() {
        // 정적 버튼 이벤트
        this.elements.newPromptBtn.addEventListener('click', () => this.store.createNewPrompt());
        this.elements.sortModeBtn.addEventListener('click', () => this.store.enterSortMode());

        this.elements.categoryTabs.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-id]');
            if (button) this.store.selectCategory(button.dataset.id === 'all' || button.dataset.id === 'unsorted' ? button.dataset.id : parseInt(button.dataset.id));
        });

        // 프롬프트 목록 클릭 시 '선택' 기능
        this.elements.promptList.addEventListener('click', (e) => {
            const promptCard = e.target.closest('.prompt-card[data-id]');
            if (promptCard) {
                const promptId = parseInt(promptCard.dataset.id);
                this.store.selectPrompt(promptId);
            }
        });
        
        // [핵심 수정] 더블클릭 리스너를 제거하고 클릭 리스너에서 모든 것을 처리
        this.elements.promptDetailContainer.removeEventListener('dblclick', this.handleDetailDoubleClick); // 기존 리스너 제거
        this.elements.promptDetailContainer.addEventListener('click', this.handleDetailClick.bind(this));
        
        // contenteditable 요소의 blur 이벤트(포커스 아웃) 시 저장
        this.elements.promptDetailContainer.addEventListener('blur', (e) => {
            const contentView = e.target.closest('.prompt-content-view[contenteditable="true"]');
            if (contentView) {
                contentView.setAttribute('contenteditable', 'false');
                const turndownService = new TurndownService();
                const newMarkdown = turndownService.turndown(contentView.innerHTML);
                this.store.updateSelectedPromptContent(newMarkdown);
            }
        }, true);
    }
    
    // [핵심] 상세 보기 영역의 모든 클릭 이벤트를 처리하는 단일 함수
    handleDetailClick(e) {
        // 버튼 클릭 처리
        const button = e.target.closest('button');
        if (button) {
            switch(button.id) {
                case 'generate-ai-draft-btn': this.store.generateAIDraft(); break;
                case 'delete-prompt-btn': this.store.deleteSelectedPrompt(); break;
                case 'confirm-ai-draft-btn': this.store.confirmAIDraft(); break;
            }
            return;
        }

        // 프롬프트 내용(contentView) 클릭 처리
        const contentView = e.target.closest('.original-panel .prompt-content-view');
        if (contentView && contentView.getAttribute('contenteditable') !== 'true') {
            // 타이머가 이미 설정되어 있다면, 두 번째 클릭(더블클릭)으로 간주
            if (this.clickTimer) {
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
                // 더블클릭 액션: 수정 모드로 전환
                contentView.setAttribute('contenteditable', 'true');
                contentView.focus();
            } else {
                // 첫 번째 클릭: 타이머 설정
                this.clickTimer = setTimeout(() => {
                    // 싱글클릭 액션: 복사
                    this.handleSingleClickOnDetailView();
                    this.clickTimer = null;
                }, 200); // 200ms 이내에 다른 클릭이 없으면 싱글클릭으로 간주
            }
        }
    }

    // 상세 보기(Detail View)에서 싱글클릭(복사) 처리 함수
    handleSingleClickOnDetailView() {
        const state = this.store.getState();
        const prompt = state.prompts.find(p => p.id === state.selectedPromptId);
        if (prompt) {
            navigator.clipboard.writeText(prompt.content)
                .then(() => {
                    this.showToast("✅ 복사 완료");
                })
                .catch(err => {
                    console.error('Copy failed', err);
                    this.showToast("❌ 복사 실패", "error");
                });
        }
    }

    // 토스트 메시지 표시 함수
    showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 1500);
    }

    // --- 이하 렌더링 관련 함수 (변경 없음) ---

    render(state) {
        if (!state) state = this.store.getState();
        this.renderCategoryTabs(state);
        this.elements.promptListContainer.classList.remove('inactive');
        switch(state.viewMode) {
            case 'sort': this.renderSortModeView(state); break;
            case 'capture': this.renderCaptureView(state); break;
            default: this.renderListView(state); break;
        }
    }

    renderCategoryTabs({ categories, prompts, currentCategoryId }) {
        const unsortedCount = prompts.filter(p => !p.categoryId).length;
        
        let tabsHtml = `
            <button data-id="all" class="${currentCategoryId === 'all' ? 'active' : ''}">모든 프롬프트</button>
            <button data-id="unsorted" class="${currentCategoryId === 'unsorted' ? 'active' : ''}">미분류</button>
            ${categories.map(cat => `<button data-id="${cat.id}" class="${currentCategoryId === cat.id ? 'active' : ''}">${sanitizeHTML(cat.name)}</button>`).join('')}
        `;
        this.elements.categoryTabs.innerHTML = tabsHtml;

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

    renderDetailView(state) {
        const { prompts, selectedPromptId, isLoading } = state;
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

        if (!selectedPrompt) {
            this.elements.promptDetailContainer.innerHTML = `<div id="detail-view-placeholder" class="placeholder">...</div>`;
            return;
        }
        
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
}

export const ui = new UI();