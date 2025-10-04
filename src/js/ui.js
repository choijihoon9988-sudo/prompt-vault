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
        // [삭제] 분할 뷰 도입으로 인라인 편집 기능 일시 비활성화
        // this.editingPromptId = null; 
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

        // 프롬프트 목록 클릭 (이벤트 위임)
        this.elements.promptList.addEventListener('click', (e) => {
            const promptCard = e.target.closest('.prompt-card[data-id]');
            if (promptCard) {
                this.store.selectPrompt(parseInt(promptCard.dataset.id));
            }
        });
        
        // 메인 컨텐츠 영역 클릭 (이벤트 위임) - 상세 뷰, 정리 모드
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
                case 'exit-sort-mode-btn':
                    this.store.exitSortMode();
                    break;
             }

             const suggestionBtn = e.target.closest('.category-suggestion-btn[data-cat-id]');
             if (suggestionBtn) {
                 this.handleSortModeAction(suggestionBtn.dataset.catId);
                 return;
             }
        });
    }

    // 상태가 변경될 때마다 호출되는 마스터 렌더링 함수
    render(state) {
        if (!state) state = this.store.getState();
        
        this.renderSidebar(state);
        
        this.elements.promptListContainer.classList.remove('inactive');
        this.elements.promptDetailContainer.innerHTML = '';
        
        switch(state.viewMode) {
            case 'sort':
                this.renderSortModeView(state);
                break;
            case 'capture':
                this.renderCaptureView(state);
                break;
            default: // 'list'
                this.renderListView(state);
                break;
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
        
        if (filteredPrompts.length === 0 && currentCategoryId !== 'all' && currentCategoryId !== 'unsorted') {
             this.elements.promptList.innerHTML = `<p class="placeholder" style="padding: 1rem;">비어있는 카테고리입니다.</p>`;
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

    // [대폭 수정] 상세 뷰를 좌우 분할 레이아웃으로 렌더링
    renderDetailView(state) {
        const { prompts, selectedPromptId, isLoading } = state;
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

        if (!selectedPrompt) {
            this.elements.promptDetailContainer.innerHTML = `
                <div id="detail-view-placeholder" class="placeholder">
                    <p>프롬프트를 선택하거나 새로 만드세요.</p>
                    <small>단축키: \`Ctrl+K\`로 명령어 팔레트 열기</small>
                </div>`;
            return;
        }

        const originalContentHtml = APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING
            ? marked.parse(selectedPrompt.content)
            : `<pre>${sanitizeHTML(selectedPrompt.content)}</pre>`;
        
        let aiDraftContentHtml = '';
        if (isLoading) {
            aiDraftContentHtml = this.renderAIDraftLoading();
        } else if (selectedPrompt.aiDraftContent) {
            aiDraftContentHtml = this.renderAIDraft(selectedPrompt);
        } else {
            aiDraftContentHtml = this.renderAIDraftPlaceholder();
        }

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

                <div class="detail-split-container">
                    <div class="prompt-view-panel original-panel">
                        <h3>원본</h3>
                        <div class="prompt-content-wrapper">
                            <div class="prompt-content-view">${originalContentHtml}</div>
                        </div>
                    </div>
                    <div class="prompt-view-panel ai-draft-panel">
                        <h3>✨ 전략가 AI 추천 초안</h3>
                        <div class="prompt-content-wrapper">
                            ${aiDraftContentHtml}
                        </div>
                    </div>
                </div>
            </div>`;
        
        if (APP_CONFIG.FEATURES.ENABLE_SYNTAX_HIGHLIGHTING) {
            this.elements.promptDetailContainer.querySelectorAll('pre code').forEach(hljs.highlightElement);
        }
    }
    
    // AI 추천 초안 뷰 렌더링
    renderAIDraft(prompt) {
        if (!prompt.aiDraftContent) return '';
        const draftHtml = APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING
            ? marked.parse(prompt.aiDraftContent)
            : `<pre>${sanitizeHTML(prompt.aiDraftContent)}</pre>`;

        return `
            <div class="prompt-content-view">${draftHtml}</div>
            <div class="ai-draft-container">
                <button id="confirm-ai-draft-btn">이 버전으로 확정하기</button>
            </div>
        `;
    }

    // AI 초안 로딩 스피너 렌더링
    renderAIDraftLoading() {
        return `
            <div class="ai-draft-header">
                <div class="loading-spinner"></div> AI가 초안을 생성하는 중...
            </div>
        `;
    }

    // AI 초안이 없을 때의 플레이스홀더 렌더링
    renderAIDraftPlaceholder() {
        return `
            <div class="placeholder">
                <p>버튼을 눌러 AI 추천 초안을 생성하고<br>당신의 아이디어를 지적 자산으로 바꿔보세요.</p>
            </div>
        `;
    }
    
    // [신규] 캡처 뷰 렌더링
    renderCaptureView() {
        this.elements.promptListContainer.classList.add('inactive');
        this.elements.promptList.innerHTML = '';
        this.elements.currentCategoryTitle.textContent = "새 아이디어";
        this.elements.promptCount.textContent = "캡처 중...";

        this.elements.promptDetailContainer.innerHTML = `
            <div id="capture-view">
                <input type="text" id="capture-input" placeholder="번뜩이는 아이디어를 한 줄로... (Enter로 즉시 저장)">
            </div>
        `;

        const input = document.getElementById('capture-input');
        input.focus();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.store.saveCapturedPrompt(e.target.value);
            }
            if (e.key === 'Escape') {
                this.store.exitCaptureMode();
            }
        });
    }

    renderSortModeView({ prompts, categories }) {
        const unsortedPrompts = prompts.filter(p => !p.categoryId);
        
        this.elements.promptList.innerHTML = ''; // 목록 비우기
        this.elements.currentCategoryTitle.textContent = "정리 모드";
        this.elements.promptCount.textContent = `${unsortedPrompts.length}개 남음`;

        if (unsortedPrompts.length === 0) {
            this.elements.promptDetailContainer.innerHTML = `
                <div id="sort-mode-view" class="placeholder">
                    <h2>${APP_CONFIG.UI_TEXTS.EMPTY_SORT_MODE_MESSAGE}</h2>
                    <button id="exit-sort-mode-btn" class="sidebar-btn" style="padding: 0.5rem 1rem; margin-top: 1rem;">돌아가기</button>
                </div>`;
            return;
        }

        const currentPrompt = unsortedPrompts[0];
        const suggestedCategories = [...categories].sort(() => 0.5 - Math.random()).slice(0, 3);

        this.elements.promptDetailContainer.innerHTML = `
            <div id="sort-mode-view">
                <h2>${APP_CONFIG.UI_TEXTS.SORT_MODE_TITLE}</h2>
                <p>${APP_CONFIG.UI_TEXTS.SORT_MODE_PROMPT}</p>
                <div class="sort-card">
                    <div class="sort-card-content">${sanitizeHTML(currentPrompt.content)}</div>
                    <div class="category-suggestions">
                        ${suggestedCategories.map(cat => `<button class="category-suggestion-btn" data-cat-id="${cat.id}">${sanitizeHTML(cat.name)}</button>`).join('')}
                        <button class="category-suggestion-btn" data-cat-id="new">직접 입력...</button>
                    </div>
                </div>
                <button id="exit-sort-mode-btn" class="sidebar-btn" style="padding: 0.5rem 1rem;">정리 끝내기</button>
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