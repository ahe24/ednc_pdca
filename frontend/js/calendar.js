// FullCalendar 설정 및 기능
let calendar;
let currentView = 'my'; // my, team, all
let currentPlanId = null;
let hideEmptyWeekends = true; // 빈 주말 자동 숨김 설정

// 디버그 함수 - 브라우저 콘솔에서 debugCalendar() 호출 가능
window.debugCalendar = function() {
    console.log('=== CALENDAR DEBUG INFO ===');
    console.log('Calendar exists:', !!calendar);
    if (calendar) {
        console.log('Current view:', calendar.view.type);
        console.log('Current events:', calendar.getEvents().length);
        calendar.getEvents().forEach(event => {
            console.log(`  - ${event.id}: ${event.title} (${event.start} - ${event.end})`);
        });
    }
    console.log('=== END DEBUG ===');
};

// 캘린더 초기화
function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        // 기본 설정
        locale: 'ko',
        // timeZone 설정 제거 - 로컬 시간 사용
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
        
        // 초기 날짜를 2025년 8월로 명시적 설정
        initialDate: '2025-08-21',
        
        // 주말 표시
        weekends: true,
        
        // 시간 표시 형식
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        
        // 시간 표시 범위 (기본값: 08:00 - 20:00)
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        
        // 시간 간격
        slotDuration: '01:00:00',
        slotLabelInterval: '01:00',
        
        // 날짜 클릭 이벤트 (주별/월별 계획 로드)
        dateClick: function(info) {
            // 날짜 문자열을 안전하게 추출
            const safeDateStr = info.dateStr || (info.date ? 
                info.date.toISOString().split('T')[0] : null);
            
            if (safeDateStr) {
                loadWeeklyMonthlyPlans(safeDateStr);
            }
            
            // 클릭한 위치에 이벤트가 있는지 확인
            const clickedEvents = calendar.getEvents().filter(event => {
                const eventDate = event.start.toISOString().split('T')[0];
                return eventDate === safeDateStr;
            });
            
            // 클릭한 시간 정보 추출 (week/day 뷰에서만 사용)
            const clickedDateTime = info.date; // FullCalendar Date 객체
            const clickedTime = clickedDateTime ? {
                hour: clickedDateTime.getHours(),
                minute: clickedDateTime.getMinutes()
            } : null;
            
            console.log('클릭 정보:', {
                originalDateStr: info.dateStr,
                safeDateStr: safeDateStr,
                time: clickedTime,
                view: calendar.view.type,
                hasEvents: clickedEvents.length > 0,
                clickedDateTime: clickedDateTime
            });
            
            // 이벤트가 있는 날짜를 클릭했지만 이벤트 영역을 정확히 클릭하지 않은 경우
            // (즉, 빈 공간을 클릭한 경우) 새 계획 생성
            if (clickedEvents.length > 0) {
                console.log('클릭한 날짜에 이벤트가 있습니다. 빈 공간 클릭 시에만 새 계획을 생성합니다.');
                // 더블클릭 감지를 위한 타이머 설정 (빈 공간 클릭 시에만 새 계획 생성)
                if (window.dateClickTimer) {
                    clearTimeout(window.dateClickTimer);
                    window.dateClickTimer = null;
                    // 더블클릭 - 새 일별 계획 생성 (기존 계획 무시)
                    console.log('빈 공간 더블클릭 - 새 계획 생성');
                    handleDateDoubleClick(safeDateStr, true, clickedTime);
                } else {
                    window.dateClickTimer = setTimeout(() => {
                        window.dateClickTimer = null;
                        // 단일 클릭은 아무것도 하지 않음
                    }, 300);
                }
            } else {
                // 이벤트가 없는 날짜를 클릭한 경우
                if (window.dateClickTimer) {
                    clearTimeout(window.dateClickTimer);
                    window.dateClickTimer = null;
                    // 더블클릭 - 일별 계획 생성/편집
                    handleDateDoubleClick(safeDateStr, false, clickedTime);
                } else {
                    window.dateClickTimer = setTimeout(() => {
                        window.dateClickTimer = null;
                        // 단일 클릭은 이미 위에서 처리됨
                    }, 300);
                }
            }
        },
        
        // 이벤트 클릭 (계획 수정)
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            
            // planned-xxx 또는 actual-xxx 형태의 ID에서 원본 ID 추출
            let planId = info.event.id;
            if (planId.startsWith('planned-') || planId.startsWith('actual-')) {
                planId = info.event.extendedProps.originalId;
            }
            
            // 더블클릭 감지를 위한 타이머 설정
            if (window.eventClickTimer) {
                clearTimeout(window.eventClickTimer);
                window.eventClickTimer = null;
                // 더블클릭 - 계획 편집
                openPlanModal(planId);
            } else {
                window.eventClickTimer = setTimeout(() => {
                    window.eventClickTimer = null;
                    // 단일 클릭은 툴팁이나 간단한 정보 표시 (현재는 아무것도 안함)
                }, 300);
            }
        },
        
        // 이벤트 드래그 앤 드롭
        editable: true,
        eventDrop: function(info) {
            handleEventDrop(info);
        },
        
        // 이벤트 리사이즈
        eventResize: function(info) {
            handleEventResize(info);
        },
        
        // 우클릭 컨텍스트 메뉴
        eventMouseEnter: function(info) {
            info.el.title = `${info.event.title}\n${info.event.extendedProps.description || ''}`;
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
            
            // 우클릭 이벤트
            element.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                showContextMenu(e, event);
            });
        },
        
        // 이벤트 소스 (동적 로딩)
        events: function(fetchInfo, successCallback, failureCallback) {
            // 약간의 지연을 두어 calendar 객체가 완전히 초기화되도록 함
            setTimeout(() => {
                loadCalendarEvents(fetchInfo, successCallback, failureCallback);
            }, 100);
        },
        
        // 이벤트 로드 완료 후 시간 범위 조정 및 주말 숨김 처리
        eventsSet: function(events) {
            adjustTimeRange(events);
            adjustWeekendDisplay(events);
        },
        
        // 뷰 변경 시 이벤트 새로고침
        viewDidMount: function(info) {
            console.log('=== VIEW CHANGED ===');
            console.log('ViewDidMount arguments:', arguments);
            console.log('ViewDidMount info object:', info);
            
            // info 객체 안에 view가 있는지 확인
            let view = null;
            if (info && info.view) {
                view = info.view;
            } else if (info && info.type) {
                view = info; // info 자체가 view 객체인 경우
            } else {
                // 최후의 수단: calendar.view 사용
                view = calendar ? calendar.view : null;
            }
            
            console.log('Detected view:', view);
            console.log('View type:', view?.type || 'unknown');
            console.log('Calendar exists:', !!calendar);
            
            if (!view || !view.type) {
                console.log('ERROR: Could not determine view type!');
                return;
            }
            
            console.log(`Refetching events for view change to: ${view.type}`);
            // 뷰가 변경되면 이벤트를 다시 로드
            calendar.refetchEvents();
            
            // 시간 뷰로 변경되면 약간의 지연 후 시간 범위 조정
            if (view.type.includes('timeGrid')) {
                setTimeout(() => {
                    console.log('Time grid view detected, triggering time range adjustment...');
                    const events = calendar.getEvents();
                    if (events.length > 0) {
                        adjustTimeRange(events);
                    }
                }, 300);
            }
        }
    });
    
    calendar.render();
    
    // 페이지 로드 시 현재 날짜의 주별/월별 계획 로드
    const today = new Date().toISOString().split('T')[0];
    loadWeeklyMonthlyPlans(today);
}

