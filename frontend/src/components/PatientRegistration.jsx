import { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, runTransaction, getDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function PatientRegistration({ onStepChange }) {
  // STEPS: 1=Search/Reg, 2=Services, 3=Payment, 4=Receipt
  const [step, setStep] = useState(1);
  
  // Use effect to sync step back to parent (Dashboard)
  useEffect(() => {
    if (onStepChange) onStepChange(step);
  }, [step, onStepChange]);

  // === STEP 1 STATES ===
  const [contactNo, setContactNo] = useState('');
  const [searchStatus, setSearchStatus] = useState('idle'); 
  const [patientsList, setPatientsList] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');

  // BMI Calculator Helper
  const getBMIDetails = (w, h) => {
    if (!w || !h || isNaN(w) || isNaN(h)) return null;
    const hm = parseFloat(h) / 100;
    const wk = parseFloat(w);
    if (hm <= 0 || wk <= 0) return null;
    const bmi = (wk / (hm * hm)).toFixed(1);
    let status = '';
    let color = '';
    if (bmi < 18.5) { status = 'Underweight'; color = '#0284c7'; } // Blue
    else if (bmi < 25) { status = 'Normal'; color = '#16a34a'; } // Green
    else if (bmi < 30) { status = 'Overweight'; color = '#d97706'; } // Orange
    else { status = 'Obese'; color = '#dc2626'; } // Red
    return { bmi, status, color };
  };

  // Auto Age Calculator
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

  // === STEP 2 STATES (Services) ===
  const [serviceType, setServiceType] = useState(''); // 'OPD' or 'Channeling'
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [prices, setPrices] = useState({ opd: 1000 });
  const [activePrice, setActivePrice] = useState(0);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [attendance, setAttendance] = useState({}); // Today's status (In/Out)

  // Fetch doctors and pricing strictly overriding defaults on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA');
        
        // Fetch Pricing
        const priceSnap = await getDoc(doc(db, 'settings', 'pricing'));
        if (priceSnap.exists()) {
          setPrices({
            opd: priceSnap.data().opd_fee || 1000
          });
        }
        
        // Fetch Today's Attendance to check who is "In"
        const qAtt = query(collection(db, 'attendance'), where('date', '==', today));
        const attSnap = await getDocs(qAtt);
        const attMap = {};
        attSnap.docs.forEach(d => {
          const data = d.data();
          // Keep the latest record for each member
          if (!attMap[data.memberId] || new Date(data.timestamp) > new Date(attMap[data.memberId].timestamp)) {
            attMap[data.memberId] = data;
          }
        });
        setAttendance(attMap);

        // Fetch All Doctors and filter by availability if they are "In"
        const qDoc = query(collection(db, 'doctors'));
        const docSnap = await getDocs(qDoc);
        const docsList = docSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const activeDocs = docsList.filter(d => 
          attMap[d.id] && 
          attMap[d.id].inTime &&
          !attMap[d.id].outTime
        );
        setAvailableDoctors(activeDocs);

      } catch (err) {
        console.error("Error fetching data", err);
      }
    };
    fetchData();
  }, []);

  // === STEP 3 STATES (Payment) ===
  const [paymentMethod, setPaymentMethod] = useState(''); // Cash, Card, Transfer

  // === STEP 4 STATES (Receipt) ===
  const [visitRecord, setVisitRecord] = useState(null);

  // Removed dummyDoctors array

  const resetAll = () => {
    setStep(1);
    setSearchStatus('idle');
    setContactNo('');
    setPatientsList([]);
    setShowNewForm(false);
    setSelectedPatient(null);
    setName(''); setAge(''); setWeight(''); setHeight(''); setBirthday(''); setGender('');
    setServiceType(''); setSelectedDoctor('');
    setPaymentMethod(''); setVisitRecord(null);
  };

  // ================= STEP 1 FUNCTIONS =================
  const handleSearch = async (e) => {
    e.preventDefault();
    const phoneRegex = /^07[0-9]{8}$/;
    if (!phoneRegex.test(contactNo)) {
      toast.error('Invalid Contact Number! Must start with 07 (e.g., 0771234567).');
      return;
    }
    
    setSearchStatus('searching');
    setShowNewForm(false);
    setSelectedPatient(null);
    
    try {
      const q = query(collection(db, 'patients'), where('contactNo', '==', contactNo));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setSearchStatus('notFound');
        setShowNewForm(true); 
        toast('New Number! Please register the patient.', { icon: '📝' });
      } else {
        const patients = [];
        querySnapshot.forEach((doc) => {
          patients.push({ id: doc.id, ...doc.data() });
        });
        setPatientsList(patients);
        setSearchStatus('found');
        toast.success(`Found ${patients.length} patient(s) for this number!`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Database search failed.');
      setSearchStatus('idle');
    }
  };

  const handleRegisterNew = async (e) => {
    e.preventDefault();
    const loadingId = toast.loading('Registering new patient...');
    try {
      const patientData = { 
        contactNo: contactNo.trim(), 
        name: name.trim(), 
        age: Number(age), 
        weight: weight.trim(), 
        height: height.trim(), 
        birthday, 
        gender, 
        registeredAt: new Date().toISOString() 
      };
      const docRef = await addDoc(collection(db, 'patients'), patientData);
      
      toast.success(`Patient ${name} registered! Moving to services...`, { id: loadingId });
      
      // Select patient and move directly to Step 2
      setSelectedPatient({ id: docRef.id, ...patientData });
      setStep(2);
    } catch (error) {
      toast.error('Failed to register.', { id: loadingId });
    }
  };

  const handleUpdateVitals = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    const loadingId = toast.loading(`Updating ${selectedPatient.name}'s vitals...`);
    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        weight: weight || selectedPatient.weight,
        height: height || selectedPatient.height,
        lastVisit: new Date().toISOString()
      });
      toast.success('Vitals Updated! Moving to services...', { id: loadingId });

      // Update local state and move to Step 2
      const updatedPatient = { ...selectedPatient, weight: weight || selectedPatient.weight, height: height || selectedPatient.height };
      setSelectedPatient(updatedPatient);
      setStep(2);
    } catch (error) {
      toast.error('Failed to update vitals.', { id: loadingId });
    }
  };

  // ================= STEP 2 FUNCTIONS =================
  const selectService = async (type) => {
    const today = new Date().toLocaleDateString('en-CA');
    
    if (type === 'OPD') {
      const loadingId = toast.loading("Checking OPD availability...");
      try {
        // Force fresh attendance fetch on selection
        const qAtt = query(collection(db, 'attendance'), where('date', '==', today));
        const attSnap = await getDocs(qAtt);
        const attMap = {};
        attSnap.docs.forEach(d => {
          const data = d.data();
          if (!attMap[data.memberId] || new Date(data.timestamp) > new Date(attMap[data.memberId].timestamp)) {
            attMap[data.memberId] = data;
          }
        });
        setAttendance(attMap);

        const opdIn = Object.values(attMap).some(att => 
          String(att.docType || '').toUpperCase() === 'OPD' && 
          att.inTime && 
          !att.outTime
        );

        if (!opdIn) {
          toast.error("Selection blocked: No OPD doctor is currently available (checked in).", { id: loadingId, icon: '⚕️' });
          return;
        }
        
        toast.success("OPD Doctor available.", { id: loadingId });
        setActivePrice(prices.opd);
      } catch (err) {
        toast.error("Failed to verify availability.", { id: loadingId });
        return;
      }
    } else {
      setActivePrice(0); // For Channeling, reset price until doctor is selected
    }
    
    setServiceType(type);
    setSelectedDoctor(''); // Reset when switching types
  };

  const handleDoctorChange = (e) => {
    const docName = e.target.value;
    setSelectedDoctor(docName);
    
    if (serviceType === 'Channeling') {
      const docObj = availableDoctors.find(d => d.name === docName);
      if (docObj) {
        const total = Number(docObj.doctorCharge || 0) + Number(docObj.hospitalCharge || 0);
        setActivePrice(total);
      } else {
        setActivePrice(0);
      }
    }
  };

  const handleProceedToPayment = async () => {
    if (!serviceType) {
      toast.error("Please select a service type");
      return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    const loadingId = toast.loading("Verifying staff presence...");

    try {
      // Re-fetch today's attendance to ensure it's not stale
      const qAtt = query(collection(db, 'attendance'), where('date', '==', today));
      const attSnap = await getDocs(qAtt);
      const attMap = {};
      attSnap.docs.forEach(d => {
        const data = d.data();
        if (!attMap[data.memberId] || new Date(data.timestamp) > new Date(attMap[data.memberId].timestamp)) {
          attMap[data.memberId] = data;
        }
      });
      setAttendance(attMap);

      if (!selectedDoctor || activePrice === 0) {
        toast.error(`Process aborted: A ${serviceType} doctor must be selected.`, { id: loadingId, icon: '⚕️' });
        return;
      }
      
      const selectedDocObj = availableDoctors.find(d => d.name === selectedDoctor);
      if (!selectedDocObj || !attMap[selectedDocObj.id] || !attMap[selectedDocObj.id].inTime || attMap[selectedDocObj.id].outTime) {
        toast.error(`Process aborted: ${selectedDoctor} is currently unavailable (not checked in).`, { id: loadingId, icon: '⚕️' });
        return;
      }

      toast.success("Staff availability verified.", { id: loadingId });
      setStep(3);
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify staff availability. Please check connection.", { id: loadingId });
    }
  };

  // ================= STEP 3 FUNCTIONS =================
  const generateAppointmentNumber = async (type) => {
    const today = new Date().toISOString().split('T')[0]; // format YYYY-MM-DD
    const counterRef = doc(db, 'daily_counters', today);
    let newNumber = 1;
    
    try {
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          const initialData = { opdCount: 0, channelingCount: 0 };
          initialData[type === 'OPD' ? 'opdCount' : 'channelingCount'] = 1;
          transaction.set(counterRef, initialData);
        } else {
          const data = counterDoc.data();
          const currentCount = type === 'OPD' ? (data.opdCount || 0) : (data.channelingCount || 0);
          newNumber = currentCount + 1;
          transaction.update(counterRef, {
            [type === 'OPD' ? 'opdCount' : 'channelingCount']: newNumber
          });
        }
      });
      return newNumber;
    } catch (e) {
      console.error("Counter Error", e);
      return Math.floor(Math.random() * 1000); // safety fallback
    }
  };

  const confirmVisit = async () => {
    if (!paymentMethod) { toast.error("Please select a payment method"); return; }
    
    const loadingId = toast.loading("Generating Appointment...");
    
    try {
      const dailyNumber = await generateAppointmentNumber(serviceType);
      const formattedApptNo = `${serviceType === 'OPD' ? 'OPD' : 'CH'}-${dailyNumber}`;
      
      const docObj = (serviceType === 'Channeling' && selectedDoctor) 
        ? availableDoctors.find(d => d.name === selectedDoctor) 
        : null;

      const newVisit = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        contactNo: selectedPatient.contactNo,
        age: selectedPatient.age,
        gender: selectedPatient.gender || 'N/A',
        weight: selectedPatient.weight,
        height: selectedPatient.height,
        serviceType,
        doctor: selectedDoctor || 'N/A',
        specialization: docObj ? docObj.specialization : '',
        amount: activePrice,
        doctorCharge: docObj ? Number(docObj.doctorCharge || 0) : 0,
        hospitalCharge: docObj ? Number(docObj.hospitalCharge || 0) : (serviceType === 'OPD' ? activePrice : 0),
        paymentMethod,
        appointmentNo: formattedApptNo,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString()
      };

      // Save visit
      await addDoc(collection(db, 'visits'), newVisit);
      
      setVisitRecord(newVisit);
      toast.success("Visit created successfully!", { id: loadingId });
      setStep(4); // Move to receipt
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate appointment", { id: loadingId });
    }
  };


  // ================= RENDER STEPS =================
  return (
    <div className="registration-panel print-container">
      
      {/* STEP INDICATOR (Hide when printing) */}
      <div className="step-indicator no-print">
        <span className={step >= 1 ? 'active' : ''}>1. Registration</span>
        <div className="line"></div>
        <span className={step >= 2 ? 'active' : ''}>2. Services</span>
        <div className="line"></div>
        <span className={step >= 3 ? 'active' : ''}>3. Payment</span>
        <div className="line"></div>
        <span className={step >= 4 ? 'active' : ''}>4. Receipt</span>
      </div>

      {/* ================= STEP 1: Registration ================= */}
      {step === 1 && (
        <div className="fade-in no-print">
          <div className="search-section">
            <h2>Search Patient Number</h2>
            <form className="search-form" onSubmit={handleSearch}>
              <input type="tel" placeholder="e.g. 0771234567" value={contactNo} onChange={(e) => setContactNo(e.target.value)} className="search-input" />
              <button type="submit" className="action-btn search-btn">Search</button>
            </form>
          </div>

          {searchStatus === 'found' && !showNewForm && !selectedPatient && (
            <div className="fade-in">
              <div className="results-header">
                <h3>Registered Patients</h3>
                <button onClick={() => setShowNewForm(true)} className="add-family-btn">+ Add Family Member</button>
              </div>
              <div className="patient-cards">
                {patientsList.map(p => (
                  <div key={p.id} className="patient-card" onClick={() => { setSelectedPatient(p); setWeight(p.weight); setHeight(p.height); }}>
                    <span className="patient-name-header">Patient Name</span>
                    <h4>{p.name}</h4>
                    
                    <span className="details-topic">Details</span>
                    <div className="card-field">
                      <span className="card-label">Gender:</span> <span className="card-value">{p.gender}</span>
                    </div>
                    <div className="card-field">
                      <span className="card-label">Age:</span> <span className="card-value">{p.age}</span>
                    </div>
                    <div className="card-field">
                      <span className="card-label">Weight:</span> <span className="card-value">{p.weight}kg</span>
                    </div>
                    <div className="card-field">
                      <span className="card-label">Height:</span> <span className="card-value">{p.height}cm</span>
                    </div>
                    
                    <div style={{color:'var(--primary-cyan)', fontSize:'0.85rem', fontWeight:'700', marginTop:'12px'}}>Click to Select</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPatient && !showNewForm && (
            <div className="fade-in form-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <h3>Update Vitals for <span style={{color:'var(--primary-cyan)'}}>{selectedPatient.name}</span></h3>
                <button className="cancel-btn" onClick={() => setSelectedPatient(null)}>Cancel</button>
              </div>
              
              <form onSubmit={handleUpdateVitals} className="grid-form">
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" placeholder="Weight" value={weight} onChange={(e)=>setWeight(e.target.value)} required step="0.1" />
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input type="number" placeholder="Height" value={height} onChange={(e)=>setHeight(e.target.value)} required />
                </div>

                {weight && height && getBMIDetails(weight, height) && (
                  <div style={{ gridColumn: '1 / -1', background: getBMIDetails(weight, height).color + '1A', color: getBMIDetails(weight, height).color, padding: '0.8rem', borderRadius: '10px', textAlign: 'center', border: `1px solid ${getBMIDetails(weight, height).color}40`, fontWeight: '600' }}>
                    Computed BMI: <span style={{fontSize:'1.2rem'}}>{getBMIDetails(weight, height).bmi}</span> ({getBMIDetails(weight, height).status})
                  </div>
                )}

                <button type="submit" className="action-btn submit-btn" style={{ gridColumn: '1 / -1' }}>
                  Update & Proceed
                </button>
              </form>
            </div>
          )}

          {showNewForm && (
            <div className="fade-in form-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <h3>New Registration</h3>
                {searchStatus === 'found' && <button className="cancel-btn" onClick={() => setShowNewForm(false)}>Back</button>}
              </div>
              <p className="notif-text">Phone Number assigned: <b>{contactNo}</b></p>
              
              <form onSubmit={handleRegisterNew} className="grid-form">
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
                  <input type="number" value={age} readOnly style={{backgroundColor: '#e2e8f0'}} />
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
                  Complete & Proceed
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 2: Services ================= */}
      {step === 2 && (
        <div className="fade-in no-print form-card">
          <div className="selected-patient-box">
            <b>Patient:</b> {selectedPatient?.name} | {selectedPatient?.contactNo}
          </div>
          
          <h3 style={{marginTop:'1.5rem', fontWeight:'800'}}>Select Category</h3>
          <div className="service-options">
            <div className={`service-card ${serviceType==='OPD'?'active':''}`} style={{padding:'0.8rem 1rem'}} onClick={()=>selectService('OPD')}>
              <h3>OPD</h3>
              <p>General Consultation</p>
            </div>
            <div className={`service-card ${serviceType==='Channeling'?'active':''}`} style={{padding:'0.8rem 1rem'}} onClick={()=>selectService('Channeling')}>
              <h3>Channeling</h3>
              <p>Specialist Doctor</p>
            </div>
          </div>

          {serviceType && (
            <div className="form-group fade-in" style={{marginTop:'1.5rem'}}>
              <label>Select {serviceType} Doctor</label>
              <select value={selectedDoctor} onChange={handleDoctorChange} className="custom-select" required>
                <option value="">-- Choose {serviceType === 'OPD' ? 'an OPD' : 'a Specialist'} Doctor --</option>
                {availableDoctors
                  .filter(d => d.type === serviceType)
                  .map((docData) => (
                   <option key={docData.id} value={docData.name}>
                     {docData.name} {docData.specialization ? `(${docData.specialization})` : ''}
                   </option>
                ))}
              </select>
              {availableDoctors.filter(d => d.type === serviceType).length === 0 && (
                <small style={{color:'#dc2626', fontWeight:'700'}}>⚠️ No active {serviceType} doctors available in attendance.</small>
              )}
            </div>
          )}

          {serviceType && (
            <div className="price-section fade-in">
              <div className="price-display">
                <span>Service Fee</span>
                <h2 style={{margin:0, color:'var(--primary-cyan)'}}>
                  LKR {activePrice}.00 
                </h2>
              </div>
              <div style={{ display:'flex', gap:'1rem' }}>
                <button className="cancel-btn" style={{ flex: 1, padding:'0.7rem 1.2rem', fontSize:'0.9rem' }} onClick={() => setStep(1)}>Back</button>
                <button className="action-btn submit-btn" style={{ flex: 2, margin: 0, padding:'0.7rem 1.2rem', fontSize:'0.95rem', borderRadius:'10px' }} onClick={handleProceedToPayment}>Proceed to Payment</button>
              </div>
            </div>
          )}

          {!serviceType && (
            <div style={{ marginTop:'1.5rem', display: 'flex' }}>
               <button className="back-card-btn" onClick={() => setStep(1)}>🔙 Back to Search</button>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: Payment ================= */}
      {step === 3 && (
        <div className="fade-in no-print form-card payment-box">
          <h2 style={{textAlign:'center'}}>Payment Gateway</h2>
          
          {/* SLIM SUMMARY BOX */}
          <div style={{
            background:'#f8fafc', color:'#0f172a', padding:'0.8rem 1.2rem', borderRadius:'10px',
            border:'1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <h3 style={{margin:0, fontSize:'0.85rem', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.8px'}}>{serviceType} {serviceType==='Channeling' ? `(${selectedDoctor})` : ''}</h3>
            <h1 style={{margin:0, fontSize:'1.4rem', color:'#0f172a'}}>LKR {activePrice}.00</h1>
          </div>
          
          {/* SPACED PAYMENT LABEL */}
          <div style={{marginTop:'3.5rem'}}>
            <label style={{display:'block', marginBottom:'15px', fontWeight:'800', fontSize:'1rem', color:'#1e293b', textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>Select Payment Method:</label>
          </div>

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

          <div style={{ display:'flex', gap:'1rem', marginTop: '2.5rem' }}>
            <button className="cancel-btn" style={{flex:1}} onClick={() => setStep(2)}>Back</button>
            <button className="action-btn submit-btn" onClick={confirmVisit}>
              Confirm &amp; Generate Receipt
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: Receipt (Printable) ================= */}
      {step === 4 && visitRecord && (
        <>
          <div className="receipt-actions no-print">
            <button className="add-family-btn" onClick={() => window.print()}>🖨️ Print Receipt</button>
            <button className="cancel-btn" onClick={resetAll}>Done / Next Patient</button>
          </div>

          <div className="receipt-paper">
            <div className="receipt-header">
              <img src="/logo.png" alt="Logo" className="receipt-logo" />
              <h2>WellMed</h2>
              <p>Specialist Medical & Diabetic Care</p>
              <div className="divider"></div>
            </div>

            <div className="receipt-row title-row">
              <h2>{visitRecord.serviceType} Token</h2>
              <h1 className="appt-no">{visitRecord.appointmentNo}</h1>
            </div>

            <div className="divider"></div>

            <div className="receipt-details">
              <p><b>Date:</b> {visitRecord.date} {visitRecord.time}</p>
              <p><b>Patient Name:</b> {visitRecord.patientName}</p>
              <p><b>Contact No:</b> {visitRecord.contactNo}</p>
              <p><b>Age:</b> {visitRecord.age} Yrs | <b>Gender:</b> {visitRecord.gender}</p>
              <p><b>Height:</b> {visitRecord.height}cm | <b>Weight:</b> {visitRecord.weight}kg</p>
              {visitRecord.weight && visitRecord.height && (
                <p><b>Predicted BMI:</b> {getBMIDetails(visitRecord.weight, visitRecord.height)?.bmi} <i>({getBMIDetails(visitRecord.weight, visitRecord.height)?.status})</i></p>
              )}
              
              {visitRecord.serviceType === 'Channeling' && (
                <div className="doctor-box">
                  <b>Doctor:</b> {visitRecord.doctor} {visitRecord.specialization ? `(${visitRecord.specialization})` : ''}
                </div>
              )}
            </div>

            <div className="divider"></div>

            <div className="receipt-footer">
              <p className="fee-line"><b>Service Fee:</b> LKR {visitRecord.amount}.00</p>
              <p><b>Paid Method:</b> {visitRecord.paymentMethod}</p>
              <br/>
              <p>Wishing you a fast recovery!</p>
              <p className="small-text">wellmed.medi@gmail.com</p>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
