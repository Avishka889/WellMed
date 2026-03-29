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

  // Registration States (Matching PatientRegistration)
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const [serviceList, setServiceList] = useState([]);
  const [procedurePrices, setProcedurePrices] = useState({}); // To track manual prices for variable types

  // Fetch Services from Firestore
  useEffect(() => {
    const fetchProcs = async () => {
       const snap = await getDocs(collection(db, 'clinical_procedures'));
       setServiceList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchProcs();
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

  const handleManualPriceChange = (serviceId, price) => {
    setProcedurePrices(prev => ({ ...prev, [serviceId]: Number(price) }));
  };

  const calculateTotal = () => {
    return selectedServices.reduce((sum, s) => {
      const price = s.type === 'Fixed' ? s.price : (procedurePrices[s.id] || 0);
      return sum + price;
    }, 0);
  };

  const handleProcessPayment = async () => {
    if (selectedServices.length === 0) return toast.error("Select at least one service.");
    
    // Check if any variable service has no price
    const missingPrice = selectedServices.find(s => s.type === 'Variable' && !procedurePrices[s.id]);
    if (missingPrice) return toast.error(`Please enter a price for ${missingPrice.name}`);

    const loadingId = toast.loading("Processing clinical service record...");
    try {
      const finalServices = selectedServices.map(s => ({
        ...s,
        price: s.type === 'Fixed' ? s.price : procedurePrices[s.id]
      }));

      const serviceRecord = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        contactNo: selectedPatient.contactNo,
        services: finalServices,
        totalAmount: calculateTotal(),
        timestamp: serverTimestamp(),
        type: 'additional_service'
      };
      
      await addDoc(collection(db, 'additional_visit_services'), serviceRecord);
      
      toast.success("Payment recorded successfully!", { id: loadingId });
      setIsReceiptGenerated(true);
    } catch (err) {
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
            <div className="receipt-hospital-name">WELLMED SPECIALIST-LED CARE</div>
            <div className="receipt-address">Specialized Medical & Diabetic Care Unit</div>
            <div className="receipt-address">Tel: 011-2345678 / 077-1234567</div>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-info-grid">
            <div className="info-item"><span className="label">PATIENT:</span><span className="value">{selectedPatient.name}</span></div>
            <div className="info-item"><span className="label">PHONE:</span><span className="value">{selectedPatient.contactNo}</span></div>
            <div className="info-item"><span className="label">DATE:</span><span className="value">{new Date().toLocaleDateString()}</span></div>
            <div className="info-item"><span className="label">TIME:</span><span className="value">{new Date().toLocaleTimeString()}</span></div>
          </div>

          <div className="receipt-divider" style={{borderStyle:'solid'}}></div>

          <div className="receipt-services">
            <h4 style={{textAlign:'center', margin:'10px 0', textDecoration:'underline'}}>CLINICAL SERVICES</h4>
            {selectedServices.map(s => {
              const price = s.type === 'Fixed' ? s.price : procedurePrices[s.id];
              return (
                <div key={s.id} className="service-row" style={{display:'flex', justifyContent:'space-between', padding:'5px 0'}}>
                  <span>{s.name}</span>
                  <span style={{fontWeight:'bold'}}>Rs. {(price || 0).toFixed(2)}</span>
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
             <p style={{marginTop:'5px'}}>Prompt Care - Professional Excellence</p>
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
                    <h4>{p.name}</h4>
                    <div className="patient-dets">
                      <span><b>Gender:</b> {p.gender}</span>
                      <span><b>Age:</b> {p.age}</span>
                      <span><b>Weight:</b> {p.weight}kg</span>
                      <span><b>Height:</b> {p.height}cm</span>
                    </div>
                    <div style={{color:'var(--primary-cyan)', fontSize:'0.85rem', fontWeight:'600'}}>Click to Select</div>
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

           <div className="grid-form">
              <div className="form-group" style={{gridColumn:'1 / -1'}}>
                 <label>Select Clinical Services</label>
                 <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem', marginTop:'1rem'}}>
                    {serviceList.map(service => {
                       const isSelected = selectedServices.find(s => s.id === service.id);
                       return (
                         <div key={service.id} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            <div 
                              className={`service-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleService(service)}
                              style={{padding:'1.2rem', height:'auto', display:'flex', justifyContent:'space-between', alignItems:'center'}}
                            >
                                <div>
                                  <div style={{fontWeight:'700'}}>{service.name}</div>
                                  <div style={{color:'var(--primary-cyan)', fontSize:'1rem'}}>
                                    {service.type === 'Fixed' ? `Rs. ${service.price}` : 'Manual Price Entry'}
                                  </div>
                                </div>
                                <div className={`check-indicator ${isSelected ? 'checked' : ''}`}></div>
                            </div>
                            
                            {/* Manual Price Entry if Variable */}
                            {isSelected && service.type === 'Variable' && (
                              <div className="fade-in" style={{padding:'0 10px 10px 10px'}}>
                                <label style={{fontSize:'0.85rem', color:'#64748b'}}>Amount (LKR)</label>
                                <input 
                                  type="number" 
                                  placeholder="Enter Price" 
                                  value={procedurePrices[service.id] || ''} 
                                  onChange={(e)=>handleManualPriceChange(service.id, e.target.value)}
                                  className="search-input"
                                  style={{padding:'0.8rem', fontSize:'1rem', marginTop:'5px'}}
                                />
                              </div>
                            )}
                         </div>
                       );
                    })}
                 </div>
              </div>

              {selectedServices.length > 0 && (
                <div className="price-section fade-in" style={{gridColumn:'1 / -1', marginTop:'2rem'}}>
                  <div className="price-display">
                    <span className="price-label">TOTAL SERVICE FEE:</span>
                    <span className="price-val">Rs. {calculateTotal()}</span>
                  </div>
                  <button className="action-btn submit-btn" onClick={handleProcessPayment} style={{marginTop:'1rem'}}>
                    Confirm & Print Clinical Bill
                  </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