// 캘린더 이벤트 로드
async function loadCalendarEvents(fetchInfo, successCallback, failureCallback) {
    try {
        // 더 넓은 날짜 범위로 조회하거나 월별로 여러 개월 조회
        const startDate = fetchInfo.start;
        const endDate = fetchInfo.end;
        
        // 시작월과 끝월이 다르면 월 범위를 확장해서 조회
        const startMonth = startDate.toISOString().substring(0, 7);
        const endMonth = endDate.toISOString().substring(0, 7);
        
        let filters = {};
        
        // 같은 월인 경우 해당 월만 조회
        if (startMonth === endMonth) {
            filters.date = startMonth;
        } else {
            // 다른 월인 경우 날짜 필터 없이 모든 계획 조회 (임시)
            filters = {};
        }
        
        console.log('Loading calendar events for:', filters, '- Timestamp:', new Date().toISOString());
        console.log('Current user:', Auth.currentUser);
        console.log('Authentication status:', Auth.isLoggedIn());
        
        // 현재 뷰에 따른 사용자 필터링
        if (currentView === 'my') {
            // 내 계획만
        } else if (currentView === 'team' && Auth.currentUser.team_id) {
            // 팀 계획 (추후 구현)
        }
        
        // 캘린더에는 일별 계획만 표시 (주별/월별은 별도 카드로 표시)
        filters.type = 'daily';
        
        const result = await API.plans.getAll(filters);
        console.log('API response:', result);
        console.log('API plans data:', result.plans);
        
        if (result.success) {
            console.log('Found plans:', result.plans.length);
            const events = [];
            
            result.plans.forEach(plan => {
                // 현재 캘린더 뷰 확인 (좀 더 안전한 방식)
                let currentView = 'dayGridMonth'; // 기본값
                
                if (calendar && calendar.view && calendar.view.type) {
                    currentView = calendar.view.type;
                } else {
                    console.warn('Calendar or view not available, using default dayGridMonth');
                }
                
                console.log(`Processing plan ${plan.id} for view: ${currentView} (calendar exists: ${!!calendar})`);
                
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
                        classNames: getStatusClasses(plan.status)
                    };
                    events.push(event);
                    
                } else {
                    // 주별/일별 뷰: 듀얼 이벤트 (계획 + 실제) - 완료된 계획은 항상 듀얼 표시
                    console.log(`Week/Day view: Creating events for plan ${plan.id} (${plan.title})`);
                    console.log(`  - Status: ${plan.status}`);
                    console.log(`  - Has actual times: ${!!(plan.actual_start_time && plan.actual_end_time)}`);
                    
                    // 1. 계획 시간 이벤트 (항상 표시)
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
                        plannedClasses = ['planned-event', 'cancelled-event'];
                    } else {
                        plannedTitle = `📅 ${plan.title}`;
                        plannedClasses = ['planned-event'];
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
                    console.log(`  -> Added planned event: planned-${plan.id}`);
                    
                    // 2. 실제 시간 이벤트 (있을 때만 표시)
                    if (plan.actual_start_time && plan.actual_end_time) {
                        console.log(`  -> Creating actual event for completed plan...`);
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
                            classNames: ['actual-event']
                        };
                        events.push(actualEvent);
                        console.log(`  -> Added actual event: actual-${plan.id}`);
                    } else {
                        console.log(`  -> No actual times found, only showing planned event`);
                    }
                }
                
                console.log(`Generated events for plan ${plan.id} in ${currentView}:`, events.filter(e => 
                    e.id === plan.id || e.extendedProps?.originalId === plan.id
                ));
            });
            
            console.log('Sending events to calendar:', events);
            successCallback(events);
        } else {
            failureCallback(new Error('계획을 불러오는데 실패했습니다.'));
        }
    } catch (error) {
        console.error('이벤트 로드 실패:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        failureCallback(error);
    }
}

