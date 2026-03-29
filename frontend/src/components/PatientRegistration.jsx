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
  const [prices, setPrices] = useState({ opd: 1000, channeling: 2500 });
  const [activePrice, setActivePrice] = useState(0);
  const [availableDoctors, setAvailableDoctors] = useState([]);

  // Fetch doctors and pricing strictly overriding defaults on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Pricing
        const priceSnap = await getDoc(doc(db, 'settings', 'pricing'));
        if (priceSnap.exists()) {
          setPrices({
            opd: priceSnap.data().opd_fee || 1000,
            channeling: priceSnap.data().channeling_fee || 2500
          });
        }
        
        // Fetch Channeling Doctors
        const q = query(collection(db, 'doctors'), where('type', '==', 'Channeling'));
        const docSnap = await getDocs(q);
        const docsList = docSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAvailableDoctors(docsList);
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
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(contactNo)) {
      toast.error('Invalid Phone Number! Please enter exactly 10 digits (e.g., 0771234567).', { icon: '📞' });
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
  const selectService = (type) => {
    setServiceType(type);
    setSelectedDoctor(''); // reset doc if switched
    setActivePrice(type === 'OPD' ? prices.opd : prices.channeling);
  };

  const handleProceedToPayment = () => {
    if (!serviceType) {
      toast.error("Please select a service type");
      return;
    }
    if (serviceType === 'Channeling' && !selectedDoctor) {
      toast.error("Please select a Doctor for Channeling");
      return;
    }
    setStep(3);
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
        amount: activePrice,
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
                    <h4>{p.name}</h4>
                    <div className="patient-dets">
                      <span><b>Gender:</b> {p.gender}</span><span><b>Age:</b> {p.age}</span><span><b>Weight:</b> {p.weight}kg</span><span><b>Height:</b> {p.height}cm</span>
                    </div>
                    <div style={{color:'var(--primary-cyan)', fontSize:'0.85rem', fontWeight:'600'}}>Click to Select</div>
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
          
          <h3 style={{marginTop:'1.5rem'}}>Select Category</h3>
          <div className="service-options">
            <div className={`service-card ${serviceType==='OPD'?'active':''}`} onClick={()=>selectService('OPD')}>
              <h3>OPD</h3>
              <p>General Consultation</p>
            </div>
            <div className={`service-card ${serviceType==='Channeling'?'active':''}`} onClick={()=>selectService('Channeling')}>
              <h3>Channeling</h3>
              <p>Specialist Doctor</p>
            </div>
          </div>

          {serviceType === 'Channeling' && (
            <div className="form-group fade-in" style={{marginTop:'1.5rem'}}>
              <label>Select Doctor</label>
              <select value={selectedDoctor} onChange={(e)=>setSelectedDoctor(e.target.value)} className="custom-select">
                <option value="">-- Choose a Doctor --</option>
                {availableDoctors.map((docData) => (
                   <option key={docData.id} value={docData.name}>
                     {docData.name} ({docData.specialization})
                   </option>
                ))}
              </select>
              <small style={{color:'#64748b'}}>* Only doctors registered as 'Channeling' are listed here.</small>
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
                <button className="cancel-btn" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
                <button className="action-btn submit-btn" style={{ flex: 2, margin: 0 }} onClick={handleProceedToPayment}>Proceed to Payment</button>
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
          <div className="bill-summary">
            <h3>{serviceType} {serviceType==='Channeling' ? `(${selectedDoctor})` : ''}</h3>
            <h1>LKR {activePrice}.00</h1>
          </div>
          
          <label style={{display:'block', marginBottom:'10px', fontWeight:'bold'}}>Select Payment Method:</label>
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

          <div style={{ display:'flex', gap:'1rem', marginTop: '2rem' }}>
            <button className="cancel-btn" style={{flex:1}} onClick={() => setStep(2)}>Back</button>
            <button className="action-btn submit-btn" style={{flex:2, margin:0}} onClick={confirmVisit}>
              Confirm & Generate Receipt
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
              <h2>WellMed Specialist-Led Care</h2>
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
                  <b>Doctor:</b> {visitRecord.doctor}
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
