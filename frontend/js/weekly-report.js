// 주간 보고서 JavaScript

let reportData = null;
let showWeekend = true;
let currentWeekDate = null; // 현재 보고 있는 주의 월요일 날짜

// 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // 인증 확인
    try {
        await Auth.loadCurrentUser();
        if (!Auth.isLoggedIn()) {
            window.location.href = '/login.html';
            return;
        }
    } catch (error) {
        console.error('Authentication failed:', error);
        window.location.href = '/login.html';
        return;
    }

    // 주말 표시 토글 이벤트
    document.getElementById('showWeekendToggle').addEventListener('change', function() {
        showWeekend = this.checked;
        if (reportData) {
            renderTables();
        }
    });

    // 초기 데이터 로드 (현재 주)
    currentWeekDate = getCurrentMonday();
    loadReportData();
});

// 현재 주의 월요일 날짜 계산
function getCurrentMonday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(monday.getDate() + mondayOffset);
    
    return monday.toISOString().split('T')[0];
}

// 날짜 포맷팅 (YYYY-MM-DD -> MM/DD (요일))
function formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${month}/${day} (${dayName})`;
}

// 시간 포맷팅 (HH:mm)
function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}

// 상태 한글 변환 (이모지 포함)
function getStatusText(status) {
    const statusMap = {
        'pending': '⏳ 대기',
        'in_progress': '🔄 진행중',
        'completed': '✅ 완료',
        'cancelled': '❌ 취소'
    };
    return statusMap[status] || status;
}

// 상태 텍스트 (인쇄용 - 더 간단한 형태)
function getStatusTextForPrint(status) {
    const statusMap = {
        'pending': '대기',
        'in_progress': '진행중',
        'completed': '완료',
        'cancelled': '취소'
    };
    return statusMap[status] || status;
}

// 계획 타입 한글 변환
function getTypeText(type) {
    const typeMap = {
        'daily': '일별',
        'weekly': '주별',
        'monthly': '월별'
    };
    return typeMap[type] || type;
}

// 마크다운 텍스트를 HTML로 변환
function renderMarkdown(text) {
    if (!text) return '';
    
    // marked.js 라이브러리 설정
    marked.setOptions({
        breaks: true, // 줄바꿈을 <br>로 변환
        gfm: true, // GitHub Flavored Markdown 지원
        sanitize: false, // HTML 태그 허용 (보안상 주의)
        smartLists: true,
        smartypants: false
    });
    
    try {
        return marked.parse(text);
    } catch (error) {
        console.error('Markdown parsing error:', error);
        return text; // 파싱 실패시 원본 텍스트 반환
    }
}

// 보고서 데이터 로드
async function loadReportData() {
    try {
        const monday = currentWeekDate || getCurrentMonday();
        const response = await API.request(`/api/plans/report/weekly?date=${monday}`);
        
        if (response.success) {
            reportData = response.data;
            updateDateRange();
            renderMajorPlans();
            renderTables();
        } else {
            throw new Error(response.error || '데이터 로드 실패');
        }
    } catch (error) {
        console.error('Report data loading error:', error);
        API.showError('보고서 데이터를 불러오는데 실패했습니다.');
    }
}

// 날짜 범위 업데이트
function updateDateRange() {
    if (!reportData || !reportData.dateRange) return;
    
    const startDate = new Date(reportData.dateRange.thisWeekStart);
    const endDate = new Date(reportData.dateRange.thisWeekEnd);
    
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();
    
    const rangeText = `${year}년 ${startMonth}월 ${startDay}일 - ${endMonth}월 ${endDay}일`;
    document.getElementById('reportDateRange').textContent = rangeText;
}

// 주요 계획 렌더링
function renderMajorPlans() {
    if (!reportData) return;
    
    // 월별 주요 계획
    const monthlyContainer = document.getElementById('monthlyMajorPlans');
    if (reportData.monthlyMajor && reportData.monthlyMajor.length > 0) {
        const monthlyHtml = reportData.monthlyMajor.map(plan => `
            <div class="mb-3 plan-item">
                <div class="fw-semibold mb-1">${plan.title}</div>
                ${plan.description ? `<div class="markdown-content">${renderMarkdown(plan.description)}</div>` : ''}
            </div>
        `).join('');
        monthlyContainer.innerHTML = monthlyHtml;
    } else {
        monthlyContainer.innerHTML = '<p class="text-muted">이번 달 주요 계획이 없습니다.</p>';
    }
    
    // 이번 주 주요 계획
    const weeklyContainer = document.getElementById('weeklyMajorPlans');
    if (reportData.weeklyMajor && reportData.weeklyMajor.length > 0) {
        const weeklyHtml = reportData.weeklyMajor.map(plan => `
            <div class="mb-3 plan-item">
                <div class="fw-semibold mb-1">${plan.title}</div>
                ${plan.description ? `<div class="markdown-content">${renderMarkdown(plan.description)}</div>` : ''}
            </div>
        `).join('');
        weeklyContainer.innerHTML = weeklyHtml;
    } else {
        weeklyContainer.innerHTML = '<p class="text-muted">이번 주 주요 계획이 없습니다.</p>';
    }

    // 다음 주 주요 계획
    const nextWeeklyContainer = document.getElementById('nextWeeklyMajorPlans');
    if (reportData.nextWeeklyMajor && reportData.nextWeeklyMajor.length > 0) {
        const nextWeeklyHtml = reportData.nextWeeklyMajor.map(plan => `
            <div class="mb-3 plan-item">
                <div class="fw-semibold mb-1">${plan.title}</div>
                ${plan.description ? `<div class="markdown-content">${renderMarkdown(plan.description)}</div>` : ''}
            </div>
        `).join('');
        nextWeeklyContainer.innerHTML = nextWeeklyHtml;
    } else {
        nextWeeklyContainer.innerHTML = '<p class="text-muted">다음 주 주요 계획이 없습니다.</p>';
    }
}

// 테이블 렌더링
function renderTables() {
    if (!reportData) return;
    
    renderThisWeekTable();
    renderNextWeekTable();
}

// 이번 주 PDCA 테이블 렌더링
function renderThisWeekTable() {
    const tbody = document.querySelector('#thisWeekTable tbody');
    
    if (!reportData.thisWeek || reportData.thisWeek.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">이번 주 계획이 없습니다.</td></tr>';
        return;
    }
    
    // 날짜별로 그룹화하되 daily 타입만 포함
    const plansByDate = {};
    reportData.thisWeek.forEach(plan => {
        // weekly, monthly 타입은 특정 요일에만 표시되어야 하므로 제외하지 않고
        // 모든 계획을 해당 날짜에 표시
        const date = plan.plan_date;
        if (!plansByDate[date]) {
            plansByDate[date] = [];
        }
        plansByDate[date].push(plan);
    });
    
    // 주말 필터링
    const dates = Object.keys(plansByDate).sort();
    const filteredDates = showWeekend ? dates : dates.filter(date => {
        const dayOfWeek = new Date(date).getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6; // 일요일(0), 토요일(6) 제외
    });
    
    if (filteredDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">표시할 계획이 없습니다.</td></tr>';
        return;
    }
    
    let html = '';
    filteredDates.forEach(date => {
        const plans = plansByDate[date];
        plans.forEach((plan, index) => {
            const isFirstPlan = index === 0;
            const rowspan = isFirstPlan ? plans.length : 0;
            
            // Add cancelled-event class for cancelled plans
            const rowClass = plan.status === 'cancelled' ? ' class="cancelled-event"' : '';
            html += `<tr${rowClass}>`;
            
            // 날짜 (첫 번째 계획에만 표시)
            if (isFirstPlan) {
                html += `<td rowspan="${rowspan}" class="fw-semibold align-middle">${formatDateWithDay(date)}</td>`;
            }
            
            // 계획 (Plan) - 시간은 별도 컬럼으로 분리
            const planTitleClass = plan.status === 'cancelled' ? 'fw-semibold' : 'fw-semibold';
            const planDescClass = plan.status === 'cancelled' ? 'text-muted' : 'text-muted';
            const planTitleStyle = plan.status === 'cancelled' ? ' style="color: #6c757d !important; opacity: 0.7 !important; text-decoration: line-through !important; font-weight: normal !important;"' : '';
            const planDescStyle = plan.status === 'cancelled' ? ' style="color: #6c757d !important; opacity: 0.7 !important; text-decoration: line-through !important; font-weight: normal !important;"' : '';
            html += `<td>
                <div class="${planTitleClass}"${planTitleStyle}>${plan.title}</div>
                ${plan.description ? `<div><small class="${planDescClass}"${planDescStyle}>${plan.description}</small></div>` : ''}
            </td>`;
            
            // 계획시간
            const planTime = plan.start_time && plan.end_time ? 
                `${formatTime(plan.start_time)}-${formatTime(plan.end_time)}` : '-';
            const planTimeCompact = plan.start_time && plan.end_time ? 
                `${formatTime(plan.start_time)}-${formatTime(plan.end_time)}` : '-';
            const timeClass = plan.status === 'cancelled' ? 'cell-badge time-cell time-planned cancelled-time' : 'cell-badge time-cell time-planned';
            html += `<td><div class="${timeClass}" data-full-time="${planTime}" data-compact-time="${planTimeCompact}">${planTime}</div></td>`;
            
            // 실제시간
            const actualTime = plan.actual_start_time && plan.actual_end_time ? 
                `${formatTime(plan.actual_start_time)}-${formatTime(plan.actual_end_time)}` : '-';
            const actualTimeCompact = plan.actual_start_time && plan.actual_end_time ? 
                `${formatTime(plan.actual_start_time)}-${formatTime(plan.actual_end_time)}` : '-';
            const actualTimeClass = plan.status === 'cancelled' ? 'cell-badge time-cell time-actual cancelled-time' : 'cell-badge time-cell time-actual';
            html += `<td><div class="${actualTimeClass}" data-full-time="${actualTime}" data-compact-time="${actualTimeCompact}">${actualTime}</div></td>`;
            
            // 실행 (Do)
            let doContent = plan.do_content || '-';
            const contentStyle = plan.status === 'cancelled' ? ' style="color: #6c757d; opacity: 0.7; text-decoration: line-through;"' : '';
            if (plan.location && plan.do_content) {
                doContent = `<div class="content-highlight"${contentStyle}>${plan.do_content}<br><small class="text-muted"><i class="bi bi-geo-alt"></i> ${plan.location}</small></div>`;
            } else if (plan.location && !plan.do_content) {
                doContent = `<div class="cell-badge location-badge"${contentStyle}><i class="bi bi-geo-alt"></i> ${plan.location}</div>`;
            } else if (plan.do_content) {
                doContent = `<div class="content-highlight"${contentStyle}>${plan.do_content}</div>`;
            } else if (plan.status === 'cancelled') {
                doContent = `<span${contentStyle}>-</span>`;
            }
            html += `<td>${doContent}</td>`;
            
            // 점검 (Check)
            const checkContent = plan.check_content || '-';
            html += `<td><span${contentStyle}>${checkContent}</span></td>`;
            
            // 개선 (Action)
            const actionContent = plan.action_content || '-';
            html += `<td><span${contentStyle}>${actionContent}</span></td>`;
            
            // 상태
            const statusText = getStatusText(plan.status);
            const statusBadgeClass = plan.status === 'completed' ? 'cell-badge status-badge completed' : 'cell-badge status-badge';
            html += `<td><div class="${statusBadgeClass}" data-status="${plan.status}" data-print-text="${getStatusTextForPrint(plan.status)}">${statusText}</div></td>`;
            
            html += '</tr>';
        });
    });
    
    tbody.innerHTML = html;
}

// 다음 주 계획 테이블 렌더링
function renderNextWeekTable() {
    const tbody = document.querySelector('#nextWeekTable tbody');
    
    if (!reportData.nextWeek || reportData.nextWeek.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">다음 주 계획이 없습니다.</td></tr>';
        return;
    }
    
    // 주말 필터링
    const filteredPlans = showWeekend ? reportData.nextWeek : reportData.nextWeek.filter(plan => {
        const dayOfWeek = new Date(plan.plan_date).getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6; // 일요일(0), 토요일(6) 제외
    });
    
    if (filteredPlans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">표시할 계획이 없습니다.</td></tr>';
        return;
    }
    
    // 날짜별로 그룹화
    const plansByDate = {};
    filteredPlans.forEach(plan => {
        const date = plan.plan_date;
        if (!plansByDate[date]) {
            plansByDate[date] = [];
        }
        plansByDate[date].push(plan);
    });
    
    const dates = Object.keys(plansByDate).sort();
    let html = '';
    
    dates.forEach(date => {
        const plans = plansByDate[date];
        plans.forEach((plan, index) => {
            const isFirstPlan = index === 0;
            const rowspan = isFirstPlan ? plans.length : 0;
            
            html += '<tr>';
            
            // 날짜 (첫 번째 계획에만 표시)
            if (isFirstPlan) {
                html += `<td rowspan="${rowspan}" class="fw-semibold align-middle">${formatDateWithDay(date)}</td>`;
            }
            
            // 계획 제목
            html += `<td>
                <div class="fw-semibold">${plan.title}</div>
            </td>`;
            
            // 세부 내용
            html += `<td>
                ${plan.description ? `<div class="content-highlight">${plan.description}</div>` : '<span class="text-muted">-</span>'}
            </td>`;
            
            // 시간
            const timeText = plan.start_time && plan.end_time ? 
                `${formatTime(plan.start_time)}-${formatTime(plan.end_time)}` : '-';
            html += `<td><div class="cell-badge time-cell time-planned">${timeText}</div></td>`;
            
            // 작업위치
            const locationText = plan.location ? 
                `<div class="cell-badge location-badge"><i class="bi bi-geo-alt"></i> ${plan.location}</div>` : '-';
            html += `<td>${locationText}</td>`;
            
            html += '</tr>';
        });
    });
    
    tbody.innerHTML = html;
}

// 보고서 새로고침
function refreshReport() {
    loadReportData();
}

// 주간 네비게이션
function navigateWeek(direction) {
    if (!currentWeekDate) {
        currentWeekDate = getCurrentMonday();
    }
    
    // direction: -1 (이전 주), 1 (다음 주)
    const currentDate = new Date(currentWeekDate);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    currentWeekDate = currentDate.toISOString().split('T')[0];
    
    loadReportData();
}

// 현재 주로 이동
function goToCurrentWeek() {
    currentWeekDate = getCurrentMonday();
    loadReportData();
}