// 계획 타입별 색상 반환
function getPlanColor(type, status) {
    if (status === 'completed') return '#6c757d';
    if (status === 'cancelled') return '#dc3545';
    
    switch (type) {
        case 'daily': return '#007bff';
        case 'weekly': return '#28a745';
        case 'monthly': return '#ffc107';
        default: return '#6c757d';
    }
}

function getPlanBorderColor(type) {
    switch (type) {
        case 'daily': return '#0056b3';
        case 'weekly': return '#1e7e34';
        case 'monthly': return '#e0a800';
        default: return '#495057';
    }
}

function getPlanTextColor(type) {
    return type === 'monthly' ? '#212529' : '#ffffff';
}

// 상태별 프리픽스
function getStatusPrefix(status) {
    switch (status) {
        case 'completed': return '✅';
        case 'cancelled': return '❌';
        case 'planned': 
        default: return '📅';
    }
}

// 상태별 색상
function getStatusColor(status, useActualTime) {
    switch (status) {
        case 'completed': return '#28a745'; // 완료 = 초록
        case 'cancelled': return '#6c757d'; // 취소 = 회색
        case 'planned':
        default: 
            if (useActualTime) {
                return '#007bff'; // 계획됨이지만 실제시간 있음 = 파랑
            } else {
                return 'rgba(0, 123, 255, 0.3)'; // 계획됨 = 연한 파랑
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
                return '#ffffff'; // 실제시간이 있으면 흰 글씨
            } else {
                return '#007bff'; // 계획만 있으면 파란 글씨
            }
    }
}

