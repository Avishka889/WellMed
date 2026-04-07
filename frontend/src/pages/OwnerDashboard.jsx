import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PaymentManagement from '../components/PaymentManagement';
import AttendanceManagement from '../components/AttendanceManagement';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const [stats, setStats] = useState({
    todayRev: 0,
    monthRev: 0,
    todayPatients: 0,
    monthPatients: 0,
    opdCount: 0,
    chanCount: 0,
    procCount: 0,
    opdRevenueToday: 0,
    chanRevenueToday: 0,
    procRevenueToday: 0,
    activeDoctors: [],
    activeNurses: [],
    activeStaff: [],
    procedureBreakdown: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        navigate('/');
      }
    });
    return () => unsub();
  }, [navigate]);


  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const vSnap = await getDocs(collection(db, 'visits'));
      let tRev=0, mRev=0, tPat=0, mPat=0, tOpdC=0, tChanC=0, mOpdR=0, mChanR=0, tOpdR=0, tChanR=0;
      vSnap.forEach(doc => {
        const v = doc.data();
        const ts = v.timestamp?.toMillis ? v.timestamp.toMillis() : new Date(v.timestamp).getTime();
        const amt = Number(v.amount) || (Number(v.doctorCharge || 0) + Number(v.hospitalCharge || 0));
        const isOPD = v.serviceType === 'OPD' || v.type === 'OPD';
        if (ts >= startOfMonth) {
          mRev += amt; mPat++; if (isOPD) mOpdR += amt; else mChanR += amt;
          if (ts >= startOfDay) { 
            tRev += amt; tPat++; 
            if (isOPD) { tOpdC++; tOpdR += amt; } 
            else { tChanC++; tChanR += amt; } 
          }
        }
      });

      const pSnap = await getDocs(collection(db, 'additional_visit_services'));
      let mProcR=0, tProcC=0, mProcC=0, tProcR=0;
      let procMap = {};
      pSnap.forEach(doc => {
        const p = doc.data();
        const ts = p.timestamp?.toMillis ? p.timestamp.toMillis() : new Date(p.timestamp).getTime();
        let pAmt = 0;
        (p.services || []).forEach(s => {
          const sAmt = (Number(s.baseAmount || s.amount || 0) + Number(s.docCut || s.doctorCharge || 0));
          pAmt += sAmt;
          if (ts >= startOfDay) {
            const sn = s.name || 'Other';
            if (!procMap[sn]) procMap[sn] = { name: sn, count: 0, rev: 0 };
            procMap[sn].count++;
            procMap[sn].rev += sAmt;
          }
        });
        if (ts >= startOfMonth) { 
          mRev += pAmt; mProcR += pAmt; mProcC++; 
          if (ts >= startOfDay) { tRev += pAmt; tProcC++; tProcR += pAmt; } 
        }
      });

      const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', todayStr)));
      const latestAtt = {};
      attSnap.forEach(d => {
        const dta = d.data();
        if (!latestAtt[dta.memberId] || new Date(dta.timestamp) > new Date(latestAtt[dta.memberId].timestamp)) {
          latestAtt[dta.memberId] = dta;
        }
      });
      let aDs=[], aNs=[], aSs=[];
      Object.values(latestAtt).forEach(att => {
        if (att.inTime && !att.outTime) {
          const r = (att.role || '').toLowerCase(); const c = (att.category || '').toLowerCase();
          if (c === 'doctor' || r.includes('doctor') || r === 'mo') aDs.push(att.name);
          else if (c === 'nurse' || r.includes('nurse')) aNs.push(att.name);
          else aSs.push(att.name);
        }
      });

      setStats({
        todayRev:tRev, monthRev:mRev, todayPatients:tPat+tProcC, monthPatients:mPat+mProcC,
        opdCount:tOpdC, chanCount:tChanC, procCount:tProcC,
        opdRevenueToday:tOpdR, chanRevenueToday:tChanR, procRevenueToday:tProcR,
        monthOpdRevenue: mOpdR, monthChanRevenue: mChanR, monthProcRevenue: mProcR,
        activeDoctors:aDs, activeNurses:aNs, activeStaff:aSs,
        procedureBreakdown: Object.values(procMap).sort((a,b) => b.rev - a.rev)
      });
    } catch (err) { console.error("Error fetching stats:", err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/'); };


  return (
    <div className="dashboard-layout owner-dashboard-theme">
      <style>{`
        .owner-dashboard-theme {
          background-color: #f8fafc;
          min-height: 100vh;
        }
        .main-content {
          background-color: transparent !important;
          padding: 2rem !important;
        }
        .mobile-nav {
          display: none;
          position: fixed;
          bottom: 20px;
          left: 20px;
          right: 20px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          z-index: 1000;
          padding: 12px 20px;
          justify-content: space-around;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          padding: 8px;
          border-radius: 12px;
        }
        .mobile-nav-item.active {
          color: #0ea5e9;
          background: rgba(14, 165, 233, 0.1);
        }
        .mobile-nav-icon {
          font-size: 1.5rem;
        }
        
        .stat-card-premium {
          background: #ffffff;
          border-radius: 20px;
          padding: 1.5rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          border: 1px solid #f1f5f9;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card-premium:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        }
        
        @media (max-width: 1024px) {
          .sidebar { display: none !important; }
          .mobile-nav { display: flex; }
          .main-content { margin-left: 0 !important; padding: 1.5rem !important; padding-bottom: 120px !important; }
          .stats-grid-top { grid-template-columns: repeat(2, 1fr) !important; gap: 15px !important; }
          .owner-main-grid { grid-template-columns: 1fr !important; gap: 15px !important; }
          .brand-header-horizontal { padding-top: 0.5rem !important; }
          .hospital-name-header { font-size: 1.5rem !important; }
        }

        @media (max-width: 480px) {
          .stats-grid-top { grid-template-columns: 1fr !important; }
          .brand-header-horizontal { gap: 10px !important; }
          .header-logo-large { width: 45px !important; height: 45px !important; }
          .hospital-name-header { font-size: 1.25rem !important; }
          .mobile-nav { bottom: 10px; left: 10px; right: 10px; padding: 8px 10px; }
        }
      `}</style>

      {/* Sidebar for Desktop - Changed back to Ash color */}
      <div className="sidebar no-print" style={{width:'280px', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0'}}>
        <div className="sidebar-brand" style={{background: '#f1f5f9', padding: '2rem 1.5rem', borderBottom: '1px solid #e2e8f0'}}>
          <img src="/logo.png" alt="WellMed" className="sidebar-logo" />
          <h4 style={{margin:'10px 0 0 0', color:'#00B4D8', fontWeight:'800', letterSpacing:'2px', fontSize:'0.75rem'}}>OWNER CENTRAL</h4>
        </div>
        <div className="sidebar-menu" style={{padding: '1.5rem 1rem'}}>
          <button className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={{borderRadius: '12px', marginBottom: '8px', color: activeTab === 'overview' ? 'white' : '#475569'}}>🏠 Overview</button>
          <button className={`menu-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')} style={{borderRadius: '12px', marginBottom: '8px', color: activeTab === 'payments' ? 'white' : '#475569', whiteSpace: 'nowrap'}}>📊 Finance Audit</button>
          <button className={`menu-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')} style={{borderRadius: '12px', marginBottom: '8px', color: activeTab === 'attendance' ? 'white' : '#475569'}}>📅 Attendance</button>
        </div>
        <button className="logout-btn" onClick={handleLogout} style={{marginTop:'auto', margin:'1rem', borderRadius: '12px', background: '#ef4444', color: 'white'}}>Sign Out</button>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav no-print">
        <button className={`mobile-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <span className="mobile-nav-icon">🏠</span>
          Overview
        </button>
        <button className={`mobile-nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
          <span className="mobile-nav-icon">📊</span>
          Finance
        </button>
        <button className={`mobile-nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
          <span className="mobile-nav-icon">📅</span>
          Staff
        </button>
        <button className="mobile-nav-item" onClick={handleLogout}>
          <span className="mobile-nav-icon">🚪</span>
          Sign Out
        </button>
      </div>

      <div className="main-content">
        <div className="brand-header-horizontal no-print" style={{display:'flex', alignItems:'center', gap:'20px', marginBottom:'2rem'}}>
          <img src="/logo.png" alt="WellMed" className="header-logo-large" style={{width:'80px', height:'80px'}} />
          <div className="header-text-group">
            <h1 className="hospital-name-header" style={{margin:0, fontSize:'2.5rem', fontWeight:'900', color:'#00B4D8'}}>WellMed</h1>
            <p className="hospital-tagline" style={{margin:0, color:'#64748b', fontWeight:'700', fontSize: '1.2rem'}}>Owner Dashboard</p>
          </div>
        </div>

        <div className="tab-content" style={{maxWidth:'1200px', margin:'0 auto'}}>
          {activeTab === 'payments' ? ( 
             <div className="registration-panel fade-in" style={{padding: '0', background: 'transparent', boxShadow: 'none'}}>
               <PaymentManagement bypassPassword={true} />
             </div>
          ) : activeTab === 'attendance' ? (
             <div className="fade-in">
                <AttendanceManagement ownerView={true} />
             </div>
          ) : loading ? (
             <div style={{padding:'10rem 2rem', textAlign:'center', color:'#64748b', fontWeight:'700', fontSize: '1.1rem'}}>
               <div className="spinner" style={{marginBottom: '20px'}}>⌛</div>
               Updating Business Metrics...
             </div>
          ) : (
            <div className="fade-in">
              {/* TOP SUMMARY GRID */}
              <div className="stats-grid-top" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'20px', marginBottom:'2rem'}}>
                 <div className="stat-card-premium" style={{borderLeft:'5px solid #0ea5e9'}}>
                   <div style={{color:'#64748b', fontWeight:'800', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'6px'}}>Revenue (Today)</div>
                   <div style={{fontSize:'1.4rem', fontWeight:'900', color:'#0f172a'}}>Rs. {stats.todayRev.toLocaleString()}</div>
                 </div>
                 <div className="stat-card-premium" style={{borderLeft:'5px solid #10b981'}}>
                   <div style={{color:'#64748b', fontWeight:'800', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'6px'}}>Patients (Today)</div>
                   <div style={{fontSize:'1.4rem', fontWeight:'900', color:'#0f172a'}}>{stats.todayPatients}</div>
                 </div>
                 <div className="stat-card-premium" style={{borderLeft:'5px solid #f59e0b'}}>
                   <div style={{color:'#64748b', fontWeight:'800', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'6px'}}>MTD Revenue</div>
                   <div style={{fontSize:'1.4rem', fontWeight:'900', color:'#0f172a'}}>Rs. {stats.monthRev.toLocaleString()}</div>
                 </div>
                 <div className="stat-card-premium" style={{borderLeft:'5px solid #8b5cf6'}}>
                   <div style={{color:'#64748b', fontWeight:'800', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'6px'}}>MTD Patients</div>
                   <div style={{fontSize:'1.4rem', fontWeight:'900', color:'#0f172a'}}>{stats.monthPatients}</div>
                 </div>
              </div>

              <div className="owner-main-grid" style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:'20px'}}>
                <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                  <div className="stat-card-premium">
                     <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'900', fontSize:'0.9rem', color:'#0f172a', textTransform:'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap'}}>Activity Breakdown</h3>
                     <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
                        <div style={{background:'#f8fafc', padding:'1.2rem 1rem', borderRadius:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'1.6rem', fontWeight:'900', color: '#0ea5e9'}}>{stats.chanCount}</div>
                          <div style={{fontSize:'0.65rem', fontWeight:'800', color:'#64748b', textTransform: 'uppercase'}}>Channeling</div>
			  <div style={{fontSize:'0.8rem', fontWeight:'800', color: '#334155', marginTop: '6px'}}>Rs. {stats.chanRevenueToday.toLocaleString()}</div>
                        </div>
                        <div style={{background:'#f8fafc', padding:'1.2rem 1rem', borderRadius:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'1.6rem', fontWeight:'900', color: '#10b981'}}>{stats.opdCount}</div>
                          <div style={{fontSize:'0.65rem', fontWeight:'800', color:'#64748b', textTransform: 'uppercase'}}>OPD Visits</div>
			  <div style={{fontSize:'0.8rem', fontWeight:'800', color: '#334155', marginTop: '6px'}}>Rs. {stats.opdRevenueToday.toLocaleString()}</div>
                        </div>
                        <div style={{background:'#f8fafc', padding:'1.2rem 1rem', borderRadius:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'1.6rem', fontWeight:'900', color: '#f59e0b'}}>{stats.procCount}</div>
                          <div style={{fontSize:'0.65rem', fontWeight:'800', color:'#64748b', textTransform: 'uppercase'}}>Procedures</div>
			  <div style={{fontSize:'0.8rem', fontWeight:'800', color: '#334155', marginTop: '6px'}}>Rs. {stats.procRevenueToday.toLocaleString()}</div>
                        </div>
                     </div>
                  </div>

                  <div className="stat-card-premium">
                    <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'900', fontSize:'0.9rem', color:'#0f172a', textTransform:'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap'}}>Procedure Breakdown (Today)</h3>
                    <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                      {stats.procedureBreakdown.length === 0 ? (
                        <div style={{fontSize:'0.75rem', color:'#94a3b8', fontStyle:'italic', textAlign: 'center', padding: '20px 0'}}>No procedures recorded today.</div>
                      ) : stats.procedureBreakdown.map((p, idx) => (
                        <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background: '#f8fafc', padding: '12px 18px', borderRadius: '12px', border: '1px solid #f1f5f9'}}>
                          <div>
                            <div style={{fontSize: '0.85rem', fontWeight: '800', color: '#334155'}}>{p.name}</div>
                            <div style={{fontSize: '0.7rem', fontWeight: '700', color: '#64748b'}}>{p.count} {p.count === 1 ? 'Times' : 'Times'}</div>
                          </div>
                          <div style={{fontSize: '0.9rem', fontWeight: '900', color: '#0f172a'}}>Rs. {p.rev.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="stat-card-premium" style={{background:'#ffffff'}}>
                  <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'900', fontSize:'0.8rem', color:'#0f172a', textTransform:'uppercase', textAlign:'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', whiteSpace: 'nowrap'}}>Staff Tracking</h3>
                  <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                    <div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <span style={{fontWeight:'800', color:'#64748b', fontSize:'0.75rem'}}>DOCTORS ON-SITE</span>
                        <span style={{background:'#0ea5e9', color:'white', padding:'2px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'900'}}>{stats.activeDoctors.length}</span>
                      </div>
                      {stats.activeDoctors.map((name, i) => (<div key={i} style={{fontSize:'0.8rem', fontWeight:'700', color:'#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px'}}>👨‍⚕️ {name}</div>))}
                      {stats.activeDoctors.length === 0 && <div style={{fontSize:'0.7rem', color:'#94a3b8', textAlign:'center', fontStyle:'italic', marginBottom: '10px'}}>No doctors in.</div>}
                    </div>
                    <div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <span style={{fontWeight:'800', color:'#64748b', fontSize:'0.75rem'}}>NURSES ON-SITE</span>
                        <span style={{background:'#10b981', color:'white', padding:'2px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'900'}}>{stats.activeNurses.length}</span>
                      </div>
                      {stats.activeNurses.map((name, i) => (<div key={i} style={{fontSize:'0.8rem', fontWeight:'700', color:'#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px'}}>👩‍⚕️ {name}</div>))}
                      {stats.activeNurses.length === 0 && <div style={{fontSize:'0.7rem', color:'#94a3b8', textAlign:'center', fontStyle:'italic', marginBottom: '10px'}}>No nurses in.</div>}
                    </div>
                    <div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <span style={{fontWeight:'800', color:'#64748b', fontSize:'0.75rem'}}>SUPPORT STAFF ON-SITE</span>
                        <span style={{background:'#f59e0b', color:'white', padding:'2px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'900'}}>{stats.activeStaff.length}</span>
                      </div>
                      {stats.activeStaff.map((name, i) => (<div key={i} style={{fontSize:'0.8rem', fontWeight:'700', color:'#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px'}}>👤 {name}</div>))}
                      {stats.activeStaff.length === 0 && <div style={{fontSize:'0.7rem', color:'#94a3b8', textAlign:'center', fontStyle:'italic'}}>No other staff in.</div>}
                    </div>
                    <button onClick={() => setActiveTab('attendance')} style={{marginTop: '10px', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer'}}>View Detailed Attendance</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
