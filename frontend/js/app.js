// 메인 애플리케이션 로직
document.addEventListener('DOMContentLoaded', async function() {
    // 인증 확인 후 앱 초기화
    try {
        await Auth.loadCurrentUser();
        if (Auth.isLoggedIn()) {
            console.log('User authenticated, initializing app...');
            await initializeApp();
        } else {
            console.log('User not authenticated');
        }
    } catch (error) {
        console.log('Authentication failed, app not initialized');
    }
});

// 앱 초기화
async function initializeApp() {
    // 캘린더 초기화
    initializeCalendar();
    
    // 검색 기능 초기화
    initializeSearch();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 주별/월별 계획 로드
    await updateWeeklyMonthlyPlans();
    
    // URL 파라미터 처리 (검색에서 넘어온 경우)
    handleUrlParameters();
    
    console.log('ED&C PDCA 앱이 초기화되었습니다.');
}

// URL 파라미터 처리
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 모달 열기 요청
    const openModal = urlParams.get('openModal');
    if (openModal) {
        setTimeout(() => {
            if (typeof openPlanModal === 'function') {
                openPlanModal(openModal);
            }
        }, 500);
        
        // URL에서 파라미터 제거
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('openModal');
        window.history.replaceState({}, '', newUrl);
    }
    
    // 날짜 이동 및 하이라이트 요청
    const targetDate = urlParams.get('date');
    const highlightPlan = urlParams.get('highlight');
    if (targetDate && calendar) {
        calendar.gotoDate(targetDate);
        calendar.changeView('dayGridMonth');
        
        if (highlightPlan) {
            setTimeout(() => {
                highlightPlanOnCalendar(highlightPlan);
                loadWeeklyMonthlyPlans(targetDate);
            }, 800);
        }
        
        // URL에서 파라미터 제거
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('date');
        newUrl.searchParams.delete('highlight');
        window.history.replaceState({}, '', newUrl);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 네비게이션 메뉴
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const view = this.getAttribute('data-view');
            changeView(view);
        });
    });
    
    // 빈 주말 자동 숨김 체크박스
    const hideWeekendsCheckbox = document.getElementById('hideEmptyWeekends');
    if (hideWeekendsCheckbox) {
        hideWeekendsCheckbox.addEventListener('change', function() {
            hideEmptyWeekends = this.checked;
            console.log(`Weekend hiding setting changed: ${hideEmptyWeekends}`);
            // 캘린더 새로고침하여 설정 적용
            if (calendar) {
                calendar.refetchEvents();
            }
        });
    }
    
    // 계획 저장 버튼
    const savePlanBtn = document.getElementById('savePlanBtn');
    if (savePlanBtn) {
        savePlanBtn.addEventListener('click', savePlan);
    }
    
    // 계획 삭제 버튼
    const deletePlanBtn = document.getElementById('deletePlanBtn');
    if (deletePlanBtn) {
        deletePlanBtn.addEventListener('click', () => deletePlan(currentPlanId));
    }
    
    // 복사 확인 버튼
    const confirmCopyBtn = document.getElementById('confirmCopyBtn');
    if (confirmCopyBtn) {
        confirmCopyBtn.addEventListener('click', confirmCopy);
    }

    // 주별 계획 편집 버튼
    const editWeeklyPlanBtn = document.getElementById('editWeeklyPlanBtn');
    if (editWeeklyPlanBtn) {
        editWeeklyPlanBtn.addEventListener('click', () => {
            console.log('주별 계획 편집 버튼 클릭됨');
            const planId = editWeeklyPlanBtn.getAttribute('data-plan-id');
            const weekStart = editWeeklyPlanBtn.getAttribute('data-week-start');
            console.log('주별 계획 ID:', planId, '주 시작일:', weekStart);
            openWeeklyMonthlyPlanModal('weekly', planId, weekStart);
        });
    } else {
        console.error('editWeeklyPlanBtn 요소를 찾을 수 없습니다');
    }

    // 월별 계획 편집 버튼  
    const editMonthlyPlanBtn = document.getElementById('editMonthlyPlanBtn');
    if (editMonthlyPlanBtn) {
        editMonthlyPlanBtn.addEventListener('click', () => {
            console.log('월별 계획 편집 버튼 클릭됨');
            const planId = editMonthlyPlanBtn.getAttribute('data-plan-id');
            const monthStart = editMonthlyPlanBtn.getAttribute('data-month-start');
            console.log('월별 계획 ID:', planId, '월 시작일:', monthStart);
            openWeeklyMonthlyPlanModal('monthly', planId, monthStart);
        });
    } else {
        console.error('editMonthlyPlanBtn 요소를 찾을 수 없습니다');
    }
    
    // 외근 체크박스 변경시 위치 필드 활성화/비활성화
    const isFieldWork = document.getElementById('isFieldWork');
    if (isFieldWork) {
        isFieldWork.addEventListener('change', toggleLocationField);
    }
    
    // 상태 변경시 실제 시간 섹션 표시/숨김
    const planStatus = document.getElementById('planStatus');
    if (planStatus) {
        planStatus.addEventListener('change', toggleActualTimeSection);
    }
    
    // 모달 닫힐 때 시간 섹션 복원
    const planModal = document.getElementById('planModal');
    if (planModal) {
        planModal.addEventListener('hidden.bs.modal', function() {
            // 시간 섹션 다시 표시 (일별 계획을 위해)
            document.getElementById('timeSection').style.display = 'block';
        });
    }
    
    // 주별/월별 계획 저장 버튼
    const saveWeeklyMonthlyPlanBtn = document.getElementById('saveWeeklyMonthlyPlanBtn');
    if (saveWeeklyMonthlyPlanBtn) {
        saveWeeklyMonthlyPlanBtn.addEventListener('click', saveWeeklyMonthlyPlan);
    }
    
    // 주별/월별 계획 삭제 버튼
    const deleteWeeklyMonthlyPlanBtn = document.getElementById('deleteWeeklyMonthlyPlanBtn');
    if (deleteWeeklyMonthlyPlanBtn) {
        deleteWeeklyMonthlyPlanBtn.addEventListener('click', deleteWeeklyMonthlyPlan);
    }
    
}

