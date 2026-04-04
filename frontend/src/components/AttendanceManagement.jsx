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

  const handleReEnter = async () => {
    setIsSaving(true);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    setInTime(currentTime);
    setOutTime('');
    // PASS NULL AS recordId TO CREATE A NEW FRESH RECORD FOR THE SECOND SHIFT
    await onSave(member, null, currentTime, '');
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
      padding:'1.5rem', background:'white', borderRadius:'10px',
      border:'1px solid #e2e8f0',
      width: '100%', boxSizing: 'border-box', flexWrap: 'wrap', gap: '1.5rem'
    }}>
      {/* Left: Info */}
      <div style={{display:'flex', gap:'1.5rem', alignItems:'center', minWidth: '300px'}}>
        <img src={member.photoUrl || 'https://via.placeholder.com/150'} alt="pic" style={{width:'50px', height:'50px', borderRadius:'8px', objectFit:'cover', border:'1px solid #cbd5e1'}} />
        <div>
          <h4 style={{margin:0, fontSize:'1.1rem', color:'#0f172a', fontWeight:'700'}}>{member.name}</h4>
          <div style={{fontSize:'0.9rem', color:'#64748b', fontWeight:'500', marginTop:'4px'}}>
            {member.category === 'doctor' ? member.specialization : member.role}
            {member.category === 'doctor' ? ` • ${member.docType}` : ''}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{display:'flex', gap:'1rem', alignItems:'center', flexWrap: 'wrap'}}>
         
         {!isManual ? (
           // MAIN QUICK BUTTONS UI
           <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
             {!inTime ? (
               <button onClick={handleMarkIn} disabled={isSaving} style={{background:'#16a34a', color:'white', padding:'8px 20px', borderRadius:'6px', border:'none', cursor:'pointer', fontWeight:'600', transition:'0.2s'}}>Mark In</button>
             ) : (
               <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                 <span style={{color:'#334155', fontWeight:'600', fontSize:'0.85rem', border:'1px solid #cbd5e1', padding:'6px 12px', borderRadius:'6px', background:'#f8fafc'}}>In: {formatAMPM(inTime)}</span>
               </div>
             )}

             {inTime && !outTime ? (
               <button onClick={handleMarkOut} disabled={isSaving} style={{background:'#dc2626', color:'white', padding:'8px 20px', borderRadius:'6px', border:'none', cursor:'pointer', fontWeight:'700', transition:'0.2s'}}>Mark Out</button>
             ) : outTime ? (
               <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                 <span style={{color:'#334155', fontWeight:'600', fontSize:'0.85rem', border:'1px solid #cbd5e1', padding:'6px 12px', borderRadius:'6px', background:'#f8fafc'}}>In: {formatAMPM(inTime)} → Out: {formatAMPM(outTime)}</span>
                 <button onClick={handleReEnter} disabled={isSaving} style={{background:'#16a34a', color:'white', padding:'8px 16px', borderRadius:'6px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'0.85rem', transition:'0.2s'}}>Re-enter Shift</button>
               </div>
             ) : null}

             <button onClick={() => setIsManual(true)} style={{background:'transparent', color:'#475569', padding:'8px 16px', borderRadius:'6px', border:'1px solid #cbd5e1', cursor:'pointer', fontWeight:'600', marginLeft:'5px'}}>Manual</button>
           </div>
         ) : (
           // MANUAL OVERRIDE UI
           <div className="fade-in" style={{display:'flex', gap:'15px', alignItems:'center', background:'#f8fafc', padding:'12px 20px', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
             <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
               <label style={{fontSize:'0.8rem', color:'#64748b', fontWeight:'600'}}>In Time</label>
               <input type="time" value={inTime} onChange={(e)=>setInTime(e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
             </div>
             
             <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
               <label style={{fontSize:'0.8rem', color:'#64748b', fontWeight:'600'}}>Out Time</label>
               <input type="time" value={outTime} onChange={(e)=>setOutTime(e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #cbd5e1', outline:'none', fontFamily:'inherit'}} />
             </div>

             <div style={{display:'flex', gap:'8px', marginLeft:'10px', marginTop:'15px'}}>
               <button onClick={handleManualSave} disabled={isSaving} style={{background:'#00B4D8', color:'white', padding:'8px 16px', borderRadius:'6px', border:'none', cursor:'pointer', fontWeight:'700'}}>Save</button>
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
  const [allAttendanceToday, setAllAttendanceToday] = useState([]); // NEW: Store ALL records for the day
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-CA');

  // OPD Session definitions: { label, endHour, endMin, checkAfterMin: grace in minutes }
  const OPD_SESSIONS = [
    { label: 'Morning Session (7:00 AM – 10:00 AM)', endHour: 10, endMin: 0, checkAfterMin: 30 },
    { label: 'Evening Session (4:00 PM – 8:00 PM)',  endHour: 20, endMin: 0, checkAfterMin: 30 },
  ];

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
      const sortedRecords = attSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setAllAttendanceToday(sortedRecords); // Store ALL for the log view
      
      // Store the LATEST record for each member for current dashboard status
      sortedRecords.forEach(data => {
        attMap[data.memberId] = data;
      });
      setAttendance(attMap);

    } catch (err) {
      toast.error('Failed to load attendance data.');
    } finally {
       setLoading(false);
    }
  };

  useEffect(() => {
    const cleanupStaleAttendance = async () => {
      try {
        const q = query(collection(db, 'attendance'), where('status', '==', 'Present'));
        const snap = await getDocs(q);
        
        snap.forEach(async (d) => {
          const data = d.data();
          if (data.date !== today) {
             // Auto mark out missed entry from previous days
             await updateDoc(doc(db, 'attendance', d.id), {
               outTime: '23:59',
               status: 'Auto Marked Out'
             });
          }
        });
      } catch(err) {
        console.error('Cleanup error', err);
      }
    };

    const load = async () => {
      await cleanupStaleAttendance();
      await fetchData();
    };
    load();
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
        const updatedRecord = { id: recordId, ...attData };
        setAttendance(prev => ({ ...prev, [member.id]: updatedRecord }));
        setAllAttendanceToday(prev => prev.map(r => r.id === recordId ? updatedRecord : r));
        toast.success(`Updated ${typeLabel} ${member.name}'s Attendance!`);
      } else {
        const res = await addDoc(collection(db, 'attendance'), attData);
        const newRecord = { id: res.id, ...attData };
        setAttendance(prev => ({ ...prev, [member.id]: newRecord }));
        setAllAttendanceToday(prev => [...prev, newRecord]);
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
    const todayLogs = allAttendanceToday.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
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
                 background: isActive ? '#000000' : '#f1f5f9',
                 color: isActive ? 'white' : '#64748b',
                 padding: '10px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                 fontWeight: '800', fontSize: '1rem', transition:'0.2s', boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.3)' : 'none'
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
                  <input type="date" value={reportDate} max={today} onChange={e=>setReportDate(e.target.value)} style={{padding:'12px', borderRadius:'12px', border:'2px solid #e2e8f0', background:'white', outline:'none', fontFamily:'inherit', boxShadow:'0 2px 5px rgba(0,0,0,0.02)'}} />
                </div>
             )}

             {(logView === 'category' || logView === 'individual') && (
                <>
                  <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'150px'}}>
                    <label style={{fontWeight:'700', color:'#475569'}}>Start Date</label>
                    <input type="date" value={startDate} max={today} onChange={e=>setStartDate(e.target.value)} style={{padding:'12px', borderRadius:'12px', border:'2px solid #e2e8f0', background:'white', outline:'none', fontFamily:'inherit', boxShadow:'0 2px 5px rgba(0,0,0,0.02)'}} />
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'150px'}}>
                    <label style={{fontWeight:'700', color:'#475569'}}>End Date</label>
                    <input type="date" value={endDate} max={today} onChange={e=>setEndDate(e.target.value)} style={{padding:'12px', borderRadius:'12px', border:'2px solid #e2e8f0', background:'white', outline:'none', fontFamily:'inherit', boxShadow:'0 2px 5px rgba(0,0,0,0.02)'}} />
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

             <button onClick={generateReport} disabled={isGenerating} style={{background:'#00B4D8', color:'white', border:'none', padding:'10px 30px', borderRadius:'10px', fontWeight:'700', cursor:'pointer', height:'48px', minWidth:'150px', transition:'0.3s', boxShadow:'0 4px 12px rgba(0,180,216,0.2)'}}>
                 {isGenerating ? 'Loading...' : 'Generate Report'}
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
                 <button onClick={()=>window.print()} className="no-print" style={{background:'#00B4D8', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'0.2s'}}>
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
                <button onClick={()=>window.print()} className="no-print" style={{background:'#00B4D8', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'0.2s'}}>
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

  const getTabStyle = (isActive) => ({
    flex: 1,
    background: isActive ? '#F4A261' : 'transparent',
    color: isActive ? 'white' : '#475569',
    border: 'none',
    padding: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '1rem',
    transition: 'all 0.2s',
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
    outline: 'none',
    boxShadow: isActive ? '0 4px 10px rgba(244,162,97,0.3)' : 'none'
  });

  const opdDoctors = doctors.filter(d => d.docType === 'OPD');
  const channelingDoctors = doctors.filter(d => d.docType === 'Channeling');

  return (
    <div className="registration-panel fade-in">
       <div className="no-print" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
         <div>
           <h2 style={{margin:0, fontSize:'1.4rem', color:'#0f172a'}}>Daily Attendance</h2>
           <p style={{color:'#64748b', margin:'0.3rem 0 0 0', fontWeight:'500', fontSize:'0.9rem'}}>{today}</p>
         </div>
       </div>

       <div className="no-print" style={{
        display:'flex', 
        marginBottom:'2rem', 
        background:'#f8fafc', 
        padding:'0.5rem', 
        borderRadius:'10px', 
        width: '100%',
        gap: '0.5rem',
        border: '1px solid #e2e8f0',
        boxSizing: 'border-box'
      }}>
        <button onClick={() => setActiveTab('doctors')} style={getTabStyle(activeTab === 'doctors')}>
          Doctors
        </button>
        <button onClick={() => setActiveTab('staff')} style={getTabStyle(activeTab === 'staff')}>
          Nurses & Staff
        </button>
        <button onClick={() => setActiveTab('logs')} style={getTabStyle(activeTab === 'logs')}>
          Logs & Reports
        </button>
      </div>

       {loading ? <div style={{textAlign:'center', padding:'2rem', color:'#64748b'}}>Loading attendance records...</div> : (
         <div className="fade-in">
            {activeTab === 'doctors' && (
              <div style={{display:'flex', flexDirection:'column', gap:'3rem'}}>
                 <div>
                   <h3 style={{color:'#0f172a', marginBottom:'1.5rem', fontSize:'1.2rem', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>
                     OPD Doctors
                   </h3>
                   {renderList(opdDoctors)}
                 </div>
                 <div>
                   <h3 style={{color:'#0f172a', marginBottom:'1.5rem', fontSize:'1.2rem', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>
                     Channeling Doctors
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
