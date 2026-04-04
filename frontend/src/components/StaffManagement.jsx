import { useState } from 'react';
import DoctorManagement from './DoctorManagement';
import NurseManagement from './NurseManagement';

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState('doctors');

  return (
    <div className="registration-panel fade-in">
      <div style={{
        display:'flex', 
        margin:'0 auto 2rem auto', 
        background:'#f8fafc', 
        padding:'0.5rem', 
        borderRadius:'12px', 
        width: '100%',
        maxWidth: '400px',
        gap: '0.5rem',
        border: '1px solid #e2e8f0',
        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.02)'
      }}>
        <button 
          onClick={() => setActiveTab('doctors')}
          style={{
            flex: 1,
            background: activeTab === 'doctors' ? '#F4A261' : 'transparent',
            color: activeTab === 'doctors' ? 'white' : '#64748b',
            border: 'none',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeTab === 'doctors' ? '0 4px 10px rgba(244, 162, 97, 0.2)' : 'none',
            outline: 'none'
          }}
        >
          Doctors
        </button>
        <button 
          onClick={() => setActiveTab('staff')}
          style={{
            flex: 1,
            background: activeTab === 'staff' ? '#F4A261' : 'transparent',
            color: activeTab === 'staff' ? 'white' : '#64748b',
            border: 'none',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeTab === 'staff' ? '0 4px 10px rgba(244, 162, 97, 0.2)' : 'none',
            outline: 'none'
          }}
        >
          Nurses & Other Staff
        </button>
      </div>

      <div>
        {activeTab === 'doctors' ? <DoctorManagement /> : <NurseManagement />}
      </div>
    </div>
  );
}
