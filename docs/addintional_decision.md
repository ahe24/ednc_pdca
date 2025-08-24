  Technical Decisions Needed:

  1. CSS Framework Choice
    - Tailwind CSS 

  2. Authentication Storage
  - JWT storage location : httpOnly cookies
  - Session persistence strategy : 1 month if lonin successfully
  
  3. File Upload Strategy
  - images, documents, etc. under 1MB. save to server 

  4. Error Handling & Logging
  - just will use by PM2

  5. Data Validation
  - just you choose, I don't know.

  Infrastructure Decisions:

  1. Development Environment
  - by github. https://github.com/ahe24/ednc_pdca.git
  - Development database : separate SQLite file
  - Hot reload strategy for development : you deicde

  2. Production Considerations
  - Nginx configuration details
  - HTTP only 
  - Database backup strategy : db file import/export by admin
  - Log rotation and monitoring : pm2 

  3. Deployment Process
  - CI/CD pipeline (if needed) : manual by me
  - Environment variable management : manual by me
  - Database migration strategy : manual by me

  Feature Scope Clarifications:

  1. Calendar Integrations
  - Export to external calendar : no yet, if simple can try
  - Import from external sources : no yet, if simple can try

  2. Notification System
  - Email notifications for deadlines? : No
  - In-app notifications? : No
  - Push notifications for mobile? : No

  3. Reporting Features
  - What specific reports/analytics needed? : weekly report to show this week tasks and next week plans
  - Export formats (PDF, Excel)? : no export, just make pretty report page in order to copy and paste to other document program.

  4. Mobile App
  - Progressive Web App (PWA) features : I don't care, just user friendly purpose any features.
  - Offline functionality scope? : no need offline function


   Answers :

  1. Member Registration Method: Should new members be registered by:
    - Admin manually creating accounts and assigning them to teams?
    - Self-registration with admin approval?
    - Both options available?
    my answer : Both

  2. Team Manager Assignment: Should each of the 4 teams (EDA, PADS, ADSK, MANAGE) have:
    - A designated team manager (promoted from members)?
    - Admin manage all teams directly?
    - Both admin and team managers can manage team members?
    my answer : Admin manage directly

  3. Default Team Setup: Should I automatically create the 4 teams (EDA, PADS, ADSK, MANAGE) during database initialization, or should admin create them manually?
    my answer : you create automatically. but admin can modify team in the future?
   
  4. Member Level Assignment: What member levels do you want besides the existing roles (member, manager, admin)? Or should admin just assign the role (member/manager) and team assignment?
    my answer : admin can assign the role.