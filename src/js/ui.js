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
            promptList: document.getElementById('prompt-list'),
            promptDetailContainer: document.getElementById('prompt-detail-container'),
            unsortedCountBadge: document.getElementById('unsorted-count-badge'),
            currentCategoryTitle: document.getElementById('current-category-title'),
            promptCount: document.getElementById('prompt-count'),
            newPromptBtn: document.getElementById('new-prompt-btn'),
            sortModeBtn: document.getElementById('sort-mode-btn'),
        };
        this.store = null;
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
    
    // 이벤트 리스너를 한 곳에서 설정 (이벤트 위임 활용)
    setupEventListeners() {
        // 정적 버튼 이벤트
        this.elements.newPromptBtn.addEventListener('click', () => this.store.createNewPrompt());
        this.elements.sortModeBtn.addEventListener('click', () => this.store.enterSortMode());

        // 카테고리 목록 클릭 (이벤트 위임)
        this.elements.categoryNav.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-id]');
            if (li) {
                const id = li.dataset.id;
                this.store.selectCategory(id === 'all' || id === 'unsorted' ? id : parseInt(id));
            }
        });

        // 프롬프트 목록 및 정렬 모드 클릭 (이벤트 위임)
        this.elements.promptList.addEventListener('click', (e) => {
            const promptCard = e.target.closest('.prompt-card[data-id]');
            if (promptCard) {
                this.store.selectPrompt(parseInt(promptCard.dataset.id));
                return;
            }
            
            const suggestionBtn = e.target.closest('.category-suggestion-btn[data-cat-id]');
            if (suggestionBtn) {
                this.handleSortModeAction(suggestionBtn.dataset.catId);
                return;
            }

            if (e.target.closest('#exit-sort-mode-btn')) {
                this.store.exitSortMode();
            }
        });

        // 프롬프트 상세 뷰 액션 버튼 클릭 (이벤트 위임)
        this.elements.promptDetailContainer.addEventListener('click', (e) => {
            const targetId = e.target.closest('button')?.id;
            switch(targetId) {
                case 'generate-ai-draft-btn':
                    this.store.generateAIDraft();
                    break;
                case 'delete-prompt-btn':
                    this.store.deleteSelectedPrompt();
                    break;
                case 'confirm-ai-draft-btn':
                    this.store.confirmAIDraft();
                    break;
            }
        });
    }

    // 상태가 변경될 때마다 호출되는 마스터 렌더링 함수
    render(state) {
        if (!state) state = this.store.getState();
        
        this.renderSidebar(state);
        
        if (state.viewMode === 'sort') {
            this.elements.promptDetailContainer.innerHTML = '';
            this.elements.promptDetailContainer.style.display = 'none';
            this.renderSortModeView(state);
        } else {
            this.elements.promptDetailContainer.style.display = 'block';
            this.renderListView(state);
        }
    }

    // 사이드바 렌더링
    renderSidebar({ categories, prompts, currentCategoryId }) {
        const unsortedCount = prompts.filter(p => !p.categoryId).length;
        
        let categoryHtml = '<ul>';
        categoryHtml += `<li data-id="all" class="${currentCategoryId === 'all' ? 'active' : ''}">모든 프롬프트</li>`;
        categoryHtml += `<li data-id="unsorted" class="${currentCategoryId === 'unsorted' ? 'active' : ''}">미분류</li>`;
        
        categories.forEach(cat => {
            categoryHtml += `<li data-id="${cat.id}" class="${currentCategoryId === cat.id ? 'active' : ''}">${sanitizeHTML(cat.name)}</li>`;
        });
        categoryHtml += '</ul>';
        
        this.elements.categoryNav.innerHTML = categoryHtml;
        
        this.elements.unsortedCountBadge.textContent = unsortedCount;
        if (unsortedCount > 0 && APP_CONFIG.FEATURES.ENABLE_SORT_MODE_NOTIFICATIONS) {
            this.elements.sortModeBtn.classList.add('highlight');
        } else {
            this.elements.sortModeBtn.classList.remove('highlight');
        }
    }

    // 일반 리스트 뷰 렌더링
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
        
        if (filteredPrompts.length === 0) {
            this.elements.promptList.innerHTML = `<p class="placeholder" style="padding: 1rem;">${APP_CONFIG.UI_TEXTS.EMPTY_PROMPTS_MESSAGE}</p>`;
        } else {
            this.elements.promptList.innerHTML = filteredPrompts.map(p => `
                <div class="prompt-card ${p.id === selectedPromptId ? 'active' : ''}" data-id="${p.id}">
                    <div class="prompt-card-title">${sanitizeHTML(getFirstLine(p.content))}</div>
                    <div class="prompt-card-preview">${sanitizeHTML(p.content)}</div>
                </div>
            `).join('');
        }

        this.renderDetailView(state);
    }

    // 상세 뷰 렌더링
    renderDetailView(state) {
        const { prompts, selectedPromptId, isLoading } = state;
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

        if (!selectedPrompt) {
            this.elements.promptDetailContainer.innerHTML = `
                <div id="detail-view-placeholder" class="placeholder">
                    <p>프롬프트를 선택하거나 새로 만드세요.</p>
                    <small>단축키: \`Ctrl+K\`로 명령 팔레트 열기</small>
                </div>`;
            return;
        }

        const contentHtml = APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING
            ? `<div class="prompt-content-view">${marked.parse(selectedPrompt.content)}</div>`
            : `<div class="prompt-content-view"><pre>${sanitizeHTML(selectedPrompt.content)}</pre></div>`;

        this.elements.promptDetailContainer.innerHTML = `
            <div id="detail-view">
                <div class="detail-header">
                    <small>최종 수정: ${new Date(selectedPrompt.updatedAt).toLocaleString()}</small>
                    <div class="detail-header-actions">
                        <button id="generate-ai-draft-btn" ${isLoading ? 'disabled' : ''}>
                            ${isLoading ? '생성 중...' : '✨ AI 초안 생성'}
                        </button>
                        <button id="delete-prompt-btn">삭제</button>
                    </div>
                </div>
                ${contentHtml}
                <div id="ai-draft-container" class="ai-draft-container ${!selectedPrompt.aiDraftContent && !isLoading ? 'hidden' : ''}">
                    ${isLoading ? this.renderAIDraftLoading() : this.renderAIDraft(selectedPrompt)}
                </div>
            </div>`;
        
        if (APP_CONFIG.FEATURES.ENABLE_SYNTAX_HIGHLIGHTING) {
            this.elements.promptDetailContainer.querySelectorAll('pre code').forEach(hljs.highlightElement);
        }
    }
    
    renderAIDraft(prompt) {
        if (!prompt.aiDraftContent) return '';
        return `
            <div class="ai-draft-header">
                <span class="sparkle">✨</span> 전략가 AI 추천 초안
            </div>
            <div class="prompt-content-view">${marked.parse(prompt.aiDraftContent)}</div>
            <div class="detail-header-actions" style="margin-top: 1rem;">
                <button id="confirm-ai-draft-btn">이 버전으로 확정하기</button>
            </div>
        `;
    }

    renderAIDraftLoading() {
        return `
            <div class="ai-draft-header">
                <div class="loading-spinner"></div> AI가 초안을 생성하는 중...
            </div>
        `;
    }

    renderSortModeView({ prompts, categories }) {
        const unsortedPrompts = prompts.filter(p => !p.categoryId);
        
        if (unsortedPrompts.length === 0) {
            this.elements.promptList.innerHTML = `
                <div id="sort-mode-view" class="placeholder">
                    <h2>${APP_CONFIG.UI_TEXTS.EMPTY_SORT_MODE_MESSAGE}</h2>
                    <button id="exit-sort-mode-btn">돌아가기</button>
                </div>`;
            return;
        }

        const currentPrompt = unsortedPrompts[0];
        const suggestedCategories = [...categories].sort(() => 0.5 - Math.random()).slice(0, APP_CONFIG.AI_SERVICE.SUGGESTED_CATEGORIES_COUNT);

        this.elements.promptList.innerHTML = `
            <div id="sort-mode-view">
                <h2>${APP_CONFIG.UI_TEXTS.SORT_MODE_TITLE} (${unsortedPrompts.length})</h2>
                <p>${APP_CONFIG.UI_TEXTS.SORT_MODE_PROMPT}</p>
                <div class="sort-card">
                    <div class="sort-card-content">${sanitizeHTML(currentPrompt.content)}</div>
                    <div class="category-suggestions">
                        ${suggestedCategories.map(cat => `<button class="category-suggestion-btn" data-cat-id="${cat.id}">${sanitizeHTML(cat.name)}</button>`).join('')}
                        <button class="category-suggestion-btn" data-cat-id="new">직접 입력...</button>
                    </div>
                </div>
                <button id="exit-sort-mode-btn">정리 끝내기</button>
            </div>`;
    }

    handleSortModeAction(categoryId) {
        const unsortedPrompts = this.store.getState().prompts.filter(p => !p.categoryId);
        if (unsortedPrompts.length === 0) return;
        const currentPrompt = unsortedPrompts[0];

        if (categoryId === 'new') {
            const newCategoryName = prompt("새 카테고리 이름을 입력하세요:");
            if (newCategoryName) {
                // This requires a new action in the store to handle category creation and assignment
                alert(`'${newCategoryName}' 카테고리가 생성되어 할당되었습니다. (스토어 액션 구현 필요)`);
                // e.g., this.store.createNewCategoryAndAssign(newCategoryName, currentPrompt.id);
            }
        } else {
            this.store.assignCategoryToPrompt(currentPrompt.id, parseInt(categoryId));
        }
    }
}

export const ui = new UI();
