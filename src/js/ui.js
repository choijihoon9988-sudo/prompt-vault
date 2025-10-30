import { APP_CONFIG } from '../../config.js'; // [FIX] 경로 수정
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
            unsortedCountBadge: document.getElementById('unsorted-count-badge'),
            currentCategoryTitle: document.getElementById('current-category-title'),
            promptCount: document.getElementById('prompt-count'),
            promptList: document.getElementById('prompt-list'),
            promptDetailContainer: document.getElementById('prompt-detail-container'),
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
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        this.elements.newPromptBtn.addEventListener('click', () => this.store.createNewPrompt());
        this.elements.sortModeBtn.addEventListener('click', () => this.store.enterSortMode());
    }

    // 상태가 변경될 때마다 호출되는 마스터 렌더링 함수
    render(state) {
        if (!state) state = this.store.getState();
        
        this.renderSidebar(state);
        
        if (state.viewMode === 'sort') {
            this.renderSortModeView(state);
        } else {
            this.renderListView(state);
        }

        // AI 초안 로딩 상태를 UI에 반영
        if (state.isLoading) {
            this.showAIDraftLoading();
        }
    }

    // 사이드바 렌더링
    renderSidebar({ categories, prompts, currentCategoryId }) {
        const unsortedCount = prompts.filter(p =>!p.categoryId).length;
        
        let categoryHtml = '<ul>';
        categoryHtml += `<li data-id="all" class="${currentCategoryId === 'all'? 'active' : ''}">모든 프롬프트</li>`;
        categoryHtml += `<li data-id="unsorted" class="${currentCategoryId === 'unsorted'? 'active' : ''}">미분류</li>`;
        
        categories.forEach(cat => {
            categoryHtml += `<li data-id="${cat.id}" class="${currentCategoryId === cat.id? 'active' : ''}">${sanitizeHTML(cat.name)}</li>`;
        });
        categoryHtml += '</ul>';
        
        this.elements.categoryNav.innerHTML = categoryHtml;
        
        // 카테고리 클릭 이벤트 위임
        this.elements.categoryNav.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.store.selectCategory(id === 'all' || id === 'unsorted'? id : parseInt(id));
            });
        });

        // 미분류 뱃지 업데이트
        this.elements.unsortedCountBadge.textContent = unsortedCount;
        if (unsortedCount > 0 && APP_CONFIG.FEATURES.ENABLE_SORT_MODE_NOTIFICATIONS) {
            this.elements.sortModeBtn.classList.add('highlight');
        } else {
            this.elements.sortModeBtn.classList.remove('highlight');
        }
    }

    // 일반 리스트 뷰 렌더링
    renderListView(state) {
        this.elements.promptDetailContainer.style.display = 'block';
        
        const { prompts, categories, currentCategoryId, selectedPromptId } = state;

        // 현재 선택된 카테고리에 따라 프롬프트 필터링
        let filteredPrompts = [];
        let categoryTitle = "";
        if (currentCategoryId === 'all') {
            filteredPrompts = prompts;
            categoryTitle = "모든 프롬프트";
        } else if (currentCategoryId === 'unsorted') {
            filteredPrompts = prompts.filter(p =>!p.categoryId);
            categoryTitle = "미분류";
        } else {
            filteredPrompts = prompts.filter(p => p.categoryId === currentCategoryId);
            const cat = categories.find(c => c.id === currentCategoryId);
            categoryTitle = cat? cat.name : "알 수 없는 카테고리";
        }

        this.elements.currentCategoryTitle.textContent = sanitizeHTML(categoryTitle);
        this.elements.promptCount.textContent = `${filteredPrompts.length}개`;
        
        // 프롬프트 목록 렌더링
        if (filteredPrompts.length === 0) {
            this.elements.promptList.innerHTML = `<p class="placeholder">${APP_CONFIG.UI_TEXTS.EMPTY_PROMPTS_MESSAGE}</p>`;
        } else {
            this.elements.promptList.innerHTML = filteredPrompts.map(p => `
                <div class="prompt-card ${p.id === selectedPromptId? 'active' : ''}" data-id="${p.id}">
                    <div class="prompt-card-title">${sanitizeHTML(getFirstLine(p.content))}</div>
                    <div class="prompt-card-preview">${sanitizeHTML(p.content)}</div>
                </div>
            `).join('');
        }

        // 프롬프트 카드 클릭 이벤트 위임
        this.elements.promptList.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.store.selectPrompt(parseInt(e.currentTarget.dataset.id));
            });
        });

        // 상세 뷰 렌더링
        this.renderDetailView(state);
    }

    // 상세 뷰 렌더링
    renderDetailView(state) {
        const { prompts, selectedPromptId } = state;
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

        if (!selectedPrompt) {
            this.elements.promptDetailContainer.innerHTML = `
                <div id="detail-view-placeholder" class="placeholder">
                    <p>프롬프트를 선택하거나 새로 만드세요.</p>
                    <small>단축키: \`Ctrl+K\`로 명령 팔레트 열기</small>
                </div>`;
            return;
        }

        const isEditing = false; // MVP에서는 편집 모드를 구현하지 않음
        let contentHtml = '';

        if (isEditing) {
            contentHtml = `<textarea class="prompt-content-editor">${sanitizeHTML(selectedPrompt.content)}</textarea>`;
        } else {
            if (APP_CONFIG.FEATURES.ENABLE_MARKDOWN_PARSING) {
                // marked.js를 사용하여 마크다운 파싱
                contentHtml = `<div class="prompt-content-view">${marked.parse(selectedPrompt.content)}</div>`;
            } else {
                contentHtml = `<div class="prompt-content-view"><pre>${sanitizeHTML(selectedPrompt.content)}</pre></div>`;
            }
        }

        this.elements.promptDetailContainer.innerHTML = `
            <div id="detail-view">
                <div class="detail-header">
                    <small>최종 수정: ${new Date(selectedPrompt.updatedAt).toLocaleString()}</small>
                    <div class="detail-header-actions">
                        <button id="generate-ai-draft-btn">✨ AI 초안 생성</button>
                        <button id="delete-prompt-btn">삭제</button>
                    </div>
                </div>
                ${contentHtml}
                <div id="ai-draft-container" class="ai-draft-container ${!selectedPrompt.aiDraftContent? 'hidden' : ''}">
                    ${this.renderAIDraft(selectedPrompt)}
                </div>
            </div>`;
        
        // 구문 강조 적용
        if (APP_CONFIG.FEATURES.ENABLE_SYNTAX_HIGHLIGHTING) {
            this.elements.promptDetailContainer.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        
        // 상세 뷰 내 버튼 이벤트 리스너 설정
        document.getElementById('generate-ai-draft-btn').addEventListener('click', () => this.store.generateAIDraft());
        document.getElementById('delete-prompt-btn').addEventListener('click', () => this.store.deleteSelectedPrompt());
        
        const confirmBtn = document.getElementById('confirm-ai-draft-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.store.confirmAIDraft());
        }
    }
    
    // AI 초안 영역 렌더링
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

    // AI 초안 로딩 UI 표시
    showAIDraftLoading() {
        const container = document.getElementById('ai-draft-container');
        if (container) {
            container.classList.remove('hidden');
            container.innerHTML = `
                <div class="ai-draft-header">
                    <div class="loading-spinner"></div> AI가 초안을 생성하는 중...
                </div>
            `;
            // 상세 뷰의 다른 부분에 로딩 상태를 표시할 수도 있습니다.
            // 예: this.elements.promptDetailContainer.querySelector('.detail-header-actions').style.opacity = '0.5';
        }
    }

    // 정리 모드 뷰 렌더링
    renderSortModeView({ prompts, categories }) {
        this.elements.promptDetailContainer.style.display = 'none';
        
        const unsortedPrompts = prompts.filter(p =>!p.categoryId);
        
        if (unsortedPrompts.length === 0) {
            this.elements.promptList.innerHTML = `
                <div id="sort-mode-view" class="placeholder">
                    <h2>${APP_CONFIG.UI_TEXTS.EMPTY_SORT_MODE_MESSAGE}</h2>
                    <button id="exit-sort-mode-btn">돌아가기</button>
                </div>`;
            document.getElementById('exit-sort-mode-btn').addEventListener('click', () => this.store.exitSortMode());
            return;
        }

        const currentPrompt = unsortedPrompts[0];
        // AI가 추천할 카테고리 시뮬레이션 (랜덤 선택)
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

        // 정리 모드 이벤트 리스너 설정
        document.getElementById('exit-sort-mode-btn').addEventListener('click', () => this.store.exitSortMode());
        this.elements.promptList.querySelectorAll('.category-suggestion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryId = e.currentTarget.dataset.catId;
                const currentPromptId = currentPrompt.id;
                
                if (categoryId === 'new') {
                    // 새 카테고리 생성 로직 (store에 기능 추가 필요)
                    const newCategoryName = prompt("새 카테고리 이름을 입력하세요:");
                    if (newCategoryName && newCategoryName.trim() !== "") {
                        // TODO: store.js에 새 카테고리를 추가하고 프롬프트에 할당하는 기능 구현 필요
                        // 예: this.store.addNewCategoryAndAssign(newCategoryName, currentPromptId);
                        alert(`'${newCategoryName}' 카테고리 추가 기능은 store.js에 구현이 필요합니다.`);
                    }
                } else {
                    this.store.assignCategoryToPrompt(currentPromptId, parseInt(categoryId));
                }
            });
        });
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const ui = new UI();