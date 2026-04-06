import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const calculateDuration = (inT, outT) => {
  if (!inT || !outT) return '-';
  const [iH, iM] = inT.split(':').map(Number);
  const [oH, oM] = outT.split(':').map(Number);
  const diffMins = (oH * 60 + oM) - (iH * 60 + iM);
  if (diffMins <= 0) return '-';
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hrs}h ${mins}m`;
};

const getHoursDecimal = (inT, outT) => {
  if (!inT || !outT) return 0;
  const [iH, iM] = inT.split(':').map(Number);
  const [oH, oM] = outT.split(':').map(Number);
  const diffMins = (oH * 60 + oM) - (iH * 60 + iM);
  return diffMins > 0 ? (diffMins / 60) : 0;
};

export default function DailySummary() {
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [activeTab, setActiveTab] = useState('earnings');

  const [stats, setStats] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [activeStaffCount, setActiveStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const startTs = new Date(reportDate + 'T00:00:00').getTime();
      const endTs = new Date(reportDate + 'T23:59:59').getTime();

      // 1. Fetch Attendance First
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', reportDate)));
      const atts = attSnap.docs.map(d => d.data());
      
      const activeCount = atts.filter(a => a.status === 'Present').length;
      setActiveStaffCount(activeCount);
      
      atts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setAttendance(atts);

      // 2. Fetch Doctors to get OPD Hourly Rates
      const docsSnap = await getDocs(collection(db, 'doctors'));
      const hrRates = {};
      docsSnap.docs.forEach(d => {
         const data = d.data();
         if (data.type === 'OPD') hrRates[data.name] = Number(data.hourlyRate) || 0;
      });

      // 3. Fetch Data if no active staff
      if (activeCount === 0 && atts.length > 0) {
        
        let counts = { opd: 0, chan: 0, proc: 0, newPat: 0, regPat: 0, total: 0 };
        let amounts = { opd: 0, chan: 0, proc: 0, total: 0 };
        let procBreakdown = { hosp: 0, doc: 0, nurse: 0 };
        let procedureTypeCounts = {}; // NEW: { "ECG": 5, "Wound Dressing": 2 }
        
        let chanDoctorBreakdown = {}; // { docName: { doc: 0, hosp: 0 } }
        let opdDoctorBreakdown = {};  // { docName: { procCharge: 0 } }

        // Fetch Visits
        const visitsSnap = await getDocs(collection(db, 'visits'));
        visitsSnap.forEach(d => {
          const v = d.data();
          const t = v.timestamp?.toMillis ? v.timestamp.toMillis() : new Date(v.timestamp).getTime();
          if (t >= startTs && t <= endTs) {
            counts.total++;
            const tFee = Number(v.amount) || (Number(v.doctorCharge || 0) + Number(v.hospitalCharge || 0));
            amounts.total += tFee;

            const isOPD = v.serviceType === 'OPD' || v.type === 'OPD';
            const isChan = v.serviceType === 'Channelling' || (!isOPD && (v.serviceType === 'Channelling' || v.type === 'Channelling' || v.appointmentNo?.startsWith('CH')));

            if (isOPD) {
              const docName = v.doctor || 'Unknown Doctor';
              counts.opd++;
              amounts.opd += tFee;
              if (!opdDoctorBreakdown[docName]) opdDoctorBreakdown[docName] = { procCharge: 0, opdConsultCharge: 0, opdCount: 0 };
              opdDoctorBreakdown[docName].opdConsultCharge += tFee;
              opdDoctorBreakdown[docName].opdCount++;
            } else if (isChan) {
              // Channelling
              counts.chan++;
              amounts.chan += tFee;
              const docName = v.doctor || 'Unknown Doctor';
              const dFee = Number(v.doctorCharge || 0);
              const hFee = Number(v.hospitalCharge || 0);
              if (!chanDoctorBreakdown[docName]) chanDoctorBreakdown[docName] = { doc: 0, hosp: 0 };
              chanDoctorBreakdown[docName].doc += dFee;
              chanDoctorBreakdown[docName].hosp += hFee;
            }
          }
        });

        // Fetch Procedures
        const procSnap = await getDocs(collection(db, 'additional_visit_services'));
        procSnap.forEach(d => {
          const p = d.data();
          const t = p.timestamp?.toMillis ? p.timestamp.toMillis() : new Date(p.timestamp).getTime();
          if (t >= startTs && t <= endTs) {
            counts.total++;
            counts.proc++;
            
            let pTotal = 0; let pDoc = 0; let pNurse = 0; let pHosp = 0;
            const opdDocName = p.activeDoctorName || 'Unknown Doctor';

            (p.services || []).forEach(s => {
              const nurseE = Number(s.nurseCut || s.nurseEarnings || 0);
              const docE = Number(s.docCut || s.doctorEarnings || 0);
              
              // Count procedure type
              const sName = s.name || 'Unspecified';
              procedureTypeCounts[sName] = (procedureTypeCounts[sName] || 0) + 1;

              // FIX: Use the same logic as PaymentManagement
              const tot = s.type === 'Fixed' 
                ? Number(s.price || s.base || s.baseAmount || 0) 
                : (Number(s.base || s.baseAmount || 0) + docE);
              
              pHosp += (tot - nurseE - docE);
              pDoc += docE;
              pNurse += nurseE;
              pTotal += tot;
            });

            amounts.total += pTotal;
            amounts.proc += pTotal;
            
            procBreakdown.hosp += pHosp;
            procBreakdown.doc += pDoc;
            procBreakdown.nurse += pNurse;

            if (!opdDoctorBreakdown[opdDocName]) opdDoctorBreakdown[opdDocName] = { procCharge: 0, opdConsultCharge: 0 };
            opdDoctorBreakdown[opdDocName].procCharge += pDoc;
          }
        });

        // Compute New vs Registered
        const patSnap = await getDocs(collection(db, 'patients'));
        patSnap.docs.forEach(d => {
           const pData = d.data();
           if (pData.createdAt) {
             const pts = pData.createdAt.toMillis ? pData.createdAt.toMillis() : new Date(pData.createdAt).getTime();
             if (pts >= startTs && pts <= endTs) {
                counts.newPat++;
             }
           }
        });
        counts.regPat = counts.total - counts.newPat;
        if (counts.regPat < 0) counts.regPat = 0;

        // Compile OPD Doctor Final Breakdown connecting Attendance Hrs
        const opdFinalBreakdown = [];
        Object.entries(opdDoctorBreakdown).forEach(([docName, data]) => {
           if (data.opdCount > 0) {
             const avgFee = data.opdConsultCharge / data.opdCount;
             opdFinalBreakdown.push({
               name: docName,
               opdCount: data.opdCount,
               opdAmount: data.opdConsultCharge,
               perPatientFee: avgFee
             });
           }
        });

        setStats({
          counts, amounts, procBreakdown, chanDoctorBreakdown, opdFinalBreakdown, procedureTypeCounts
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate]);

  return (
    <div className="fade-in registration-panel">
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 portrait; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-logo { width: 80px; height: auto; margin-bottom: 10px; }
          body { background: white !important; font-family: 'Segoe UI', Roboto, sans-serif; color: black !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
          
          h3 { font-size: 16pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; page-break-after: avoid; }
          h4 { font-size: 13pt; margin-top: 20px; margin-bottom: 10px; border-left: 4px solid #000; padding-left: 10px; }
          
          table.print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          table.print-table td, table.print-table th { padding: 8px 5px; border-bottom: 1px dashed #ccc; text-align: left; font-size: 10pt; }
          table.print-table th { border-bottom: 1.5px solid #000; font-weight: 900; text-transform: uppercase; font-size: 9pt; }
        }
        .print-header, .print-only { display: none; }
      `}</style>
      
      <div className="no-print" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
        <h2 style={{margin:0, color:'#0f172a', fontWeight:'800'}}>
          Daily Summary &amp; Reports
        </h2>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <label style={{fontWeight:'700', color:'#475569'}}>Select Date:</label>
          <input 
            type="date" 
            value={reportDate} 
            max={new Date().toLocaleDateString('en-CA')}
            onChange={e => setReportDate(e.target.value)}
            style={{padding:'8px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', outline:'none', fontWeight:'600'}}
          />
        </div>
      </div>

      <div className="print-header">
        <img src="/logo.png" alt="WellMed" className="print-logo" />
        <h2 style={{margin:'0', fontSize: '26pt', fontWeight: '900', letterSpacing: '-1px'}}>WellMed</h2>
        <p style={{margin:'2px 0 15px 0', fontSize: '11pt', fontWeight:'600', color: '#334155'}}>Specialist Medical & Diabetic Care</p>
        <div style={{height: '1px', background: '#e2e8f0', width: '60%', margin: '0 auto 15px auto'}}></div>
        <h3 style={{margin:'0 0 5px 0', border: 'none', padding: 0, fontSize: '18pt'}}>DAILY SUMMARY REPORT</h3>
        <p style={{margin:0, fontWeight:'700', fontSize: '10pt', textTransform: 'uppercase', color: '#64748b'}}>
          Date: {reportDate} | Report Type: {activeTab === 'earnings' ? 'Financial Earnings' : 'Staff Attendance'}
        </p>
      </div>

      {loading ? (
        <div style={{padding:'3rem', textAlign:'center', color:'#64748b', fontSize:'1.1rem', fontWeight:'600'}}>Loading Report Data...</div>
      ) : activeStaffCount > 0 ? (
        <div className="no-print" style={{background:'#fef2f2', border:'1.5px solid #fecaca', padding:'3rem', borderRadius:'12px', textAlign:'center'}}>
          <div style={{fontSize:'3.5rem', marginBottom:'15px'}}>🔒</div>
          <h2 style={{color:'#991b1b', margin:'0 0 10px 0'}}>Hospital is Still Active</h2>
          <p style={{color:'#7f1d1d', margin:0, fontWeight:'600', fontSize:'1.1rem', maxWidth:'600px', marginLeft:'auto', marginRight:'auto'}}>
             {activeStaffCount} staff member(s) are currently marked as "Present". <br/><br/>
             Reports can only be generated once everyone has checked out, or when viewed the following day.
          </p>
        </div>
      ) : attendance.length === 0 ? (
        <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'3rem', borderRadius:'12px', textAlign:'center'}}>
          <div style={{fontSize:'3rem', marginBottom:'15px'}}>📭</div>
          <h3 style={{color:'#475569', margin:0}}>No Activity Recorded</h3>
          <p style={{color:'#64748b', margin:'10px 0 0 0', fontWeight:'500'}}>There are no records for the selected date ({reportDate}).</p>
        </div>
      ) : (
        <>
          <div className="no-print" style={{display:'flex', margin:'0 auto 2rem auto', background:'#f8fafc', padding:'0.5rem', borderRadius:'12px', width:'100%', maxWidth:'450px', gap:'0.5rem', border:'1px solid #e2e8f0', boxShadow:'inset 0 2px 5px rgba(0,0,0,0.02)'}}>
            <button 
              onClick={() => setActiveTab('earnings')}
              style={{flex:1, background: activeTab === 'earnings' ? '#F4A261' : 'transparent', color: activeTab === 'earnings' ? 'white' : '#64748b', border:'none', padding:'0.8rem 1rem', borderRadius:'8px', cursor:'pointer', fontWeight:'800', fontSize:'0.95rem', transition:'all 0.2s', boxShadow: activeTab === 'earnings' ? '0 4px 10px rgba(244,162,97,0.2)' : 'none'}}
            >
              Earnings Report
            </button>
            <button 
              onClick={() => setActiveTab('attendance')}
              style={{flex:1, background: activeTab === 'attendance' ? '#F4A261' : 'transparent', color: activeTab === 'attendance' ? 'white' : '#64748b', border:'none', padding:'0.8rem 1rem', borderRadius:'8px', cursor:'pointer', fontWeight:'800', fontSize:'0.95rem', transition:'all 0.2s', boxShadow: activeTab === 'attendance' ? '0 4px 10px rgba(244,162,97,0.2)' : 'none'}}
            >
              Attendance Report
            </button>
          </div>

          {activeTab === 'earnings' && stats && (
            <>
              {/* === SCREEN VIEW ONLY === */}
              <div className="fade-in no-print">
                {/* Patient Breakdown */}
                <div style={{background:'#fcfcfc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'1.5rem', marginBottom:'2rem'}}>
                   <h3 style={{color:'#1e293b', margin:'0 0 15px 0', borderBottom:'2px solid #e2e8f0', paddingBottom:'10px'}}>Patient Statistics</h3>
                   <div style={{display:'flex', flexWrap:'wrap', gap:'2rem'}}>
                      <div style={{flex:1, minWidth:'120px'}}>
                        <div style={{color:'#64748b', fontWeight:'700', fontSize:'0.9rem'}}>TOTAL PATIENTS</div>
                        <div style={{fontSize:'2rem', fontWeight:'900', color:'#0f172a'}}>{stats.counts.total}</div>
                      </div>
                      <div style={{flex:1, minWidth:'120px'}}>
                        <div style={{color:'#64748b', fontWeight:'700', fontSize:'0.9rem'}}>OPD PATIENTS</div>
                        <div style={{fontSize:'1.5rem', fontWeight:'800', color:'#0284c7'}}>{stats.counts.opd}</div>
                      </div>
                      <div style={{flex:1, minWidth:'120px'}}>
                        <div style={{color:'#64748b', fontWeight:'700', fontSize:'0.9rem'}}>CHANNELLING</div>
                        <div style={{fontSize:'1.5rem', fontWeight:'800', color:'#16a34a'}}>{stats.counts.chan}</div>
                      </div>
                      <div style={{flex:1, minWidth:'120px'}}>
                        <div style={{color:'#64748b', fontWeight:'700', fontSize:'0.9rem'}}>PROCEDURES</div>
                        <div style={{fontSize:'1.5rem', fontWeight:'800', color:'#c2410c'}}>{stats.counts.proc}</div>
                      </div>
                   </div>
                </div>

                {/* Amount Breakdown */}
                <div style={{background:'#fcfcfc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'1.5rem', marginBottom:'2rem'}}>
                   <h3 style={{color:'#1e293b', margin:'0 0 15px 0', borderBottom:'2px solid #e2e8f0', paddingBottom:'10px'}}>Overall Revenue</h3>
                   <div style={{display:'flex', gap:'0.8rem', flexWrap:'wrap'}}>
                      <div style={{flex:1, minWidth:'175px', background:'#f8fafc', padding:'0.75rem 1rem', borderRadius:'8px', border:'1px solid #cbd5e1'}}>
                        <div style={{color:'#64748b', fontWeight:'700', fontSize:'0.75rem'}}>TOTAL REVENUE</div>
                        <div style={{fontSize:'1.35rem', fontWeight:'900', color:'#0f172a'}}>Rs. {stats.amounts.total.toFixed(2)}</div>
                      </div>
                      <div style={{flex:1, minWidth:'175px', background:'#f0f9ff', padding:'0.75rem 1rem', borderRadius:'8px', border:'1px solid #bae6fd'}}>
                        <div style={{color:'#0369a1', fontWeight:'700', fontSize:'0.75rem'}}>OPD REVENUE</div>
                        <div style={{fontSize:'1.35rem', fontWeight:'800', color:'#0284c7'}}>Rs. {stats.amounts.opd.toFixed(2)}</div>
                      </div>
                      <div style={{flex:1, minWidth:'175px', background:'#f0fdf4', padding:'0.75rem 1rem', borderRadius:'8px', border:'1px solid #bbf7d0'}}>
                        <div style={{color:'#166534', fontWeight:'700', fontSize:'0.75rem'}}>CHAN. REVENUE</div>
                        <div style={{fontSize:'1.35rem', fontWeight:'800', color:'#16a34a'}}>Rs. {stats.amounts.chan.toFixed(2)}</div>
                      </div>
                      <div style={{flex:1, minWidth:'175px', background:'#fff7ed', padding:'0.75rem 1rem', borderRadius:'8px', border:'1px solid #fed7aa'}}>
                        <div style={{color:'#9a3412', fontWeight:'700', fontSize:'0.75rem'}}>PROC. REVENUE</div>
                        <div style={{fontSize:'1.35rem', fontWeight:'800', color:'#c2410c'}}>Rs. {stats.amounts.proc.toFixed(2)}</div>
                      </div>
                   </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem', alignItems: 'start'}}>
                   {/* Left Col: Channelling & Procedures */}
                   <div style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
                      {/* Procedures Breakdown */}
                      <div style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'1.5rem'}}>
                         <h4 style={{color:'#1e293b', margin:'0 0 15px 0', fontSize:'1.1rem'}}>Procedure Amount Breakdown</h4>
                         <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed #e2e8f0'}}>
                            <span style={{fontWeight:'600', color:'#475569'}}>Hospital Share</span>
                            <span style={{fontWeight:'800'}}>Rs. {stats.procBreakdown.hosp.toFixed(2)}</span>
                         </div>
                         <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed #e2e8f0'}}>
                            <span style={{fontWeight:'600', color:'#475569'}}>Doctor Share</span>
                            <span style={{fontWeight:'800'}}>Rs. {stats.procBreakdown.doc.toFixed(2)}</span>
                         </div>
                         <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1.5px solid #f1f5f9'}}>
                            <span style={{fontWeight:'600', color:'#475569'}}>Nurse Share</span>
                            <span style={{fontWeight:'800'}}>Rs. {stats.procBreakdown.nurse.toFixed(2)}</span>
                         </div>
                         <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'2px solid #e2e8f0', background:'#f8fafc', margin:'5px -1.5rem 0 -1.5rem', paddingLeft:'1.5rem', paddingRight:'1.5rem'}}>
                            <span style={{fontWeight:'800', color:'#0f172a'}}>SUBTOTAL PROCEDURES</span>
                            <span style={{fontWeight:'900', color:'#c2410c'}}>Rs. {(stats.procBreakdown.hosp + stats.procBreakdown.doc + stats.procBreakdown.nurse).toFixed(2)}</span>
                         </div>
                         
                         {/* Individual Procedure Counts */}
                         <div style={{marginTop:'12px'}}>
                            <p style={{fontSize:'0.75rem', fontWeight:'700', color:'#64748b', margin:'0 0 5px 0', textTransform:'uppercase'}}>Procedure Volume</p>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
                               {Object.entries(stats.procedureTypeCounts).map(([name, count]) => (
                                  <div key={name} style={{background:'#f1f5f9', padding:'4px 10px', borderRadius:'6px', fontSize:'0.82rem', color:'#334155', fontWeight:'600'}}>
                                     {name}: <span style={{color:'#0284c7'}}>{count}</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>

                      {/* Channelling Breakdown */}
                      <div style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'1.5rem'}}>
                         <h4 style={{color:'#1e293b', margin:'0 0 15px 0', fontSize:'1.1rem'}}>Channelling Breakdown</h4>
                         {Object.keys(stats.chanDoctorBreakdown).length === 0 ? (
                           <div style={{color:'#94a3b8', fontStyle:'italic'}}>No channelling records today.</div>
                         ) : (
                           Object.entries(stats.chanDoctorBreakdown).map(([docName, vals], i) => (
                             <div key={i} style={{marginBottom:'1rem', paddingBottom:'1rem', borderBottom:'1px solid #f1f5f9'}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                                   <div style={{fontWeight:'800', color:'#0f172a'}}>{docName}</div>
                                   <div style={{background:'#f0fdf4', padding:'2px 8px', borderRadius:'6px', fontSize:'0.85rem', color:'#166534', fontWeight:'700'}}>Total: Rs. {(vals.doc + vals.hosp).toFixed(2)}</div>
                                </div>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.85rem', color:'#64748b'}}>
                                   <span>Doctor: <b>Rs. {vals.doc.toFixed(2)}</b></span>
                                   <span>Hospital: <b>Rs. {vals.hosp.toFixed(2)}</b></span>
                                </div>
                             </div>
                           ))
                         )}
                      </div>
                   </div>

                   {/* Right Col: OPD Doctor Final Pay */}
                   <div style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'1.5rem'}}>
                      <h4 style={{color:'#1e293b', margin:'0 0 15px 0', fontSize:'1.1rem'}}>OPD Doctor Earnings</h4>
                      {stats.opdFinalBreakdown.length === 0 ? (
                        <div style={{color:'#94a3b8', fontStyle:'italic'}}>No OPD doctors attended today.</div>
                      ) : (
                        stats.opdFinalBreakdown.map((opd, i) => (
                          <div key={i} style={{marginBottom:'1.5rem', background:'#f8fafc', padding:'1rem', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                               <div style={{fontWeight:'800', color:'#0f172a', fontSize:'1.1rem'}}>{opd.name}</div>
                               <div style={{fontSize:'0.9rem', color:'#64748b', fontWeight:'700', background:'#f1f5f9', padding:'2px 10px', borderRadius:'6px'}}>{opd.opdCount} Patients</div>
                             </div>
                             
                             <div style={{display:'flex', justifyContent:'space-between', fontSize:'1rem', color:'#0f172a', fontWeight:'700', borderTop:'1px dashed #cbd5e1', paddingTop:'10px', marginTop:'10px'}}>
                                <div style={{display:'flex', flexDirection:'column'}}>
                                   <span style={{fontSize:'0.8rem', color:'#64748b', fontWeight:'500'}}>Rs. {opd.perPatientFee.toFixed(0)} × {opd.opdCount} Patients</span>
                                   <span>OPD Revenue</span>
                                </div>
                                <span style={{fontSize:'1.15rem', color:'#166534'}}>Rs. {opd.opdAmount.toFixed(2)}</span>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                </div>
              </div>

              {/* === PRINT VIEW ONLY === */}
              <div className="print-only">
                <h3>Patient Statistics</h3>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td>Total Patients Handled:</td><td><b>{stats.counts.total}</b></td>
                      <td>OPD Patients:</td><td><b>{stats.counts.opd}</b></td>
                    </tr>
                    <tr>
                      <td>Channelling Patients:</td><td><b>{stats.counts.chan}</b></td>
                      <td>Procedure Billings:</td><td><b>{stats.counts.proc}</b></td>
                    </tr>
                  </tbody>
                </table>

                <h3>Overall Revenue</h3>
                <table className="print-table">
                  <tbody>
                    <tr><td style={{width:'50%'}}>TOTAL DAILY REVENUE:</td><td><b>Rs. {stats.amounts.total.toFixed(2)}</b></td></tr>
                    <tr><td>OPD Revenue:</td><td>Rs. {stats.amounts.opd.toFixed(2)}</td></tr>
                    <tr><td>Channelling Revenue:</td><td>Rs. {stats.amounts.chan.toFixed(2)}</td></tr>
                    <tr><td>Procedures Revenue:</td><td>Rs. {stats.amounts.proc.toFixed(2)}</td></tr>
                  </tbody>
                </table>

                {stats.counts.proc > 0 && (
                  <>
                    <h3>Procedure Amount Breakdown</h3>
                    <table className="print-table">
                      <tbody>
                        <tr><td style={{width:'50%'}}>Hospital Share:</td><td>Rs. {stats.procBreakdown.hosp.toFixed(2)}</td></tr>
                        <tr><td>Doctor Share:</td><td>Rs. {stats.procBreakdown.doc.toFixed(2)}</td></tr>
                        <tr><td>Nurse Share:</td><td>Rs. {stats.procBreakdown.nurse.toFixed(2)}</td></tr>
                      </tbody>
                    </table>
                  </>
                )}

                {Object.keys(stats.chanDoctorBreakdown).length > 0 && (
                  <>
                    <h3>Channelling Breakdown</h3>
                    <table className="print-table">
                      <thead>
                        <tr><th>Doctor Name</th><th>Doctor's Pay</th><th>Hospital Share</th></tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.chanDoctorBreakdown).map(([docName, vals], i) => (
                           <tr key={i}>
                             <td>{docName}</td>
                             <td>Rs. {vals.doc.toFixed(2)}</td>
                             <td>Rs. {vals.hosp.toFixed(2)}</td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <h3>OPD Doctor Earnings</h3>
                {stats.opdFinalBreakdown.length === 0 ? (
                  <p><i>No OPD doctors attended today.</i></p>
                ) : (
                  <table className="print-table">
                    <thead>
                      <tr><th>Doctor Name</th><th style={{textAlign:'center'}}>Patients Count</th><th style={{textAlign:'right'}}>Total OPD Income</th></tr>
                    </thead>
                    <tbody>
                      {stats.opdFinalBreakdown.map((opd, i) => (
                         <tr key={i}>
                           <td><b>{opd.name}</b></td>
                           <td style={{textAlign:'center'}}>
                              {opd.opdCount} <span style={{fontSize:'0.8rem', fontWeight:'normal', color:'#64748b'}}>(@ Rs. {opd.perPatientFee.toFixed(0)})</span>
                           </td>
                           <td style={{textAlign:'right', fontWeight:'700'}}>Rs. {opd.opdAmount.toFixed(2)}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {activeTab === 'attendance' && (
            <>
              {/* === SCREEN VIEW ONLY === */}
              <div className="fade-in no-print">
                {['Channelling', 'OPD', 'Nurses & Staff'].map((groupTitle) => {
                  let groupData = [];
                  const isDoctor = (a) => a.category === 'doctor' || a.docType || ['Doctor', 'MO', 'Physician'].includes(a.role);
                  if (groupTitle === 'Channelling') {
                    groupData = attendance.filter(a => isDoctor(a) && a.docType === 'Channelling');
                  } else if (groupTitle === 'OPD') {
                    groupData = attendance.filter(a => isDoctor(a) && a.docType === 'OPD');
                  } else {
                    groupData = attendance.filter(a => !isDoctor(a));
                  }

                  if (groupData.length === 0) return null;

                  return (
                    <div key={groupTitle} style={{marginBottom:'2rem', background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden'}}>
                      <h3 style={{background:'#f8fafc', margin:0, padding:'1rem 1.5rem', color:'#0f172a', fontSize:'1.1rem', borderBottom:'1px solid #e2e8f0'}}>
                        {groupTitle === 'Nurses & Staff' ? 'Nurses & Other Staff' : `${groupTitle} Doctors`}
                      </h3>
                      <table style={{width:'100%', borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{textAlign:'left', fontSize:'0.9rem', color:'#64748b'}}>
                             <th style={{padding:'12px 1.5rem', borderBottom:'1px solid #e2e8f0', fontWeight:'700'}}>Name</th>
                             <th style={{padding:'12px 1.5rem', borderBottom:'1px solid #e2e8f0', fontWeight:'700'}}>Role</th>
                             <th style={{padding:'12px 1.5rem', borderBottom:'1px solid #e2e8f0', fontWeight:'700'}}>In Time</th>
                             <th style={{padding:'12px 1.5rem', borderBottom:'1px solid #e2e8f0', fontWeight:'700'}}>Out Time</th>
                             <th style={{padding:'12px 1.5rem', borderBottom:'1px solid #e2e8f0', fontWeight:'700'}}>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupData.map((a, idx) => (
                            <tr key={idx}>
                              <td style={{padding:'12px 1.5rem', borderBottom:'1px solid #f1f5f9', fontWeight:'700', color:'#0f172a'}}>{a.name}</td>
                              <td style={{padding:'12px 1.5rem', borderBottom:'1px solid #f1f5f9', color:'#475569'}}>{a.role}</td>
                              <td style={{padding:'12px 1.5rem', borderBottom:'1px solid #f1f5f9', fontWeight:'600'}}>{a.inTime || '-'}</td>
                              <td style={{padding:'12px 1.5rem', borderBottom:'1px solid #f1f5f9', fontWeight:'600'}}>{a.outTime || a.status}</td>
                              <td style={{padding:'12px 1.5rem', borderBottom:'1px solid #f1f5f9', fontWeight:'800', color:'#0369a1'}}>
                                {calculateDuration(a.inTime, a.outTime)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              {/* === PRINT VIEW ONLY === */}
              <div className="print-only">
                {['Channelling', 'OPD', 'Nurses & Staff'].map((groupTitle) => {
                  let groupData = [];
                  const isDoctor = (a) => a.category === 'doctor' || a.docType || ['Doctor', 'MO', 'Physician'].includes(a.role);
                  if (groupTitle === 'Channelling') {
                    groupData = attendance.filter(a => isDoctor(a) && a.docType === 'Channelling');
                  } else if (groupTitle === 'OPD') {
                    groupData = attendance.filter(a => isDoctor(a) && a.docType === 'OPD');
                  } else {
                    groupData = attendance.filter(a => !isDoctor(a));
                  }

                  if (groupData.length === 0) return null;

                  return (
                    <div key={'print_'+groupTitle} style={{marginBottom:'20px'}}>
                      <h3>{groupTitle === 'Nurses & Staff' ? 'Nurses & Other Staff' : `${groupTitle} Doctors`}</h3>
                      <table className="print-table">
                        <thead>
                          <tr><th>Name</th><th>Role</th><th>In Time</th><th>Out Time</th><th>Duration</th></tr>
                        </thead>
                        <tbody>
                          {groupData.map((a, idx) => (
                            <tr key={idx}>
                              <td>{a.name}</td>
                              <td>{a.role}</td>
                              <td>{a.inTime || '-'}</td>
                              <td>{a.outTime || a.status}</td>
                              <td>{calculateDuration(a.inTime, a.outTime)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="no-print" style={{display:'flex', justifyContent:'center', marginTop:'3rem'}}>
            <button onClick={() => window.print()} style={{background:'#0369a1', color:'white', border:'none', padding:'12px 30px', borderRadius:'8px', fontWeight:'800', fontSize:'1rem', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'8px', boxShadow:'0 4px 10px rgba(3, 105, 161, 0.3)'}}>
              🖨️ Print Detailed Report
            </button>
          </div>
        </>
      )}
    </div>
  );
}
