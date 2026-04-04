import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function DoctorManagement() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [type, setType] = useState('Channeling'); // 'OPD' or 'Channeling'
  const [qualifications, setQualifications] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // New Payment Fields
  const [hourlyRate, setHourlyRate] = useState('');
  const [doctorCharge, setDoctorCharge] = useState('');
  const [hospitalCharge, setHospitalCharge] = useState('');

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'doctors'));
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDoctors(docs);
    } catch (err) {
      toast.error("Failed to load doctors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB Limit for Base64 demonstration
        toast.error("Photo is too large. Please select a smaller image.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    // Phone validation (07XXXXXXXX)
    const phoneRegex = /^07[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("Invalid Phone Number! Must start with 07 and be 10 digits (e.g., 0771234567).");
      return false;
    }

    // Email validation
    if (!email.includes('@')) {
      toast.error("Invalid Email Format! Must contain @.");
      return false;
    }

    // Duplicate Name check (if not editing or if name changed)
    const normalizedName = name.trim().toLowerCase();
    const isDuplicate = doctors.some(d => d.name.trim().toLowerCase() === normalizedName && d.id !== editingId);
    if (isDuplicate) {
      toast.error(`A doctor named "${name}" already exists! Please use a unique identifier if needed.`, { icon: '🚫' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const loadingId = toast.loading(editingId ? "Updating doctor..." : "Adding doctor...");
    
    try {
      const docData = { 
        name: name.trim(), 
        specialization: specialization.trim(), 
        type, 
        qualifications: qualifications.trim(),
        birthday,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        photoUrl: photoUrl || 'https://via.placeholder.com/150',
        hourlyRate: type === 'OPD' ? Number(hourlyRate) || 0 : 0,
        doctorCharge: type === 'Channeling' ? Number(doctorCharge) || 0 : 0,
        hospitalCharge: type === 'Channeling' ? Number(hospitalCharge) || 0 : 0
      };
      
      if (editingId) {
        await updateDoc(doc(db, 'doctors', editingId), docData);
        toast.success("Doctor profile updated successfully!", { id: loadingId });
      } else {
        await addDoc(collection(db, 'doctors'), docData);
        toast.success("New doctor registered successfully!", { id: loadingId });
      }
      
      resetForm();
      fetchDoctors();
    } catch (err) {
      toast.error("System encountered an error. Please try again.", { id: loadingId });
    }
  };

  const handleEdit = (doc) => {
    setEditingId(doc.id);
    setName(doc.name);
    setSpecialization(doc.specialization);
    setType(doc.type);
    setQualifications(doc.qualifications || '');
    setPhotoUrl(doc.photoUrl);
    setBirthday(doc.birthday || '');
    setPhone(doc.phone || '');
    setEmail(doc.email || '');
    setHourlyRate(doc.hourlyRate || '');
    setDoctorCharge(doc.doctorCharge || '');
    setHospitalCharge(doc.hospitalCharge || '');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this doctor?")) return;
    try {
      await deleteDoc(doc(db, 'doctors', id));
      toast.success("Doctor deleted.");
      fetchDoctors();
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSpecialization('');
    setType('Channeling');
    setQualifications('');
    setPhotoUrl('');
    setBirthday('');
    setPhone('');
    setEmail('');
    setHourlyRate('');
    setDoctorCharge('');
    setHospitalCharge('');
    setShowForm(false);
  };

  return (
    <div className="registration-panel fade-in">
      <div className="results-header" style={{marginBottom:'2rem'}}>
        <div>
          <h2 style={{margin:0}}>Doctor Profiles</h2>
          <p style={{color:'#64748b', margin:0}}>Manage staff and specialists</p>
        </div>
        {!showForm && (
          <button className="action-btn" onClick={() => setShowForm(true)} style={{width:'auto', padding: '0.8rem 2rem', background:'#00B4D8', borderRadius:'12px', color:'white', border:'none', fontWeight:'700', cursor:'pointer'}}>
            + Add New Doctor Profile
          </button>
        )}
      </div>

      {showForm ? (
        <div className="form-card fade-in">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1.5rem'}}>
            <h3>{editingId ? 'Edit Doctor Profile' : 'Register New Doctor'}</h3>
            <button className="cancel-btn" onClick={resetForm}>Cancel</button>
          </div>
          <form onSubmit={handleSubmit} className="grid-form">
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Doctor's Full Name (with Title)</label>
              <input type="text" placeholder="e.g. Dr. Kamal Perera" value={name} onChange={e=>setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Specialization / Designation</label>
              <input type="text" placeholder="e.g. Cardiologist / MO" value={specialization} onChange={e=>setSpecialization(e.target.value)} required />
            </div>
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Qualifications</label>
              <input type="text" placeholder="e.g. MBBS, MD, FRCP" value={qualifications} onChange={e=>setQualifications(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Service Type</label>
              <select value={type} onChange={e=>setType(e.target.value)} className="custom-select" required>
                  <option value="OPD">OPD Services</option>
                  <option value="Channeling">Private Channeling</option>
                </select>
              </div>

              {type === 'OPD' ? (
                <div className="form-group">
                  <label>Hourly Payment Rate (LKR)</label>
                  <input type="number" value={hourlyRate} onChange={e=>setHourlyRate(e.target.value)} placeholder="e.g. 1500" required />
                </div>
              ) : (
                <>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                    <div className="form-group">
                      <label>Doctor Charge (LKR)</label>
                      <input type="number" value={doctorCharge} onChange={e=>setDoctorCharge(e.target.value)} placeholder="e.g. 2000" required />
                    </div>
                    <div className="form-group">
                      <label>Hospital Charge (LKR)</label>
                      <input type="number" value={hospitalCharge} onChange={e=>setHospitalCharge(e.target.value)} placeholder="e.g. 500" required />
                    </div>
                  </div>
                  <div style={{fontSize:'0.85rem', color:'#64748b', marginTop:'-10px', marginBottom:'10px'}}>
                    Total Channeling Fee: <b>Rs. {(Number(doctorCharge) + Number(hospitalCharge)).toFixed(2)}</b>
                  </div>
                </>
              )}
            <div className="form-group">
              <label>Birthday</label>
              <input type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="e.g. 0771234567" value={phone} onChange={e=>setPhone(e.target.value)} required />
            </div>
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Email Address</label>
              <input type="email" placeholder="doctor@wellmed.com" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Doctor's Profile Photo</label>
              <div style={{display:'flex', gap:'1rem', alignItems:'center', background:'#f8fafc', padding:'1rem', borderRadius:'12px', border:'2px dashed #e2e8f0'}}>
                 <img src={photoUrl || 'https://via.placeholder.com/150'} alt="preview" style={{width:'80px', height:'80px', borderRadius:'14px', objectFit:'cover', border:'2px solid var(--primary-cyan)'}} />
                 <input type="file" accept="image/*" onChange={handlePhotoSelect} id="doc-photo-upload" style={{display:'none'}} />
                 <label htmlFor="doc-photo-upload" className="btn-sm" style={{background:'var(--primary-cyan)', color:'white', padding:'0.8rem 1.2rem', cursor:'pointer', borderRadius:'10px'}}>
                   {photoUrl ? 'Change Photo' : 'Select Photo'}
                 </label>
                 {photoUrl && <button type="button" onClick={()=>setPhotoUrl('')} style={{background:'transparent', border:'none', color:'#ef4444', textDecoration:'underline', cursor:'pointer', fontWeight:'600'}}>Remove</button>}
              </div>
            </div>
            <button type="submit" className="action-btn submit-btn" style={{gridColumn:'1 / -1'}}>
              {editingId ? 'Save Changes' : 'Add Doctor Profile'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%'}}>
          {loading ? (
            <p>Loading doctors...</p>
          ) : doctors.length === 0 ? (
            <p>No doctors registered yet.</p>
          ) : doctors.map(doc => (
            <div key={doc.id} className="fade-in" style={{
              display:'flex', justifyContent:'space-between', alignItems:'center', 
              padding:'1.2rem 2rem', background:'white', borderRadius:'16px',
              boxShadow:'0 4px 12px rgba(0,0,0,0.03)', border:'1.5px solid #e2e8f0',
              width: '100%', boxSizing: 'border-box',
              borderLeft: `6px solid ${doc.type === 'OPD' ? '#F4A261' : '#00B4D8'}`
            }}>
              <div style={{display:'flex', gap:'1.5rem', alignItems:'center'}}>
                <img src={doc.photoUrl} alt="doc" style={{width:'64px', height:'64px', borderRadius:'14px', objectFit:'cover', border:'1px solid #e2e8f0', background:'#f8fafc'}} />
                <div>
                  <h4 style={{margin:0, fontSize:'1.2rem', color:'#0f172a', fontWeight:'700'}}>{doc.name}</h4>
                  <p style={{margin:0, color: doc.type === 'OPD' ? '#c2410c' : '#0369a1', fontWeight:'600', fontSize:'0.9rem', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.5px'}}>{doc.specialization}</p>
                  {doc.qualifications && (
                    <p style={{margin:'4px 0 0 0', color:'#64748b', fontSize:'0.85rem', fontWeight:'500'}}>{doc.qualifications}</p>
                  )}
                  <div style={{marginTop:'8px', color:'#94a3b8', fontSize:'0.85rem', display:'flex', gap:'1.2rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'5px'}}><span style={{fontWeight:'700', color:'#475569'}}>TEL:</span> {doc.phone}</div>
                    <div style={{display:'flex', alignItems:'center', gap:'5px'}}><span style={{fontWeight:'700', color:'#475569'}}>MAIL:</span> {doc.email}</div>
                  </div>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                <div style={{display:'flex', gap:'8px'}}>
                  <button onClick={() => handleEdit(doc)} style={{background:'#f1f5f9', color:'#475569', padding:'8px 16px', borderRadius:'8px', border:'none', fontSize:'0.85rem', fontWeight:'700', cursor:'pointer', transition:'0.2s'}}>Edit</button>
                  <button onClick={() => handleDelete(doc.id)} style={{background:'#fee2e2', color:'#ef4444', padding:'8px 16px', borderRadius:'8px', border:'none', fontSize:'0.85rem', fontWeight:'700', cursor:'pointer', transition:'0.2s'}}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