// 계획 모달 열기
async function openPlanModal(planId = null, selectedDate = null) {
    currentPlanId = planId;
    const modal = new bootstrap.Modal(document.getElementById('planModal'));
    const modalTitle = document.getElementById('planModalTitle');
    const deletePlanBtn = document.getElementById('deletePlanBtn');
    
    // 폼 초기화
    resetPlanForm();
    
    // 시간 섹션 표시 (일별 계획)
    document.getElementById('timeSection').style.display = 'block';
    
    if (planId) {
        // 기존 계획 수정
        modalTitle.textContent = '계획 수정';
        deletePlanBtn.classList.remove('d-none');
        
        try {
            const result = await API.plans.getById(planId);
            if (result.success) {
                fillPlanForm(result.plan);
            }
        } catch (error) {
            Utils.showError('계획 정보를 불러오는데 실패했습니다.');
            return;
        }
    } else {
        // 새 계획 생성
        modalTitle.textContent = '새 계획 추가';
        deletePlanBtn.classList.add('d-none');
        
        if (selectedDate) {
            document.getElementById('planDate').value = selectedDate;
            // 날짜가 선택된 경우 일별 계획으로 설정
            document.getElementById('planType').value = 'daily';
        }
    }
    
    modal.show();
}

// 계획 폼 초기화
function resetPlanForm() {
    document.getElementById('planForm').reset();
    document.getElementById('planId').value = '';
    
    // 기본값 설정
    document.getElementById('planType').value = 'daily';
    document.getElementById('startTime').value = '09:00';
    document.getElementById('endTime').value = '17:00';
    document.getElementById('isFieldWork').checked = false;
    document.getElementById('location').value = '';
    toggleLocationField();
    
    // 오늘 날짜 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('planDate').value = today;
}

