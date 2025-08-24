// 일정 검색 기능
let searchTimeout = null;
let allUserPlans = []; // 사용자 일정을 캐시해둘 배열

// 검색 초기화
function initializeSearch() {
    const searchInput = document.getElementById('planSearch');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput) return;
    
    // 검색 입력 이벤트
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        // 기존 타이머 클리어
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        
        // 검색 딜레이 적용 (300ms)
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    // 검색 결과 클릭 이벤트 위임 (한 번만 등록)
    searchResults.addEventListener('click', handleSearchResultClick);
    
    // 검색 결과 숨김 (외부 클릭 시)
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            hideSearchResults();
        }
    });
    
    // ESC 키로 검색 결과 숨김
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideSearchResults();
            searchInput.blur();
        }
    });
    
    // 초기 사용자 일정 로드
    loadUserPlans();
}

// 사용자 일정 로드 및 캐시
async function loadUserPlans() {
    try {
        console.log('Loading user plans for search...');
        
        // 모든 타입의 일정을 로드 (daily, weekly, monthly)
        const promises = [
            API.plans.getAll({ type: 'daily' }),
            API.plans.getAll({ type: 'weekly' }),
            API.plans.getAll({ type: 'monthly' })
        ];
        
        const results = await Promise.all(promises);
        allUserPlans = [];
        
        results.forEach(result => {
            if (result.success && result.plans) {
                allUserPlans.push(...result.plans);
            }
        });
        
        console.log(`Loaded ${allUserPlans.length} plans for search`);
    } catch (error) {
        console.error('Failed to load user plans for search:', error);
    }
}

// 검색 수행
function performSearch(query) {
    console.log(`Searching for: "${query}"`);
    
    if (allUserPlans.length === 0) {
        showSearchResults([]);
        return;
    }
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    allUserPlans.forEach(plan => {
        const score = calculateSearchScore(plan, lowerQuery);
        if (score > 0) {
            results.push({ plan, score });
        }
    });
    
    // 점수순으로 정렬하고 상위 10개만 표시
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, 10).map(result => result.plan);
    
    console.log(`Found ${topResults.length} matching plans`);
    showSearchResults(topResults);
}

// 검색 점수 계산
function calculateSearchScore(plan, query) {
    let score = 0;
    
    // 제목 매치 (높은 점수)
    if (plan.title && plan.title.toLowerCase().includes(query)) {
        score += 100;
        // 정확히 일치하면 보너스
        if (plan.title.toLowerCase() === query) {
            score += 200;
        }
    }
    
    // 설명 매치 (중간 점수)
    if (plan.description && plan.description.toLowerCase().includes(query)) {
        score += 50;
    }
    
    // 날짜 매치 (중간 점수)
    if (plan.plan_date && plan.plan_date.includes(query)) {
        score += 75;
    }
    
    // 상태 매치 (낮은 점수)
    const statusMap = {
        '완료': 'completed',
        '계획': 'planned',
        '계획됨': 'planned', 
        '취소': 'cancelled',
        '취소됨': 'cancelled'
    };
    
    for (const [korean, english] of Object.entries(statusMap)) {
        if (query === korean && plan.status === english) {
            score += 30;
        }
    }
    
    // 위치 매치 (낮은 점수)
    if (plan.location && plan.location.toLowerCase().includes(query)) {
        score += 25;
    }
    
    return score;
}

// 검색 결과 표시
function showSearchResults(plans) {
    const searchResults = document.getElementById('searchResults');
    
    if (plans.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">검색 결과가 없습니다.</div>';
    } else {
        searchResults.innerHTML = plans.map(plan => createSearchResultItem(plan)).join('');
    }
    
    searchResults.classList.remove('d-none');
}

// 검색 결과 아이템 생성
function createSearchResultItem(plan) {
    const statusText = getStatusDisplayText(plan.status);
    const typeText = getTypeDisplayText(plan.type);
    const dateFormatted = formatDateForDisplay(plan.plan_date);
    
    // 설명 미리보기 (최대 100자)
    let descriptionPreview = '';
    if (plan.description) {
        descriptionPreview = plan.description.length > 100 
            ? plan.description.substring(0, 100) + '...'
            : plan.description;
    }
    
    return `
        <div class="search-result-item" data-plan-id="${plan.id}">
            <div class="search-result-title">${plan.title || '제목 없음'}</div>
            <div class="search-result-meta">
                <span class="badge bg-${getStatusBadgeClass(plan.status)}">${statusText}</span>
                <span class="badge bg-secondary ms-1">${typeText}</span>
                <span class="text-muted ms-2">${dateFormatted}</span>
            </div>
            ${descriptionPreview ? `<div class="search-result-description">${descriptionPreview}</div>` : ''}
            <div class="search-result-actions">
                <button type="button" class="btn btn-outline-primary btn-sm me-2" data-action="details" data-plan-id="${plan.id}">
                    상세보기
                </button>
                <button type="button" class="btn btn-outline-success btn-sm" data-action="navigate" data-plan-id="${plan.id}" data-plan-date="${plan.plan_date}">
                    날짜로 이동
                </button>
            </div>
        </div>
    `;
}

