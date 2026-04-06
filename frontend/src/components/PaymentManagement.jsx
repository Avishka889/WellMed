import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

const formatAMPM = (timeStr) => {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':');
  let hr = parseInt(h);
  const ap = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return `${hr}:${m} ${ap}`;
};

const PRINT_STYLES = `
  @media print {
    @page { margin: 12mm; size: A4 portrait; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    body { background: white !important; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, sans-serif; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .registration-panel { border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; box-shadow: none !important; background: white !important; }
    .report-print-container { padding: 0; background: white !important; }
    
    table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 25px; }
    th, td { border: none !important; border-bottom: 1px dashed #ccc !important; padding: 8px 6px !important; font-size: 10pt !important; color: #000 !important; text-align: left; }
    th { border-bottom: 2px solid #000 !important; font-weight: 900; background: transparent !important; text-transform: uppercase; font-size: 9pt; }
    
    .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
    .print-logo { width: 80px; height: auto; margin-bottom: 10px; }
    .print-hospital-name { font-size: 26pt; font-weight: 900; color: #000; margin-bottom: 2px; letter-spacing: -1px; }
    
    h3, h4 { color: #000 !important; border-bottom: none; padding-bottom: 0; margin-top: 25px; margin-bottom: 10px; page-break-after: avoid; font-weight: 800; }
    h3 { font-size: 18pt; text-decoration: underline; text-underline-offset: 4px; }
    h4 { font-size: 13pt; border-left: 5px solid #000; padding-left: 10px; }
  }
  .print-only { display: none; }
`;