// 계획 폼 채우기
function fillPlanForm(plan) {
    document.getElementById('planId').value = plan.id;
    document.getElementById('planType').value = plan.type;
    document.getElementById('planDate').value = plan.plan_date;
    document.getElementById('planTitle').value = plan.title;
    document.getElementById('planDescription').value = plan.description || '';
    document.getElementById('startTime').value = plan.start_time || '09:00';
    document.getElementById('endTime').value = plan.end_time || '17:00';
    
    // 외근 체크박스 설정
    const isFieldWork = plan.work_type === 'field';
    document.getElementById('isFieldWork').checked = isFieldWork;
    document.getElementById('location').value = plan.location || '';
    toggleLocationField();
    
    // 상태 설정
    document.getElementById('planStatus').value = plan.status || 'planned';
    toggleActualTimeSection();
    
    // 실제 시간 설정
    document.getElementById('actualStartTime').value = plan.actual_start_time || '';
    document.getElementById('actualEndTime').value = plan.actual_end_time || '';
    
    // PDCA 내용
    document.getElementById('doContent').value = plan.do_content || '';
    document.getElementById('checkContent').value = plan.check_content || '';
    document.getElementById('actionContent').value = plan.action_content || '';
}

// 외근 체크박스에 따른 위치 필드 활성화/비활성화
function toggleLocationField() {
    const isFieldWork = document.getElementById('isFieldWork');
    const locationField = document.getElementById('location');
    
    if (isFieldWork.checked) {
        locationField.disabled = false;
        locationField.placeholder = '외근 위치를 입력하세요';
        locationField.focus();
    } else {
        locationField.disabled = true;
        locationField.value = '';
        locationField.placeholder = '외근 시 위치를 입력하세요';
    }
}

// 상태에 따른 실제 시간 섹션 표시/숨김
function toggleActualTimeSection() {
    const planStatus = document.getElementById('planStatus');
    const actualTimeSection = document.getElementById('actualTimeSection');
    
    if (planStatus.value === 'completed') {
        actualTimeSection.classList.remove('d-none');
        
        // 실제 시간이 비어있으면 계획 시간으로 초기화
        const actualStartTime = document.getElementById('actualStartTime');
        const actualEndTime = document.getElementById('actualEndTime');
        const plannedStartTime = document.getElementById('startTime');
        const plannedEndTime = document.getElementById('endTime');
        
        if (!actualStartTime.value && plannedStartTime.value) {
            actualStartTime.value = plannedStartTime.value;
        }
        if (!actualEndTime.value && plannedEndTime.value) {
            actualEndTime.value = plannedEndTime.value;
        }
    } else {
        actualTimeSection.classList.add('d-none');
        // 숨길 때 값도 초기화
        document.getElementById('actualStartTime').value = '';
        document.getElementById('actualEndTime').value = '';
    }
}