// 검색 결과 숨김
function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    searchResults.classList.add('d-none');
}

// 검색 결과 클릭 처리
function handleSearchResultClick(event) {
    const target = event.target;
    
    if (target.tagName !== 'BUTTON') return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const action = target.getAttribute('data-action');
    const planId = target.getAttribute('data-plan-id');
    const planDate = target.getAttribute('data-plan-date');
    
    if (action === 'details' && planId) {
        showPlanDetails(planId);
    } else if (action === 'navigate' && planId && planDate) {
        goToCalendarDate(planDate, planId);
    }
}

// 일정 상세보기
function showPlanDetails(planId) {
    hideSearchResults();
    
    // 현재 페이지에 모달 열기 함수가 있는지 확인
    if (typeof openPlanModal === 'function') {
        openPlanModal(planId);
    } else {
        // 다른 페이지에서는 메인 캘린더 페이지로 이동하면서 모달 열기
        const url = new URL('/', window.location.origin);
        url.searchParams.set('openModal', planId);
        window.location.href = url.toString();
    }
}

// 캘린더 날짜로 이동
function goToCalendarDate(dateStr, planId) {
    hideSearchResults();
    
    // 현재 페이지의 캘린더 확인
    const currentCalendar = (typeof calendar !== 'undefined' ? calendar : null) || 
                          (typeof teamCalendar !== 'undefined' ? teamCalendar : null);
    
    if (currentCalendar) {
        // 현재 페이지에 캘린더가 있으면 해당 날짜로 이동
        currentCalendar.gotoDate(dateStr);
        currentCalendar.changeView('dayGridMonth');
        
        setTimeout(() => {
            highlightPlanOnCalendar(planId);
            
            // 메인 캘린더의 경우 주별/월별 계획 로드
            if (typeof calendar !== 'undefined' && calendar && typeof loadWeeklyMonthlyPlans === 'function') {
                loadWeeklyMonthlyPlans(dateStr);
            }
            // 팀 캘린더의 경우 멤버 계획 로드
            else if (typeof teamCalendar !== 'undefined' && teamCalendar && typeof loadMemberPlansForDate === 'function') {
                loadMemberPlansForDate(dateStr);
            }
        }, 300);
    } else {
        // 캘린더가 없는 페이지에서는 해당 페이지로 이동
        const currentPage = window.location.pathname;
        let targetUrl;
        
        if (currentPage.includes('team-calendar')) {
            // 팀 캘린더 페이지로 이동
            targetUrl = new URL('/team-calendar.html', window.location.origin);
        } else {
            // 메인 캘린더 페이지로 이동
            targetUrl = new URL('/', window.location.origin);
        }
        
        targetUrl.searchParams.set('date', dateStr);
        targetUrl.searchParams.set('highlight', planId);
        window.location.href = targetUrl.toString();
    }
    
    // 검색 입력 초기화
    const searchInput = document.getElementById('planSearch');
    if (searchInput) {
        searchInput.value = '';
    }
}

// 캘린더에서 일정 하이라이트
function highlightPlanOnCalendar(planId) {
    // 해당 일정 요소 찾아서 임시로 하이라이트
    const eventElements = document.querySelectorAll(`.fc-event[data-event-id="${planId}"]`);
    
    eventElements.forEach(element => {
        element.style.outline = '3px solid #007bff';
        element.style.outlineOffset = '2px';
        
        // 3초 후 하이라이트 제거
        setTimeout(() => {
            element.style.outline = '';
            element.style.outlineOffset = '';
        }, 3000);
    });
}

// 헬퍼 함수들
function getStatusDisplayText(status) {
    const statusMap = {
        'completed': '완료',
        'planned': '계획됨',
        'cancelled': '취소됨'
    };
    return statusMap[status] || status;
}

function getTypeDisplayText(type) {
    const typeMap = {
        'daily': '일별',
        'weekly': '주별', 
        'monthly': '월별'
    };
    return typeMap[type] || type;
}

function getStatusBadgeClass(status) {
    const classMap = {
        'completed': 'success',
        'planned': 'primary',
        'cancelled': 'secondary'
    };
    return classMap[status] || 'secondary';
}

function formatDateForDisplay(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
    } catch (error) {
        return dateStr;
    }
}

// 일정이 업데이트될 때 검색 캐시 새로고침
function refreshSearchCache() {
    loadUserPlans();
}

// 전역에서 접근 가능하도록 export
window.refreshSearchCache = refreshSearchCache;