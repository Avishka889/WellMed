import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PaymentManagement from '../components/PaymentManagement';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  
  const today = new Date().toLocaleDateString('en-CA');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  
  const [stats, setStats] = useState({
    todayRev: 0,
    monthRev: 0,
    todayPatients: 0,
    monthPatients: 0,
    opdCount: 0,
    chanCount: 0,
    procCount: 0,
    opdRevenue: 0,
    chanRevenue: 0,
    procRevenue: 0,
    activeDoctors: [],
    activeNurses: [],
    activeStaff: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate('/');
    });
    fetchData();
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceRange(startDate, endDate);
    }
  }, [activeTab, startDate, endDate]);

  const fetchAttendanceRange = async (s, e) => {
    try {
      const q = query(
        collection(db, 'attendance'), 
        where('date', '>=', s),
        where('date', '<=', e)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by date then by inTime
      data.sort((a,b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.inTime || '').localeCompare(b.inTime || '');
      });
      setAttendanceLogs(data);
    } catch (err) { console.error("Error fetching attendance range:", err); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const vSnap = await getDocs(collection(db, 'visits'));
      let tRev=0, mRev=0, tPat=0, mPat=0, tOpdC=0, tChanC=0, mOpdR=0, mChanR=0;
      vSnap.forEach(doc => {
        const v = doc.data();
        const ts = v.timestamp?.toMillis ? v.timestamp.toMillis() : new Date(v.timestamp).getTime();
        const amt = Number(v.amount) || (Number(v.doctorCharge || 0) + Number(v.hospitalCharge || 0));
        const isOPD = v.serviceType === 'OPD' || v.type === 'OPD';
        if (ts >= startOfMonth) {
          mRev += amt; mPat++; if (isOPD) mOpdR += amt; else mChanR += amt;
          if (ts >= startOfDay) { tRev += amt; tPat++; if (isOPD) tOpdC++; else tChanC++; }
        }
      });

      const pSnap = await getDocs(collection(db, 'additional_visit_services'));
      let mProcR=0, tProcC=0, mProcC=0;
      pSnap.forEach(doc => {
        const p = doc.data();
        const ts = p.timestamp?.toMillis ? p.timestamp.toMillis() : new Date(p.timestamp).getTime();
        let pAmt = 0;
        (p.services || []).forEach(s => pAmt += (Number(s.baseAmount || s.amount || 0) + Number(s.docCut || s.doctorCharge || 0)));
        if (ts >= startOfMonth) { mRev += pAmt; mProcR += pAmt; mProcC++; if (ts >= startOfDay) { tRev += pAmt; tProcC++; } }
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
        opdRevenue:mOpdR, chanRevenue:mChanR, procRevenue:mProcR,
        activeDoctors:aDs, activeNurses:aNs, activeStaff:aSs
      });
    } catch (err) { console.error("Error fetching stats:", err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/'); };

  const calculateStay = (inT, outT) => {
    if (!inT || !outT) return '-';
    const [iH, iM] = inT.split(':').map(Number);
    const [oH, oM] = outT.split(':').map(Number);
    const diff = (oH * 60 + oM) - (iH * 60 + iM);
    return diff > 0 ? `${Math.floor(diff/60)}h ${diff%60}m` : '-';
  };

  return (
    <div className="dashboard-layout owner-dashboard-theme">
      <style>{`
        .owner-dashboard-theme {
          background-color: #ffffff;
          min-height: 100vh;
        }
        .main-content {
          background-color: #ffffff !important;
        }
        .mobile-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #f8fafc;
          box-shadow: 0 -2px 15px rgba(0,0,0,0.08);
          z-index: 1000;
          padding: 10px 15px;
          justify-content: space-around;
        }
        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .mobile-nav-item.active {
          color: var(--primary-cyan);
        }
        .mobile-nav-icon {
          font-size: 1.4rem;
        }
        
        .stat-card-premium {
          background: #ffffff;
          border-radius: 16px;
          padding: 1.25rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
          border: 1px solid #f1f5f9;
          transition: transform 0.2s;
        }
        
        @media (max-width: 900px) {
          .sidebar { display: none !important; }
          .mobile-nav { display: flex; }
          .main-content { margin-left: 0 !important; padding: 1rem !important; padding-bottom: 80px !important; }
          .stats-grid-top { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .owner-main-grid { grid-template-columns: 1fr !important; }
          .brand-header-horizontal { padding-top: 1rem !important; flex-direction: row !important; text-align: left !important; }
          .header-logo-large { width: 50px !important; height: 50px !important; }
          .hospital-name-header { fontSize: 1.5rem !important; }
          .hospital-tagline { fontSize: 0.75rem !important; }
        }
      `}</style>

      {/* Sidebar for Desktop - Changed back to Ash color */}
      <div className="sidebar no-print" style={{width:'280px', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0'}}>
        <div className="sidebar-brand" style={{background: '#f1f5f9', padding: '2rem 1.5rem', borderBottom: '1px solid #e2e8f0'}}>
          <img src="/logo.png" alt="WellMed" className="sidebar-logo" />
          <h4 style={{margin:'10px 0 0 0', color:'#0891b2', fontWeight:'800', letterSpacing:'2px', fontSize:'0.75rem'}}>OWNER CENTRAL</h4>
        </div>
        <div className="sidebar-menu" style={{padding: '1.5rem 1rem'}}>
          <button className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={{borderRadius: '12px', marginBottom: '8px', color: activeTab === 'overview' ? 'white' : '#475569'}}>🏠 Overview</button>
          <button className={`menu-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')} style={{borderRadius: '12px', marginBottom: '8px', color: activeTab === 'payments' ? 'white' : '#475569'}}>📊 Finance Audit</button>
          <button className={`menu-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')} style={{borderRadius: '12px', marginBottom: '8px', color: activeTab === 'attendance' ? 'white' : '#475569'}}>📅 Attendance</button>
        </div>
        <button className="logout-btn" onClick={handleLogout} style={{marginTop:'auto', margin:'1rem', borderRadius: '12px', background: '#e2e8f0', color: '#475569'}}>Sign Out</button>
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
          Exit
        </button>
      </div>

      <div className="main-content">
        <div className="brand-header-horizontal no-print" style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'1.5rem'}}>
          <img src="/logo.png" alt="WellMed" className="header-logo-large" style={{width:'60px', height:'60px'}} />
          <div className="header-text-group">
            <h1 className="hospital-name-header" style={{margin:0, fontSize:'1.8rem', fontWeight:'900', color:'#0f172a'}}>WellMed</h1>
            <p className="hospital-tagline" style={{margin:0, color:'#64748b', fontWeight:'600'}}>Owner Dashboard</p>
          </div>
        </div>

        <div className="tab-content" style={{maxWidth:'1200px', margin:'0 auto'}}>
          {activeTab === 'payments' ? ( 
             <div className="registration-panel fade-in" style={{padding: '0', background: 'transparent', boxShadow: 'none'}}>
               <PaymentManagement bypassPassword={true} />
             </div>
          ) : activeTab === 'attendance' ? (
            <div className="registration-panel fade-in" style={{borderRadius: '16px', padding: '1.5rem'}}>
              <div style={{display:'flex', flexDirection: 'column', gap:'1rem', marginBottom:'2rem'}}>
                 <h3 style={{margin:0, fontWeight:'900', color:'#0f172a', fontSize: '1.2rem'}}>STAFF ATTENDANCE</h3>
                 <div style={{display:'flex', gap:'10px'}} className="no-print">
                    <div style={{flex: 1}}>
                       <label style={{fontSize:'0.65rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase'}}>From</label>
                       <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{width: '100%', padding:'10px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize: '0.85rem'}} />
                    </div>
                    <div style={{flex: 1}}>
                       <label style={{fontSize:'0.65rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase'}}>To</label>
                       <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{width: '100%', padding:'10px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize: '0.85rem'}} />
                    </div>
                 </div>
              </div>
              
              <div style={{overflowX:'auto', "-webkit-overflow-scrolling": "touch"}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize: '0.85rem'}}>
                  <thead>
                    <tr style={{textAlign:'left', color:'#64748b', borderBottom:'1px solid #e2e8f0'}}>
                      <th style={{padding:'12px 10px'}}>Date & Name</th>
                      <th style={{padding:'12px 10px', textAlign:'center'}}>Role</th>
                      <th style={{padding:'12px 10px', textAlign:'right'}}>Stay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.map((log) => (
                      <tr key={log.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'12px 10px'}}>
                          <div style={{fontWeight:'700', color:'#0f172a'}}>{log.name}</div>
                          <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>{log.date} | {log.inTime} - {log.outTime || 'Active'}</div>
                        </td>
                        <td style={{padding:'12px 10px', textAlign:'center'}}>
                          <span style={{background:'#f1f5f9', padding:'3px 8px', borderRadius:'6px', color:'#475569', fontSize:'0.65rem', fontWeight:'800'}}>{(log.category || log.role || '').substring(0, 4).toUpperCase()}</span>
                        </td>
                        <td style={{padding:'12px 10px', textAlign:'right', fontWeight:'700', color:'var(--primary-cyan)'}}>{calculateStay(log.inTime, log.outTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:'2rem', textAlign:'center'}} className="no-print">
                 <button onClick={() => window.print()} className="action-btn" style={{background:'#0f172a', padding:'12px 25px', borderRadius: '12px', width: '100%'}}>Print Full Report</button>
              </div>
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
                     <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'900', fontSize:'0.9rem', color:'#0f172a', textTransform:'uppercase', letterSpacing: '0.5px'}}>Activity Breakdown</h3>
                     <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
                        <div style={{background:'#f8fafc', padding:'1.2rem 1rem', borderRadius:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'1.6rem', fontWeight:'900', color: '#0ea5e9'}}>{stats.chanCount}</div>
                          <div style={{fontSize:'0.65rem', fontWeight:'800', color:'#94a3b8', textTransform: 'uppercase'}}>Channeling</div>
                        </div>
                        <div style={{background:'#f8fafc', padding:'1.2rem 1rem', borderRadius:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'1.6rem', fontWeight:'900', color: '#10b981'}}>{stats.opdCount}</div>
                          <div style={{fontSize:'0.65rem', fontWeight:'800', color:'#94a3b8', textTransform: 'uppercase'}}>OPD Visits</div>
                        </div>
                        <div style={{background:'#f8fafc', padding:'1.2rem 1rem', borderRadius:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'1.6rem', fontWeight:'900', color: '#f59e0b'}}>{stats.procCount}</div>
                          <div style={{fontSize:'0.65rem', fontWeight:'800', color:'#94a3b8', textTransform: 'uppercase'}}>Procedures</div>
                        </div>
                     </div>
                  </div>

                  <div className="stat-card-premium">
                    <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'900', fontSize:'0.9rem', color:'#0f172a', textTransform:'uppercase', letterSpacing: '0.5px'}}>MTD Revenue Split</h3>
                    <div style={{display:'flex', flexDirection:'column', gap:'1.25rem'}}>
                      <div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                          <span style={{fontWeight:'800', fontSize:'0.75rem', color: '#64748b'}}>OPD</span>
                          <span style={{fontWeight:'900', fontSize:'0.85rem', color: '#0f172a'}}>Rs. {stats.opdRevenue.toLocaleString()}</span>
                        </div>
                        <div style={{height:'10px', background:'#f1f5f9', borderRadius:'5px', overflow:'hidden'}}>
                          <div style={{width:`${stats.monthRev>0?(stats.opdRevenue/stats.monthRev*100):0}%`, height:'100%', background:'#10b981'}}></div>
                        </div>
                      </div>
                      <div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                          <span style={{fontWeight:'800', fontSize:'0.75rem', color: '#64748b'}}>CHANNELING</span>
                          <span style={{fontWeight:'900', fontSize:'0.85rem', color: '#0f172a'}}>Rs. {stats.chanRevenue.toLocaleString()}</span>
                        </div>
                        <div style={{height:'10px', background:'#f1f5f9', borderRadius:'5px', overflow:'hidden'}}>
                          <div style={{width:`${stats.monthRev>0?(stats.chanRevenue/stats.monthRev*100):0}%`, height:'100%', background:'#0ea5e9'}}></div>
                        </div>
                      </div>
                      <div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontWeight:'700', fontSize:'0.85rem'}}>
                          <span style={{fontWeight:'800', fontSize:'0.75rem', color: '#64748b'}}>PROCEDURES</span>
                          <span style={{fontWeight:'900', fontSize:'0.85rem', color: '#0f172a'}}>Rs. {stats.procRevenue.toLocaleString()}</span>
                        </div>
                        <div style={{height:'10px', background:'#f1f5f9', borderRadius:'5px', overflow:'hidden'}}>
                          <div style={{width:`${stats.monthRev>0?(stats.procRevenue/stats.monthRev*100):0}%`, height:'100%', background:'#f59e0b'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="stat-card-premium" style={{background:'#ffffff'}}>
                  <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'900', fontSize:'0.8rem', color:'#0f172a', textTransform:'uppercase', textAlign:'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px'}}>Staff Tracking</h3>
                  <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                    <div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <span style={{fontWeight:'800', color:'#64748b', fontSize:'0.75rem'}}>DOCTORS ON-SITE</span>
                        <span style={{background:'#0ea5e9', color:'white', padding:'2px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'900'}}>{stats.activeDoctors.length}</span>
                      </div>
                      {stats.activeDoctors.map((name, i) => (<div key={i} style={{fontSize:'0.8rem', fontWeight:'700', color:'#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px'}}>👨‍⚕️ {name}</div>))}
                    </div>
                    <div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <span style={{fontWeight:'800', color:'#64748b', fontSize:'0.75rem'}}>NURSES ON-SITE</span>
                        <span style={{background:'#10b981', color:'white', padding:'2px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'900'}}>{stats.activeNurses.length}</span>
                      </div>
                      {stats.activeNurses.map((name, i) => (<div key={i} style={{fontSize:'0.8rem', fontWeight:'700', color:'#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px'}}>👩‍⚕️ {name}</div>))}
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