// 계획 저장
async function savePlan() {
    const form = document.getElementById('planForm');
    const formData = new FormData(form);
    
    const planType = formData.get('planType') || document.getElementById('planType').value;
    const planTitle = document.getElementById('planTitle').value;
    const planDescription = document.getElementById('planDescription').value;
    
    // 유효성 검사
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // 추가 유효성 검사: 일별 계획은 제목 필수, 주별/월별은 내용 필수
    if (planType === 'daily' && !planTitle.trim()) {
        Utils.showError('일별 계획은 제목을 입력해주세요.');
        document.getElementById('planTitle').focus();
        return;
    }
    
    if ((planType === 'weekly' || planType === 'monthly') && !planDescription.trim()) {
        Utils.showError('주별/월별 계획은 계획 내용을 입력해주세요.');
        document.getElementById('planDescription').focus();
        return;
    }
    
    // 주별/월별 계획의 경우 기본 제목 생성
    let title = planTitle;
    if ((planType === 'weekly' || planType === 'monthly') && !planTitle) {
        const planDate = document.getElementById('planDate').value;
        const date = new Date(planDate);
        
        if (planType === 'weekly') {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            title = `${year}년 ${month}월 ${day}일 주간 계획`;
        } else {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            title = `${year}년 ${month}월 계획`;
        }
    }
    
    // 외근 체크박스에 따른 work_type 설정
    const isFieldWork = document.getElementById('isFieldWork').checked;
    const workType = isFieldWork ? 'field' : 'office';
    const location = isFieldWork ? document.getElementById('location').value : '';
    
    const planData = {
        type: planType,
        title: title,
        description: document.getElementById('planDescription').value,
        plan_date: document.getElementById('planDate').value,
        start_time: document.getElementById('startTime').value,
        end_time: document.getElementById('endTime').value,
        actual_start_time: document.getElementById('actualStartTime').value || null,
        actual_end_time: document.getElementById('actualEndTime').value || null,
        status: document.getElementById('planStatus').value,
        work_type: workType,
        location: location
    };
    
    // PDCA 데이터
    const pdcaData = {
        do_content: document.getElementById('doContent').value,
        check_content: document.getElementById('checkContent').value,
        action_content: document.getElementById('actionContent').value
    };
    
    const savePlanBtn = document.getElementById('savePlanBtn');
    const loading = Utils.showLoading(savePlanBtn, '저장 중...');
    
    try {
        let result;
        
        if (currentPlanId) {
            // 계획 수정
            result = await API.plans.update(currentPlanId, planData);
        } else {
            // 계획 생성
            result = await API.plans.create(planData);
            currentPlanId = result.planId;
        }
        
        // PDCA 저장 (내용이 있는 경우만)
        if (pdcaData.do_content || pdcaData.check_content || pdcaData.action_content) {
            await API.plans.savePdca(currentPlanId, pdcaData);
        }
        
        Utils.showSuccess(currentPlanId ? '계획이 수정되었습니다.' : '계획이 생성되었습니다.');
        
        // 모달 닫기 및 캘린더 새로고침
        bootstrap.Modal.getInstance(document.getElementById('planModal')).hide();
        refreshCalendar();
        
        // 검색 캐시 새로고침
        if (typeof refreshSearchCache === 'function') {
            refreshSearchCache();
        }
        
        // 주별/월별 계획인 경우 카드도 새로고침
        if (planData.type === 'weekly' || planData.type === 'monthly') {
            // 현재 보고 있는 날짜의 주별/월별 계획 다시 로드
            const currentDate = document.getElementById('planDate').value;
            if (currentDate) {
                loadWeeklyMonthlyPlans(currentDate);
            }
        }
        
    } catch (error) {
        console.error('계획 저장 실패:', error);
        Utils.showError('계획 저장에 실패했습니다.');
    } finally {
        loading.hide();
    }
}

// 계획 삭제
async function deletePlan(planId) {
    if (!planId) return;
    
    const confirmed = await Utils.confirm('정말로 이 계획을 삭제하시겠습니까?', '계획 삭제');
    if (!confirmed) return;
    
    try {
        await API.plans.delete(planId);
        Utils.showSuccess('계획이 삭제되었습니다.');
        
        // 모달이 열려있으면 닫기
        const modal = bootstrap.Modal.getInstance(document.getElementById('planModal'));
        if (modal) {
            modal.hide();
        }
        
        refreshCalendar();
        
        // 검색 캐시 새로고침
        if (typeof refreshSearchCache === 'function') {
            refreshSearchCache();
        }
    } catch (error) {
        console.error('계획 삭제 실패:', error);
        Utils.showError('계획 삭제에 실패했습니다.');
    }
}

// 다중 복사 모달 열기
function openMultiCopyModal(planId) {
    currentPlanId = planId;
    const modal = new bootstrap.Modal(document.getElementById('multiCopyModal'));
    modal.show();
}

