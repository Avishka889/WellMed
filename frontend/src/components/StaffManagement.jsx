import { useState } from 'react';
import DoctorManagement from './DoctorManagement';
import NurseManagement from './NurseManagement';

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState('doctors');

  return (
    <div className="fade-in">
      <div style={{
        display:'flex', 
        marginBottom:'2rem', 
        background:'#f8fafc', 
        padding:'0.8rem', 
        borderRadius:'20px', 
        width: '100%',
        gap: '0.8rem',
        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.03), 0 4px 6px -1px rgba(0,0,0,0.05)'
      }}>
        <button 
          onClick={() => setActiveTab('doctors')}
          style={{
            flex: 1,
            background: activeTab === 'doctors' ? 'var(--primary-cyan)' : 'transparent',
            color: activeTab === 'doctors' ? 'white' : '#64748b',
            border: 'none',
            padding: '1.2rem 2rem',
            borderRadius: '14px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '1.25rem',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            boxShadow: activeTab === 'doctors' ? '0 8px 16px -4px rgba(6, 182, 212, 0.4)' : 'none',
            outline: 'none',
            transform: activeTab === 'doctors' ? 'scale(1.02)' : 'scale(1)'
          }}
        >
          <span style={{fontSize: '1.6rem'}}>👨‍⚕️</span> Doctors
        </button>
        <button 
          onClick={() => setActiveTab('staff')}
          style={{
            flex: 1,
            background: activeTab === 'staff' ? 'var(--primary-cyan)' : 'transparent',
            color: activeTab === 'staff' ? 'white' : '#64748b',
            border: 'none',
            padding: '1.2rem 2rem',
            borderRadius: '14px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '1.25rem',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            boxShadow: activeTab === 'staff' ? '0 8px 16px -4px rgba(6, 182, 212, 0.4)' : 'none',
            outline: 'none',
            transform: activeTab === 'staff' ? 'scale(1.02)' : 'scale(1)'
          }}
        >
          <span style={{fontSize: '1.6rem'}}>👩‍⚕️</span> Nurses & Other Staff
        </button>
      </div>

      <div>
        {activeTab === 'doctors' ? <DoctorManagement /> : <NurseManagement />}
      </div>
    </div>
  );
}
