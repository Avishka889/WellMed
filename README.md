# 🏥 WellMed – Hospital Management System

WellMed is a modern, real-time hospital management system designed specifically to streamline front-desk, reception, and administrative workflows. The platform replaces traditional paper-based processes with an efficient, digital-first system that reduces patient wait times and enhances operational productivity.

---

## 🚀 Key Features

* **👤 Patient Registration & Profiles:** Seamless patient onboarding, digital intake forms, and profile management.
* **📅 Appointment Booking & Token Queue:** Real-time scheduling with structured token/queue handling for doctors.
* **💳 Billing & Automated Invoicing:** Dynamic billing calculations with instant PDF invoice generation.
* **👨‍⚕️ Doctor Directory & Availability:** Management of doctor schedules, availability, and specialty allocations.
* **📊 Administrative Report Generation:** Real-time reports and analytics for operational decision-making.
* **🔒 Secure Authentication:** Role-based access control and secure database rules powered by Firebase.

---

## 🛠 Tech Stack

- **Frontend:** React.js (Vite), React Router, Custom CSS
- **Backend & Database:** Firebase Authentication, Cloud Firestore (Real-time Database)
- **Document Generation:** Puppeteer (for generating print-ready invoices and reports)
- **Deployment:** Firebase Hosting

---

## 📂 Project Structure

```text
WellMed/
├── frontend/
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── assets/          # Images, logos, SVG files
│   │   ├── components/      # Reusable UI components (Patient Registration, Billing, etc.)
│   │   ├── pages/           # Page-level components
│   │   ├── firebase.js      # Firebase configuration & initialization
│   │   ├── App.jsx          # Main App routing & entry point
│   │   └── index.css        # Core stylesheet & UI styling system
│   ├── .env                 # Local environment variables (git-ignored)
│   ├── firebase.json        # Firebase hosting & service configurations
│   ├── vite.config.js       # Vite configuration
│   └── package.json         # Dependencies & scripts
└── README.md                # Project documentation
```

---

## ⚙️ Getting Started & Setup

Follow these steps to run the project locally on your machine:

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v16+ recommended)
* npm (comes with Node.js)

### 2. Clone the Repository
```bash
git clone https://github.com/Avishka889/WellMed.git
cd WellMed
```

### 3. Install Dependencies
Navigate to the `frontend` directory and install the required npm packages:
```bash
cd frontend
npm install
```

### 4. Setup Environment Variables
Create a `.env` file in the `frontend` root directory and add your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

VITE_OWNER_EMAIL=your_admin_email
VITE_STAFF_EMAIL=your_staff_email
```
> ⚠️ **Note:** Do not commit the `.env` file to your GitHub repository. It has already been added to the `.gitignore` to protect sensitive database credentials.

### 5. Run the Application
Start the local development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### 6. Build for Production
To build a optimized production bundle, run:
```bash
npm run build
```

---

## 🔒 Security & Database Rules
The database is secured using Firebase Security Rules, restricting read/write access to authenticated receptionists and admins only, ensuring patient medical data remains confidential.
