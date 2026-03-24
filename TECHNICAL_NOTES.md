# CivicTrack Technical Notes

## 1. Application Objective
CivicTrack is a Flask-based civic issue management system where:
- Citizens submit complaints with category, location, and optional image.
- Government/admin users triage, assign, prioritize, and resolve complaints.
- Dashboards and analytics expose status, department load, and trend metrics.

Primary entry point:
- `app.py:11` (`create_app`)
- `app.py:66` (home-page live issue counters)

## 2. Core Data Model and Relationships
Database entities and key relationships are defined in:
- `models/models.py:7` (`User`)
- `models/models.py:53` (`Department`)
- `models/models.py:65` (`Complaint`)
- `models/models.py:112` (`Feedback`)

Important relationship logic:
- Reporter relation: `Complaint.user_id -> User.id` (`models/models.py:79`, `models/models.py:94`)
- Assignee relation: `Complaint.assigned_to -> User.id` (`models/models.py:82`, `models/models.py:100`)
- Department relation: `Complaint.department_id -> Department.id` (`models/models.py:84`, `models/models.py:106`)

## 3. Algorithms and Logic Used by Functionality

### 3.1 Complaint Submission and Department Assignment
Route:
- `routes/complaints.py:39` (`new_complaint`)

Algorithm:
- Rule-based category-to-department mapping using a dictionary.
- Lookup is done through:
  - `category_dept_map` at `routes/complaints.py:44`
  - `get(form.category.data, 'Emergency Services')` at `routes/complaints.py:55`

Impact:
- Every incoming complaint is auto-routed to a department by category.

### 3.2 Current Priority Assignment in Live Flow
Current behavior:
- Priority is hard-set to Medium during complaint creation:
  - `routes/complaints.py:67`

Meaning:
- The production complaint creation path is not yet invoking dynamic AI/keyword-based priority scoring.

### 3.3 User and Admin Dashboard Metrics
Citizen dashboard aggregation:
- `routes/complaints.py:20` (`dashboard`)
- Uses list-comprehension counting by status:
  - Pending: `routes/complaints.py:25`
  - In Progress: `routes/complaints.py:26`
  - Resolved: `routes/complaints.py:27`

Admin dashboard aggregation:
- `routes/admin.py:18` (`admin_dashboard`)
- Department-wise issue distribution via hash map counting:
  - init: `routes/admin.py:30`
  - increment: `routes/admin.py:33`
  - fill missing departments: `routes/admin.py:37`

### 3.4 Analytics Algorithms
Analytics route:
- `routes/admin.py:118` (`analytics`)

Algorithms:
1. Category distribution (group-by count)
   - `routes/admin.py:122`
2. Status distribution (group-by count)
   - `routes/admin.py:127`
3. Monthly trend (Python-side temporal bucketing)
   - init monthly buckets: `routes/admin.py:133`
   - increment counts: `routes/admin.py:136`
   - chronological sort: `routes/admin.py:138`
4. Department performance counts
   - `routes/admin.py:145`
5. Heatmap weighting from complaint priority
   - `routes/admin.py:156`
6. Resolution rate computation
   - `routes/admin.py:169`
7. Active citizens via unique complaint user ids
   - `routes/admin.py:170`
8. Average rating computation
   - `routes/admin.py:172`

Analytics API calculations:
- `routes/admin.py:188` (`analytics_api`)
- Avg resolution time in days:
  - list build: `routes/admin.py:196`
  - append per complaint: `routes/admin.py:200`
  - mean calculation: `routes/admin.py:202`
- Current-month category frequency map:
  - map init: `routes/admin.py:217`
  - increment: `routes/admin.py:221`

### 3.5 Admin Filtering and Department Distribution UI Algorithm
Template JS:
- `templates/admin_dashboard.html:378` (`filterTable`)

Algorithm:
- Normalize all filter values (dept/status/priority) for robust matching.
  - `templates/admin_dashboard.html:382`
  - `templates/admin_dashboard.html:383`
  - `templates/admin_dashboard.html:384`
- For each table row, apply multi-condition filter chain.
  - `templates/admin_dashboard.html:394`
  - `templates/admin_dashboard.html:395`
  - `templates/admin_dashboard.html:396`
- Recompute visible counts per department dynamically.
  - `templates/admin_dashboard.html:389`
  - `templates/admin_dashboard.html:409`
- Recompute percent share for department cards.
  - `templates/admin_dashboard.html:417`
- Show filtered summary text.
  - `templates/admin_dashboard.html:234`

### 3.6 Map and Geospatial UI Algorithms
Map controller class:
- `static/js/map.js:3` (`SmartCityMap`)

Algorithms/features:
1. Geocoding-based search and map fly-to
   - `searchLocation`: `static/js/map.js:213`
2. Auto fit bounds for visible complaint markers
   - `static/js/map.js:590`
3. Marker clustering (density reduction)
   - `static/js/map.js:717`
   - `L.markerClusterGroup`: `static/js/map.js:727`