function getStatusClasses(status) {
    const baseClasses = ['plan-event'];
    if (status === 'cancelled') {
        baseClasses.push('cancelled-event');
    }
    return baseClasses;
}

// 이벤트 드롭 처리
async function handleEventDrop(info) {
    let planId = info.event.id;
    const eventId = planId;
    let isActualEvent = false;
    
    // planned-xxx 또는 actual-xxx 형태의 ID에서 원본 ID 추출
    if (planId.startsWith('planned-') || planId.startsWith('actual-')) {
        isActualEvent = planId.startsWith('actual-');
        planId = info.event.extendedProps.originalId;
    }
    
    // 로컬 시간으로 직접 추출
    const startDate = info.event.start;
    const endDate = info.event.end;
    
    // 로컬 날짜/시간으로 추출
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const newDate = `${year}-${month}-${day}`;
    
    const newStartTime = String(startDate.getHours()).padStart(2, '0') + ':' + 
                        String(startDate.getMinutes()).padStart(2, '0');
    const newEndTime = endDate ? 
                      String(endDate.getHours()).padStart(2, '0') + ':' + 
                      String(endDate.getMinutes()).padStart(2, '0') : null;
    
    console.log(`Drag update - Event type: ${isActualEvent ? 'actual' : 'planned'}, ID: ${eventId} -> ${planId}`);
    console.log(`New times: ${newDate} ${newStartTime} - ${newEndTime}`);
    
    try {
        let updateData = { plan_date: newDate };
        
        if (isActualEvent) {
            // 실제 이벤트 드래그 시 actual_start_time, actual_end_time 업데이트
            updateData.actual_start_time = newStartTime;
            updateData.actual_end_time = newEndTime;
        } else {
            // 계획 이벤트 드래그 시 start_time, end_time 업데이트
            updateData.start_time = newStartTime;
            updateData.end_time = newEndTime;
        }
        
        await API.plans.update(planId, updateData);
        
        Utils.showSuccess(`${isActualEvent ? '실제' : '계획'} 시간이 변경되었습니다.`);
        
        // 캘린더 새로고침하여 변경사항 반영
        calendar.refetchEvents();
        
    } catch (error) {
        console.error('계획 이동 실패:', error);
        Utils.showError('계획 이동에 실패했습니다.');
        info.revert();
    }
}

// 이벤트 리사이즈 처리
async function handleEventResize(info) {
    let planId = info.event.id;
    const eventId = planId;
    let isActualEvent = false;
    
    // planned-xxx 또는 actual-xxx 형태의 ID에서 원본 ID 추출
    if (planId.startsWith('planned-') || planId.startsWith('actual-')) {
        isActualEvent = planId.startsWith('actual-');
        planId = info.event.extendedProps.originalId;
    }
    
    const endDate = info.event.end;
    const newEndTime = endDate ? 
                      String(endDate.getHours()).padStart(2, '0') + ':' + 
                      String(endDate.getMinutes()).padStart(2, '0') : null;
    
    console.log(`Resize update - Event type: ${isActualEvent ? 'actual' : 'planned'}, ID: ${eventId} -> ${planId}`);
    console.log(`New end time: ${newEndTime}`);
    
    try {
        let updateData = {};
        
        if (isActualEvent) {
            // 실제 이벤트 리사이즈 시 actual_end_time 업데이트
            updateData.actual_end_time = newEndTime;
        } else {
            // 계획 이벤트 리사이즈 시 end_time 업데이트
            updateData.end_time = newEndTime;
        }
        
        await API.plans.update(planId, updateData);
        
        Utils.showSuccess(`${isActualEvent ? '실제' : '계획'} 시간이 수정되었습니다.`);
        
        // 캘린더 새로고침하여 변경사항 반영
        calendar.refetchEvents();
        
    } catch (error) {
        console.error('계획 시간 수정 실패:', error);
        Utils.showError('계획 시간 수정에 실패했습니다.');
        info.revert();
    }
}

