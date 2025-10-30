import { APP_CONFIG } from '../../config.js'; // [FIX] 경로 수정

// 커맨드 팔레트 UI 및 로직을 관리하는 모듈
class CommandPalette {
    constructor() {
        this.elements = {
            overlay: document.getElementById('command-palette-overlay'),
            palette: document.getElementById('command-palette'),
            input: document.getElementById('command-palette-input'),
            list: document.getElementById('command-palette-list'),
        };
        this.store = null;
        this.commands = [];
        this.filteredCommands = [];
        this.selectedIndex = 0;
    }

    init(storeInstance) {
        this.store = storeInstance;
        this.elements.input.placeholder = APP_CONFIG.UI_TEXTS.COMMAND_PALETTE_PLACEHOLDER;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) this.hide();
        });
        this.elements.input.addEventListener('input', () => this.filterAndRender());
        this.elements.input.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    // 커맨드 목록을 동적으로 생성
    generateCommands() {
        const { categories } = this.store.getState();
        this.commands = [
            {
                label: "새 프롬프트 생성",
                category: "액션",
                action: () => this.store.createNewPrompt(),
            },
            {
                label: "정리 모드 시작",
                category: "액션",
                action: () => this.store.enterSortMode(),
            },
            ...categories.map(cat => ({
                label: `${cat.name} 카테고리로 이동`,
                category: "탐색",
                action: () => this.store.selectCategory(cat.id),
            })),
        ];
    }
    
    // 입력값에 따라 커맨드를 필터링하고 렌더링
    filterAndRender() {
        const query = this.elements.input.value.toLowerCase();
        this.filteredCommands = this.commands.filter(cmd => cmd.label.toLowerCase().includes(query));
        this.selectedIndex = 0;
        this.renderList();
    }
    
    // 필터링된 커맨드 목록을 HTML로 렌더링
    renderList() {
        if (this.filteredCommands.length === 0) {
            this.elements.list.innerHTML = `<li>결과 없음</li>`;
            return;
        }
        this.elements.list.innerHTML = this.filteredCommands.map((cmd, index) => `
            <li class="${index === this.selectedIndex? 'selected' : ''}" data-index="${index}">
                <span class="command-label">${cmd.label}</span>
                <span class="command-category">${cmd.category}</span>
            </li>
        `).join('');
        
        // 클릭 이벤트 위임
        this.elements.list.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.executeCommand(index);
            });
        });
    }

    handleKeyDown(e) {
        if (this.filteredCommands.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
                this.renderList();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
                this.renderList();
                break;
            case 'Enter':
                e.preventDefault();
                this.executeCommand(this.selectedIndex);
                break;
        }
    }

    executeCommand(index) {
        if (this.filteredCommands[index]) {
            this.filteredCommands[index].action();
            this.hide();
        }
    }

    toggle() {
        this.elements.overlay.classList.contains('hidden')? this.show() : this.hide();
    }

    show() {
        this.generateCommands();
        this.elements.overlay.classList.remove('hidden');
        this.elements.input.value = '';
        this.filterAndRender();
        this.elements.input.focus();
    }

    hide() {
        this.elements.overlay.classList.add('hidden');
    }
    
    isHidden() {
        return this.elements.overlay.classList.contains('hidden');
    }
}

export const commandPalette = new CommandPalette();