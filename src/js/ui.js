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
            vaultList: document.getElementById('vault-list'),
            categoriesHeader: document.getElementById('categories-header'),
            categoryToggleIcon: document.getElementById('category-toggle-icon'),
            userCategoryListContainer: document.getElementById('user-category-list-container'),
            userCategoryList: document.getElementById('user-category-list'),
            categorySection: document.getElementById('category-section'),
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
        this.isCategoryListExpanded = false; // 카테고리 목록 확장 상태
        this.sortModeState = { selectedButtonIndex: 0 }; // 정리 모드 키보드 네비게이션 상태
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
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        this.elements.newPromptBtn.addEventListener('click', () => this.store.createNewPrompt());
        this.elements.sortModeBtn.addEventListener('click', () => this.store.enterSortMode());
        
        this.elements.categoriesHeader.addEventListener('click', () => this.toggleCategoryList());

        this.elements.categorySection.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-id]');
            if (button) this.store.selectCategory(button.dataset.id === 'all' || button.dataset.id === 'unsorted' ? button.dataset.id : parseInt(button.dataset.id));
        });

        this.elements.promptList.addEventListener('click', (e) => {
            const promptCard = e.target.closest('.prompt-card[data-id]');
            if (promptCard) {
                const promptId = parseInt(promptCard.dataset.id);
                this.store.selectPrompt(promptId);
            }
        });
        
        this.elements.promptDetailContainer.addEventListener('click', this.handleDetailClick.bind(this));
        
        // [신규] Enter 키 입력 시 서식이 깨지는 오류를 방지하기 위한 이벤트 리스너
        this.elements.promptDetailContainer.addEventListener('keydown', (e) => {
            const contentView = e.target.closest('.prompt-content-view[contenteditable="true"]');
            if (contentView && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // 브라우저의 기본 동작(div 또는 p 태그 삽입)을 막습니다.
                document.execCommand('insertHTML', false, '<br><br>'); // 수동으로 줄바꿈을 삽입하여 단락 구분을 만듭니다.
            }
        });
        
        this.elements.promptDetailContainer.addEventListener('blur', (e) => {
            const contentView = e.target.closest('.prompt-content-view[contenteditable="true"]');
            if (contentView) {
                contentView.setAttribute('contenteditable', 'false');
                const turndownService = new TurndownService();
                const newMarkdown = turndownService.turndown(contentView.innerHTML);
                this.store.updateSelectedPromptContent(newMarkdown);
            }
        }, true);
        
        document.addEventListener('keydown', this.handleSortModeKeyDown.bind(this));
    }
    
    toggleCategoryList() {
        this.isCategoryListExpanded = !this.isCategoryListExpanded;
        this.elements.userCategoryListContainer.classList.toggle('expanded', this.isCategoryListExpanded);
        this.elements.categoryToggleIcon.textContent = this.isCategoryListExpanded ? '▲' : '▼';
    }
    
    handleDetailClick(e) {
        const sortButton = e.target.closest('.category-suggestion-btn');
        if (sortButton) {
            const promptId = parseInt(sortButton.dataset.promptId);
            const categoryName = sortButton.dataset.categoryName;
            this.animateAndAssignCategory(sortButton, promptId, categoryName);
            return;
        }

        const button = e.target.closest('button');
        if (button) {
            switch(button.id) {
                case 'generate-ai-draft-btn': this.store.generateAIDraft(); break;
                case 'delete-prompt-btn': this.store.deleteSelectedPrompt(); break;
                case 'confirm-ai-draft-btn': this.store.confirmAIDraft(); break;
            }
            return;
        }

        const contentView = e.target.closest('.original-panel .prompt-content-view');
        if (contentView && contentView.getAttribute('contenteditable') !== 'true') {
            if (this.clickTimer) {
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
                contentView.setAttribute('contenteditable', 'true');
                contentView.focus();
            } else {
                this.clickTimer = setTimeout(() => {
                    this.handleSingleClickOnDetailView();
                    this.clickTimer = null;
                }, 200);
            }
        }
    }

    handleSingleClickOnDetailView() {
        const state = this.store.getState();
        const prompt = state.prompts.find(p => p.id === state.selectedPromptId);
        if (prompt) {
            navigator.clipboard.writeText(prompt.content)
                .then(() => this.showToast("✅ 복사 완료"))
                .catch(err => {
                    console.error('Copy failed', err);
                    this.showToast("❌ 복사 실패", "error");
                });
        }
    }
    
    handleSortModeKeyDown(e) {
        const state = this.store.getState();
        if (state.viewMode !== 'sort' || !state.currentSortPrompt) return;
        
        const buttons = this.elements.promptDetailContainer.querySelectorAll('.category-suggestion-btn');
        if (buttons.length === 0) return;

        let newIndex = this.sortModeState.selectedButtonIndex;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            newIndex = (newIndex - 1 + buttons.length) % buttons.length;
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            newIndex = (newIndex + 1) % buttons.length;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            buttons[newIndex].click();
            return;
        }
        
        if (newIndex !== this.sortModeState.selectedButtonIndex) {
            this.sortModeState.selectedButtonIndex = newIndex;
            buttons.forEach((btn, index) => {
                btn.classList.toggle('selected', index === newIndex);
            });
        }
    }

    animateAndAssignCategory(button, promptId, categoryName) {
        const card = this.elements.promptDetailContainer.querySelector('.sort-card');
        if (!card) return;

        const direction = button.classList.contains('best-suggestion') ? 'right' : 'left';
        card.classList.add(`fly-out-${direction}`);

        card.addEventListener('animationend', () => {
            this.store.assignCategoryAndGoNext(promptId, categoryName);
        }, { once: true });
    }

    showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 1500);
    }

    render(state) {
        if (!state) state = this.store.getState();
        
        this.renderCategoryList(state); 
        
        this.elements.promptListContainer.classList.remove('inactive');
        const isSortMode = state.viewMode === 'sort';
        this.elements.promptListContainer.classList.toggle('hidden', isSortMode);
        this.elements.promptDetailContainer.classList.toggle('sort-mode-active', isSortMode);

        switch(state.viewMode) {
            case 'sort': this.renderSortModeView(state); break;
            case 'capture': this.renderCaptureView(state); break;
            default: this.renderListView(state); break;
        }
    }

    renderCategoryList({ categories, prompts, currentCategoryId }) {
        const unsortedCount = prompts.filter(p => !p.categoryId).length;

        const vaultHtml = `
            <button data-id="all" class="category-item ${currentCategoryId === 'all' ? 'active' : ''}">모든 프롬프트</button>
            <button data-id="unsorted" class="category-item ${currentCategoryId === 'unsorted' ? 'active' : ''}">
                <span>미분류</span><span class="badge">${unsortedCount}</span>
            </button>`;
        this.elements.vaultList.innerHTML = vaultHtml;

        const categoriesHtml = categories.map(cat => `
            <button data-id="${cat.id}" class="category-item ${currentCategoryId === cat.id ? 'active' : ''}">
                ${sanitizeHTML(cat.name)}</button>`).join('');
        this.elements.userCategoryList.innerHTML = categoriesHtml;

        this.elements.unsortedCountBadge.textContent = unsortedCount;
        this.elements.sortModeBtn.classList.toggle('highlight', unsortedCount > 0 && APP_CONFIG.FEATURES.ENABLE_SORT_MODE_NOTIFICATIONS);
    }
    
    // [신규] 마크다운 렌더링을 위한 헬퍼 함수
    _renderMarkdownContent(content) {
        if (!content) return '';
        if (APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING) {
            return marked.parse(content);
        }
        // 마크다운 비활성화 시, pre 태그로 래핑하여 텍스트 형식 유지
        return `<pre>${sanitizeHTML(content)}</pre>`;
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
        
        this.elements.promptList.innerHTML = (filteredPrompts.length === 0 && currentCategoryId !== 'all' && currentCategoryId !== 'unsorted')
            ? `<p class="placeholder" style="padding: 1rem;">비어있는 카테고리입니다.</p>`
            : filteredPrompts.map(p => `
                <div class="prompt-card ${p.id === selectedPromptId ? 'active' : ''}" data-id="${p.id}">
                    <div class="prompt-card-title">${sanitizeHTML(p.title || getFirstLine(p.content))}</div>
                    <div class="prompt-card-preview">${sanitizeHTML(p.summary || p.content)}</div>
                </div>
            `).join('');
        
        this.renderDetailView(state);
    }

    renderDetailView(state) {
        const { prompts, selectedPromptId, isLoading } = state;
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

        if (!selectedPrompt) {
            this.elements.promptDetailContainer.innerHTML = `<div id="detail-view-placeholder" class="placeholder"><p>프롬프트를 선택하거나 새로 만드세요.</p><small>단축키: \`Ctrl+K\`로 명령어 팔레트 열기</small></div>`;
            return;
        }
        
        // [수정] 헬퍼 함수를 사용하여 원본 콘텐츠 렌더링 (버그 수정)
        const originalPanelContent = `<div class="prompt-content-view">${this._renderMarkdownContent(selectedPrompt.content)}</div>`;

        let mainViewHtml;
        if (selectedPrompt.aiDraftContent || isLoading) {
            const aiDraftContentHtml = isLoading ? this.renderAIDraftLoading() : this.renderAIDraft(selectedPrompt);
            mainViewHtml = `<div class="detail-split-container">
                    <div class="prompt-view-panel original-panel"><h3>원본</h3><div class="prompt-content-wrapper">${originalPanelContent}</div></div>
                    <div class="prompt-view-panel ai-draft-panel"><h3>✨ 전략가 AI 추천 초안</h3><div class="prompt-content-wrapper">${aiDraftContentHtml}</div></div>
                </div>`;
        } else {
            mainViewHtml = `<div class="prompt-view-panel original-panel full-width">
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
        // [수정] 헬퍼 함수를 사용하여 AI 초안 렌더링 (코드 일관성 확보)
        const draftHtml = this._renderMarkdownContent(prompt.aiDraftContent);
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

        this.elements.promptDetailContainer.innerHTML = `<div id="capture-view"><input type="text" id="capture-input" placeholder="${APP_CONFIG.UI_TEXTS.CAPTURE_PLACEHOLDER}"></div>`;

        const input = document.getElementById('capture-input');
        input.focus();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.store.saveCapturedPrompt(e.target.value);
            if (e.key === 'Escape') this.store.exitCaptureMode();
        });
    }

    renderSortModeView({ prompts, isLoading, currentSortPrompt }) {
        this.elements.promptListContainer.classList.add('inactive');
        this.elements.currentCategoryTitle.textContent = APP_CONFIG.UI_TEXTS.SORT_MODE_TITLE;
        const unsortedCount = prompts.filter(p => !p.categoryId).length;
        this.elements.promptCount.textContent = `${unsortedCount}개 남음`;

        let contentHtml = '';

        if (isLoading) {
            contentHtml = `<div class="sort-mode-loading"><div class="loading-spinner"></div>AI 추천을 기다리는 중...</div>`;
        } else if (currentSortPrompt) {
            const { prompt, suggestions } = currentSortPrompt;
            this.sortModeState.selectedButtonIndex = 0;
            contentHtml = `
                <div class="sort-card" data-prompt-id="${prompt.id}">
                    <div class="sort-card-content">
                        <h3>${sanitizeHTML(getFirstLine(prompt.content))}</h3>
                        <p>${sanitizeHTML(prompt.content)}</p>
                    </div>
                    <div class="category-suggestions">
                        <button class="category-suggestion-btn best-suggestion selected" data-prompt-id="${prompt.id}" data-category-name="${suggestions.best}">⭐ ${sanitizeHTML(suggestions.best)}</button>
                        <button class="category-suggestion-btn" data-prompt-id="${prompt.id}" data-category-name="${suggestions.second}">${sanitizeHTML(suggestions.second)}</button>
                    </div>
                </div>`;
        } else {
             contentHtml = `<div class="sort-complete-message">${APP_CONFIG.UI_TEXTS.SORT_MODE_COMPLETE_MESSAGE}</div>`;
        }

        this.elements.promptDetailContainer.innerHTML = `<div id="sort-mode-view">${contentHtml}</div>`;
    }
}

export const ui = new UI();