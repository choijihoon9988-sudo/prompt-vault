// 애플리케이션 전반에서 사용되는 유틸리티 함수 모음

/**
 * XSS 공격을 방지하기 위해 HTML 문자열을 이스케이프 처리합니다.
 * @param {string} str - 이스케이프 처리할 문자열
 * @returns {string} 이스케이프 처리된 안전한 문자열
 */
export function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * 주어진 텍스트의 첫 번째 줄을 추출합니다.
 * 제목이 없는 프롬프트의 제목으로 사용됩니다.
 * @param {string} text - 전체 텍스트
 * @returns {string} 첫 번째 줄 (최대 50자)
 */
export function getFirstLine(text) {
    if (!text) return "제목 없음";
    const firstLine = text.split('\n').replace(/^#+\s*/, '').trim();
    return firstLine.length > 50? firstLine.substring(0, 50) + '...' : firstLine |

| "제목 없음";
}