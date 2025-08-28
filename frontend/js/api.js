// API 통신 관련 기능
const API = {
    // 기본 설정 - 환경 변수에서 백엔드 포트 설정
    baseURL: (() => {
        const host = window.location.hostname;
        const backendPort = window.CONFIG?.BACKEND_PORT || 3001;
        const url = `http://${host}:${backendPort}`;
        console.log('API.js loaded - baseURL:', url);
        return url;
    })(),
    
    // HTTP 요청 공통 함수
    async request(url, options = {}) {
        const config = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        const fullUrl = this.baseURL + url;
        console.log('API Request:', config.method || 'GET', fullUrl);

        try {
            const response = await fetch(fullUrl, config);
            console.log('API Response:', response.status, response.statusText);
            
            if (!response.ok && response.status !== 401) {
                console.error('API Error Response:', response);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                throw new Error(`Expected JSON but got: ${contentType || 'unknown'}`);
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP Error: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            // 401 오류가 아닌 경우에만 로그 출력
            if (!error.message.includes('로그인이 필요합니다') && !error.message.includes('유효하지 않은 토큰')) {
                console.error('API 요청 실패:', error);
            }
            throw error;
        }
    },

    // GET 요청
    async get(url, params = {}) {
        const searchParams = new URLSearchParams(params);
        const queryString = searchParams.toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        return this.request(fullUrl, { method: 'GET' });
    },

    // POST 요청
    async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // PUT 요청
    async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    // DELETE 요청
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    },

    // 계획 관련 API
    plans: {
        // 계획 목록 조회
        async getAll(filters = {}) {
            return API.get('/api/plans', filters);
        },

        // 특정 계획 조회
        async getById(id) {
            return API.get(`/api/plans/${id}`);
        },

        // 계획 생성
        async create(planData) {
            return API.post('/api/plans', planData);
        },

        // 계획 수정
        async update(id, planData) {
            return API.put(`/api/plans/${id}`, planData);
        },

        // 계획 삭제
        async delete(id) {
            return API.delete(`/api/plans/${id}`);
        },

        // 계획 복사
        async copy(id, copyData) {
            return API.post(`/api/plans/${id}/copy`, copyData);
        },

        // PDCA 기록 저장/수정
        async savePdca(planId, pdcaData) {
            return API.post(`/api/plans/${planId}/pdca`, pdcaData);
        },

        // PDCA 기록 조회
        async getPdca(planId) {
            return API.get(`/api/plans/${planId}/pdca`);
        }
    },

    // PDCA 관련 API
    pdca: {
        // PDCA 기록 생성/업데이트
        async createOrUpdate(planId, pdcaData) {
            return API.post(`/api/plans/${planId}/pdca`, pdcaData);
        },

        // PDCA 기록 조회
        async get(planId) {
            return API.get(`/api/plans/${planId}/pdca`);
        }
    },

    // 사용자 관련 API
    users: {
        // 전체 사용자 목록 (관리자만)
        async getAll() {
            return API.get('/api/users');
        },

        // 특정 사용자 정보
        async getById(id) {
            return API.get(`/api/users/${id}`);
        }
    },

    // 팀 관련 API
    teams: {
        // 팀 목록 조회
        async getAll() {
            return API.get('/api/teams');
        },

        // 팀 멤버 조회
        async getMembers(teamId) {
            return API.get(`/api/teams/${teamId}/members`);
        }
    }
};

// 유틸리티 함수들
const Utils = {
    // 날짜 포맷팅 (한국 로케일)
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Seoul'
        };
        
        return new Intl.DateTimeFormat('ko-KR', { ...defaultOptions, ...options })
            .format(new Date(date));
    },

    // 시간 포맷팅
    formatTime(time) {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        return `${hours}:${minutes}`;
    },

    // 날짜 범위 생성
    generateDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            dates.push(new Date(current).toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    },

    // 한국어 요일 이름
    getKoreanDayName(date) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[new Date(date).getDay()];
    },

    // 계획 타입 한국어 변환
    getPlanTypeText(type) {
        const types = {
            'daily': '일별 계획',
            'weekly': '주별 계획',
            'monthly': '월별 계획'
        };
        return types[type] || type;
    },

    // 상태 한국어 변환
    getStatusText(status) {
        const statuses = {
            'planned': '계획됨',
            'in_progress': '진행중',
            'completed': '완료',
            'cancelled': '취소됨',
            'admin': '관리자',
            'manager': '매니저',
            'member': '팀원'
        };
        return statuses[status] || status;
    },

    // 근무 형태 한국어 변환
    getWorkTypeText(workType) {
        const types = {
            'office': '내근',
            'field': '외근'
        };
        return types[workType] || workType;
    },

    // 성공 메시지 표시
    showSuccess(message) {
        this.showAlert(message, 'success');
    },

    // 에러 메시지 표시
    showError(message) {
        this.showAlert(message, 'danger');
    },

    // 정보 메시지 표시
    showInfo(message) {
        this.showAlert(message, 'info');
    },

    // 알림 표시
    showAlert(message, type = 'info') {
        // 기존 알림 제거
        const existingAlert = document.querySelector('.alert-floating');
        if (existingAlert) {
            existingAlert.remove();
        }

        // 새 알림 생성
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-floating position-fixed`;
        alert.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        alert.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white" aria-label="Close"></button>
            </div>
        `;

        // 문서에 추가
        document.body.appendChild(alert);

        // 닫기 버튼 이벤트
        const closeBtn = alert.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => alert.remove());

        // 자동 제거 (5초 후)
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    },

    // 로딩 표시
    showLoading(element, text = '로딩 중...') {
        const originalContent = element.innerHTML;
        element.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            ${text}
        `;
        element.disabled = true;
        
        return {
            hide: () => {
                element.innerHTML = originalContent;
                element.disabled = false;
            }
        };
    },

    // 확인 대화상자
    async confirm(message, title = '확인') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                            <button type="button" class="btn btn-primary confirm-btn">확인</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            
            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                bsModal.hide();
                resolve(true);
            });

            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
                resolve(false);
            });

            bsModal.show();
        });
    }
};