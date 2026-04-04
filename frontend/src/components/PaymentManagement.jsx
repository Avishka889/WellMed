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
    @page { margin: 15mm; size: A4 portrait; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    body { background: white !important; margin: 0; padding: 0; font-family: sans-serif; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .registration-panel { border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; box-shadow: none !important; background: white !important; }
    .report-print-container { padding: 0; background: white !important; }
    table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; }
    th, td { border: none !important; border-bottom: 1px dashed #ccc !important; padding: 8px 4px !important; font-size: 10.5pt !important; color: #000 !important; text-align: left; }
    th { border-bottom: 1px solid #aaa !important; font-weight: bold; background: transparent !important; }
    .print-header { text-align: center; margin-bottom: 30px; }
    .print-hospital-name { font-size: 24pt; font-weight: bold; color: #000; margin-bottom: 5px; }
    h3, h4 { color: #000 !important; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 20px; margin-bottom: 15px; page-break-after: avoid; font-size: 13pt; font-weight: bold; text-decoration: none !important; }
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
  const [channelingTotal, setChannelingTotal] = useState(0);
  const [procNurseTotal, setProcNurseTotal] = useState(0);
  const [procDoctorTotal, setProcDoctorTotal] = useState(0);
  const [procHospitalTotal, setProcHospitalTotal] = useState(0);

  const [visitRecords, setVisitRecords] = useState([]);
  const [procRecords, setProcRecords] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  
  const [nurseList, setNurseList] = useState([]);
  const [doctorList, setDoctorList] = useState([]);
  const [channelingDoctorList, setChannelingDoctorList] = useState([]);
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
      setChannelingDoctorList(dArr.filter(d => d.type === 'Channeling').map(d => d.name));
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
        const isChan = v.serviceType === 'Channeling' || (!isOPD && (v.serviceType === 'Channeling' || v.type === 'Channeling' || v.appointmentNo?.startsWith('CH')));
        if (isOPD) oSum += fee; else if (isChan) cSum += fee;
      });
      setOpdTotal(oSum); setChannelingTotal(cSum);
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
          const total = Number(s.baseAmount || s.amount || 0) + Number(s.docCut || s.doctorCharge || 0);
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
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>Financial Reporting</h2>
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
            <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight:'700' }}>Date</label><input type="date" value={singleDate} max={today} onChange={e => { setSingleDate(e.target.value); setReportGenerated(false); }} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} /></div>
          ) : (
            <>
              <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight:'700' }}>From</label><input type="date" value={startDate} max={today} onChange={e => { setStartDate(e.target.value); setReportGenerated(false); }} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight:'700' }}>To</label><input type="date" value={endDate} max={today} onChange={e => { setEndDate(e.target.value); setReportGenerated(false); }} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} /></div>
            </>
          )}
          <select value={selectedNurseName} onChange={e => { setSelectedNurseName(e.target.value); setSelectedDoctorName(''); setReportGenerated(false); }} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <option value="">-- All Nurses --</option>
            {nurseList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={selectedDoctorName} onChange={e => { 
            const val = e.target.value; setSelectedDoctorName(val); setSelectedNurseName('');
            if (doctorList.includes(val)) setSelectedDoctorType('OPD');
            else if (channelingDoctorList.includes(val)) setSelectedDoctorType('Channeling');
            else setSelectedDoctorType('');
            setReportGenerated(false);
          }} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <option value="">-- All Doctors --</option>
            {doctorList.length > 0 && <optgroup label="OPD">{doctorList.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>}
            {channelingDoctorList.length > 0 && <optgroup label="Channeling">{channelingDoctorList.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>}
          </select>
          <button onClick={generateReport} disabled={isLoading} style={{ background: '#00B4D8', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{isLoading ? '...' : 'Generate'}</button>
        </div>
      </div>

      {reportGenerated && (
        <div className="report-print-container">
          <div className="print-only print-header">
            <h2 style={{margin:'0', fontSize: '24pt', fontWeight: 'bold'}}>WellMed</h2>
            <h4 style={{margin:'5px 0 15px 0', fontWeight:'normal', textDecoration:'none', borderBottom:'none', paddingBottom:0}}>Specialist Medical &amp; Diabetic Care</h4>
            <h3 style={{margin:'0 0 5px 0', textDecoration:'underline', borderBottom:'none', paddingBottom:0}}>{isAudit ? 'STAFF AUDIT REPORT' : 'FINANCIAL SUMMARY REPORT'}</h3>
            <p style={{ margin: '5px 0', fontWeight:'600' }}>Period: {filterMode === 'daily' ? singleDate : `${startDate} to ${endDate}`}</p>
          </div>
          {!isAudit && (
            <div className="no-print">
              <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <Card label="Total Admissions" value={visitRecords.length + procRecords.length} icon="👥" sub="Aggregate caseload" />
                <Card label="OPD Revenue" value={fmt(opdTotal)} color="#0369a1" sub={`${visitRecords.filter(v=>v.serviceType==='OPD').length} Patients`} />
                <Card label="Channeling Revenue" value={fmt(channelingTotal)} color="#7c3aed" sub={`${visitRecords.filter(v=>v.serviceType==='Channeling').length} Patients`} />
                <Card label="Total Proc. Value" value={fmt(procHospitalTotal+procDoctorTotal+procNurseTotal)} color="#16a34a" sub={`${procRecords.length} Procedures`} />
              </div>
            </div>
          )}
          <div style={{marginTop:'20px'}}>
             {isAudit ? (
                <p style={{textAlign:'center', color:'#64748b'}}>Use Print button below for detail audit view.</p>
             ) : (
                <>
                  <h4>Hospital Revenue Summary</h4>
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <tbody>
                      <tr><td>OPD Consultations</td><td style={{textAlign:'right'}}>{fmt(opdTotal)}</td></tr>
                      <tr><td>Specialist Channeling</td><td style={{textAlign:'right'}}>{fmt(channelingTotal)}</td></tr>
                      <tr><td>Clinical Procedures (Total)</td><td style={{textAlign:'right'}}>{fmt(procHospitalTotal + procDoctorTotal + procNurseTotal)}</td></tr>
                      <tr style={{fontWeight:'bold', fontSize:'12pt', background:'#f1f5f9'}}><td>GRAND TOTAL REVENUE</td><td style={{textAlign:'right'}}>{fmt(opdTotal + channelingTotal + procHospitalTotal + procDoctorTotal + procNurseTotal)}</td></tr>
                    </tbody>
                  </table>
                </>
             )}
          </div>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
            <button onClick={() => window.print()} style={{ background: '#0369a1', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>🖨️ Print Detailed Report</button>
          </div>
        </div>
      )}
    </div>
  );
}
