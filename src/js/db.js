// IndexedDB를 추상화하여 사용하기 쉽게 만드는 데이터베이스 모듈
const DB_NAME = 'PromptVaultDB';
const DB_VERSION = 4; // <<-- [수정] 안정적인 스키마 마이그레이션을 위해 버전 업그레이드
const PROMPTS_STORE = 'prompts';
const CATEGORIES_STORE = 'categories';

let dbInstance = null;

// 데이터베이스 초기화 및 객체 저장소 생성
function init() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject("Database error");
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        // 데이터베이스 버전이 변경되거나 처음 생성될 때 호출
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const transaction = event.target.transaction;

            // [수정] v3 스키마 변경(title, summary 추가)에 따른 마이그레이션 로직
            // 기존 저장소가 있다면 삭제하고 새로 만들어 데이터 구조의 일관성을 보장합니다.
            if (db.objectStoreNames.contains(PROMPTS_STORE)) {
                db.deleteObjectStore(PROMPTS_STORE);
            }
            const promptStore = db.createObjectStore(PROMPTS_STORE, { keyPath: 'id', autoIncrement: true });
            promptStore.createIndex('categoryId', 'categoryId', { unique: false });
            promptStore.createIndex('updatedAt', 'updatedAt', { unique: false });


            // 'categories' 객체 저장소 생성
            if (!db.objectStoreNames.contains(CATEGORIES_STORE)) {
                const categoryStore = db.createObjectStore(CATEGORIES_STORE, { keyPath: 'id', autoIncrement: true });
                categoryStore.createIndex('name', 'name', { unique: true });
                
                // [수정] onupgradeneeded 내에서 트랜잭션을 통해 안전하게 기본 데이터 추가
                transaction.objectStore(CATEGORIES_STORE).add({ name: '기획' });
                transaction.objectStore(CATEGORIES_STORE).add({ name: '마케팅' });
                transaction.objectStore(CATEGORIES_STORE).add({ name: '개발' });
            }
        };
    });
}

// Promise 기반으로 트랜잭션을 처리하는 헬퍼 함수
function performTransaction(storeName, mode, action) {
    return new Promise((resolve, reject) => {
        if (!dbInstance) {
            return reject("Database not initialized");
        }
        try {
            const transaction = dbInstance.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            action(store, resolve, reject);
            transaction.onerror = (event) => reject(event.target.error);
        } catch (error) {
            reject(error);
        }
    });
}

// 데이터베이스 CRUD(Create, Read, Update, Delete) 함수들
export const db = {
    init,
    
    // Prompts
    addPrompt: (prompt) => performTransaction(PROMPTS_STORE, 'readwrite', (store, resolve) => {
        const request = store.add(prompt);
        request.onsuccess = () => resolve(request.result);
    }),
    
    updatePrompt: (prompt) => performTransaction(PROMPTS_STORE, 'readwrite', (store, resolve) => {
        const request = store.put(prompt);
        request.onsuccess = () => resolve(request.result);
    }),
    
    deletePrompt: (id) => performTransaction(PROMPTS_STORE, 'readwrite', (store, resolve) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
    }),
    
    getPrompt: (id) => performTransaction(PROMPTS_STORE, 'readonly', (store, resolve) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
    }),
    
    getAllPrompts: () => performTransaction(PROMPTS_STORE, 'readonly', (store, resolve) => {
        const index = store.index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result.reverse()); // 최신순으로 정렬
    }),

    // Categories
    addCategory: (category) => performTransaction(CATEGORIES_STORE, 'readwrite', (store, resolve) => {
        const request = store.add(category);
        request.onsuccess = () => resolve(request.result);
    }),

    getAllCategories: () => performTransaction(CATEGORIES_STORE, 'readonly', (store, resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    }),
};