// 컨텍스트 메뉴 표시
function showContextMenu(event, calendarEvent) {
    // 기존 컨텍스트 메뉴 제거
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" data-action="edit">수정</div>
        <div class="context-menu-item" data-action="copy">복사</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete">삭제</div>
    `;
    
    // 메뉴 위치 설정
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    
    document.body.appendChild(menu);
    
    // 메뉴 항목 클릭 이벤트
    menu.addEventListener('click', function(e) {
        const action = e.target.getAttribute('data-action');
        let planId = calendarEvent.id;
        
        // planned-xxx 또는 actual-xxx 형태의 ID에서 원본 ID 추출
        if (planId.startsWith('planned-') || planId.startsWith('actual-')) {
            planId = calendarEvent.extendedProps.originalId;
        }
        
        switch (action) {
            case 'edit':
                openPlanModal(planId);
                break;
            case 'copy':
                openMultiCopyModal(planId);
                break;
            case 'delete':
                deletePlan(planId);
                break;
        }
        
        menu.remove();
    });
    
    // 외부 클릭시 메뉴 숨기기
    setTimeout(() => {
        document.addEventListener('click', function hideMenu() {
            menu.remove();
            document.removeEventListener('click', hideMenu);
        });
    }, 100);
}

// 주별 계획을 날짜 범위로 로드
async function loadWeeklyPlanByRange(weekStart, weekEnd) {
    try {
        // 모든 주별 계획을 가져와서 클라이언트에서 필터링
        const result = await API.plans.getAll({ type: 'weekly' });
        
        if (result.success) {
            // 해당 주 기간에 포함되는 계획 찾기
            const filteredPlans = result.plans.filter(plan => {
                const planDate = plan.plan_date;
                return planDate >= weekStart && planDate <= weekEnd;
            });
            
            return { success: true, plans: filteredPlans };
        }
        
        return result;
    } catch (error) {
        console.error('주별 계획 로드 실패:', error);
        return { success: false, plans: [] };
    }
}

// 주별/월별 계획 로드 및 표시
async function loadWeeklyMonthlyPlans(dateStr) {
    const selectedDate = new Date(dateStr);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1; // 0-based to 1-based
    
    // 주차 계산 (해당 주의 월요일)
    const dayOfWeek = selectedDate.getDay();
    const mondayDate = new Date(selectedDate);
    mondayDate.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const weekStart = mondayDate.toISOString().split('T')[0];
    const weekEnd = new Date(mondayDate);
    weekEnd.setDate(mondayDate.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    console.log(`Loading plans for week: ${weekStart} to ${weekEndStr}`);
    console.log(`Loading plans for month: ${year}-${month.toString().padStart(2, '0')}`);
    
    try {
        // 주별 계획 로드 - 해당 주 기간에 속하는 계획 찾기
        const weeklyResult = await loadWeeklyPlanByRange(weekStart, weekEndStr);
        
        // 월별 계획 로드  
        const monthlyResult = await API.plans.getAll({
            type: 'monthly',
            date: `${year}-${month.toString().padStart(2, '0')}`
        });
        
        // 주별 계획 표시
        displayWeeklyPlan(weeklyResult, weekStart, weekEndStr);
        
        // 월별 계획 표시
        displayMonthlyPlan(monthlyResult, year, month);
        
    } catch (error) {
        console.error('주별/월별 계획 로드 실패:', error);
        Utils.showError('계획을 불러오는데 실패했습니다.');
    }
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

// 주별 계획 표시
function displayWeeklyPlan(result, weekStart, weekEnd) {
    const titleElement = document.getElementById('weeklyPlanTitle');
    const contentElement = document.getElementById('weeklyPlanContent');
    
    titleElement.textContent = `주별 계획 (${weekStart} ~ ${weekEnd})`;
    
    if (result.success && result.plans.length > 0) {
        const plan = result.plans[0];
        const planItems = formatPlanItems(plan.description);
        contentElement.innerHTML = `<div class="plan-items">${planItems}</div>`;
        
        // 편집 버튼에 계획 ID와 날짜 저장
        document.getElementById('editWeeklyPlanBtn').setAttribute('data-plan-id', plan.id);
        document.getElementById('editWeeklyPlanBtn').setAttribute('data-week-start', weekStart);
        document.getElementById('editWeeklyPlanBtn').textContent = '편집';
    } else {
        contentElement.innerHTML = '<p class="text-muted">선택한 주의 계획이 없습니다.</p>';
        document.getElementById('editWeeklyPlanBtn').removeAttribute('data-plan-id');
        document.getElementById('editWeeklyPlanBtn').setAttribute('data-week-start', weekStart);
        document.getElementById('editWeeklyPlanBtn').textContent = '새 계획';
    }
}

// 월별 계획 표시
function displayMonthlyPlan(result, year, month) {
    const titleElement = document.getElementById('monthlyPlanTitle');
    const contentElement = document.getElementById('monthlyPlanContent');
    
    titleElement.textContent = `월별 계획 (${year}년 ${month}월)`;
    
    if (result.success && result.plans.length > 0) {
        const plan = result.plans[0];
        const planItems = formatPlanItems(plan.description);
        contentElement.innerHTML = `<div class="plan-items">${planItems}</div>`;
        
        // 편집 버튼에 계획 ID와 날짜 저장
        const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
        document.getElementById('editMonthlyPlanBtn').setAttribute('data-plan-id', plan.id);
        document.getElementById('editMonthlyPlanBtn').setAttribute('data-month-start', monthStart);
        document.getElementById('editMonthlyPlanBtn').textContent = '편집';
    } else {
        contentElement.innerHTML = '<p class="text-muted">선택한 월의 계획이 없습니다.</p>';
        const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
        document.getElementById('editMonthlyPlanBtn').removeAttribute('data-plan-id');
        document.getElementById('editMonthlyPlanBtn').setAttribute('data-month-start', monthStart);
        document.getElementById('editMonthlyPlanBtn').textContent = '새 계획';
    }
}

// 캘린더 새로고침
function refreshCalendar() {
    if (calendar) {
        calendar.refetchEvents();
        Utils.showInfo('캘린더가 새로고침되었습니다.');
    }
}

// 뷰 변경
function changeView(view) {
    currentView = view;
    
    // 네비게이션 활성화 상태 변경
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // 캘린더 새로고침
    refreshCalendar();
    
    // 팀원 필터 표시/숨김
    const teamMemberFilter = document.getElementById('teamMemberFilter');
    if (view === 'team' || view === 'all') {
        teamMemberFilter.classList.remove('d-none');
        loadTeamMembers();
    } else {
        teamMemberFilter.classList.add('d-none');
    }
}

// 팀원 목록 로드
async function loadTeamMembers() {
    if (!Auth.currentUser.team_id) return;
    
    try {
        const result = await API.teams.getMembers(Auth.currentUser.team_id);
        const memberList = document.getElementById('teamMemberList');
        
        if (result.success) {
            memberList.innerHTML = result.members.map(member => `
                <div class="form-check">
                    <input class="form-check-input member-filter" 
                           type="checkbox" 
                           id="member_${member.id}" 
                           value="${member.id}" 
                           checked>
                    <label class="form-check-label" for="member_${member.id}">
                        ${member.name} (${Utils.getStatusText(member.role)})
                    </label>
                </div>
            `).join('');
            
            // 필터 변경 이벤트
            memberList.querySelectorAll('.member-filter').forEach(checkbox => {
                checkbox.addEventListener('change', refreshCalendar);
            });
        }
    } catch (error) {
        console.error('팀원 목록 로드 실패:', error);
    }
}

// 시간 범위 동적 조정
function adjustTimeRange(events) {
    console.log('=== Time Range Adjustment ===');
    console.log('Current view:', calendar.view.type);
    console.log('Total events received:', events.length);
    
    // 시간 뷰가 아니면 조정하지 않음
    const currentView = calendar.view.type;
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
        console.log('No timed events, using default range 07:00-21:00');
        calendar.setOption('slotMinTime', '07:00:00');
        calendar.setOption('slotMaxTime', '21:00:00');
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
        console.log(`  Raw start:`, event.start);
        console.log(`  Raw end:`, event.end);
        
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
    
    console.log(`Setting time range: ${newMinTime} - ${newMaxTime}`);
    
    // Try setting options with a slight delay to ensure calendar is ready
    setTimeout(() => {
        console.log('Applying time range options...');
        calendar.setOption('slotMinTime', newMinTime);
        calendar.setOption('slotMaxTime', newMaxTime);
        
        // Verify the options were set
        console.log('Verification - slotMinTime:', calendar.getOption('slotMinTime'));
        console.log('Verification - slotMaxTime:', calendar.getOption('slotMaxTime'));
        
        // Force calendar refresh
        console.log('Forcing calendar refresh');
        calendar.render();
    }, 100);
    
    console.log('=== Time Range Adjustment Complete ===');
}

// 주말 표시 조정 함수
function adjustWeekendDisplay(events) {
    console.log('=== Weekend Display Adjustment ===');
    
    if (!hideEmptyWeekends) {
        console.log('Auto-hide weekends disabled, showing all days');
        calendar.setOption('weekends', true);
        return;
    }
    
    const currentViewType = calendar.view.type;
    console.log('Current view type:', currentViewType);
    
    // 월별 뷰에서는 주말 숨김 적용하지 않음
    if (currentViewType === 'dayGridMonth') {
        console.log('Month view detected, keeping weekends visible');
        calendar.setOption('weekends', true);
        return;
    }
    
    // 주별/일별 뷰에서만 적용
    if (!currentViewType.includes('timeGrid') && currentViewType !== 'listWeek') {
        console.log('Not a week/day view, keeping weekends visible');
        calendar.setOption('weekends', true);
        return;
    }
    
    // 현재 보이는 날짜 범위 가져오기
    const view = calendar.view;
    const startDate = view.currentStart;
    const endDate = view.currentEnd;
    
    console.log(`Checking date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
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
                    console.log(`Weekend event found: ${event.title} on ${eventDate.toDateString()}`);
                }
            }
        }
    });
    
    console.log(`Has weekend events: ${hasWeekendEvents}`);
    
    // 주말 이벤트가 없으면 주말 숨김
    const shouldShowWeekends = hasWeekendEvents;
    calendar.setOption('weekends', shouldShowWeekends);
    
    console.log(`Setting weekends visibility: ${shouldShowWeekends}`);
    console.log('=== Weekend Display Adjustment Complete ===');
}


