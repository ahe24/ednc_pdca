class AdminManager {
    constructor() {
        this.currentSection = 'teams';
        this.teams = [];
        this.users = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
    }

    bindEvents() {
        // 사이드바 메뉴 클릭
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(e.target.dataset.section);
            });
        });

        // 팀 관련 이벤트
        document.getElementById('addTeamBtn').addEventListener('click', () => this.showTeamModal());
        document.getElementById('saveTeamBtn').addEventListener('click', () => this.saveTeam());

        // 사용자 관련 이벤트
        document.getElementById('addUserBtn').addEventListener('click', () => this.showUserModal());
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());

        // 등록 폼 이벤트
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
    }

    async loadInitialData() {
        await this.loadTeams();
        await this.loadUsers();
        await this.loadStats();
        this.populateTeamSelects();
    }

    switchSection(section) {
        // 사이드바 활성화 상태 변경
        document.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // 섹션 표시/숨김
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.add('d-none');
        });
        document.getElementById(`${section}Section`).classList.remove('d-none');

        this.currentSection = section;

        // 데이터 로드
        if (section === 'teams') {
            this.loadTeams();
        } else if (section === 'users') {
            this.loadUsers();
        } else if (section === 'stats') {
            this.loadStats();
        }
    }

    async loadTeams() {
        try {
            const response = await API.get('/api/teams');
            if (response.success) {
                this.teams = response.teams;
                this.renderTeamsTable();
            }
        } catch (error) {
            console.error('팀 목록 로드 실패:', error);
            alert('팀 목록을 불러오는데 실패했습니다.');
        }
    }

    async loadUsers() {
        try {
            const response = await API.get('/api/users');
            if (response.success) {
                this.users = response.users;
                this.renderUsersTable();
            }
        } catch (error) {
            console.error('사용자 목록 로드 실패:', error);
            alert('사용자 목록을 불러오는데 실패했습니다.');
        }
    }

    async loadStats() {
        try {
            const response = await API.get('/api/users/admin/stats');
            if (response.success) {
                this.renderStats(response.stats);
            }
        } catch (error) {
            console.error('통계 로드 실패:', error);
            // 통계 로드 실패는 에러를 표시하지 않고 기본값 유지
        }
    }

    renderTeamsTable() {
        const tbody = document.getElementById('teamsTableBody');
        tbody.innerHTML = '';

        this.teams.forEach(team => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${team.name}</td>
                <td>${team.description || '-'}</td>
                <td>${team.member_count || 0}</td>
                <td>${new Date(team.created_at).toLocaleDateString('ko-KR')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="admin.editTeam(${team.id})">
                        수정
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="admin.deleteTeam(${team.id})">
                        삭제
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        this.users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.name}</td>
                <td>${user.email || '-'}</td>
                <td>
                    <span class="badge bg-${this.getRoleBadgeColor(user.role)}">
                        ${this.getRoleDisplayName(user.role)}
                    </span>
                </td>
                <td>${user.team_name || '-'}</td>
                <td>${new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="admin.editUser(${user.id})">
                        수정
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="admin.deleteUser(${user.id})">
                        삭제
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalTeams').textContent = stats.totalTeams || 0;
        document.getElementById('totalPlans').textContent = stats.totalPlans || 0;
        document.getElementById('activeUsers').textContent = stats.activeUsers || 0;
    }

    getRoleBadgeColor(role) {
        const colors = {
            'admin': 'danger',
            'manager': 'warning',
            'member': 'primary'
        };
        return colors[role] || 'secondary';
    }

    getRoleDisplayName(role) {
        const names = {
            'admin': '관리자',
            'manager': '매니저',
            'member': '멤버'
        };
        return names[role] || role;
    }

    populateTeamSelects() {
        const selects = ['regTeam', 'userTeam'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            // 기존 옵션 제거 (첫 번째 기본 옵션 제외)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            this.teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name;
                select.appendChild(option);
            });
        });
    }

    // 팀 관리 메서드
    showTeamModal(teamId = null) {
        const modal = new bootstrap.Modal(document.getElementById('teamModal'));
        const title = document.getElementById('teamModalTitle');
        const form = document.getElementById('teamForm');
        
        form.reset();
        
        if (teamId) {
            const team = this.teams.find(t => t.id === teamId);
            if (team) {
                title.textContent = '팀 수정';
                document.getElementById('teamId').value = team.id;
                document.getElementById('teamName').value = team.name;
                document.getElementById('teamDescription').value = team.description || '';
            }
        } else {
            title.textContent = '팀 추가';
            document.getElementById('teamId').value = '';
        }
        
        modal.show();
    }

    async saveTeam() {
        const teamId = document.getElementById('teamId').value;
        const teamData = {
            name: document.getElementById('teamName').value,
            description: document.getElementById('teamDescription').value
        };

        try {
            let response;
            if (teamId) {
                response = await API.put(`/api/teams/${teamId}`, teamData);
            } else {
                response = await API.post('/api/teams', teamData);
            }

            if (response.success) {
                alert(teamId ? '팀이 수정되었습니다.' : '팀이 추가되었습니다.');
                bootstrap.Modal.getInstance(document.getElementById('teamModal')).hide();
                await this.loadTeams();
                this.populateTeamSelects();
            }
        } catch (error) {
            alert('오류가 발생했습니다: ' + error.message);
        }
    }

    editTeam(teamId) {
        this.showTeamModal(teamId);
    }

    async deleteTeam(teamId) {
        const team = this.teams.find(t => t.id === teamId);
        if (!team) return;

        if (!confirm(`정말로 '${team.name}' 팀을 삭제하시겠습니까?`)) return;

        try {
            const response = await API.delete(`/api/teams/${teamId}`);
            if (response.success) {
                alert('팀이 삭제되었습니다.');
                await this.loadTeams();
                this.populateTeamSelects();
            }
        } catch (error) {
            alert('오류가 발생했습니다: ' + error.message);
        }
    }

    // 사용자 관리 메서드
    showUserModal(userId = null) {
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        const title = document.getElementById('userModalTitle');
        const form = document.getElementById('userForm');
        const passwordField = document.getElementById('passwordField');
        
        form.reset();
        
        if (userId) {
            const user = this.users.find(u => u.id === userId);
            if (user) {
                title.textContent = '사용자 수정';
                document.getElementById('userId').value = user.id;
                document.getElementById('userUsername').value = user.username;
                document.getElementById('userUsername').disabled = true;
                document.getElementById('userName').value = user.name;
                document.getElementById('userEmail').value = user.email || '';
                document.getElementById('userRole').value = user.role;
                document.getElementById('userTeam').value = user.team_id || '';
                
                // 수정 모드에서는 비밀번호 필드 숨김
                passwordField.style.display = 'none';
                document.getElementById('userPassword').required = false;
            }
        } else {
            title.textContent = '사용자 추가';
            document.getElementById('userId').value = '';
            document.getElementById('userUsername').disabled = false;
            passwordField.style.display = 'block';
            document.getElementById('userPassword').required = true;
        }
        
        modal.show();
    }

    async saveUser() {
        const userId = document.getElementById('userId').value;
        const userData = {
            username: document.getElementById('userUsername').value,
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value || null,
            role: document.getElementById('userRole').value,
            team_id: document.getElementById('userTeam').value || null
        };

        if (!userId) {
            userData.password = document.getElementById('userPassword').value;
        }

        try {
            let response;
            if (userId) {
                // 수정 시에는 username 제외
                const { username, ...updateData } = userData;
                response = await API.put(`/api/users/${userId}`, updateData);
            } else {
                response = await API.post('/api/users', userData);
            }

            if (response.success) {
                alert(userId ? '사용자가 수정되었습니다.' : '사용자가 추가되었습니다.');
                bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
                await this.loadUsers();
            }
        } catch (error) {
            alert('오류가 발생했습니다: ' + error.message);
        }
    }

    editUser(userId) {
        this.showUserModal(userId);
    }

    async deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (!confirm(`정말로 '${user.name}' 사용자를 삭제하시겠습니까?`)) return;

        try {
            const response = await API.delete(`/api/users/${userId}`);
            if (response.success) {
                alert('사용자가 삭제되었습니다.');
                await this.loadUsers();
            }
        } catch (error) {
            alert('오류가 발생했습니다: ' + error.message);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            username: formData.get('username'),
            password: formData.get('password'),
            name: formData.get('name'),
            email: formData.get('email') || null,
            role: formData.get('role'),
            team_id: formData.get('team_id') || null
        };

        try {
            const response = await API.post('/api/users', userData);
            if (response.success) {
                alert('사용자가 등록되었습니다.');
                e.target.reset();
                await this.loadUsers();
            }
        } catch (error) {
            alert('오류가 발생했습니다: ' + error.message);
        }
    }
}

// 전역 변수로 admin 인스턴스 생성
let admin;

document.addEventListener('DOMContentLoaded', function() {
    admin = new AdminManager();
});