// 복사 확인
async function confirmCopy() {
    const startDate = document.getElementById('copyStartDate').value;
    const endDate = document.getElementById('copyEndDate').value;
    const copyPdca = document.getElementById('copyPdca').checked;
    
    if (!startDate || !endDate) {
        Utils.showError('시작 날짜와 종료 날짜를 모두 입력해주세요.');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        Utils.showError('종료 날짜는 시작 날짜보다 늦어야 합니다.');
        return;
    }
    
    const targetDates = Utils.generateDateRange(startDate, endDate);
    const copyData = {
        target_dates: targetDates,
        copy_pdca: copyPdca
    };
    
    const confirmCopyBtn = document.getElementById('confirmCopyBtn');
    const loading = Utils.showLoading(confirmCopyBtn, '복사 중...');
    
    try {
        await API.plans.copy(currentPlanId, copyData);
        Utils.showSuccess(`${targetDates.length}개 날짜로 계획이 복사되었습니다.`);
        
        // 모달 닫기 및 캘린더 새로고침
        bootstrap.Modal.getInstance(document.getElementById('multiCopyModal')).hide();
        refreshCalendar();
        
    } catch (error) {
        console.error('계획 복사 실패:', error);
        Utils.showError('계획 복사에 실패했습니다.');
    } finally {
        loading.hide();
    }
}

// 주별/월별 계획 모달 열기 (별도 모달 사용)
async function openWeeklyMonthlyPlanModal(type, planId = null, selectedDate = null) {
    try {
        const modal = new bootstrap.Modal(document.getElementById('weeklyMonthlyPlanModal'));
        const form = document.getElementById('weeklyMonthlyPlanForm');
        const titleElement = document.getElementById('weeklyMonthlyPlanModalTitle');
        const deleteBtn = document.getElementById('deleteWeeklyMonthlyPlanBtn');
        
        // 폼 초기화
        form.reset();
        document.getElementById('weeklyMonthlyPlanId').value = planId || '';
        document.getElementById('weeklyMonthlyPlanType').value = type;
        
        // 날짜 설정
        let planDate;
        
        if (selectedDate) {
            // 선택된 날짜가 있으면 해당 날짜 사용
            planDate = selectedDate;
        } else {
            // 선택된 날짜가 없으면 현재 날짜 기준으로 계산
            const today = new Date();
            
            if (type === 'weekly') {
                // 주별 계획: 현재 주의 월요일
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const monday = new Date(today);
                monday.setDate(today.getDate() + mondayOffset);
                planDate = monday.toISOString().split('T')[0];
            } else if (type === 'monthly') {
                // 월별 계획: 현재 월의 1일
                planDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            }
        }
        
        document.getElementById('weeklyMonthlyPlanDate').value = planDate;
        
        if (planId) {
            // 기존 계획 편집
            titleElement.textContent = type === 'weekly' ? '주별 계획 편집' : '월별 계획 편집';
            deleteBtn.classList.remove('d-none');
            
            // 계획 데이터 로드
            const result = await API.plans.getById(planId);
            if (result.success) {
                const plan = result.plan;
                document.getElementById('weeklyMonthlyPlanTitle').value = plan.title || '';
                document.getElementById('weeklyMonthlyPlanDescription').value = plan.description || '';
                document.getElementById('weeklyMonthlyPlanDate').value = plan.plan_date;
                document.getElementById('weeklyMonthlyPlanStatus').value = plan.status || 'planned';
            }
        } else {
            // 새 계획 작성
            titleElement.textContent = type === 'weekly' ? '새 주별 계획' : '새 월별 계획';
            deleteBtn.classList.add('d-none');
            document.getElementById('weeklyMonthlyPlanTitle').value = type === 'weekly' ? '주간 목표' : '월별 목표';
            document.getElementById('weeklyMonthlyPlanStatus').value = 'planned';
        }
        
        modal.show();
        
    } catch (error) {
        console.error('주별/월별 계획 모달 열기 실패:', error);
        alert('계획 편집 화면을 열 수 없습니다.');
    }
}