const Card = ({ label, value, color = '#1e293b', sub, icon }) => (
  <div style={{
    background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '1.25rem', flex: 1, minWidth: '220px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column',
    justifyContent: 'center'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</p>
      {icon && <span style={{ fontSize: '1.1rem' }}>{icon}</span>}
    </div>
    <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color }}>{value}</p>
    {sub && <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#94a3b8', fontWeight: '500' }}>{sub}</p>}
  </div>
);

export default function PaymentManagement({ bypassPassword = false }) {
  const [authenticated, setAuthenticated] = useState(bypassPassword);
  const [pwInput, setPwInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Load from environment variable
  const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL;

  const [filterMode, setFilterMode] = useState('daily'); 
  const today = new Date().toLocaleDateString('en-CA');
  const [singleDate, setSingleDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [isLoading, setIsLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  const [opdTotal, setOpdTotal] = useState(0);
  const [channellingTotal, setChannellingTotal] = useState(0);
  const [procNurseTotal, setProcNurseTotal] = useState(0);
  const [procDoctorTotal, setProcDoctorTotal] = useState(0);
  const [procHospitalTotal, setProcHospitalTotal] = useState(0);

  const [visitRecords, setVisitRecords] = useState([]);
  const [procRecords, setProcRecords] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  
  const [nurseList, setNurseList] = useState([]);
  const [doctorList, setDoctorList] = useState([]);
  const [channellingDoctorList, setChannellingDoctorList] = useState([]);
  const [allDocData, setAllDocData] = useState([]);

  const [selectedNurseName, setSelectedNurseName] = useState('');
  const [selectedDoctorName, setSelectedDoctorName] = useState('');
  const [selectedDoctorType, setSelectedDoctorType] = useState(''); 

  const handleLogin = async () => {
    if (!pwInput) return toast.error("Please enter password.");
    setIsVerifying(true);
    const id = toast.loading("Verifying Owner Credentials...");
    try {
      await signInWithEmailAndPassword(auth, OWNER_EMAIL, pwInput);
      setAuthenticated(true);
      toast.success("Identity Verified!", { id });
    } catch (err) {
      console.error(err);
      toast.error("Invalid Owner Password. Access Denied.", { id });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    const fetchStaff = async () => {
      const dSnap = await getDocs(collection(db, 'doctors'));
      const dArr = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllDocData(dArr);
      setDoctorList(dArr.filter(d => d.type === 'OPD').map(d => d.name));
      setChannellingDoctorList(dArr.filter(d => d.type === 'Channelling').map(d => d.name));
      const sSnap = await getDocs(collection(db, 'staff'));
      setNurseList(sSnap.docs.filter(s => ['Nurse', 'Training Nurse'].includes(s.data().role)).map(s => s.data().name));
    };
    fetchStaff();
  }, [authenticated]);

  const generateReport = async () => {
    const start = filterMode === 'daily' ? singleDate : startDate;
    const end = filterMode === 'daily' ? singleDate : endDate;
    if (!start || !end) return toast.error('Check dates.');
    setIsLoading(true);
    setReportGenerated(false);
    const toMs = (v) => v?.toDate ? v.toDate().getTime() : (v ? new Date(v).getTime() : 0);
    const startTs = new Date(start + 'T00:00:00').getTime();
    const endTs = new Date(end + 'T23:59:59').getTime();
    try {
      const vSnap = await getDocs(collection(db, 'visits'));
      const fVisits = vSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => {
        const t = toMs(v.timestamp); return t >= startTs && t <= endTs;
      });
      fVisits.sort((a,b) => toMs(a.timestamp) - toMs(b.timestamp));
      setVisitRecords(fVisits);
      let oSum = 0, cSum = 0;
      fVisits.forEach(v => {
        const fee = Number(v.amount) || (Number(v.doctorCharge || 0) + Number(v.hospitalCharge || 0));
        const isOPD = v.serviceType === 'OPD' || v.type === 'OPD';
        const isChan = v.serviceType === 'Channelling' || (!isOPD && (v.serviceType === 'Channelling' || v.type === 'Channelling' || v.appointmentNo?.startsWith('CH')));
        if (isOPD) oSum += fee; else if (isChan) cSum += fee;
      });
      setOpdTotal(oSum); setChannellingTotal(cSum);
      const pSnap = await getDocs(collection(db, 'additional_visit_services'));
      const fProcs = pSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
        const t = toMs(p.timestamp); return t >= startTs && t <= endTs;
      });
      fProcs.sort((a,b) => toMs(a.timestamp) - toMs(b.timestamp));
      setProcRecords(fProcs);
      let nSum = 0, dSum = 0, hSum = 0;
      fProcs.forEach(p => {
        (p.services || []).forEach(s => {
          const nE = Number(s.nurseCut || s.nurseEarnings || 0);
          const dE = Number(s.docCut || s.doctorEarnings || 0);
          // FIX: For Fixed price, the price/base is already the total. For Variable, it is Base + Doc cut.
          const total = s.type === 'Fixed' 
            ? Number(s.price || s.base || 0) 
            : (Number(s.base || s.baseAmount || 0) + dE);
          
          nSum += nE; dSum += dE; hSum += (total - nE - dE);
        });
      });
      setProcNurseTotal(nSum); setProcDoctorTotal(dSum); setProcHospitalTotal(hSum);
      const aSnap = await getDocs(collection(db, 'attendance'));
      const fAtt = aSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => {
        const t = new Date(a.date + 'T12:00:00').getTime(); return t >= startTs && t <= endTs;
      });
      fAtt.sort((a,b) => (a.date !== b.date) ? a.date.localeCompare(b.date) : (a.inTime || '').localeCompare(b.inTime || ''));
      setAttendanceRecords(fAtt);
      setReportGenerated(true);
      toast.success('Report generated!');
    } catch (err) { toast.error('Failed to generate.'); } finally { setIsLoading(false); }
  };

  const calculateStayHours = (inT, outT) => {
    if (!inT || !outT) return 0;
    const [iH, iM] = inT.split(':').map(Number);
    const [oH, oM] = outT.split(':').map(Number);
    const diff = (oH * 60 + oM) - (iH * 60 + iM);
    return diff > 0 ? Math.round(diff / 60) : 0;
  };

  if (!authenticated) {
    return (
      <div className="registration-panel fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '2.5rem', maxWidth: '360px', width: '100%', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Owner Verification</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Enter your Owner Account Password to access financial data.</p>
          <input type="password" value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Current Owner Password" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem', outline: 'none' }} autoFocus />
          <button onClick={handleLogin} disabled={isVerifying} style={{ width: '100%', padding: '12px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: isVerifying ? 0.7 : 1 }}>{isVerifying ? 'Verifying...' : 'Unlock Audit'}</button>
        </div>
      </div>
    );
  }

  const isAudit = selectedNurseName || selectedDoctorName;

  return (
    <div className="registration-panel fade-in">
      <style>{PRINT_STYLES}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', whiteSpace: 'nowrap' }}>Financial Reporting</h2>
        {!bypassPassword && (
          <button onClick={() => setAuthenticated(false)} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer' }}>🔒 Lock Data</button>
        )}
      </div>

      <div className="no-print" style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.2rem' }}>
          {[['daily', 'Single Day'], ['range', 'Date Range']].map(([m, l]) => (
            <button key={m} onClick={() => { setFilterMode(m); setReportGenerated(false); }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', background: filterMode === m ? '#0369a1' : 'white', color: filterMode === m ? 'white' : '#475569', border: '1px solid #e2e8f0', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {filterMode === 'daily' ? (
            <div style={{ flex: '1 1 200px' }}><label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight:'700' }}>Date</label><input type="date" value={singleDate} max={today} onChange={e => { setSingleDate(e.target.value); setReportGenerated(false); }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} /></div>
          ) : (
            <>
              <div style={{ flex: '1 1 140px' }}><label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight:'700' }}>From</label><input type="date" value={startDate} max={today} onChange={e => { setStartDate(e.target.value); setReportGenerated(false); }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} /></div>
              <div style={{ flex: '1 1 140px' }}><label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight:'700' }}>To</label><input type="date" value={endDate} max={today} onChange={e => { setEndDate(e.target.value); setReportGenerated(false); }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} /></div>
            </>
          )}
          <select value={selectedNurseName} onChange={e => { setSelectedNurseName(e.target.value); setSelectedDoctorName(''); setReportGenerated(false); }} style={{ flex: '1 1 200px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <option value="">-- All Nurses --</option>
            {nurseList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={selectedDoctorName} onChange={e => { 
            const val = e.target.value; setSelectedDoctorName(val); setSelectedNurseName('');
            if (doctorList.includes(val)) setSelectedDoctorType('OPD');
            else if (channellingDoctorList.includes(val)) setSelectedDoctorType('Channelling');
            else setSelectedDoctorType('');
            setReportGenerated(false);
          }} style={{ flex: '1 1 200px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <option value="">-- All Doctors --</option>
            {doctorList.length > 0 && <optgroup label="OPD">{doctorList.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>}
            {channellingDoctorList.length > 0 && <optgroup label="Channelling">{channellingDoctorList.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>}
          </select>
          <button onClick={generateReport} disabled={isLoading} style={{ width: '130px', background: '#00B4D8', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{isLoading ? '...' : 'Generate'}</button>
        </div>
      </div>

      {reportGenerated && (
        <div className="report-print-container">
          <div className="print-only print-header">
            <img src="/logo.png" alt="WellMed" className="print-logo" />
            <h2 className="print-hospital-name">WellMed</h2>
            <p style={{margin:'0 0 15px 0', fontSize: '11pt', fontWeight:'600', color: '#334155'}}>Specialist Medical &amp; Diabetic Care</p>
            <div style={{height: '1px', background: '#ccc', width: '60%', margin: '0 auto 15px auto'}}></div>
            <h3 style={{margin:'0 0 10px 0'}}>{isAudit ? 'STAFF PERFORMANCE AUDIT' : 'FINANCIAL SUMMARY REPORT'}</h3>
            <p style={{ margin: '5px 0', fontWeight:'800', fontSize: '10pt', color: '#4b5563', textTransform: 'uppercase' }}>Period: {filterMode === 'daily' ? singleDate : `${startDate} to ${endDate}`}</p>
          </div>
          {!isAudit && (
            <div className="no-print">
              <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <Card label="Total Admissions" value={visitRecords.length + procRecords.length} icon="👥" sub="Aggregate caseload" />
                <Card label="OPD Revenue" value={fmt(opdTotal)} color="#0369a1" sub={`${visitRecords.filter(v=>v.serviceType==='OPD').length} Patients`} />
                <Card label="Channelling Revenue" value={fmt(channellingTotal)} color="#7c3aed" sub={`${visitRecords.filter(v=>v.serviceType==='Channelling').length} Patients`} />
                <Card label="Total Proc. Value" value={fmt(procHospitalTotal+procDoctorTotal+procNurseTotal)} color="#16a34a" sub={`${procRecords.length} Procedures`} />
              </div>
            </div>
          )}
          <div style={{marginTop:'25px'}}>
             {isAudit ? (
                <div className="fade-in">
                  <h4 style={{fontSize: '1.4rem', borderBottom: '2px solid #00B4D8', paddingBottom: '8px'}}>Staff Audit Report: {selectedDoctorName || selectedNurseName}</h4>
                  <table style={{width:'100%', borderCollapse:'collapse', marginBottom: '30px', fontSize: '0.9rem'}}>
                    <thead>
                      <tr style={{background: '#f8fafc', borderBottom: '2px solid #cbd5e1'}}>
                        <th style={{padding: '10px', textAlign: 'left'}}>Date</th>
                        <th style={{padding: '10px', textAlign: 'left'}}>Patient Name</th>
                        <th style={{padding: '10px', textAlign: 'left'}}>Type</th>
                        <th style={{padding: '10px', textAlign: 'right'}}>Total Charge</th>
                        <th style={{padding: '10px', textAlign: 'right', color: '#0369a1'}}>Hospital</th>
                        <th style={{padding: '10px', textAlign: 'right', color: '#7c3aed'}}>Your Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let staffEarnings = 0;
                        let hospitalTotal = 0;
                        let count = 0;
                        const filteredProcs = [];
                        
                        procRecords.forEach(p => {
                          const safeDate = p.date || (p.timestamp?.toDate ? p.timestamp.toDate().toLocaleDateString('en-CA') : (p.timestamp ? new Date(p.timestamp).toLocaleDateString('en-CA') : '-'));
                          const isProcMatch = (selectedDoctorName && p.activeDoctorName === selectedDoctorName) || 
                                             (selectedNurseName && p.activeNurseName === selectedNurseName);
                          
                          if (isProcMatch) {
                            (p.services || []).forEach(s => {
                              const nE = Number(s.nurseCut || 0);
                              const dE = Number(s.docCut || 0);
                              const myE = selectedDoctorName ? dE : nE;
                              const total = s.type === 'Fixed' ? Number(s.price || s.base || 0) : (Number(s.base || s.baseAmount || 0) + dE);
                              const hNet = total - nE - dE;
                              
                              staffEarnings += myE;
                              hospitalTotal += hNet;
                              filteredProcs.push({ date: safeDate, name: p.patientName, service: s.name, total, hospital: hNet, earnings: myE });
                              count++;
                            });
                          }
                        });

                        const filteredVisits = visitRecords.filter(v => 
                          (selectedDoctorName && v.doctor === selectedDoctorName)
                        );
                        
                        filteredVisits.forEach(v => {
                           const e = Number(v.doctorCharge || 0);
                           staffEarnings += e;
                           hospitalTotal += Number(v.hospitalCharge || 0);
                           count++;
                        });

                        if (count === 0) return <tr><td colSpan="6" style={{padding: '20px', textAlign: 'center', color: '#94a3b8'}}>No direct earnings found for this staff member in this period.</td></tr>;

                        return (
                          <>
                            {filteredVisits.map(v => (
                              <tr key={v.id} style={{borderBottom: '1px solid #e2e8f0'}}>
                                <td style={{padding: '10px'}}>{v.date}</td>
                                <td style={{padding: '10px'}}>{v.patientName}</td>
                                <td style={{padding: '10px'}}>{v.serviceType || v.type}</td>
                                <td style={{padding: '10px', textAlign: 'right'}}>{fmt(v.amount)}</td>
                                <td style={{padding: '10px', textAlign: 'right', color: '#0369a1'}}>{fmt(v.hospitalCharge)}</td>
                                <td style={{padding: '10px', textAlign: 'right', color: '#7c3aed', fontWeight:'600'}}>{fmt(v.doctorCharge)}</td>
                              </tr>
                            ))}
                            {filteredProcs.map((p, ix) => (
                              <tr key={`p-${ix}`} style={{borderBottom: '1px solid #e2e8f0'}}>
                                <td style={{padding: '10px'}}>{p.date}</td>
                                <td style={{padding: '10px'}}>{p.name}</td>
                                <td style={{padding: '10px'}}>{p.service} (P)</td>
                                <td style={{padding: '10px', textAlign: 'right'}}>{fmt(p.total)}</td>
                                <td style={{padding: '10px', textAlign: 'right', color: '#0369a1'}}>{fmt(p.hospital)}</td>
                                <td style={{padding: '10px', textAlign: 'right', color: '#7c3aed', fontWeight:'600'}}>{fmt(p.earnings)}</td>
                              </tr>
                            ))}
                            <tr style={{background: '#f1f5f9', fontWeight: '800'}}>
                              <td colSpan="4" style={{padding: '12px'}}>STAFF PERFORMANCE TOTALS</td>
                              <td style={{padding: '12px', textAlign: 'right', color: '#0369a1'}}>{fmt(hospitalTotal)}</td>
                              <td style={{padding: '12px', textAlign: 'right', color: '#7c3aed', fontSize:'1.1rem'}}>{fmt(staffEarnings)}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
             ) : (
                <>
                  <h4>Clinic Revenue Summary</h4>
                  <table style={{width:'100%', borderCollapse:'collapse', marginBottom: '30px'}}>
                    <thead>
                      <tr style={{borderBottom: '2px solid #e2e8f0'}}>
                        <th style={{padding: '12px', textAlign: 'left'}}>Category</th>
                        <th style={{padding: '12px', textAlign: 'center'}}>Patient Count</th>
                        <th style={{padding: '12px', textAlign: 'right'}}>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
                        <td style={{padding: '12px', fontWeight: '600'}}>OPD Consultations</td>
                        <td style={{padding: '12px', textAlign: 'center'}}>
                          {(() => {
                              const list = visitRecords.filter(v => v.serviceType === 'OPD' || v.type === 'OPD');
                              const morn = list.filter(v => {
                                const dt = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.timestamp);
                                return dt.getHours() < 13;
                              }).length;
                              const eve = list.length - morn;
                              return (
                                <span>
                                  <strong>{list.length}</strong> <br/>
                                  <small style={{color:'#64748b'}}>Morn: {morn} | Eve: {eve}</small>
                                </span>
                              );
                          })()}
                        </td>
                        <td style={{padding: '12px', textAlign: 'right'}}>{fmt(opdTotal)}</td>
                      </tr>
                      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
                        <td style={{padding: '12px', fontWeight: '600'}}>Specialist Channelling</td>
                        <td style={{padding: '12px', textAlign: 'center'}}><strong>{visitRecords.filter(v=> v.serviceType=== 'Channelling' || v.type === 'Channelling' || v.appointmentNo?.startsWith('CH')).length}</strong></td>
                        <td style={{padding: '12px', textAlign: 'right'}}>{fmt(channellingTotal)}</td>
                      </tr>
                      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
                        <td style={{padding: '12px', fontWeight: '600'}}>Clinical Procedures</td>
                        <td style={{padding: '12px', textAlign: 'center'}}><strong>{procRecords.length}</strong></td>
                        <td style={{padding: '12px', textAlign: 'right'}}>{fmt(procHospitalTotal + procDoctorTotal + procNurseTotal)}</td>
                      </tr>
                      <tr style={{background: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontSize: '13pt'}}>
                        <td style={{padding: '15px', fontWeight: '800', color: '#000'}}>GRAND TOTAL REVENUE</td>
                        <td style={{padding: '15px', textAlign: 'center', fontWeight: '800', color: '#000'}}>
                           Patients: {(() => {
                              const uniqueIds = new Set();
                              visitRecords.forEach(v => v.patientId && uniqueIds.add(v.patientId));
                              procRecords.forEach(p => p.patientId && uniqueIds.add(p.patientId));
                              return uniqueIds.size > 0 ? uniqueIds.size : (visitRecords.length + procRecords.length);
                           })()}
                        </td>
                        <td style={{padding: '15px', textAlign: 'right', fontWeight: '800', color: '#000'}}>{fmt(opdTotal + channelingTotal + procHospitalTotal + procDoctorTotal + procNurseTotal)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4 style={{marginTop: '40px', borderBottom: '2px solid #00B4D8'}}>Clinical Procedures: Individual Breakdown</h4>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize: '0.9rem'}}>
                    <thead>
                      <tr style={{background: '#f8fafc', borderBottom: '2px solid #cbd5e1'}}>
                        <th style={{padding: '10px', textAlign: 'left'}}>Patient / Date</th>
                        <th style={{padding: '10px', textAlign: 'left'}}>Procedure</th>
                        <th style={{padding: '10px', textAlign: 'right'}}>Total Charge</th>
                        <th style={{padding: '10px', textAlign: 'right', color: '#0369a1'}}>Hospital Net</th>
                        <th style={{padding: '10px', textAlign: 'right', color: '#7c3aed'}}>Doctor Fee</th>
                        <th style={{padding: '10px', textAlign: 'right', color: '#16a34a'}}>Nurse Fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procRecords.length === 0 ? (
                        <tr><td colSpan="6" style={{padding: '20px', textAlign: 'center', color: '#94a3b8'}}>No procedure records found for this period.</td></tr>
                      ) : procRecords.map((p, idx) => (
                        (p.services || []).map((s, sIdx) => {
                          const nE = Number(s.nurseCut || s.nurseEarnings || 0);
                          const dE = Number(s.docCut || s.doctorEarnings || 0);
                          const total = s.type === 'Fixed' ? Number(s.price || s.base || 0) : (Number(s.base || s.baseAmount || 0) + dE);
                          const hNet = total - nE - dE;
                          
                          return (
                            <tr key={`${idx}-${sIdx}`} style={{borderBottom: '1px solid #e2e8f0'}}>
                              <td style={{padding: '10px'}}>{p.patientName}<br/><small style={{color: '#64748b'}}>{p.date}</small></td>
                              <td style={{padding: '10px', fontWeight: '600'}}>{s.name} <small style={{fontWeight:'normal', color:'#94a3b8'}}>({s.type})</small></td>
                              <td style={{padding: '10px', textAlign: 'right', fontWeight: '700'}}>{fmt(total)}</td>
                              <td style={{padding: '10px', textAlign: 'right', color: '#0369a1', fontWeight: '600'}}>{fmt(hNet)}</td>
                              <td style={{padding: '10px', textAlign: 'right', color: '#7c3aed'}}>{fmt(dE)}</td>
                              <td style={{padding: '10px', textAlign: 'right', color: '#16a34a'}}>{fmt(nE)}</td>
                            </tr>
                          );
                        })
                      ))}
                    </tbody>
                    {procRecords.length > 0 && (
                      <tfoot>
                        <tr style={{background: '#f1f5f9', fontWeight: '800'}}>
                          <td colSpan="2" style={{padding: '12px'}}>TOTAL PROCEDURES SUMMARY</td>
                          <td style={{padding: '12px', textAlign: 'right'}}>{fmt(procHospitalTotal + procDoctorTotal + procNurseTotal)}</td>
                          <td style={{padding: '12px', textAlign: 'right', color: '#0369a1'}}>{fmt(procHospitalTotal)}</td>
                          <td style={{padding: '12px', textAlign: 'right', color: '#7c3aed'}}>{fmt(procDoctorTotal)}</td>
                          <td style={{padding: '12px', textAlign: 'right', color: '#16a34a'}}>{fmt(procNurseTotal)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </>
             )}

             <div className="no-print" style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                <button onClick={() => window.print()} style={{ background: '#0369a1', color: 'white', border: 'none', padding: '14px 45px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 18px rgba(3,105,161,0.25)', fontSize: '1rem', transition: '0.3s' }}>
                  Print Detailed Financial Report
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
