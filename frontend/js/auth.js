// 인증 관련 기능
const Auth = {
    // 현재 사용자 정보
    currentUser: null,

    // 로그인 상태 확인
    isLoggedIn() {
        return this.currentUser !== null;
    },

    // 현재 사용자 정보 반환
    getCurrentUser() {
        return this.currentUser;
    },

    // 로그인 처리
    async handleLogin(event) {
        event.preventDefault();
        
        const loginBtn = document.getElementById('loginBtn');
        const loginText = document.getElementById('loginText');
        const loginSpinner = document.getElementById('loginSpinner');
        const errorAlert = document.getElementById('errorAlert');
        
        // 버튼 상태 변경
        loginBtn.disabled = true;
        loginText.textContent = '로그인 중...';
        loginSpinner.classList.remove('d-none');
        errorAlert.classList.add('d-none');

        const formData = new FormData(event.target);
        const credentials = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const result = await API.post('/api/auth/login', credentials);

            if (result.success) {
                Auth.currentUser = result.user;
                localStorage.setItem('user', JSON.stringify(result.user));
                
                // 짧은 지연 후 리다이렉트 (쿠키 설정 완료 대기)
                setTimeout(() => {
                    window.location.href = '/';
                }, 100);
            } else {
                throw new Error(result.error || '로그인에 실패했습니다.');
            }
        } catch (error) {
            console.error('로그인 오류:', error);
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
        } finally {
            // 버튼 상태 복원
            loginBtn.disabled = false;
            loginText.textContent = '로그인';
            loginSpinner.classList.add('d-none');
        }
    },

    // 로그아웃 처리
    async logout() {
        try {
            await API.post('/api/auth/logout', {});
        } catch (error) {
            console.error('로그아웃 오류:', error);
        } finally {
            this.currentUser = null;
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        }
    },

    // 현재 사용자 정보 로드
    async loadCurrentUser() {
        try {
            // 서버에서 최신 정보 확인
            const result = await API.get('/api/auth/me');
            if (result.success) {
                this.currentUser = result.user;
                localStorage.setItem('user', JSON.stringify(result.user));
                return this.currentUser;
            }
            
            // 인증 실패시 로그인 페이지로 리다이렉트
            throw new Error('인증이 필요합니다.');
            
        } catch (error) {
            // 인증 오류가 아닌 경우에만 로그 출력
            if (!error.message.includes('로그인이 필요합니다') && !error.message.includes('유효하지 않은 토큰')) {
                console.error('사용자 정보 로드 실패:', error);
            }
            this.currentUser = null;
            localStorage.removeItem('user');
            
            // 로그인 페이지, 회원가입 페이지가 아닌 경우에만 리다이렉트
            if (!window.location.pathname.includes('login.html') && 
                !window.location.pathname.includes('register.html')) {
                window.location.href = '/login.html';
            }
            return null;
        }
    },

    // 토큰 검증
    async verifyToken() {
        try {
            const result = await API.get('/api/auth/verify');
            return result.success && result.valid;
        } catch (error) {
            console.error('토큰 검증 실패:', error);
            return false;
        }
    },

    // 권한 확인
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    },

    // 관리자 권한 확인
    isAdmin() {
        return this.hasRole('admin');
    },

    // 팀장 권한 확인
    isManager() {
        return this.hasRole('manager') || this.isAdmin();
    },

    // 팀 접근 권한 확인
    canAccessTeam(teamId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        return this.currentUser.team_id === teamId;
    },

    // 프로필 모달 열기
    showProfile() {
        if (!this.currentUser) return;

        // 사용자 정보로 폼 채우기
        document.getElementById('profileUsername').value = this.currentUser.username;
        document.getElementById('profileName').value = this.currentUser.name || '';
        document.getElementById('profileEmail').value = this.currentUser.email || '';
        document.getElementById('profileTeam').value = this.currentUser.team_name || '소속 팀 없음';
        const roleTexts = { 'admin': '관리자', 'manager': '매니저', 'member': '팀원' };
        document.getElementById('profileRole').value = roleTexts[this.currentUser.role] || this.currentUser.role;

        // 비밀번호 필드 초기화
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        // 모달 열기
        const profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
        profileModal.show();
    },

    // 프로필 저장
    async saveProfile() {
        const saveBtn = document.getElementById('saveProfileBtn');
        const loading = Utils.showLoading(saveBtn, '저장 중...');

        try {
            // 기본 정보 업데이트
            const name = document.getElementById('profileName').value.trim();
            const email = document.getElementById('profileEmail').value.trim();

            if (!name) {
                throw new Error('이름을 입력해주세요.');
            }

            // 프로필 정보 업데이트
            await API.put('/api/auth/profile', { name, email });

            // 비밀번호 변경 처리
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (currentPassword || newPassword || confirmPassword) {
                if (!currentPassword) {
                    throw new Error('현재 비밀번호를 입력해주세요.');
                }
                if (!newPassword) {
                    throw new Error('새 비밀번호를 입력해주세요.');
                }
                if (newPassword !== confirmPassword) {
                    throw new Error('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
                }
                if (newPassword.length < 6) {
                    throw new Error('새 비밀번호는 최소 6자 이상이어야 합니다.');
                }

                await API.put('/api/auth/password', { currentPassword, newPassword });
            }

            // 사용자 정보 다시 로드
            await this.loadCurrentUser();

            // 사용자 이름 표시 업데이트
            const userNameDisplay = document.getElementById('userNameDisplay');
            if (userNameDisplay) {
                const teamName = this.currentUser.team_name ? `(${this.currentUser.team_name})` : '';
                userNameDisplay.textContent = `${this.currentUser.name}${teamName}`;
            }

            Utils.showSuccess('프로필이 성공적으로 저장되었습니다.');

            // 모달 닫기
            const profileModal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
            profileModal.hide();

        } catch (error) {
            console.error('프로필 저장 실패:', error);
            Utils.showError(error.message || '프로필 저장에 실패했습니다.');
        } finally {
            loading.hide();
        }
    }
};