// 주별/월별 계획 저장
async function saveWeeklyMonthlyPlan() {
    const saveBtn = document.getElementById('saveWeeklyMonthlyPlanBtn');
    const loading = Utils.showLoading(saveBtn, '저장 중...');
    
    try {
        const form = document.getElementById('weeklyMonthlyPlanForm');
        const formData = new FormData(form);
        
        const planData = {
            id: document.getElementById('weeklyMonthlyPlanId').value || undefined,
            title: formData.get('weeklyMonthlyPlanTitle') || document.getElementById('weeklyMonthlyPlanTitle').value,
            description: formData.get('weeklyMonthlyPlanDescription') || document.getElementById('weeklyMonthlyPlanDescription').value,
            plan_date: formData.get('weeklyMonthlyPlanDate') || document.getElementById('weeklyMonthlyPlanDate').value,
            status: formData.get('weeklyMonthlyPlanStatus') || document.getElementById('weeklyMonthlyPlanStatus').value,
            type: document.getElementById('weeklyMonthlyPlanType').value,
            start_time: '09:00',
            end_time: '17:00'
        };
        
        let result;
        if (planData.id) {
            // 기존 계획 수정
            result = await API.plans.update(planData.id, planData);
        } else {
            // 새 계획 생성
            result = await API.plans.create(planData);
        }
        
        if (result.success) {
            Utils.showSuccess('계획이 저장되었습니다.');
            
            // 모달 닫기
            const modal = bootstrap.Modal.getInstance(document.getElementById('weeklyMonthlyPlanModal'));
            modal.hide();
            
            // 캘린더 새로고침
            refreshCalendar();
            
            // 검색 캐시 새로고침
            if (typeof refreshSearchCache === 'function') {
                refreshSearchCache();
            }
            
            // 주별/월별 계획 카드 새로고침
            await updateWeeklyMonthlyPlans();
        } else {
            throw new Error(result.error || '계획 저장에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('주별/월별 계획 저장 실패:', error);
        Utils.showError(error.message || '계획 저장에 실패했습니다.');
    } finally {
        // 항상 로딩 상태 해제
        loading.hide();
    }
}

// 주별/월별 계획 삭제
async function deleteWeeklyMonthlyPlan() {
    const planId = document.getElementById('weeklyMonthlyPlanId').value;
    
    if (!planId) {
        alert('삭제할 계획이 없습니다.');
        return;
    }
    
    if (!confirm('정말로 이 계획을 삭제하시겠습니까?')) {
        return;
    }
    
    const deleteBtn = document.getElementById('deleteWeeklyMonthlyPlanBtn');
    const loading = Utils.showLoading(deleteBtn, '삭제 중...');
    
    try {
        const result = await API.plans.delete(planId);
        
        if (result.success) {
            Utils.showSuccess('계획이 삭제되었습니다.');
            
            // 모달 닫기
            const modal = bootstrap.Modal.getInstance(document.getElementById('weeklyMonthlyPlanModal'));
            modal.hide();
            
            // 캘린더 새로고침
            refreshCalendar();
            
            // 검색 캐시 새로고침
            if (typeof refreshSearchCache === 'function') {
                refreshSearchCache();
            }
            
            // 주별/월별 계획 카드 새로고침
            await updateWeeklyMonthlyPlans();
        } else {
            throw new Error(result.error || '계획 삭제에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('주별/월별 계획 삭제 실패:', error);
        Utils.showError(error.message || '계획 삭제에 실패했습니다.');
    } finally {
        // 항상 로딩 상태 해제
        loading.hide();
    }
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + N: 새 계획
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openPlanModal();
    }
    
    // F5: 새로고침
    if (e.key === 'F5') {
        e.preventDefault();
        refreshCalendar();
    }
    
    // ESC: 모달 닫기
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            bootstrap.Modal.getInstance(modal)?.hide();
        });
    }
});

