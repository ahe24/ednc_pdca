# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the ED&C PDCA web service project - a PDCA (Plan-Do-Check-Action) management system for company members. The system is designed to track and manage individual, team, and company-wide work planning and execution with a mobile-friendly web interface.

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite
- **Frontend**: HTML5 + Tailwind CSS + Vanilla JavaScript
- **UI Framework**: Bootstrap 5 (responsive design)
- **Process Manager**: PM2
- **Calendar Library**: FullCalendar.js
- **Localization**: Korean (ko-KR), Seoul timezone (Asia/Seoul)
- **Authentication**: JWT with httpOnly cookies (1 month session)
- **File Storage**: Local server storage (images, documents under 1MB)

## Architecture

The system follows a traditional 3-tier architecture:
- **Frontend** (Static files served on port 3000)
- **Backend** (Express.js API server on port 3001)
- **Database** (SQLite file-based database)

## Project Structure

Based on the system design document, the expected directory structure is:

```
pdca-system/
├── .env                    # Environment configuration
├── package.json
├── ecosystem.config.js     # PM2 configuration
├── backend/
│   ├── server.js          # Main server file
│   ├── routes/            # API route handlers
│   ├── models/            # Database models
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
├── frontend/
│   ├── index.html         # Main dashboard
│   ├── login.html         # Login page
│   ├── css/              # Custom styles
│   ├── js/               # Client-side JavaScript
│   └── assets/           # Static assets
└── database/
    └── pdca.db           # SQLite database file
```

## Key Features

1. **PDCA Management**: Plan-Do-Check-Action workflow for task management
2. **Multi-level Planning**: Daily, weekly, and monthly planning support
3. **Team Management**: Role-based access (member, manager, admin)
4. **Calendar Integration**: FullCalendar.js with Korean localization
5. **Mobile-First Design**: Bootstrap 5 responsive layout
6. **Drag & Drop**: Plan copying and moving functionality

## Database Schema

The system uses four main tables:
- `users`: User management with roles and team assignments
- `teams`: Team organization structure
- `plans`: Core planning data with PDCA workflow
- `pdca_records`: Detailed PDCA execution records

## Development Commands

Repository: https://github.com/ahe24/ednc_pdca.git

```bash
# Install dependencies
npm install

# Initialize database
node backend/models/database.js

# Development mode with hot reload
npm run dev

# Start with PM2
pm2 start ecosystem.config.js

# Production deployment
pm2 restart all

# Development database
# Uses separate SQLite file for development environment
```

## API Structure

The REST API follows these patterns:
- Authentication: `/api/auth/*`
- Plans: `/api/plans/*`
- PDCA Records: `/api/pdca/*`
- Users/Teams: `/api/users/*`, `/api/teams/*`

## Localization

All UI elements use Korean language with Seoul timezone (Asia/Seoul). FullCalendar is configured for Korean locale with appropriate month names, day names, and button text.

## Security Features

- JWT token-based authentication
- Role-based access control (member/manager/admin)
- bcrypt password hashing
- SQL injection prevention
- Input validation and sanitization

## Implementation Specifications

### Technical Decisions
- **CSS Framework**: Tailwind CSS for utility-first styling
- **Authentication**: JWT stored in httpOnly cookies, 1-month session duration
- **File Uploads**: Support images/documents under 1MB, stored on server
- **Data Validation**: Use express-validator for server-side validation
- **Error Handling**: PM2 for logging and process management
- **Development**: Hot reload with nodemon for development

### Feature Scope
- **Calendar Integration**: Simple export/import if feasible (not priority)
- **Notifications**: No email/push notifications required
- **Reports**: Weekly report page showing current week tasks and next week plans (copy-paste friendly format)
- **Mobile**: PWA features for user-friendliness, no offline functionality needed
- **Deployment**: HTTP only (no HTTPS), manual deployment process

### Database Management
- **Development**: Separate SQLite file for development
- **Backup**: Admin-controlled database file import/export functionality
- **Migration**: Manual database migration process

## Development Notes

- Frontend uses vanilla JavaScript (no frameworks like React/Vue)
- Mobile-first responsive design approach with Bootstrap 5 + Tailwind CSS
- Korean language UI with proper formatting for dates/times
- Drag & drop functionality supports both moving and copying plans
- Context menus for plan management operations
- Focus on simplicity and user-friendliness over complex features