// 날짜 더블클릭 처리 (일별 계획 생성/편집)
async function handleDateDoubleClick(dateStr, forceNew = false, timeInfo = null) {
    try {
        console.log(`날짜 더블클릭: ${dateStr}, forceNew: ${forceNew}, timeInfo:`, timeInfo);
        
        if (forceNew) {
            // 강제로 새 계획 생성 (빈 공간 클릭 시)
            console.log(`새 일별 계획 생성 (강제): ${dateStr}`);
            openPlanModal(null, dateStr, timeInfo);
            return;
        }
        
        // 해당 날짜에 기존 일별 계획이 있는지 확인
        const result = await API.plans.getAll({
            date: dateStr,
            type: 'daily'
        });
        
        if (result.success && result.plans.length > 0) {
            // 기존 계획이 있으면 첫 번째 계획 편집
            const existingPlan = result.plans[0];
            console.log(`기존 일별 계획 편집: ${existingPlan.id}`);
            openPlanModal(existingPlan.id);
        } else {
            // 기존 계획이 없으면 새 일별 계획 생성
            console.log(`새 일별 계획 생성: ${dateStr}`);
            openPlanModal(null, dateStr, timeInfo);
        }
    } catch (error) {
        console.error('날짜 더블클릭 처리 실패:', error);
        Utils.showError('계획을 불러오는데 실패했습니다.');
    }
}