// 주별/월별 계획 카드 업데이트
async function updateWeeklyMonthlyPlans() {
    try {
        const today = new Date();
        
        // 이번 주 월요일 계산
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        const weekStart = monday.toISOString().split('T')[0];
        
        // 이번 달 1일 계산
        const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        
        // 주별 계획 조회
        const weeklyResult = await API.get('/api/plans', {
            date: weekStart,
            type: 'weekly'
        });
        
        // 월별 계획 조회
        const monthlyResult = await API.get('/api/plans', {
            date: monthStart,
            type: 'monthly'
        });
        
        // 주별 계획 업데이트
        const weeklyPlanContent = document.getElementById('weeklyPlanContent');
        const weeklyPlanTitle = document.getElementById('weeklyPlanTitle');
        
        if (weeklyResult.success && weeklyResult.plans && weeklyResult.plans.length > 0) {
            const weeklyPlan = weeklyResult.plans[0];
            weeklyPlanTitle.textContent = `주별 계획 - ${weeklyPlan.title}`;
            weeklyPlanContent.innerHTML = `<div class="plan-items">${formatPlanItems(weeklyPlan.description)}</div>`;
        } else {
            weeklyPlanTitle.textContent = '주별 계획';
            weeklyPlanContent.innerHTML = '<p class="text-muted">선택한 주의 계획이 없습니다.</p>';
        }
        
        // 월별 계획 업데이트
        const monthlyPlanContent = document.getElementById('monthlyPlanContent');
        const monthlyPlanTitle = document.getElementById('monthlyPlanTitle');
        
        if (monthlyResult.success && monthlyResult.plans && monthlyResult.plans.length > 0) {
            const monthlyPlan = monthlyResult.plans[0];
            monthlyPlanTitle.textContent = `월별 계획 - ${monthlyPlan.title}`;
            monthlyPlanContent.innerHTML = `<div class="plan-items">${formatPlanItems(monthlyPlan.description)}</div>`;
        } else {
            monthlyPlanTitle.textContent = '월별 계획';
            monthlyPlanContent.innerHTML = '<p class="text-muted">선택한 월의 계획이 없습니다.</p>';
        }
        
    } catch (error) {
        console.error('주별/월별 계획 업데이트 실패:', error);
    }
}

// 상태 텍스트 변환
function getStatusText(status) {
    const statusMap = {
        'planned': '계획됨',
        'in_progress': '진행중',
        'completed': '완료',
        'cancelled': '취소됨'
    };
    return statusMap[status] || status;
}

// 계획 내용을 목록 형태로 포맷팅 (다중 제목 지원)
function formatPlanItems(description) {
    if (!description) return '<p class="text-muted">계획 내용이 없습니다.</p>';
    
    const lines = description.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '<p class="text-muted">계획 내용이 없습니다.</p>';
    
    let result = '';
    let currentSection = [];
    let currentTitle = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // 제목 패턴 감지: "제목:" 또는 "## 제목" 형태
        if (trimmed.endsWith(':') || trimmed.startsWith('##')) {
            // 이전 섹션 처리
            if (currentTitle || currentSection.length > 0) {
                result += formatSection(currentTitle, currentSection);
            }
            
            // 새 섹션 시작
            currentTitle = trimmed.endsWith(':') ? 
                trimmed.slice(0, -1).trim() : 
                trimmed.replace(/^##\s*/, '').trim();
            currentSection = [];
        }
        // 빈 줄은 무시
        else if (trimmed === '') {
            continue;
        }
        // 리스트 아이템 또는 일반 텍스트
        else {
            currentSection.push(trimmed);
        }
    }
    
    // 마지막 섹션 처리
    if (currentTitle || currentSection.length > 0) {
        result += formatSection(currentTitle, currentSection);
    }
    
    return result || '<p class="text-muted">계획 내용이 없습니다.</p>';
}

// 섹션 포맷팅 헬퍼 함수
function formatSection(title, items) {
    let html = '';
    
    if (title) {
        html += `<h6 class="fw-semibold text-dark mb-1 mt-2">${title}</h6>`;
    }
    
    if (items.length > 0) {
        const listItems = items.map(item => {
            const trimmed = item.trim();
            // 이미 - 또는 • 로 시작하는 경우 그대로 사용
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                return `<li>${trimmed.substring(1).trim()}</li>`;
            }
            // 그렇지 않으면 - 추가
            return `<li>${trimmed}</li>`;
        }).join('');
        
        html += `<ul class="mb-0 ps-3">${listItems}</ul>`;
    }
    
    return html;
}