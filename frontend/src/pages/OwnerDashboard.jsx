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
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar no-print" style={{width:'300px'}}>
        <div className="sidebar-brand">
          <img src="/logo.png" alt="WellMed" className="sidebar-logo" />
          <h4 style={{margin:'0', color:'var(--primary-cyan)', fontWeight:'800', letterSpacing:'1px', fontSize:'0.85rem'}}>OWNER CENTRAL</h4>
        </div>
        <div className="sidebar-menu">
          <button className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`menu-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments Audit</button>
          <button className={`menu-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>Attendance Reports</button>
        </div>
        <button className="logout-btn" onClick={handleLogout} style={{marginTop:'auto'}}>Sign Out</button>
      </div>

      <div className="main-content dashboard-bg">
        <div className="brand-header-horizontal no-print" style={{paddingTop:'2rem', paddingBottom:'1.5rem'}}>
          <img src="/logo.png" alt="WellMed" className="header-logo-large" />
          <div className="header-text-group">
            <h1 className="hospital-name-header">WellMed</h1>
            <p className="hospital-tagline">Specialist Medical & Diabetic Care</p>
          </div>
        </div>

        <div className="tab-content" style={{maxWidth:'1200px', margin:'0 auto'}}>
          {activeTab === 'payments' ? ( 
             <PaymentManagement bypassPassword={true} />
          ) : activeTab === 'attendance' ? (
            <div className="registration-panel fade-in">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
                 <h3 style={{margin:0, fontWeight:'800', color:'#475569'}}>STAFF ATTENDANCE RANGE REPORT</h3>
                 <div style={{display:'flex', gap:'15px', alignItems:'center'}} className="no-print">
                    <div style={{display:'flex', flexDirection:'column'}}>
                       <label style={{fontSize:'0.75rem', fontWeight:'700', color:'#64748b'}}>From:</label>
                       <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                    </div>
                    <div style={{display:'flex', flexDirection:'column'}}>
                       <label style={{fontSize:'0.75rem', fontWeight:'700', color:'#64748b'}}>To:</label>
                       <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                    </div>
                 </div>
              </div>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f8fafc', borderBottom:'1px solid #e2e8f0'}}>
                    <th style={{padding:'12px', textAlign:'left'}}>Date</th>
                    <th style={{padding:'12px', textAlign:'left'}}>Staff Member</th>
                    <th style={{padding:'12px', textAlign:'center'}}>Role</th>
                    <th style={{padding:'12px', textAlign:'center'}}>In Time</th>
                    <th style={{padding:'12px', textAlign:'center'}}>Out Time</th>
                    <th style={{padding:'12px', textAlign:'right'}}>Stay Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLogs.map((log) => (
                    <tr key={log.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                      <td style={{padding:'12px', fontSize:'0.85rem'}}>{log.date}</td>
                      <td style={{padding:'12px', fontWeight:'600'}}>{log.name}</td>
                      <td style={{padding:'12px', textAlign:'center'}}><span style={{background:'#f8fafc', padding:'4px 10px', borderRadius:'6px', color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase'}}>{log.category || log.role}</span></td>
                      <td style={{padding:'12px', textAlign:'center', color:'#1e293b', fontWeight:'600'}}>{log.inTime || '--:--'}</td>
                      <td style={{padding:'12px', textAlign:'center', color:'#1e293b', fontWeight:'600'}}>{log.outTime || '--:--'}</td>
                      <td style={{padding:'12px', textAlign:'right', fontWeight:'700', color:'var(--primary-cyan)'}}>{calculateStay(log.inTime, log.outTime)}</td>
                    </tr>
                  ))}
                  {attendanceLogs.length === 0 && <tr><td colSpan="6" style={{textAlign:'center', padding:'2rem', color:'#94a3b8'}}>No attendance records found for this selected range.</td></tr>}
                </tbody>
              </table>
              <div style={{marginTop:'2rem', textAlign:'center'}} className="no-print">
                 <button onClick={() => window.print()} className="action-btn" style={{background:'var(--primary-cyan)', padding:'10px 25px'}}>Print Attendance Report</button>
              </div>
            </div>
          ) : loading ? (
             <div style={{padding:'5rem', textAlign:'center', color:'var(--text-muted)', fontWeight:'600'}}>Syncing Data...</div>
          ) : (
            <div className="fade-in" style={{marginTop:'1.5rem'}}>
              {/* TOP SUMMARY LABELS */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'15px', marginBottom:'3rem'}}>
                 <div className="registration-panel" style={{padding:'1rem', textAlign:'center', borderTop:'6px solid var(--primary-cyan)'}}><div style={{color:'var(--text-muted)', fontWeight:'700', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'4px'}}>Revenue (Today)</div><div style={{fontSize:'1.4rem', fontWeight:'900', color:'var(--text-main)'}}>Rs. {stats.todayRev.toLocaleString()}</div></div>
                 <div className="registration-panel" style={{padding:'1rem', textAlign:'center', borderTop:'6px solid #10b981'}}><div style={{color:'var(--text-muted)', fontWeight:'700', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'4px'}}>Patients (Today)</div><div style={{fontSize:'1.4rem', fontWeight:'900', color:'var(--text-main)'}}>{stats.todayPatients}</div></div>
                 <div className="registration-panel" style={{padding:'1rem', textAlign:'center', borderTop:'6px solid var(--primary-orange)'}}><div style={{color:'var(--text-muted)', fontWeight:'700', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'4px'}}>Revenue (MTD)</div><div style={{fontSize:'1.4rem', fontWeight:'900', color:'var(--text-main)'}}>Rs. {stats.monthRev.toLocaleString()}</div></div>
                 <div className="registration-panel" style={{padding:'1rem', textAlign:'center', borderTop:'6px solid #7c3aed'}}><div style={{color:'var(--text-muted)', fontWeight:'700', fontSize:'0.65rem', textTransform:'uppercase', marginBottom:'4px'}}>Total Patients (MTD)</div><div style={{fontSize:'1.4rem', fontWeight:'900', color:'var(--text-main)'}}>{stats.monthPatients}</div></div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:'25px'}}>
                <div style={{display:'flex', flexDirection:'column', gap:'25px'}}>
                  <div className="registration-panel" style={{maxWidth:'100%', minHeight:'220px'}}>
                     <h3 style={{margin:'0 0 1.5rem 0', fontWeight:'800', fontSize:'1.1rem', color:'#475569', textAlign:'center'}}>TODAY'S SERVICE ACTIVITY</h3>
                     <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
                        <div style={{background:'#f8fafc', padding:'1rem', borderRadius:'10px', textAlign:'center', border:'1px solid #f1f5f9'}}><div style={{fontSize:'1.5rem', fontWeight:'900'}}>{stats.chanCount}</div><div style={{fontSize:'0.7rem', fontWeight:'700', color:'var(--text-muted)'}}>Channeling</div></div>
                        <div style={{background:'#f8fafc', padding:'1rem', borderRadius:'10px', textAlign:'center', border:'1px solid #f1f5f9'}}><div style={{fontSize:'1.5rem', fontWeight:'900'}}>{stats.opdCount}</div><div style={{fontSize:'0.7rem', fontWeight:'700', color:'var(--text-muted)'}}>OPD Visits</div></div>
                        <div style={{background:'#f8fafc', padding:'1rem', borderRadius:'10px', textAlign:'center', border:'1px solid #f1f5f9'}}><div style={{fontSize:'1.5rem', fontWeight:'900'}}>{stats.procCount}</div><div style={{fontSize:'0.7rem', fontWeight:'700', color:'var(--text-muted)'}}>Procedures</div></div>
                     </div>
                  </div>
                  <div className="registration-panel" style={{maxWidth:'100%', minHeight:'220px'}}><h3 style={{margin:'0 0 2rem 0', fontWeight:'800', color:'#475569', fontSize:'1.1rem', textAlign:'center'}}>MONTHLY REVENUE COMPOSITION (MTD)</h3><div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}><div><div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontWeight:'700', fontSize:'0.85rem'}}><span>OPD Income</span><span>Rs. {stats.opdRevenue.toLocaleString()}</span></div><div style={{height:'6px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden'}}><div style={{width:`${stats.monthRev>0?(stats.opdRevenue/stats.monthRev*100):0}%`, height:'100%', background:'#94a3b8'}}></div></div></div><div><div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontWeight:'700', fontSize:'0.85rem'}}><span>Channeling Income</span><span>Rs. {stats.chanRevenue.toLocaleString()}</span></div><div style={{height:'6px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden'}}><div style={{width:`${stats.monthRev>0?(stats.chanRevenue/stats.monthRev*100):0}%`, height:'100%', background:'var(--primary-cyan)'}}></div></div></div><div><div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontWeight:'700', fontSize:'0.85rem'}}><span>Procedure Income</span><span>Rs. {stats.procRevenue.toLocaleString()}</span></div><div style={{height:'6px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden'}}><div style={{width:`${stats.monthRev>0?(stats.procRevenue/stats.monthRev*100):0}%`, height:'100%', background:'var(--primary-orange)'}}></div></div></div></div></div>
                </div>
                <div className="registration-panel" style={{maxWidth:'100%', background:'#fcfcfc', borderTop:'5px solid var(--primary-cyan)'}}><h3 style={{margin:'0 0 1.5rem 0', fontWeight:'800', fontSize:'0.9rem', color:'#475569', textTransform:'uppercase', textAlign:'center'}}>Personnel On-Site</h3><div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                   <div><div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px', marginBottom:'8px'}}><span style={{fontWeight:'700', color:'#64748b', fontSize:'0.8rem'}}>DOCTORS</span><span style={{fontWeight:'900', color:'var(--primary-cyan)'}}>{stats.activeDoctors.length}</span></div>{stats.activeDoctors.map((name, i) => (<div key={i} style={{fontSize:'0.85rem', fontWeight:'600', color:'#334155', marginBottom:'4px'}}>• {name}</div>))}</div>
                   <div><div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px', marginBottom:'8px'}}><span style={{fontWeight:'700', color:'#64748b', fontSize:'0.8rem'}}>NURSES</span><span style={{fontWeight:'900', color:'var(--primary-cyan)'}}>{stats.activeNurses.length}</span></div>{stats.activeNurses.map((name, i) => (<div key={i} style={{fontSize:'0.85rem', fontWeight:'600', color:'#334155', marginBottom:'4px'}}>• {name}</div>))}</div>
                   <div><div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px', marginBottom:'8px'}}><span style={{fontWeight:'700', color:'#64748b', fontSize:'0.8rem'}}>GENERAL STAFF</span><span style={{fontWeight:'900', color:'var(--primary-cyan)'}}>{stats.activeStaff.length}</span></div>{stats.activeStaff.map((name, i) => (<div key={i} style={{fontSize:'0.85rem', fontWeight:'600', color:'#334155', marginBottom:'4px'}}>• {name}</div>))}</div>
                </div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
