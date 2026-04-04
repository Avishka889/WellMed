import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function OtherServices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isReceiptGenerated, setIsReceiptGenerated] = useState(false);
  const [potentialPatients, setPotentialPatients] = useState([]);
  const [showRegForm, setShowRegForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Registration States (Matching PatientRegistration)
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const [serviceList, setServiceList] = useState([]);
  const [procedurePrices, setProcedurePrices] = useState({}); // To track manual prices for variable types

  const [activeDoctor, setActiveDoctor] = useState(null);
  const [activeNurse, setActiveNurse] = useState(null);
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    const fetchProcs = async () => {
       const snap = await getDocs(collection(db, 'clinical_procedures'));
       const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       
       // Deduplicate by name just in case DB has duplicates
       const unique = [];
       const seen = new Set();
       data.forEach(p => {
         const nameLower = p.name.trim().toLowerCase();
         if (!seen.has(nameLower)) {
           seen.add(nameLower);
           unique.push(p);
         }
       });
       setServiceList(unique);
    };
    fetchProcs();
  }, []);

  // Fetch Active Staff Verification (time-aware: only counts staff who marked in within last 6 hours)
  const verifyStaffAvailability = async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, 'attendance'), where('date', '==', today), where('status', '==', 'Present'));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => d.data());

    // Time-aware filter: inTime must be within last 6 hours from now
    const now = new Date();
    const isActiveNow = (inTimeStr) => {
      if (!inTimeStr) return false;
      const [h, m] = inTimeStr.split(':').map(Number);
      const inDate = new Date();
      inDate.setHours(h, m, 0, 0);
      const diffHours = (now - inDate) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 6;
    };

    const activeStaff = docs.filter(d => isActiveNow(d.inTime));
    
    const opdDocs = activeStaff.filter(d => d.category === 'doctor' && d.docType === 'OPD');
    const nurses = activeStaff.filter(d => d.category === 'staff' && d.role === 'Nurse');
    
    let errs = [];
    if (opdDocs.length > 1) errs.push('Multiple OPD Doctors are currently active');
    if (opdDocs.length === 0) errs.push('No Active OPD Doctor (check attendance)');
    if (nurses.length > 1) errs.push('Multiple Nurses are currently active');
    if (nurses.length === 0) errs.push('No Active Nurse (check attendance)');

    if (opdDocs.length === 1) setActiveDoctor(opdDocs[0]);
    else setActiveDoctor(null);

    if (nurses.length === 1) setActiveNurse(nurses[0]);
    else setActiveNurse(null);

    if (errs.length > 0) {
      setStaffError(errs.join(' | '));
      return { success: false, error: errs.join(' | ') };
    } else {
      setStaffError('');
      return { success: true };
    }
  };

  useEffect(() => {
    verifyStaffAvailability();
  }, []);

  // BMI Calculator Helper (Shared Logic)
  const getBMIDetails = (w, h) => {
    if (!w || !h || isNaN(w) || isNaN(h)) return null;
    const hm = parseFloat(h) / 100;
    const wk = parseFloat(w);
    if (hm <= 0 || wk <= 0) return null;
    const bmi = (wk / (hm * hm)).toFixed(1);
    let status = '';
    let color = '';
    if (bmi < 18.5) { status = 'Underweight'; color = '#0284c7'; }
    else if (bmi < 25) { status = 'Normal'; color = '#16a34a'; }
    else if (bmi < 30) { status = 'Overweight'; color = '#d97706'; }
    else { status = 'Obese'; color = '#dc2626'; }
    return { bmi, status, color };
  };

  // Auto Age Calculator (Shared Logic)
  const handleBirthdayChange = (e) => {
    const bday = e.target.value;
    setBirthday(bday);
    if (bday) {
      const today = new Date();
      const birthDate = new Date(bday);
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) calculatedAge--;
      setAge(calculatedAge.toString());
    } else {
      setAge('');
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(searchTerm)) {
      toast.error('Invalid Phone Number! Please enter exactly 10 digits (e.g., 0771234567).', { icon: '📞' });
      return;
    }
    
    setSearching(true);
    setPotentialPatients([]);
    setSelectedPatient(null);
    setShowRegForm(false);

    try {
      const q = query(collection(db, 'patients'), where('contactNo', '==', searchTerm));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const matches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPotentialPatients(matches);
        toast.success(`Found ${matches.length} patient(s)!`);
      } else {
        toast('New Number! Please register the patient.', { icon: '📝' });
        setShowRegForm(true);
      }
    } catch (err) {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const loadingId = toast.loading("Registering patient for services...");
    try {
      const newPatient = {
        name,
        contactNo: searchTerm,
        gender,
        birthday,
        age: Number(age),
        weight,
        height,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'patients'), newPatient);
      setSelectedPatient({ id: docRef.id, ...newPatient });
      toast.success("Patient registered successfully!", { id: loadingId });
      setShowRegForm(false);
    } catch (err) {
      toast.error("Registration failed.");
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setPotentialPatients([]);
  };

  const toggleService = (service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id));
      const newPrices = { ...procedurePrices };
      delete newPrices[service.id];
      setProcedurePrices(newPrices);
    } else {
      setSelectedServices(prev => [...prev, service]);
    }
  };

  const handleManualPriceChange = (serviceId, field, value) => {
    setProcedurePrices(prev => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] || { base: '', doc: '' }),
        [field]: value
      }
    }));
  };

  const calculateTotal = () => {
    return selectedServices.reduce((sum, s) => {
      if (s.type === 'Fixed') return sum + Number(s.price);
      const manual = procedurePrices[s.id] || { base: 0, doc: 0 };
      return sum + (Number(manual.base) || 0) + (Number(manual.doc) || 0);
    }, 0);
  };

  const handleProcessPayment = async () => {
    if (selectedServices.length === 0) return toast.error("Select at least one service.");
    
    const verification = await verifyStaffAvailability();
    if (!verification.success) return toast.error("Process aborted: " + verification.error);
    
    if (!activeDoctor || !activeNurse) return toast.error("Active Doctor/Nurse missing!");
    
    // Check if any variable service has no price
    const missingPrice = selectedServices.find(s => s.type === 'Variable' && (!procedurePrices[s.id] || !procedurePrices[s.id].base));
    if (missingPrice) return toast.error(`Please enter a base price for ${missingPrice.name}`);

    const loadingId = toast.loading("Processing clinical service record...");
    try {
      const finalServices = selectedServices.map(s => {
        let p = 0; let dCut = 0; let nCut = 0; let baseAmt = 0;
        if (s.type === 'Fixed') {
           p = Number(s.price);
           baseAmt = p;
           dCut = Number(s.docFee) || 0;
           nCut = Number(s.nurseFee) || 0;
        } else {
           const manual = procedurePrices[s.id] || { base: 0, doc: 0 };
           baseAmt = Number(manual.base) || 0;
           dCut = Number(manual.doc) || 0;
           p = baseAmt + dCut; // Total composite price
           nCut = (baseAmt * (Number(s.nurseFee) || 0)) / 100; // Nurse calculation on base amount
        }
        return {
          ...s,
          price: p,
          baseAmount: baseAmt,
          docCut: dCut,
          nurseCut: nCut
        }
      });

      const totalDocCut = finalServices.reduce((acc, s) => acc + s.docCut, 0);
      const totalNurseCut = finalServices.reduce((acc, s) => acc + s.nurseCut, 0);

      const serviceRecord = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        contactNo: selectedPatient.contactNo,
        services: finalServices,
        totalAmount: calculateTotal(),
        paymentMethod: paymentMethod,
        timestamp: serverTimestamp(),
        type: 'additional_service',
        activeDoctorId: activeDoctor.memberId || activeDoctor.id || null,
        activeDoctorName: activeDoctor.name,
        doctorEarnings: totalDocCut,
        activeNurseId: activeNurse.memberId || activeNurse.id || null,
        activeNurseName: activeNurse.name,
        nurseEarnings: totalNurseCut
      };
      
      await addDoc(collection(db, 'additional_visit_services'), serviceRecord);
      
      toast.success("Payment recorded successfully!", { id: loadingId });
      setIsReceiptGenerated(true);
    } catch (err) {
      console.error(err);
      toast.error("Process failed.");
    }
  };

  const resetAll = () => {
    setSearchTerm('');
    setSelectedPatient(null);
    setSelectedServices([]);
    setIsReceiptGenerated(false);
    setPotentialPatients([]);
    setShowRegForm(false);
    setProcedurePrices({});
    setPaymentMethod('Cash');
    setName(''); setAge(''); setGender(''); setBirthday(''); setWeight(''); setHeight('');
  };

  if (isReceiptGenerated) {
    return (
      <div className="registration-panel fade-in">
          <div className="receipt-actions no-print">
            <button className="add-family-btn" onClick={() => window.print()}>Print Service Bill</button>
            <button className="cancel-btn" onClick={resetAll}>Done / New Search</button>
          </div>

        <div className="receipt-paper">
          <div className="receipt-header">
            <img src="/logo.png" alt="WellMed" className="receipt-logo" />
            <h2 style={{fontSize:'22pt', margin:'10px 0 0 0', fontWeight:'800'}}>WellMed</h2>
            <p style={{fontSize:'12pt', margin:'0 0 10px 0', fontWeight:'600'}}>Specialist Medical & Diabetic Care</p>
            <div className="receipt-address">Tel: 011-2345678 / 077-1234567</div>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-info-grid">
            <div className="info-item"><span className="label">PATIENT:</span><span className="value">{selectedPatient.name}</span></div>
            <div className="info-item"><span className="label">PHONE:</span><span className="value">{selectedPatient.contactNo}</span></div>
            <div className="info-item"><span className="label">DATE:</span><span className="value">{new Date().toLocaleDateString()}</span></div>
            <div className="info-item"><span className="label">PAID VIA:</span><span className="value" style={{fontWeight:'normal', color:'#000'}}>{paymentMethod.toUpperCase()}</span></div>
          </div>

          <div className="receipt-divider" style={{borderStyle:'solid'}}></div>

          <div className="receipt-services">
            <h4 style={{textAlign:'center', margin:'10px 0', textDecoration:'underline'}}>CLINICAL SERVICES</h4>
            {selectedServices.map(s => {
              let p = 0; let dCut = 0; let baseAmt = 0;
              if (s.type === 'Fixed') {
                 p = Number(s.price);
              } else {
                 const manual = procedurePrices[s.id] || { base: 0, doc: 0 };
                 baseAmt = Number(manual.base) || 0;
                 dCut = Number(manual.doc) || 0;
                 p = baseAmt + dCut;
              }
              return (
                <div key={s.id} style={{display:'flex', flexDirection:'column', padding:'5px 0'}}>
                  <div className="service-row" style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={{fontWeight:'700'}}>{s.name}</span>
                    <span style={{fontWeight:'bold'}}>Rs. {(p || 0).toFixed(2)}</span>
                  </div>

                </div>
              );
            })}
          </div>

          <div className="receipt-divider" style={{borderStyle:'solid', marginTop:'15px'}}></div>

          <div className="total-section" style={{display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:'1.2rem'}}>
            <span style={{fontWeight:'800'}}>TOTAL AMOUNT (LKR):</span>
            <span style={{fontWeight:'800', borderBottom:'3px double #000'}}>Rs. {calculateTotal().toFixed(2)}</span>
          </div>

          <div className="receipt-footer">
             <p style={{margin:'20px 0 0 0', fontWeight:'700'}}>*** CLINICAL SERVICE RECEIPT ***</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="registration-panel fade-in">
      <div className="results-header" style={{marginBottom:'2rem'}}>
        <div>
          <h2 style={{margin:0}}>Additional Clinical Services</h2>
          <p style={{color:'#64748b', margin:0}}>ECG, Wound Care & Specialized Procedures</p>
        </div>
      </div>

      {!selectedPatient ? (
        <div className="fade-in no-print">
          <div className="search-section" style={{ maxWidth: '600px', margin: '0 auto 2rem auto', textAlign: 'center' }}>
            <h2>Search Patient Number</h2>
            <form className="search-form" onSubmit={handleSearch}>
              <input 
                type="tel" 
                placeholder="e.g. 0771234567" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="search-input" 
              />
              <button type="submit" className="action-btn search-btn">
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>

          {showRegForm && (
            <div className="fade-in form-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <h3>New Service Registration</h3>
                <button className="cancel-btn" onClick={() => setShowRegForm(false)}>Back</button>
              </div>
              <p className="notif-text">Phone Number assigned: <b>{searchTerm}</b></p>
              
              <form onSubmit={handleRegister} className="grid-form">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Full Name</label>
                  <input type="text" placeholder="Patient name" value={name} onChange={(e)=>setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select value={gender} onChange={(e)=>setGender(e.target.value)} required className="custom-select">
                    <option value="">-- Select Gender --</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Birthday</label>
                  <input type="date" value={birthday} onChange={handleBirthdayChange} required />
                </div>
                <div className="form-group">
                  <label>Age (Auto-calculated)</label>
                  <input type="number" value={age} readOnly style={{backgroundColor: '#f1f5f9'}} />
                </div>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" value={weight} onChange={(e)=>setWeight(e.target.value)} required step="0.1" />
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input type="number" value={height} onChange={(e)=>setHeight(e.target.value)} required />
                </div>

                {weight && height && getBMIDetails(weight, height) && (
                  <div style={{ gridColumn: '1 / -1', background: getBMIDetails(weight, height).color + '1A', color: getBMIDetails(weight, height).color, padding: '0.8rem', borderRadius: '10px', textAlign: 'center', border: `1px solid ${getBMIDetails(weight, height).color}40`, fontWeight: '600' }}>
                    Computed BMI: <span style={{fontSize:'1.2rem'}}>{getBMIDetails(weight, height).bmi}</span> ({getBMIDetails(weight, height).status})
                  </div>
                )}

                <button type="submit" className="action-btn submit-btn" style={{ gridColumn: '1 / -1' }}>
                  Register & Proceed to Services
                </button>
              </form>
            </div>
          )}

          {potentialPatients.length > 0 && (
            <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="results-header">
                <h3>Registered Patients for {searchTerm}</h3>
                <button onClick={() => setShowRegForm(true)} className="add-family-btn">+ Add Family Member</button>
              </div>
              <div className="patient-cards">
                {potentialPatients.map(p => (
                  <div key={p.id} className="patient-card" onClick={() => selectPatient(p)}>
                    <span className="patient-name-header">Patient Name</span>
                    <h4>{p.name}</h4>
                    
                    <span className="details-topic">Details</span>
                    <div className="card-field"><span className="card-label">Gender</span><span className="card-value">{p.gender}</span></div>
                    <div className="card-field"><span className="card-label">Age</span><span className="card-value">{p.age} Yrs</span></div>
                    <div className="card-field"><span className="card-label">Weight</span><span className="card-value">{p.weight}kg</span></div>
                    <div className="card-field"><span className="card-label">Height</span><span className="card-value">{p.height}cm</span></div>
                    
                    <div style={{color:'var(--primary-cyan)', fontSize:'0.85rem', fontWeight:'900', marginTop:'15px', textTransform:'uppercase', textAlign:'center', borderTop:'1px solid #fed7aa', paddingTop:'10px'}}>
                      Click to Select & Proceed
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="step-container fade-in">
           <div className="form-card" style={{marginBottom:'2rem', borderLeft:'5px solid var(--primary-cyan)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <h3 style={{margin:0, color:'var(--primary-cyan)'}}>{selectedPatient.name}</h3>
                  <div style={{margin:'5px 0', fontSize:'1rem', fontWeight:'600'}}>
                    {selectedPatient.age} Yrs | {selectedPatient.gender} | {selectedPatient.weight}kg | {selectedPatient.height}cm
                  </div>
                  <p style={{margin:'5px 0 0 0', color:'#64748b'}}>Phone: {selectedPatient.contactNo}</p>
                </div>
                <button className="cancel-btn" onClick={resetAll}>Change Patient</button>
              </div>
           </div>

           <div style={{marginBottom:'2rem'}}>
              {/* ── Selected Procedures List ── */}
              {selectedServices.length > 0 && (
                <div style={{display:'flex', flexDirection:'column', gap:'0.8rem', marginBottom:'1.2rem'}}>
                  {selectedServices.map((service, idx) => {
                    const isVariable = service.type === 'Variable';
                    const prices = procedurePrices[service.id] || {};
                    const baseAmt = Number(prices.base) || 0;
                    const docAmt  = Number(prices.doc)  || 0;
                    const fixedTotal = service.type === 'Fixed' ? Number(service.price) : baseAmt + docAmt;
                    return (
                      <div key={service.id} className="fade-in" style={{
                        background:'white', border:'1.5px solid #e2e8f0',
                        borderRadius:'10px', overflow:'hidden'
                      }}>
                        {/* Header row */}
                        <div style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'0.9rem 1.2rem', borderBottom: isVariable ? '1px solid #f1f5f9' : 'none'
                        }}>
                          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                            <div style={{
                              width:'28px', height:'28px', borderRadius:'50%',
                              background:'#0f172a', color:'white',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:'0.8rem', fontWeight:'800', flexShrink:0
                            }}>{idx + 1}</div>
                            <div>
                              <div style={{fontWeight:'700', color:'#0f172a', fontSize:'1rem'}}>{service.name}</div>
                              <div style={{fontSize:'0.8rem', color:'#64748b', marginTop:'2px'}}>
                                {isVariable ? 'Variable Price — enter amounts below' : `Fixed • Rs. ${Number(service.price).toFixed(2)}`}
                              </div>
                            </div>
                          </div>
                          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                            {!isVariable && (
                              <span style={{fontWeight:'800', color:'#0f172a', fontSize:'1.1rem'}}>
                                Rs. {fixedTotal.toFixed(2)}
                              </span>
                            )}
                            {isVariable && (baseAmt > 0 || docAmt > 0) && (
                              <span style={{fontWeight:'800', color:'#0f172a', fontSize:'1.1rem'}}>
                                Rs. {fixedTotal.toFixed(2)}
                              </span>
                            )}
                            <button
                              onClick={() => toggleService(service)}
                              style={{background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:'1.2rem', padding:'2px', lineHeight:1}}
                              title="Remove"
                            >✕</button>
                          </div>
                        </div>

                        {/* Variable price entry */}
                        {isVariable && (
                          <div className="fade-in" style={{
                            display:'flex', gap:'1rem', padding:'0.9rem 1.2rem',
                            background:'#f8fafc', flexWrap:'wrap'
                          }}>
                            <div style={{flex:1, minWidth:'140px'}}>
                              <label style={{fontSize:'0.78rem', color:'#64748b', fontWeight:'600', display:'block', marginBottom:'5px'}}>
                                Base Amount (LKR)
                              </label>
                              <input
                                type="number"
                                placeholder="e.g. 1500"
                                value={prices.base || ''}
                                onChange={e => handleManualPriceChange(service.id, 'base', e.target.value)}
                                style={{
                                  width:'100%', padding:'8px 12px', borderRadius:'8px',
                                  border:'1.5px solid #cbd5e1', outline:'none',
                                  fontFamily:'inherit', fontSize:'0.95rem', boxSizing:'border-box'
                                }}
                              />
                            </div>
                            <div style={{flex:1, minWidth:'140px'}}>
                              <label style={{fontSize:'0.78rem', color:'#64748b', fontWeight:'600', display:'block', marginBottom:'5px'}}>
                                Doctor's Charge (LKR)
                              </label>
                              <input
                                type="number"
                                placeholder="e.g. 500"
                                value={prices.doc || ''}
                                onChange={e => handleManualPriceChange(service.id, 'doc', e.target.value)}
                                style={{
                                  width:'100%', padding:'8px 12px', borderRadius:'8px',
                                  border:'1.5px solid #cbd5e1', outline:'none',
                                  fontFamily:'inherit', fontSize:'0.95rem', boxSizing:'border-box'
                                }}
                              />
                            </div>
                            {(baseAmt > 0 || docAmt > 0) && (
                              <div style={{display:'flex', alignItems:'flex-end', paddingBottom:'2px'}}>
                                <div style={{
                                  background:'#0f172a', color:'white', padding:'8px 16px',
                                  borderRadius:'8px', fontWeight:'700', fontSize:'0.9rem', whiteSpace:'nowrap'
                                }}>
                                  Total: Rs. {fixedTotal.toFixed(2)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Add Procedure Dropdown ── */}
              {(() => {
                const available = serviceList.filter(s => !selectedServices.find(sel => sel.id === s.id));
                if (available.length === 0 && selectedServices.length > 0) return (
                  <p style={{color:'#94a3b8', fontSize:'0.9rem', textAlign:'center', padding:'0.5rem'}}>All available procedures selected.</p>
                );
                return (
                  <div style={{display:'flex', gap:'0.8rem', alignItems:'center', flexWrap:'wrap'}}>
                    <select
                      id="procedure-selector"
                      defaultValue=""
                      onChange={e => {
                        const svc = serviceList.find(s => s.id === e.target.value);
                        if (svc) { toggleService(svc); e.target.value = ''; }
                      }}
                      style={{
                        flex:1, minWidth:'200px', padding:'10px 14px',
                        border:'1.5px solid #cbd5e1', borderRadius:'8px',
                        outline:'none', fontFamily:'inherit', fontSize:'0.95rem',
                        background:'white', color:'#475569', cursor:'pointer'
                      }}
                    >
                      <option value="">
                        {selectedServices.length === 0 ? '+ Select a Procedure' : '+ Add Another Procedure'}
                      </option>
                      {available.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.type === 'Fixed' ? `— Rs. ${s.price}` : '— Variable'}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
           </div>

           {/* ── Staff Info + Total + Confirm ── */}
           {selectedServices.length > 0 && (
             <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
               {staffError ? (
                 <div style={{color:'white', background:'#dc2626', padding:'1rem 1.2rem', borderRadius:'10px', fontWeight:'700', fontSize:'0.9rem'}}>
                   ⚠️ {staffError} — Ensure ONE OPD Doctor and ONE Nurse are marked Present.
                 </div>
               ) : (
                 <div style={{background:'#f0f9ff', padding:'1rem 1.2rem', borderRadius:'10px', border:'1px solid #bae6fd', display:'flex', gap:'2rem', flexWrap:'wrap'}}>
                   <div style={{fontSize:'0.9rem', color:'#0369a1'}}>
                     <span style={{fontWeight:'600'}}>Active Doctor:</span> {activeDoctor?.name}
                   </div>
                   <div style={{fontSize:'0.9rem', color:'#16a34a'}}>
                     <span style={{fontWeight:'600'}}>Active Nurse:</span> {activeNurse?.name}
                   </div>
                 </div>
               )}

               <div style={{
                 display:'flex', justifyContent:'space-between', alignItems:'center',
                 background:'white', color:'#0f172a', padding:'1.2rem 1.5rem', borderRadius:'10px',
                 border:'2px solid #0f172a'
               }}>
                 <span style={{fontWeight:'700', fontSize:'1rem'}}>TOTAL SERVICE FEE</span>
                 <span style={{fontWeight:'800', fontSize:'1.6rem'}}>Rs. {calculateTotal().toFixed(2)}</span>
               </div>

               <div style={{marginTop:'10px'}}>
                 <label style={{display:'block', marginBottom:'8px', fontWeight:'700', fontSize:'0.9rem', color:'#475569'}}>Select Payment Method:</label>
                 <div className="payment-options">
                   {['Cash', 'Card', 'Bank Transfer'].map((method) => (
                     <button 
                       key={method} 
                       className={`pay-btn ${paymentMethod === method ? 'active' : ''}`}
                       onClick={() => setPaymentMethod(method)}
                     >
                       {method}
                     </button>
                   ))}
                 </div>
               </div>

               <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                 <button
                   className="action-btn submit-btn"
                   onClick={handleProcessPayment}
                   disabled={!!staffError}
                   style={{padding:'8px 24px', fontSize:'0.9rem', fontWeight:'700', borderRadius:'10px', width:'auto', minWidth:'200px'}}
                 >
                   Confirm &amp; Print Bill
                 </button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}

