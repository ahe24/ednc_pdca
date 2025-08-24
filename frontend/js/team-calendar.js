// 팀 캘린더 관리
let teamCalendar;
let selectedMemberId = null;
let selectedMemberName = '';
let hideEmptyWeekends = true; // 빈 주말 자동 숨김 설정

// 페이지 로드시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // 현재 경로 확인
    const currentPath = window.location.pathname;
    
    // 로그인 페이지나 회원가입 페이지인 경우 인증 체크 건너뛰기
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
        return;
    }

    let user;
    try {
        // 사용자 인증 정보 로드 대기
        await Auth.loadCurrentUser();
        
        // 인증 확인
        if (!Auth.isLoggedIn()) {
            console.log('Not logged in, redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        user = Auth.getCurrentUser();
        if (!user || !user.team_id) {
            Utils.showError('팀에 소속되어 있지 않습니다.');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = '/login.html';
        return;
    }

    // 사용자 정보 표시
    const teamName = user.team_name ? `(${user.team_name})` : '';
    document.getElementById('userNameDisplay').textContent = `${user.name}${teamName}`;

    // 이벤트 리스너 설정
    setupEventListeners();

    // 팀 멤버 목록 로드
    await loadTeamMembers();

    // 기본적으로 본인 계정 선택 (캘린더 초기화 전에)
    const memberSelect = document.getElementById('teamMemberSelect');
    memberSelect.value = user.id;
    selectedMemberId = user.id;
    
    // 선택된 멤버 이름 설정
    const selectedOption = memberSelect.options[memberSelect.selectedIndex];
    if (selectedOption) {
        selectedMemberName = selectedOption.textContent;
    }

    // 캘린더 초기화 (멤버 선택 후)
    initializeTeamCalendar();
    
    // 검색 기능 초기화
    initializeSearch();

    // 팀원 선택 처리 및 표시 업데이트 (현재 날짜 계획도 자동 로드됨)
    await handleMemberSelection();
    
    // URL 파라미터 처리 (검색에서 넘어온 경우)
    handleUrlParameters();
});

// URL 파라미터 처리
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 모달 열기 요청 (팀 캘린더에서는 메인 캘린더로 리다이렉트)
    const openModal = urlParams.get('openModal');
    if (openModal) {
        const url = new URL('/', window.location.origin);
        url.searchParams.set('openModal', openModal);
        window.location.href = url.toString();
        return;
    }
    
    // 날짜 이동 및 하이라이트 요청
    const targetDate = urlParams.get('date');
    const highlightPlan = urlParams.get('highlight');
    if (targetDate && teamCalendar) {
        teamCalendar.gotoDate(targetDate);
        teamCalendar.changeView('dayGridMonth');
        
        if (highlightPlan) {
            setTimeout(() => {
                highlightPlanOnCalendar(highlightPlan);
                loadMemberPlansForDate(targetDate);
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
    // 팀 멤버 선택 변경
    document.getElementById('teamMemberSelect').addEventListener('change', handleMemberSelection);
    
    // 빈 주말 자동 숨김 체크박스
    const hideWeekendsCheckbox = document.getElementById('hideEmptyWeekends');
    if (hideWeekendsCheckbox) {
        hideWeekendsCheckbox.addEventListener('change', function() {
            hideEmptyWeekends = this.checked;
            console.log(`Team calendar weekend hiding setting changed: ${hideEmptyWeekends}`);
            // 캘린더 새로고침하여 설정 적용
            if (teamCalendar) {
                teamCalendar.refetchEvents();
            }
        });
    }

    // 로그아웃 버튼
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        Auth.logout();
    });

    // 프로필 버튼
    document.getElementById('profileBtn').addEventListener('click', function(e) {
        e.preventDefault();
        Auth.showProfile();
    });

    // 프로필 저장 버튼
    document.getElementById('saveProfileBtn').addEventListener('click', function(e) {
        e.preventDefault();
        Auth.saveProfile();
    });

    // 관리자 메뉴 표시
    if (Auth.isAdmin()) {
        document.getElementById('adminMenuItem').classList.remove('d-none');
    }
}

// 팀 멤버 목록 로드
async function loadTeamMembers() {
    const user = Auth.getCurrentUser();
    
    try {
        const result = await API.teams.getMembers(user.team_id);
        const memberSelect = document.getElementById('teamMemberSelect');
        
        if (result.success && result.members.length > 0) {
            memberSelect.innerHTML = '<option value="">팀원을 선택하세요</option>';
            
            result.members.forEach(member => {
                const roleText = Utils.getStatusText(member.role);
                const teamText = user.team_name || '팀';
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.name} (${teamText} • ${roleText})`;
                // Store member data for selected display
                option.dataset.teamName = teamText;
                option.dataset.roleName = roleText;
                memberSelect.appendChild(option);
            });
        } else {
            memberSelect.innerHTML = '<option value="">팀원이 없습니다</option>';
        }
    } catch (error) {
        console.error('팀 멤버 로드 실패:', error);
        Utils.showError('팀원 목록을 불러오는데 실패했습니다.');
    }
}

// 멤버 선택 처리
async function handleMemberSelection() {
    const memberSelect = document.getElementById('teamMemberSelect');
    selectedMemberId = memberSelect.value;
    
    console.log('Member selection changed to:', selectedMemberId);
    
    if (!selectedMemberId) {
        selectedMemberName = '';
        updateSelectedMemberDisplay();
        clearCalendarAndSidebar();
        return;
    }

    // 선택된 멤버 이름 저장
    const selectedOption = memberSelect.options[memberSelect.selectedIndex];
    selectedMemberName = selectedOption.textContent;
    
    console.log('Selected member name:', selectedMemberName);
    
    // 선택된 멤버 정보 표시
    updateSelectedMemberDisplay();
    
    // 편집 권한 업데이트 (본인 선택시에만 편집 가능)
    const isOwnAccount = selectedMemberId === Auth.getCurrentUser().id;
    teamCalendar.setOption('editable', isOwnAccount);
    
    console.log('Member selection - editable set to:', isOwnAccount);
    
    // 현재 날짜의 주별/월별 계획 로드
    const today = new Date().toISOString().split('T')[0];
    await loadMemberPlansForDate(today);
    
    // 캘린더 새로고침
    if (teamCalendar) {
        teamCalendar.refetchEvents();
    }
}

// 선택된 멤버 표시 업데이트
function updateSelectedMemberDisplay() {
    const displayElement = document.getElementById('selectedMemberName');
    if (selectedMemberName) {
        // Extract clean name from the full format "name (team • role)"
        const cleanName = selectedMemberName.split(' (')[0];
        displayElement.innerHTML = `
            <span class="text-muted">보는 중:</span> 
            <span class="fw-semibold text-primary">${cleanName}</span>
            <span class="text-muted small ms-1">${selectedMemberName.includes('(') ? selectedMemberName.substring(selectedMemberName.indexOf('(')) : ''}</span>
        `;
        displayElement.className = 'me-3';
    } else {
        displayElement.textContent = '선택된 팀원: 없음';
        displayElement.className = 'text-muted me-3';
    }
}

// 멤버 정보 로드
async function loadMemberInfo() {
    if (!selectedMemberId) return;

    try {
        const result = await API.get(`/api/users/${selectedMemberId}`);
        
        if (result.success && result.user) {
            const user = result.user;
            const roleText = Utils.getStatusText(user.role);
            const teamName = user.team_name || '소속 팀 없음';
            
            document.getElementById('memberInfo').innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <strong class="me-2">${user.name}</strong>
                    <span class="badge bg-primary">${roleText}</span>
                </div>
                <div class="text-muted small mb-1">
                    <i class="bi bi-person-badge"></i> ${user.username}
                </div>
                <div class="text-muted small mb-1">
                    <i class="bi bi-building"></i> ${teamName}
                </div>
                ${user.email ? `<div class="text-muted small">
                    <i class="bi bi-envelope"></i> ${user.email}
                </div>` : ''}
            `;
        }
    } catch (error) {
        console.error('멤버 정보 로드 실패:', error);
        document.getElementById('memberInfo').innerHTML = 
            '<p class="text-danger">멤버 정보를 불러오는데 실패했습니다.</p>';
    }
}

// 캘린더와 사이드바 초기화
function clearCalendarAndSidebar() {
    // 멤버 정보 초기화
    document.getElementById('memberInfo').innerHTML = 
        '<p class="text-muted">멤버를 선택해주세요.</p>';
    
    // 계획 카드 초기화 - 현재 주/월로 제목 설정
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    // 주차 계산
    const dayOfWeek = today.getDay();
    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStart = mondayDate.toISOString().split('T')[0];
    const weekEnd = new Date(mondayDate);
    weekEnd.setDate(mondayDate.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    document.getElementById('weeklyPlanTitle').textContent = `주별 계획 (${weekStart} ~ ${weekEndStr})`;
    document.getElementById('weeklyPlanContent').innerHTML = 
        '<p class="text-muted">팀원을 선택해주세요.</p>';
    
    document.getElementById('monthlyPlanTitle').textContent = `월별 계획 (${year}년 ${month}월)`;
    document.getElementById('monthlyPlanContent').innerHTML = 
        '<p class="text-muted">팀원을 선택해주세요.</p>';
    
    // 캘린더 새로고침
    if (teamCalendar) {
        teamCalendar.refetchEvents();
    }
}

// 팀 캘린더 초기화
function initializeTeamCalendar() {
    const calendarEl = document.getElementById('teamCalendar');
    
    teamCalendar = new FullCalendar.Calendar(calendarEl, {
        // 기본 설정
        locale: 'ko',
        height: 'auto',
        
        // 헤더 툴바
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        
        // 버튼 텍스트
        buttonText: {
            today: '오늘',
            month: '월',
            week: '주',
            day: '일'
        },
        
        // 초기 뷰
        initialView: 'dayGridMonth',
        
        // 초기 날짜
        initialDate: '2025-08-21',
        
        // 주말 표시
        weekends: true,
        
        // 시간 표시 형식
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        
        // 시간 표시 범위
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        
        // 시간 간격
        slotDuration: '01:00:00',
        slotLabelInterval: '01:00',
        
        // 날짜 클릭 이벤트 (주별/월별 계획 로드)
        dateClick: function(info) {
            if (selectedMemberId) {
                loadMemberPlansForDate(info.dateStr);
            }
        },
        
        // 이벤트 클릭 - 읽기 전용이므로 상세 정보만 표시
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            showEventDetails(info.event);
        },
        
        // 본인 선택시에만 편집 가능하도록 동적 설정
        editable: false,
        
        // 이벤트 드래그 앤 드롭 (본인 계정 선택시에만)
        eventDrop: function(info) {
            if (selectedMemberId === Auth.getCurrentUser().id) {
                handleTeamEventDrop(info);
            } else {
                info.revert();
                Utils.showError('본인의 계획만 수정할 수 있습니다.');
            }
        },
        
        // 이벤트 리사이즈 (본인 계정 선택시에만)
        eventResize: function(info) {
            if (selectedMemberId === Auth.getCurrentUser().id) {
                handleTeamEventResize(info);
            } else {
                info.revert();
                Utils.showError('본인의 계획만 수정할 수 있습니다.');
            }
        },
        
        // 이벤트 렌더링
        eventDidMount: function(info) {
            const event = info.event;
            const element = info.el;
            
            // 계획 타입별 스타일 적용
            element.setAttribute('data-type', event.extendedProps.type);
            element.setAttribute('data-status', event.extendedProps.status);
            
            // 취소된 이벤트의 경우 특별한 HTML 구조 생성
            if (event.extendedProps.status === 'cancelled') {
                const titleElement = element.querySelector('.fc-event-title');
                if (titleElement && event.extendedProps.originalTitle) {
                    titleElement.innerHTML = `
                        <span class="cancelled-emoji">❌</span>
                        <span class="cancelled-title">${event.extendedProps.originalTitle}</span>
                    `;
                }
            }
            
            // 툴팁 추가
            element.title = `${event.title}\n${event.extendedProps.description || ''}`;
        },
        
        // 이벤트 소스 (동적 로딩)
        events: function(fetchInfo, successCallback, failureCallback) {
            loadTeamCalendarEvents(fetchInfo, successCallback, failureCallback);
        },
        
        // 이벤트 로드 완료 후 시간 범위 조정 및 주말 숨김 처리
        eventsSet: function(events) {
            adjustTeamCalendarTimeRange(events);
            adjustTeamCalendarWeekendDisplay(events);
        },
        
        // 뷰 변경 시 이벤트 새로고침
        viewDidMount: function(info) {
            console.log('=== TEAM CALENDAR VIEW CHANGED ===');
            console.log('Team ViewDidMount info:', info);
            
            // info 객체 안에 view가 있는지 확인
            let view = null;
            if (info && info.view) {
                view = info.view;
            } else if (info && info.type) {
                view = info; // info 자체가 view 객체인 경우
            } else {
                // 최후의 수단: teamCalendar.view 사용
                view = teamCalendar ? teamCalendar.view : null;
            }
            
            console.log('Team calendar detected view:', view);
            console.log('Team calendar view type:', view?.type || 'unknown');
            
            if (!view || !view.type) {
                console.log('ERROR: Could not determine team calendar view type!');
                return;
            }
            
            console.log(`Team calendar refetching events for view change to: ${view.type}`);
            // 뷰가 변경되면 이벤트를 다시 로드
            teamCalendar.refetchEvents();
            
            // 시간 뷰로 변경되면 약간의 지연 후 시간 범위 조정
            if (view.type.includes('timeGrid')) {
                setTimeout(() => {
                    console.log('Team calendar time grid view detected, triggering time range adjustment...');
                    const events = teamCalendar.getEvents();
                    if (events.length > 0) {
                        adjustTeamCalendarTimeRange(events);
                    }
                }, 300);
            }
        }
    });
    
    teamCalendar.render();
}

// 팀 캘린더 이벤트 로드
async function loadTeamCalendarEvents(fetchInfo, successCallback, failureCallback) {
    if (!selectedMemberId) {
        successCallback([]);
        return;
    }

    try {
        const startDate = fetchInfo.start;
        const endDate = fetchInfo.end;
        
        const startMonth = startDate.toISOString().substring(0, 7);
        const endMonth = endDate.toISOString().substring(0, 7);
        
        let filters = {
            user_id: selectedMemberId,
            type: 'daily'
        };
        
        if (startMonth === endMonth) {
            filters.date = startMonth;
        }
        
        console.log('Loading team calendar events for member:', selectedMemberId, filters);
        console.log('API.plans.getAll filters:', JSON.stringify(filters));
        
        const result = await API.plans.getAll(filters);
        console.log('API result:', result);
        
        if (result.success) {
            const events = [];
            
            result.plans.forEach(plan => {
                // 현재 팀 캘린더 뷰 확인 (좀 더 안전한 방식)
                let currentView = 'dayGridMonth'; // 기본값
                
                if (teamCalendar && teamCalendar.view && teamCalendar.view.type) {
                    currentView = teamCalendar.view.type;
                } else {
                    console.warn('Team calendar or view not available, using default dayGridMonth');
                }
                
                console.log(`Team calendar processing plan ${plan.id} for view: ${currentView} (teamCalendar exists: ${!!teamCalendar})`);
                
                if (currentView === 'dayGridMonth') {
                    // 월별 뷰: 단일 이벤트 (시간 표시 없이 올데이 이벤트로)
                    const eventStartDateTime = plan.plan_date;
                    const eventEndDateTime = plan.plan_date;
                    
                    const statusPrefix = getStatusPrefix(plan.status);
                    
                    // 취소된 이벤트의 경우 특별한 제목 구조 생성
                    let eventTitle;
                    if (plan.status === 'cancelled') {
                        eventTitle = plan.title; // ❌ 제거 - eventDidMount에서 처리
                    } else {
                        eventTitle = `${statusPrefix} ${plan.title}`;
                    }
                    
                    const event = {
                        id: plan.id,
                        title: eventTitle,
                        start: eventStartDateTime,
                        end: eventEndDateTime,
                        allDay: true, // 월별 뷰는 항상 올데이 이벤트 (시간 표시 안함)
                        extendedProps: {
                            type: plan.type,
                            status: plan.status,
                            description: plan.description,
                            work_type: plan.work_type,
                            location: plan.location,
                            user_name: plan.user_name,
                            useActualTime: false, // 월별 뷰에서는 시간 정보 사용 안함
                            originalTitle: plan.title // 원본 제목 저장
                        },
                        backgroundColor: getStatusColor(plan.status, false),
                        borderColor: getStatusBorderColor(plan.status, false),
                        textColor: getStatusTextColor(plan.status, false),
                        classNames: ['team-plan-event', ...getStatusClasses(plan.status)]
                    };
                    events.push(event);
                    
                } else {
                    // 주별/일별 뷰: 듀얼 이벤트 (계획 + 실제)
                    console.log(`Team calendar: Creating dual events for plan ${plan.id} (${plan.title})`);
                    console.log(`  - Status: ${plan.status}`);
                    console.log(`  - Has actual times: ${!!(plan.actual_start_time && plan.actual_end_time)}`);
                    
                    // 1. 계획 시간 이벤트
                    let plannedStartDateTime, plannedEndDateTime;
                    
                    if (plan.start_time) {
                        const [year, month, day] = plan.plan_date.split('-').map(Number);
                        const [hour, minute] = plan.start_time.split(':').map(Number);
                        plannedStartDateTime = new Date(year, month - 1, day, hour, minute);
                    } else {
                        plannedStartDateTime = plan.plan_date;
                    }
                    
                    if (plan.end_time) {
                        const [year, month, day] = plan.plan_date.split('-').map(Number);
                        const [hour, minute] = plan.end_time.split(':').map(Number);
                        plannedEndDateTime = new Date(year, month - 1, day, hour, minute);
                    } else {
                        plannedEndDateTime = plan.plan_date;
                    }
                    
                    // 취소된 이벤트의 경우 다른 표시
                    let plannedTitle, plannedClasses;
                    if (plan.status === 'cancelled') {
                        plannedTitle = plan.title; // ❌ 제거 - eventDidMount에서 처리
                        plannedClasses = ['team-planned-event', 'cancelled-event'];
                    } else {
                        plannedTitle = `📅 ${plan.title}`;
                        plannedClasses = ['team-planned-event'];
                    }
                    
                    const plannedEvent = {
                        id: `planned-${plan.id}`,
                        title: plannedTitle,
                        start: plannedStartDateTime,
                        end: plannedEndDateTime,
                        allDay: plan.type !== 'daily',
                        extendedProps: {
                            type: plan.type,
                            status: plan.status,
                            description: plan.description,
                            work_type: plan.work_type,
                            location: plan.location,
                            user_name: plan.user_name,
                            eventType: 'planned',
                            originalId: plan.id,
                            originalTitle: plan.title // 원본 제목 저장
                        },
                        backgroundColor: 'rgba(0, 123, 255, 0.2)',
                        borderColor: '#007bff',
                        textColor: '#007bff',
                        classNames: plannedClasses
                    };
                    events.push(plannedEvent);
                    console.log(`  -> Team calendar: Added planned event: planned-${plan.id}`);
                    
                    // 2. 실제 시간 이벤트
                    if (plan.actual_start_time && plan.actual_end_time) {
                        console.log(`  -> Team calendar: Creating actual event for completed plan...`);
                        let actualStartDateTime, actualEndDateTime;
                        
                        const [year, month, day] = plan.plan_date.split('-').map(Number);
                        const [startHour, startMinute] = plan.actual_start_time.split(':').map(Number);
                        const [endHour, endMinute] = plan.actual_end_time.split(':').map(Number);
                        
                        actualStartDateTime = new Date(year, month - 1, day, startHour, startMinute);
                        actualEndDateTime = new Date(year, month - 1, day, endHour, endMinute);
                        
                        const actualEvent = {
                            id: `actual-${plan.id}`,
                            title: `✅ ${plan.title}`,
                            start: actualStartDateTime,
                            end: actualEndDateTime,
                            allDay: false,
                            extendedProps: {
                                type: plan.type,
                                status: plan.status,
                                description: plan.description,
                                work_type: plan.work_type,
                                location: plan.location,
                                user_name: plan.user_name,
                                eventType: 'actual',
                                originalId: plan.id
                            },
                            backgroundColor: plan.status === 'completed' ? '#28a745' : '#28a745',
                            borderColor: plan.status === 'completed' ? '#1e7e34' : '#1e7e34',
                            textColor: '#ffffff',
                            classNames: ['team-actual-event']
                        };
                        events.push(actualEvent);
                        console.log(`  -> Team calendar: Added actual event: actual-${plan.id}`);
                    } else {
                        console.log(`  -> Team calendar: No actual times found, only showing planned event`);
                    }
                }
            });
            
            console.log('Sending team calendar events:', events);
            successCallback(events);
        } else {
            failureCallback(new Error('팀 멤버 계획을 불러오는데 실패했습니다.'));
        }
    } catch (error) {
        console.error('팀 캘린더 이벤트 로드 실패:', error);
        failureCallback(error);
    }
}

// 특정 날짜의 멤버 계획 로드
async function loadMemberPlansForDate(dateStr) {
    if (!selectedMemberId) return;

    const selectedDate = new Date(dateStr);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    
    // 주차 계산
    const dayOfWeek = selectedDate.getDay();
    const mondayDate = new Date(selectedDate);
    mondayDate.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const weekStart = mondayDate.toISOString().split('T')[0];
    const weekEnd = new Date(mondayDate);
    weekEnd.setDate(mondayDate.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    try {
        // 주별 계획 로드
        const weeklyResult = await loadMemberWeeklyPlan(weekStart, weekEndStr);
        
        // 월별 계획 로드
        const monthlyResult = await API.plans.getAll({
            user_id: selectedMemberId,
            type: 'monthly',
            date: `${year}-${month.toString().padStart(2, '0')}`
        });
        
        // 주별 계획 표시
        displayMemberWeeklyPlan(weeklyResult, weekStart, weekEndStr);
        
        // 월별 계획 표시
        displayMemberMonthlyPlan(monthlyResult, year, month);
        
    } catch (error) {
        console.error('멤버 계획 로드 실패:', error);
        Utils.showError('계획을 불러오는데 실패했습니다.');
    }
}

// 멤버 주별 계획 로드
async function loadMemberWeeklyPlan(weekStart, weekEnd) {
    try {
        const result = await API.plans.getAll({ 
            user_id: selectedMemberId,
            type: 'weekly' 
        });
        
        if (result.success) {
            const filteredPlans = result.plans.filter(plan => {
                const planDate = plan.plan_date;
                return planDate >= weekStart && planDate <= weekEnd;
            });
            
            return { success: true, plans: filteredPlans };
        }
        
        return result;
    } catch (error) {
        console.error('멤버 주별 계획 로드 실패:', error);
        return { success: false, plans: [] };
    }
}

// 멤버 주별 계획 표시
function displayMemberWeeklyPlan(result, weekStart, weekEnd) {
    const titleElement = document.getElementById('weeklyPlanTitle');
    const contentElement = document.getElementById('weeklyPlanContent');
    
    titleElement.textContent = `주별 계획 (${weekStart} ~ ${weekEnd})`;
    
    if (result.success && result.plans.length > 0) {
        const plan = result.plans[0];
        const planItems = formatPlanItems(plan.description);
        contentElement.innerHTML = `
            <div class="plan-items">${planItems}</div>
            <div class="mt-2 text-muted small">
                <i class="bi bi-person"></i> ${plan.user_name}
            </div>
        `;
    } else {
        contentElement.innerHTML = `
            <p class="text-muted">선택한 주의 계획이 없습니다.</p>
            ${selectedMemberName ? `<div class="text-muted small">
                <i class="bi bi-person"></i> ${selectedMemberName}
            </div>` : ''}
        `;
    }
}

// 멤버 월별 계획 표시
function displayMemberMonthlyPlan(result, year, month) {
    const titleElement = document.getElementById('monthlyPlanTitle');
    const contentElement = document.getElementById('monthlyPlanContent');
    
    titleElement.textContent = `월별 계획 (${year}년 ${month}월)`;
    
    if (result.success && result.plans.length > 0) {
        const plan = result.plans[0];
        const planItems = formatPlanItems(plan.description);
        contentElement.innerHTML = `
            <div class="plan-items">${planItems}</div>
            <div class="mt-2 text-muted small">
                <i class="bi bi-person"></i> ${plan.user_name}
            </div>
        `;
    } else {
        contentElement.innerHTML = `
            <p class="text-muted">선택한 월의 계획이 없습니다.</p>
            ${selectedMemberName ? `<div class="text-muted small">
                <i class="bi bi-person"></i> ${selectedMemberName}
            </div>` : ''}
        `;
    }
}

// 이벤트 상세 정보 표시
function showEventDetails(event) {
    const props = event.extendedProps;
    // Use originalTitle for cancelled events to avoid duplicate ❌
    const displayTitle = props.status === 'cancelled' && props.originalTitle ? 
        `❌ ${props.originalTitle}` : event.title;
    
    let content = `
        <div class="event-details">
            <h6 class="fw-bold">${displayTitle}</h6>
            <div class="mb-2">
                <span class="badge bg-${getStatusBadgeColor(props.status)}">${getStatusText(props.status)}</span>
                <span class="badge bg-secondary ms-1">${getTypeText(props.type)}</span>
            </div>
    `;
    
    if (props.description) {
        content += `<div class="mb-2"><strong>설명:</strong><br>${props.description}</div>`;
    }
    
    if (props.work_type) {
        content += `<div class="mb-1"><strong>근무 형태:</strong> ${getWorkTypeText(props.work_type)}</div>`;
    }
    
    if (props.location) {
        content += `<div class="mb-1"><strong>위치:</strong> ${props.location}</div>`;
    }
    
    content += `<div class="mb-1"><strong>담당자:</strong> ${props.user_name}</div>`;
    
    content += `</div>`;
    
    // 간단한 alert로 표시 (추후 모달로 개선 가능)
    Utils.showInfo(content);
}

// 팀 캘린더 새로고침
function refreshTeamCalendar() {
    if (teamCalendar) {
        teamCalendar.refetchEvents();
        Utils.showSuccess('팀 캘린더가 새로고침되었습니다.');
    }
}

// 헬퍼 함수들 (기존 calendar.js에서 재사용)
function getStatusPrefix(status) {
    switch (status) {
        case 'completed': return '✅';
        case 'cancelled': return '❌';
        case 'planned': 
        default: return '📅';
    }
}

function getStatusColor(status, useActualTime) {
    switch (status) {
        case 'completed': return '#28a745';
        case 'cancelled': return '#6c757d';
        case 'planned':
        default: 
            if (useActualTime) {
                return '#007bff';
            } else {
                return 'rgba(0, 123, 255, 0.3)';
            }
    }
}

function getStatusBorderColor(status, useActualTime) {
    switch (status) {
        case 'completed': return '#1e7e34';
        case 'cancelled': return '#495057';
        case 'planned':
        default: return '#007bff';
    }
}

function getStatusTextColor(status, useActualTime) {
    switch (status) {
        case 'completed': return '#ffffff';
        case 'cancelled': return '#ffffff';
        case 'planned':
        default:
            if (useActualTime) {
                return '#ffffff';
            } else {
                return '#007bff';
            }
    }
}

function getStatusClasses(status) {
    const baseClasses = ['team-plan-event'];
    if (status === 'cancelled') {
        baseClasses.push('cancelled-event');
    }
    return baseClasses;
}

function getStatusText(status) {
    switch (status) {
        case 'completed': return '완료';
        case 'cancelled': return '취소';
        case 'planned': return '계획됨';
        default: return status;
    }
}

function getStatusBadgeColor(status) {
    switch (status) {
        case 'completed': return 'success';
        case 'cancelled': return 'secondary';
        case 'planned': return 'primary';
        default: return 'secondary';
    }
}

function getTypeText(type) {
    switch (type) {
        case 'daily': return '일별';
        case 'weekly': return '주별';
        case 'monthly': return '월별';
        default: return type;
    }
}

function getWorkTypeText(workType) {
    switch (workType) {
        case 'office': return '사무실';
        case 'field': return '현장';
        default: return workType;
    }
}

function formatPlanItems(description) {
    if (!description) return '<p class="text-muted">계획 내용이 없습니다.</p>';
    
    const lines = description.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '<p class="text-muted">계획 내용이 없습니다.</p>';
    
    let result = '';
    let currentSection = [];
    let currentTitle = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.endsWith(':') || trimmed.startsWith('##')) {
            if (currentTitle || currentSection.length > 0) {
                result += formatSection(currentTitle, currentSection);
            }
            
            currentTitle = trimmed.endsWith(':') ? 
                trimmed.slice(0, -1).trim() : 
                trimmed.replace(/^##\s*/, '').trim();
            currentSection = [];
        }
        else if (trimmed === '') {
            continue;
        }
        else {
            currentSection.push(trimmed);
        }
    }
    
    if (currentTitle || currentSection.length > 0) {
        result += formatSection(currentTitle, currentSection);
    }
    
    return result || '<p class="text-muted">계획 내용이 없습니다.</p>';
}

function formatSection(title, items) {
    let html = '';
    
    if (title) {
        html += `<h6 class="fw-semibold text-dark mb-1 mt-2">${title}</h6>`;
    }
    
    if (items.length > 0) {
        const listItems = items.map(item => {
            const trimmed = item.trim();
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                return `<li>${trimmed.substring(1).trim()}</li>`;
            }
            return `<li>${trimmed}</li>`;
        }).join('');
        
        html += `<ul class="mb-0 ps-3">${listItems}</ul>`;
    }
    
    return html;
}

// 팀 캘린더 시간 범위 동적 조정
function adjustTeamCalendarTimeRange(events) {
    console.log('=== Team Calendar Time Range Adjustment ===');
    console.log('Current view:', teamCalendar.view.type);
    console.log('Total events received:', events.length);
    
    // 시간 뷰가 아니면 조정하지 않음
    const currentView = teamCalendar.view.type;
    if (!currentView.includes('timeGrid')) {
        console.log('Not a time grid view, skipping');
        return;
    }
    
    // 시간이 있는 이벤트만 필터링
    const timedEvents = events.filter(event => {
        const hasTimes = event.start && !event.allDay;
        console.log(`Event "${event.title}": allDay=${event.allDay}, start=${event.start}, end=${event.end}, hasTimes=${hasTimes}`);
        if (hasTimes && event.start) {
            console.log(`  -> Event start time: ${event.start.getHours()}:${event.start.getMinutes()}`);
        }
        return hasTimes;
    });
    
    console.log('Filtered timed events:', timedEvents.length);
    
    if (timedEvents.length === 0) {
        console.log('No timed events, using default range 06:00-20:00');
        teamCalendar.setOption('slotMinTime', '06:00:00');
        teamCalendar.setOption('slotMaxTime', '20:00:00');
        return;
    }
    
    let earliestHour = 23;
    let latestHour = 0;
    
    timedEvents.forEach((event, index) => {
        // FullCalendar Date 객체에서 시간 추출
        const startHour = event.start.getHours();
        let endHour = event.end ? event.end.getHours() : startHour;
        
        // 자정을 넘는 이벤트 처리 (다음날 새벽 시간인 경우)
        if (event.end && event.end.getDate() !== event.start.getDate()) {
            // 다음날로 넘어간 경우, 해당 날의 23:59까지만 고려
            endHour = 23;
            console.log(`Event ${index} crosses midnight, adjusting end to 23:00`);
        }
        
        console.log(`Event ${index} "${event.title}": ${startHour}:${event.start.getMinutes()} - ${endHour}:${event.end ? event.end.getMinutes() : 'N/A'}`);
        
        if (startHour < earliestHour) earliestHour = startHour;
        if (endHour > latestHour) latestHour = endHour;
    });
    
    console.log(`Found hour range: ${earliestHour}:00 - ${latestHour}:00`);
    
    // 합리적인 시간 범위 보장
    if (earliestHour > latestHour) {
        console.log('Invalid hour range detected, using default');
        earliestHour = 9;
        latestHour = 18;
    }
    
    // 여유 시간 추가 (1시간 전후) 및 합리적인 범위 보장
    // 5시대 이벤트가 있으면 5시부터 시작하도록 수정
    const adjustedStartHour = Math.max(earliestHour < 6 ? 5 : 6, earliestHour - 1);
    const adjustedEndHour = Math.min(23, latestHour + 1);
    
    const newMinTime = `${adjustedStartHour.toString().padStart(2, '0')}:00:00`;
    const newMaxTime = `${adjustedEndHour.toString().padStart(2, '0')}:00:00`;
    
    console.log(`Setting team calendar time range: ${newMinTime} - ${newMaxTime}`);
    
    // Try setting options with a slight delay to ensure calendar is ready
    setTimeout(() => {
        console.log('Applying team calendar time range options...');
        teamCalendar.setOption('slotMinTime', newMinTime);
        teamCalendar.setOption('slotMaxTime', newMaxTime);
        
        // Verify the options were set
        console.log('Team Calendar Verification - slotMinTime:', teamCalendar.getOption('slotMinTime'));
        console.log('Team Calendar Verification - slotMaxTime:', teamCalendar.getOption('slotMaxTime'));
        
        // Force calendar refresh
        console.log('Forcing team calendar refresh');
        teamCalendar.render();
    }, 100);
    
    console.log('=== Team Calendar Time Range Adjustment Complete ===');
}

// 팀 캘린더 주말 표시 조정 함수
function adjustTeamCalendarWeekendDisplay(events) {
    console.log('=== Team Calendar Weekend Display Adjustment ===');
    
    if (!hideEmptyWeekends) {
        console.log('Team calendar auto-hide weekends disabled, showing all days');
        teamCalendar.setOption('weekends', true);
        return;
    }
    
    const currentViewType = teamCalendar.view.type;
    console.log('Team calendar current view type:', currentViewType);
    
    // 월별 뷰에서는 주말 숨김 적용하지 않음
    if (currentViewType === 'dayGridMonth') {
        console.log('Team calendar month view detected, keeping weekends visible');
        teamCalendar.setOption('weekends', true);
        return;
    }
    
    // 주별/일별 뷰에서만 적용
    if (!currentViewType.includes('timeGrid') && currentViewType !== 'listWeek') {
        console.log('Team calendar not a week/day view, keeping weekends visible');
        teamCalendar.setOption('weekends', true);
        return;
    }
    
    // 현재 보이는 날짜 범위 가져오기
    const view = teamCalendar.view;
    const startDate = view.currentStart;
    const endDate = view.currentEnd;
    
    console.log(`Team calendar checking date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // 주말(토요일=6, 일요일=0)에 이벤트가 있는지 확인
    let hasWeekendEvents = false;
    
    events.forEach(event => {
        if (event.start) {
            const eventDate = new Date(event.start);
            const dayOfWeek = eventDate.getDay();
            
            // 토요일(6) 또는 일요일(0)인지 확인
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                // 현재 보이는 범위 내에 있는지 확인
                if (eventDate >= startDate && eventDate < endDate) {
                    hasWeekendEvents = true;
                    console.log(`Team calendar weekend event found: ${event.title} on ${eventDate.toDateString()}`);
                }
            }
        }
    });
    
    console.log(`Team calendar has weekend events: ${hasWeekendEvents}`);
    
    // 주말 이벤트가 없으면 주말 숨김
    const shouldShowWeekends = hasWeekendEvents;
    teamCalendar.setOption('weekends', shouldShowWeekends);
    
    console.log(`Team calendar setting weekends visibility: ${shouldShowWeekends}`);
    console.log('=== Team Calendar Weekend Display Adjustment Complete ===');
}

// 팀 캘린더 이벤트 드래그 앤 드롭 처리
async function handleTeamEventDrop(info) {
    if (selectedMemberId !== Auth.getCurrentUser().id) {
        info.revert();
        Utils.showError('본인의 계획만 수정할 수 있습니다.');
        return;
    }

    const planId = info.event.id;
    
    // 로컬 시간으로 직접 추출
    const startDate = info.event.start;
    const endDate = info.event.end;
    
    // 로컬 날짜/시간으로 추출
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const newPlanDate = `${year}-${month}-${day}`;
    
    const newStartTime = String(startDate.getHours()).padStart(2, '0') + ':' + 
                        String(startDate.getMinutes()).padStart(2, '0');
    const newEndTime = endDate ? 
                      String(endDate.getHours()).padStart(2, '0') + ':' + 
                      String(endDate.getMinutes()).padStart(2, '0') : null;

    try {
        await API.plans.update(planId, {
            plan_date: newPlanDate,
            start_time: newStartTime,
            end_time: newEndTime
        });
        
        console.log('팀 캘린더 이벤트 드래그 완료:', { planId, newPlanDate, newStartTime, newEndTime });
        
        // 팀 캘린더 새로고침
        teamCalendar.refetchEvents();
        
    } catch (error) {
        console.error('팀 캘린더 이벤트 드래그 실패:', error);
        info.revert();
        Utils.showError('계획 이동에 실패했습니다.');
    }
}

// 팀 캘린더 이벤트 리사이즈 처리
async function handleTeamEventResize(info) {
    if (selectedMemberId !== Auth.getCurrentUser().id) {
        info.revert();
        Utils.showError('본인의 계획만 수정할 수 있습니다.');
        return;
    }

    const planId = info.event.id;
    const endDate = info.event.end;
    const newEndTime = endDate ? 
                      String(endDate.getHours()).padStart(2, '0') + ':' + 
                      String(endDate.getMinutes()).padStart(2, '0') : null;
    
    try {
        await API.plans.update(planId, {
            end_time: newEndTime
        });
        
        console.log('팀 캘린더 이벤트 리사이즈 완료:', { planId, newEndTime });
        
        // 팀 캘린더 새로고침
        teamCalendar.refetchEvents();
        
    } catch (error) {
        console.error('팀 캘린더 이벤트 리사이즈 실패:', error);
        info.revert();
        Utils.showError('계획 수정에 실패했습니다.');
    }
}