4. Priority-weighted heatmap layer
   - `static/js/map.js:783`
   - `L.heatLayer`: `static/js/map.js:797`
5. Client-side marker filtering by category/status/priority
   - `static/js/map.js:815`
6. Filter result statistics update
   - `static/js/map.js:866`

### 3.7 Authentication and Navigation Logic
Authentication route logic:
- `routes/auth.py:24` (`login`)

Algorithms:
1. Safe endpoint fallback resolver
   - `routes/auth.py:11` (`safe_url_for`)
2. Role-based redirect strategy
   - in `login`: `routes/auth.py:28`, `routes/auth.py:42`
3. Secure password verification
   - `models/models.py:46`

Registration timestamps:
- Account creation stores system timestamp:
  - `routes/auth.py:69` (`created_at=datetime.now()`)

### 3.8 Password Security
- Password hashing: `models/models.py:44` (`generate_password_hash`)
- Password verification: `models/models.py:47` (`check_password_hash`)

## 4. Priority Calculation: Detailed Note

### 4.1 What is currently active
- New complaints are set to Medium priority in live route flow:
  - `routes/complaints.py:67`

### 4.2 Rule-based priority function available (not wired in route)
- File: `utils/helpers.py:136`
- Uses keyword buckets by severity:
  - keyword table: `utils/helpers.py:141`
  - nested keyword scan: `utils/helpers.py:150`
  - default Medium fallback: `utils/helpers.py:155`

### 4.3 AI-assist priority function available (not wired in route)
- File: `utils/ai_classifier.py:187`
- Priority strategy:
  1. Detect urgent terms -> Critical (`utils/ai_classifier.py:201`)
  2. Apply category baseline priority (`utils/ai_classifier.py:207`)
  3. Elevate with high-risk words (`utils/ai_classifier.py:221`)

## 5. AI/ML Module in Repository
AI classifier class:
- `utils/ai_classifier.py:10` (`ComplaintClassifier`)

Implemented ML pipeline:
- TF-IDF vectorization: `utils/ai_classifier.py:91`
- Multinomial Naive Bayes classifier: `utils/ai_classifier.py:96`
- Predict probability confidence: `utils/ai_classifier.py:146`
- Keyword fallback classifier: `utils/ai_classifier.py:158`
- Retraining hook with feedback: `utils/ai_classifier.py:262`

Model artifact note:
- `models/classifier/README.txt:1` indicates where trained classifier artifacts are stored.

## 6. Validation and Input Control
Form validators (Flask-WTF/WTForms):
- Login and registration constraints: `routes/forms.py:7`, `routes/forms.py:13`, `routes/forms.py:22`
- Username/email uniqueness checks: `routes/forms.py:26`, `routes/forms.py:32`
- Government ID validation for govt role: `routes/forms.py:38`
- Complaint form required fields and file type restriction: `routes/forms.py:49`, `routes/forms.py:59`, `routes/forms.py:63`

## 7. Utility Algorithms in Helpers
File: `utils/helpers.py`

Notable helper algorithms:
- Secure file extension checks: `utils/helpers.py:8`
- Collision-resistant filenames (timestamp + random token): `utils/helpers.py:15`
- Image resize/compression pipeline using PIL: `utils/helpers.py:22`
- Resolution time in days: `utils/helpers.py:70`
- Coordinate bounds validation: `utils/helpers.py:95`
- Percentage calculation with zero guard: `utils/helpers.py:110`
- Category color mapping: `utils/helpers.py:122`
- Sliding-window IP rate limiting:
  - `is_allowed`: `utils/helpers.py:221`
  - `get_remaining`: `utils/helpers.py:240`

## 8. Observations and Gaps
1. Priority currently does not use AI/rule functions in live complaint creation.
   - Active route: `routes/complaints.py:67`
   - Available implementations: `utils/helpers.py:136`, `utils/ai_classifier.py:187`

2. AI classifier is implemented but not integrated into route flow.
   - Core class: `utils/ai_classifier.py:10`
   - Runtime singleton: `utils/ai_classifier.py:280`

3. Some frontend dashboard JS has API endpoints that are not visible in current Flask routes.
   - Example calls in `static/js/dashboard.js:80`, `static/js/dashboard.js:95`

## 9. Recommended Next Integration Steps
1. Wire automatic category and priority assignment inside `new_complaint` route using `ComplaintClassifier`.
2. Replace hardcoded `priority='Medium'` with dynamic scoring output.
3. Add model-confidence logging and fallback tracing for auditability.
4. Add tests for:
   - department assignment mapping
   - priority scoring edge cases
   - analytics aggregation correctness
   - status transition and resolution-time calculations

## 10. Summary
The application already contains strong algorithmic foundations:
- Rule-based routing and filtering
- Time-series and distribution aggregations
- Geospatial clustering/heatmap rendering
- ML text classification pipeline with fallback logic

The main architectural gap is integration: AI/keyword priority logic exists but is not yet connected to live complaint submission.
