import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const AttendanceRow = ({ member, att, onSave, onRemove }) => {
  const [inTime, setInTime] = useState(att?.inTime || '');
  const [outTime, setOutTime] = useState(att?.outTime || '');
  const [isManual, setIsManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setInTime(att?.inTime || '');
    setOutTime(att?.outTime || '');
  }, [att]);

  const handleMarkIn = async () => {
    setIsSaving(true);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    setInTime(currentTime);
    await onSave(member, att?.id, currentTime, outTime);
    setIsSaving(false);
  };

  const handleMarkOut = async () => {
    setIsSaving(true);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    setOutTime(currentTime);
    await onSave(member, att?.id, inTime, currentTime);
    setIsSaving(false);
  };

  const handleManualSave = async () => {
    if (!inTime && !outTime) {
      toast.error('Please enter an In-Time or Out-Time first.');
      return;
    }
    setIsSaving(true);
    await onSave(member, att?.id, inTime, outTime);
    setIsSaving(false);
    setIsManual(false);
  };

  const formatAMPM = (timeStr) => {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${m} ${ampm}`;
  };

  return (
    <div className="fade-in" style={{
      display:'flex', justifyContent:'space-between', alignItems:'center', 
      padding:'1.5rem 2rem', background:'white', borderRadius:'20px',
      boxShadow:'0 4px 6px -1px rgba(0,0,0,0.05)', border:'1px solid #f1f5f9',
      width: '100%', boxSizing: 'border-box', flexWrap: 'wrap', gap: '1.5rem'
    }}>
      {/* Left: Info */}
      <div style={{display:'flex', gap:'1.5rem', alignItems:'center', minWidth: '300px'}}>
        <img src={member.photoUrl || 'https://via.placeholder.com/150'} alt="pic" style={{width:'64px', height:'64px', borderRadius:'16px', objectFit:'cover', border:'2px solid var(--primary-cyan)', padding:'2px', background:'white'}} />
        <div>
          <h4 style={{margin:0, fontSize:'1.25rem', color:'#1e293b'}}>{member.name}</h4>
          <div style={{fontSize:'1rem', color:'#64748b', fontWeight:'600', marginTop:'4px'}}>
            {member.category === 'doctor' ? member.specialization : member.role}
            {member.category === 'doctor' ? ` • ${member.docType}` : ''}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{display:'flex', gap:'1.5rem', alignItems:'center', flexWrap: 'wrap'}}>
         
         {!isManual ? (
           // MAIN QUICK BUTTONS UI
           <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
             {!inTime ? (
               <button onClick={handleMarkIn} disabled={isSaving} style={{background:'var(--primary-cyan)', color:'white', padding:'10px 20px', borderRadius:'12px', border:'none', cursor:'pointer', fontWeight:'800', boxShadow:'0 4px 10px -2px rgba(6,182,212,0.4)', transition:'0.2s'}}>✅ MARK IN</button>
             ) : (
               <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                 <span style={{color:'#166534', fontWeight:'800', fontSize:'0.9rem', background:'#dcfce7', padding:'8px 12px', borderRadius:'10px'}}>IN: {formatAMPM(inTime)}</span>
               </div>
             )}

             {inTime && !outTime ? (
               <button onClick={handleMarkOut} disabled={isSaving} style={{background:'#cf2a27', color:'white', padding:'10px 20px', borderRadius:'12px', border:'none', cursor:'pointer', fontWeight:'800', boxShadow:'0 4px 10px -2px rgba(207,42,39,0.4)', transition:'0.2s'}}>🔴 MARK OUT</button>
             ) : outTime ? (
               <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                 <span style={{color:'#991b1b', fontWeight:'800', fontSize:'0.9rem', background:'#fee2e2', padding:'8px 12px', borderRadius:'10px'}}>OUT: {formatAMPM(outTime)}</span>
               </div>
             ) : null}

             <button onClick={() => setIsManual(true)} style={{background:'#f1f5f9', color:'#475569', padding:'10px 16px', borderRadius:'12px', border:'none', cursor:'pointer', fontWeight:'700', marginLeft:'10px'}}>✏️ Manual Entry</button>
             
             {att && (
               <button onClick={() => onRemove(att.id, member.id)} style={{background:'transparent', border:'none', textDecoration:'underline', color:'#ef4444', fontSize:'0.85rem', cursor:'pointer', marginLeft:'10px'}}>Clear</button>
             )}
           </div>
         ) : (
           // MANUAL OVERRIDE UI
           <div className="fade-in" style={{display:'flex', gap:'15px', alignItems:'center', background:'#f8fafc', padding:'15px 25px', borderRadius:'16px', border:'1px solid #e2e8f0'}}>
             <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
               <label style={{fontSize:'0.85rem', color:'#64748b', fontWeight:'700'}}>In Time</label>
               <input type="time" value={inTime} onChange={(e)=>setInTime(e.target.value)} style={{padding:'8px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
             </div>
             
             <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
               <label style={{fontSize:'0.85rem', color:'#64748b', fontWeight:'700'}}>Out Time</label>
               <input type="time" value={outTime} onChange={(e)=>setOutTime(e.target.value)} style={{padding:'8px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
             </div>

             <div style={{display:'flex', flexDirection:'column', gap:'8px', marginLeft:'10px', marginTop:'15px'}}>
               <button onClick={handleManualSave} disabled={isSaving} style={{background:'var(--primary-cyan)', color:'white', padding:'8px 16px', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:'700'}}>💾 Update</button>
               <button onClick={() => {
                 setIsManual(false);
                 setInTime(att?.inTime || '');
                 setOutTime(att?.outTime || '');
               }} style={{background:'transparent', border:'none', textDecoration:'underline', color:'#64748b', fontSize:'0.85rem', cursor:'pointer'}}>Cancel</button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

export default function AttendanceManagement() {
  const [activeTab, setActiveTab] = useState('doctors');
  const [doctors, setDoctors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState({}); 
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-CA');

  const [logView, setLogView] = useState('today');
  const [reportDate, setReportDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reportCategory, setReportCategory] = useState('OPD');
  const [reportMemberId, setReportMemberId] = useState('');
  const [reportLogs, setReportLogs] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = async () => {
     if (logView === 'daily' && !reportDate) return toast.error("Select a date.");
     if ((logView === 'category' || logView === 'individual') && (!startDate || !endDate)) return toast.error("Select a date range.");
     if (logView === 'individual' && !reportMemberId) return toast.error("Select a member.");

     setIsGenerating(true);
     setReportLogs([]);

     try {
       let q;
       const attRef = collection(db, 'attendance');

       if (logView === 'daily') {
          q = query(attRef, where('date', '==', reportDate));
       } else {
          q = query(attRef, where('date', '>=', startDate), where('date', '<=', endDate));
       }

       const snap = await getDocs(q);
       let results = [];
       snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));

       if (logView === 'category') {
           if (reportCategory === 'OPD') results = results.filter(r => r.category === 'doctor' && r.docType === 'OPD');
           if (reportCategory === 'Channeling') results = results.filter(r => r.category === 'doctor' && r.docType === 'Channeling');
           if (reportCategory === 'staff') results = results.filter(r => r.category === 'staff');
       }

       if (logView === 'individual') {
           results = results.filter(r => r.memberId === reportMemberId);
       }

       results.sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return new Date(a.timestamp) - new Date(b.timestamp);
       });

       setReportLogs(results);
       if (results.length === 0) toast.error("No records found.");
       else toast.success(`Generated report with ${results.length} records.`);
     } catch(err) {
       console.error(err);
       toast.error("Failed to generate report.");
     } finally {
       setIsGenerating(false);
     }
  };
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const dSnap = await getDocs(collection(db, 'doctors'));
      const dList = dSnap.docs.map(d => ({ id: d.id, category: 'doctor', docType: d.data().type, ...d.data() }));
      setDoctors(dList);

      const sSnap = await getDocs(collection(db, 'staff'));
      const sList = sSnap.docs.map(s => ({ id: s.id, category: 'staff', ...s.data() }));
      setStaff(sList);

      const q = query(collection(db, 'attendance'), where('date', '==', today));
      const attSnap = await getDocs(q);
      const attMap = {};
      attSnap.forEach(a => {
        const data = a.data();
        attMap[data.memberId] = { id: a.id, ...data };
      });
      setAttendance(attMap);

    } catch (err) {
      toast.error('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveAttendance = async (member, recordId, inTime, outTime) => {
    try {
      const roleDef = member.category === 'doctor' ? member.specialization : member.role;
      const typeLabel = member.category === 'doctor' ? 'Doctor' : 'Staff'; 
      const status = (inTime && outTime) ? 'Completed' : (inTime ? 'Present' : 'Absent');

      const attData = {
        date: today,
        inTime,
        outTime,
        timestamp: new Date().toISOString(),
        memberId: member.id || 'unknown',
        name: member.name || 'Unknown Name',
        role: roleDef || 'N/A',
        category: member.category,
        docType: member.docType || null,
        status
      };

      if (recordId) {
        await updateDoc(doc(db, 'attendance', recordId), attData);
        setAttendance(prev => ({ ...prev, [member.id]: { id: recordId, ...attData } }));
        toast.success(`Updated ${typeLabel} ${member.name}'s Attendance!`);
      } else {
        const res = await addDoc(collection(db, 'attendance'), attData);
        setAttendance(prev => ({ ...prev, [member.id]: { id: res.id, ...attData } }));
        toast.success(`Saved In-Time for ${typeLabel} ${member.name}!`);
      }
    } catch (err) {
      console.error("Firebase Error saving time:", err);
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  const handleRemoveAttendance = async (recordId, memberId) => {
    try {
      await deleteDoc(doc(db, 'attendance', recordId));
      const newAtt = { ...attendance };
      delete newAtt[memberId];
      setAttendance(newAtt);
      toast.success('Attendance record cleared.');
    } catch (err) {
      console.error("Firebase Error in remove:", err);
      toast.error(`Failed to remove: ${err.message}`);
    }
  };

  const formatAMPM = (timeStr) => {
    if(!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${m} ${ampm}`;
  };

  const renderList = (list) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%'}}>
      {list.length === 0 && <p style={{color:'#64748b', padding:'1rem'}}>No members found in this category.</p>}
      {list.map(member => (
        <AttendanceRow 
          key={member.id} 
          member={member} 
          att={attendance[member.id]} 
          onSave={handleSaveAttendance} 
          onRemove={handleRemoveAttendance} 
        />
      ))}
    </div>
  );

  const calculateStayTime = (inTime, outTime) => {
    if (!inTime || !outTime) return '-';
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inTotal = inH * 60 + inM;
    const outTotal = outH * 60 + outM;
    if (outTotal < inTotal) return '-'; 
    const diff = outTotal - inTotal;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    if (hours === 0 && minutes === 0) return `0m`;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const renderLogsTable = (logsList, title) => {
    if (logsList.length === 0) return null;
    return (
      <div style={{marginBottom:'2.5rem', pageBreakInside: 'avoid'}}>
        <h4 className="report-title" style={{margin:'0 0 1rem 0', color:'#1e293b', fontSize:'1.2rem', borderBottom:'2px solid #1e293b', paddingBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.5px'}}>{title}</h4>
        <table className="report-table" style={{width:'100%', borderCollapse:'collapse', textAlign:'left', background:'white'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #1e293b'}}>
                <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Name</th>
                <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Role</th>
                <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>In Time</th>
                <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Out Time</th>
                <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Duration</th>
                <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {logsList.map((log) => (
                <tr key={log.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                  <td style={{padding:'0.8rem 0.5rem', fontWeight:'600', color:'#1e293b', fontSize:'0.95rem'}}>{log.name}</td>
                  <td style={{padding:'0.8rem 0.5rem', color:'#475569', fontSize:'0.9rem'}}>
                    {log.role} {log.docType ? `(${log.docType})` : ''}
                  </td>
                  <td style={{padding:'0.8rem 0.5rem', fontWeight:'500', color:'#1e293b', fontSize:'0.9rem'}}>{formatAMPM(log.inTime)}</td>
                  <td style={{padding:'0.8rem 0.5rem', fontWeight:'500', color:'#1e293b', fontSize:'0.9rem'}}>{formatAMPM(log.outTime)}</td>
                  <td style={{padding:'0.8rem 0.5rem', fontWeight:'700', color:'#0369a1', fontSize:'0.9rem'}}>{calculateStayTime(log.inTime, log.outTime)}</td>
                  <td style={{padding:'0.8rem 0.5rem'}}>
                    <span style={{ fontWeight: '600', color: '#1e293b', fontSize:'0.85rem' }}>
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    );
  };

  const getSelectedMemberName = () => {
    const d = doctors.find(doc => doc.id === reportMemberId);
    if(d) return d.name;
    const s = staff.find(stf => stf.id === reportMemberId);
    if(s) return s.name;
    return 'Unknown Member';
  };

  const renderReportsUI = () => {
    const todayLogs = Object.values(attendance).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return (
      <div className="form-card fade-in" style={{background:'white', padding:'2.5rem', borderRadius:'20px', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.05)', border:'1px solid #e2e8f0'}}>
        <style>{`
          @media print {
            .report-table th, .report-table td { font-size: 0.8rem !important; padding: 0.4rem !important; }
            .report-title, .print-header h4 { font-size: 1.4rem !important; text-align: center !important; border-bottom: none !important; margin-bottom: 1rem !important; }
            .print-header { border-bottom: 2px solid #1e293b !important; padding-bottom: 1rem !important; margin-bottom: 1.5rem !important; }
          }
        `}</style>

        <h3 className="no-print" style={{marginBottom:'2rem', display:'flex', alignItems:'center', gap:'10px', color:'#1e293b', fontSize:'1.5rem', fontWeight:'800'}}>
          Attendance Logs / Reports
        </h3>

        <div className="no-print" style={{display:'flex', gap:'10px', marginBottom:'2rem', flexWrap:'wrap'}}>
          {['today', 'daily', 'category', 'individual'].map(view => {
             const labels = { today: "Today's Logs", daily: "Daily Report", category: "Category Range", individual: "Individual Range" };
             const isActive = logView === view;
             return (
               <button key={view} onClick={() => { setLogView(view); setReportLogs([]); }} style={{
                 background: isActive ? '#1e293b' : '#f1f5f9',
                 color: isActive ? 'white' : '#64748b',
                 padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                 fontWeight: '800', fontSize: '1rem', transition:'0.2s', boxShadow: isActive ? '0 4px 10px rgba(30,41,59,0.3)' : 'none'
               }}>
                 {labels[view]}
               </button>
             );
          })}
        </div>

        {logView !== 'today' && (
          <div className="fade-in no-print" style={{background:'#f8fafc', padding:'1.5rem', borderRadius:'16px', marginBottom:'2rem', border:'1px solid #e2e8f0', display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap'}}>
             {logView === 'daily' && (
                <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'150px'}}>
                  <label style={{fontWeight:'700', color:'#475569'}}>Select Date</label>
                  <input type="date" value={reportDate} max={today} onChange={e=>setReportDate(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
                </div>
             )}

             {(logView === 'category' || logView === 'individual') && (
                <>
                  <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'150px'}}>
                    <label style={{fontWeight:'700', color:'#475569'}}>Start Date</label>
                    <input type="date" value={startDate} max={today} onChange={e=>setStartDate(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'150px'}}>
                    <label style={{fontWeight:'700', color:'#475569'}}>End Date</label>
                    <input type="date" value={endDate} max={today} onChange={e=>setEndDate(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
                  </div>
                </>
             )}

             {logView === 'category' && (
                <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'200px'}}>
                  <label style={{fontWeight:'700', color:'#475569'}}>Category Filter</label>
                  <select value={reportCategory} onChange={e=>setReportCategory(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}}>
                     <option value="OPD">OPD Doctors</option>
                     <option value="Channeling">Channeling Doctors</option>
                     <option value="staff">Nurses & Staff</option>
                  </select>
                </div>
             )}

             {logView === 'individual' && (
                <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'200px'}}>
                  <label style={{fontWeight:'700', color:'#475569'}}>Select Member</label>
                  <select value={reportMemberId} onChange={e=>setReportMemberId(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1.5px solid #cbd5e1', outline:'none', fontFamily:'inherit'}}>
                     <option value="">-- Choose Member --</option>
                     <optgroup label="OPD Doctors">
                        {doctors.filter(d=>d.docType==='OPD').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </optgroup>
                     <optgroup label="Channeling Doctors">
                        {doctors.filter(d=>d.docType==='Channeling').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </optgroup>
                     <optgroup label="Nurses & Staff">
                        {staff.map(d => <option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
                     </optgroup>
                  </select>
                </div>
             )}

             <button onClick={generateReport} disabled={isGenerating} style={{background:'var(--primary-cyan)', color:'white', border:'none', padding:'12px 24px', borderRadius:'12px', fontWeight:'800', cursor:'pointer', height:'43px', minWidth:'120px', boxShadow:'0 4px 6px rgba(6,182,212,0.3)', transition:'0.2s'}}>
                 {isGenerating ? 'Loading...' : '🚀 Generate'}
             </button>
          </div>
        )}

        {logView === 'today' ? (
          todayLogs.length === 0 ? <p style={{color:'#64748b'}}>No records saved for today.</p> : (
            <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
               {renderLogsTable(todayLogs.filter(l => l.category === 'doctor' && l.docType === 'OPD'), "OPD Doctors")}
               {renderLogsTable(todayLogs.filter(l => l.category === 'doctor' && l.docType === 'Channeling'), "Channeling Doctors")}
               {renderLogsTable(todayLogs.filter(l => l.category === 'staff'), "Nurses & Staff")}
            </div>
          )
        ) : (
          reportLogs.length === 0 ? (
             <p style={{color:'#64748b', textAlign:'center', marginTop:'2rem'}}>Select criteria and click Generate.</p>
          ) : logView === 'daily' ? (
             <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
               <div className="print-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', borderBottom:'1px solid #e2e8f0', paddingBottom:'1rem'}}>
                 <h4 style={{margin:0, color:'#1e293b', fontSize:'1.5rem', fontWeight:'800', letterSpacing:'0.5px'}}>Daily Attendance Report: {reportDate}</h4>
                 <button onClick={()=>window.print()} className="no-print" style={{background:'#1e293b', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'0.2s'}}>
                    Print Report
                 </button>
               </div>
               {renderLogsTable(reportLogs.filter(l => l.category === 'doctor' && l.docType === 'OPD'), "OPD Doctors")}
               {renderLogsTable(reportLogs.filter(l => l.category === 'doctor' && l.docType === 'Channeling'), "Channeling Doctors")}
               {renderLogsTable(reportLogs.filter(l => l.category === 'staff'), "Nurses & Staff")}
             </div>
          ) : (
             <div className="fade-in" style={{marginBottom:'2.5rem', pageBreakInside:'avoid'}}>
              <div className="print-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', borderBottom:'2px solid #1e293b', paddingBottom:'1rem'}}>
                <h4 style={{margin:0, color:'#1e293b', fontSize:'1.5rem', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                  {logView === 'category' ? `${reportCategory === 'staff' ? 'Nurses & Staff' : reportCategory + ' Doctors'} Report | ${startDate} to ${endDate}` : `Report: ${getSelectedMemberName()} | ${startDate} to ${endDate}`}
                </h4>
                <button onClick={()=>window.print()} className="no-print" style={{background:'#1e293b', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'0.2s'}}>
                    Print Report
                </button>
              </div>
              <table className="report-table" style={{width:'100%', borderCollapse:'collapse', textAlign:'left', background:'white'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid #1e293b'}}>
                      <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Date</th>
                      {logView === 'category' && <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Name</th>}
                      <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Role</th>
                      <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>In Time</th>
                      <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Out Time</th>
                      <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Duration</th>
                      <th style={{padding:'0.8rem 0.5rem', fontSize:'0.95rem', color:'#1e293b', fontWeight:'800'}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLogs.map((log) => (
                      <tr key={log.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                        <td style={{padding:'0.8rem 0.5rem', fontWeight:'600', color:'#1e293b', fontSize:'0.9rem'}}>{log.date}</td>
                        {logView === 'category' && <td style={{padding:'0.8rem 0.5rem', fontWeight:'600', color:'#1e293b', fontSize:'0.95rem'}}>{log.name}</td>}
                        <td style={{padding:'0.8rem 0.5rem', color:'#475569', fontSize:'0.9rem'}}>{log.role}</td>
                        <td style={{padding:'0.8rem 0.5rem', fontWeight:'500', color:'#1e293b', fontSize:'0.9rem'}}>{formatAMPM(log.inTime)}</td>
                        <td style={{padding:'0.8rem 0.5rem', fontWeight:'500', color:'#1e293b', fontSize:'0.9rem'}}>{formatAMPM(log.outTime)}</td>
                        <td style={{padding:'0.8rem 0.5rem', fontWeight:'700', color:'#0369a1', fontSize:'0.9rem'}}>{calculateStayTime(log.inTime, log.outTime)}</td>
                        <td style={{padding:'0.8rem 0.5rem'}}>
                          <span style={{ fontWeight: '600', color: '#1e293b', fontSize:'0.85rem' }}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            </div>
          )
        )}
      </div>
    );
  };

  const getTabStyle = (isActive, isDark = false) => ({
    flex: 1,
    background: isActive ? (isDark ? '#1e293b' : 'var(--primary-cyan)') : 'transparent',
    color: isActive ? 'white' : '#64748b',
    border: 'none',
    padding: '1.2rem',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '1.1rem',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
    boxShadow: isActive ? (isDark ? '0 8px 16px -4px rgba(30, 41, 59, 0.4)' : '0 8px 16px -4px rgba(6, 182, 212, 0.4)') : 'none',
    outline: 'none',
    transform: isActive ? 'scale(1.02)' : 'scale(1)'
  });

  const opdDoctors = doctors.filter(d => d.docType === 'OPD');
  const channelingDoctors = doctors.filter(d => d.docType === 'Channeling');

  return (
    <div className="registration-panel fade-in">
       <div className="no-print" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
         <div>
           <h2 style={{margin:0, fontSize:'1.6rem', color:'#1e293b'}}>Daily Attendance</h2>
           <p style={{color:'var(--primary-cyan)', margin:'0.3rem 0 0 0', fontWeight:'700', fontSize:'1.1rem'}}>Date: {today}</p>
         </div>
       </div>

       <div className="no-print" style={{
        display:'flex', 
        marginBottom:'2rem', 
        background:'#f8fafc', 
        padding:'0.8rem', 
        borderRadius:'20px', 
        width: '100%',
        gap: '0.8rem',
        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.03), 0 4px 6px -1px rgba(0,0,0,0.05)',
        boxSizing: 'border-box'
      }}>
        <button onClick={() => setActiveTab('doctors')} style={getTabStyle(activeTab === 'doctors')}>
          <span style={{fontSize: '1.4rem'}}>👨‍⚕️</span> Doctors
        </button>
        <button onClick={() => setActiveTab('staff')} style={getTabStyle(activeTab === 'staff')}>
          <span style={{fontSize: '1.4rem'}}>👩‍⚕️</span> Nurses & Staff
        </button>
        <button onClick={() => setActiveTab('logs')} style={getTabStyle(activeTab === 'logs', true)}>
          <span style={{fontSize: '1.4rem'}}>📋</span> Logs
        </button>
      </div>

       {loading ? <div style={{textAlign:'center', padding:'2rem', color:'#64748b'}}>Loading attendance data...</div> : (
         <div className="fade-in">
            {activeTab === 'doctors' && (
              <div style={{display:'flex', flexDirection:'column', gap:'3rem'}}>
                 <div>
                   <h3 style={{color:'#334155', display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.5rem', fontSize:'1.4rem'}}>
                     <span style={{fontSize:'1.6rem'}}>🏥</span> OPD Doctors
                   </h3>
                   {renderList(opdDoctors)}
                 </div>
                 <div style={{borderTop:'2px solid #f1f5f9', paddingTop:'2rem'}}>
                   <h3 style={{color:'#334155', display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.5rem', fontSize:'1.4rem'}}>
                     <span style={{fontSize:'1.6rem'}}>🩺</span> Channeling Doctors
                   </h3>
                   {renderList(channelingDoctors)}
                 </div>
              </div>
            )}
            {activeTab === 'staff' && renderList(staff)}
            {activeTab === 'logs' && renderReportsUI()}
         </div>
       )}
    </div>
  );
}
