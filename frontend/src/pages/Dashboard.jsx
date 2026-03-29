import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PatientRegistration from '../components/PatientRegistration';
import ManageServices from '../components/ManageServices';
import DoctorManagement from '../components/DoctorManagement';
import StaffManagement from '../components/StaffManagement';
import AttendanceManagement from '../components/AttendanceManagement';
import OtherServices from '../components/OtherServices';
import '../index.css';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('wellmed_activeTab') || 'registration';
  });
  const [registrationKey, setRegistrationKey] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const handleTabClick = (tab) => {
    if (tab === 'registration' && activeTab === 'registration') {
      // If at the final receipt step (Step 4), disable the sidebar reset to prevent accidental loss
      if (currentStep === 4) {
        toast.error("Please finish the current visit before resetting.");
        return;
      }
      setRegistrationKey(prev => prev + 1);
      setCurrentStep(1);
    }
    setActiveTab(tab);
    localStorage.setItem('wellmed_activeTab', tab);
  };

  useEffect(() => {
    // onAuthStateChanged waits for Firebase to check local storage properly
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Successfully logged out.", { id: 'logout' });
      navigate('/');
    } catch (err) {
      toast.error("Logout failed.");
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar no-print">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Logo" className="sidebar-logo" />
        </div>
        
        <div className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'registration' ? 'active' : ''}`}
            onClick={() => handleTabClick('registration')}
          >
            <span className="menu-icon">👥</span> OPD/Channelling
          </button>
          <button 
            className={`menu-item ${activeTab === 'other_services' ? 'active' : ''}`}
            onClick={() => handleTabClick('other_services')}
          >
            <span className="menu-icon">⚡</span> Other Services
          </button>
          <button 
            className={`menu-item ${activeTab === 'staff_management' ? 'active' : ''}`}
            onClick={() => handleTabClick('staff_management')}
          >
            <span className="menu-icon">👨‍⚕️</span> Staff Profiles
          </button>
          <button 
            className={`menu-item ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => handleTabClick('attendance')}
          >
            <span className="menu-icon">✅</span> Daily Attendance
          </button>
          <button 
            className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabClick('settings')}
          >
            <span className="menu-icon">⚙️</span> Manage Services
          </button>
        </div>
        
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="main-content dashboard-bg">
        <div className="brand-header-horizontal no-print">
          <img src="/logo.png" alt="WellMed" className="header-logo-large" />
          <div className="header-text-group">
            <h1 className="hospital-name-header">WELLMED SPECIALIST-LED CARE</h1>
            <p className="hospital-tagline">Specialized Medical & Diabetic Care Unit</p>
          </div>
        </div>

        <div className="tab-content">
          {activeTab === 'registration' && (
            <PatientRegistration 
              key={registrationKey} 
              onStepChange={(step) => setCurrentStep(step)} 
            />
          )}
          {activeTab === 'settings' && <ManageServices />}
          {activeTab === 'staff_management' && <StaffManagement />}
          {activeTab === 'attendance' && <AttendanceManagement />}
          {activeTab === 'other_services' && <OtherServices />}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