// 페이지 로드시 인증 상태 확인
document.addEventListener('DOMContentLoaded', async function() {
    const currentPath = window.location.pathname;
    
    // 로그인 페이지나 회원가입 페이지인 경우
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
        return; // 아무것도 하지 않음
    }

    // 다른 페이지에서는 인증 확인
    try {
        await Auth.loadCurrentUser();
        
        if (Auth.isLoggedIn()) {
            // 사용자 정보 표시
            const userNameDisplay = document.getElementById('userNameDisplay');
            if (userNameDisplay) {
                const teamName = Auth.currentUser.team_name ? `(${Auth.currentUser.team_name})` : '';
                userNameDisplay.textContent = `${Auth.currentUser.name}${teamName}`;
            }

            // 권한별 메뉴 표시
            const teamNavItem = document.getElementById('teamNavItem');
            if (teamNavItem) {
                if (Auth.isAdmin()) {
                    // 관리자: "전체 캘린더" 텍스트로 표시
                    const teamNavLink = teamNavItem.querySelector('a');
                    if (teamNavLink) {
                        teamNavLink.textContent = '전체 캘린더';
                    }
                    teamNavItem.classList.remove('d-none');
                } else if (Auth.currentUser.team_id) {
                    // 일반 사용자: "팀 캘린더" 텍스트로 표시 (팀이 있는 경우만)
                    const teamNavLink = teamNavItem.querySelector('a');
                    if (teamNavLink) {
                        teamNavLink.textContent = '팀 캘린더';
                    }
                    teamNavItem.classList.remove('d-none');
                }
            }

            if (Auth.isAdmin()) {
                // 관리자 메뉴 표시
                const adminMenuItem = document.getElementById('adminMenuItem');
                if (adminMenuItem) {
                    adminMenuItem.classList.remove('d-none');
                }
            }

            // 로그아웃 버튼 이벤트 리스너
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    Auth.logout();
                });
            }

            // 프로필 버튼 이벤트 리스너
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) {
                profileBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    Auth.showProfile();
                });
            }

            // 프로필 저장 버튼 이벤트 리스너
            const saveProfileBtn = document.getElementById('saveProfileBtn');
            if (saveProfileBtn) {
                saveProfileBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    Auth.saveProfile();
                });
            }
        }
    } catch (error) {
        // 인증 오류가 아닌 경우에만 로그 출력
        if (!error.message.includes('로그인이 필요합니다') && !error.message.includes('유효하지 않은 토큰')) {
            console.error('Authentication error:', error);
        }
    }
});