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
  const [photoUrl, setPhotoUrl] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loadingId = toast.loading(editingId ? "Updating doctor..." : "Adding doctor...");
    
    try {
      const docData = { 
        name, 
        specialization, 
        type, 
        birthday,
        phone,
        email,
        photoUrl: photoUrl || 'https://via.placeholder.com/150' 
      };
      
      if (editingId) {
        await updateDoc(doc(db, 'doctors', editingId), docData);
        toast.success("Doctor updated successfully!", { id: loadingId });
      } else {
        await addDoc(collection(db, 'doctors'), docData);
        toast.success("Doctor added successfully!", { id: loadingId });
      }
      
      resetForm();
      fetchDoctors();
    } catch (err) {
      toast.error("Operation failed.", { id: loadingId });
    }
  };

  const handleEdit = (doc) => {
    setEditingId(doc.id);
    setName(doc.name);
    setSpecialization(doc.specialization);
    setType(doc.type);
    setPhotoUrl(doc.photoUrl);
    setBirthday(doc.birthday || '');
    setPhone(doc.phone || '');
    setEmail(doc.email || '');
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
    setPhotoUrl('');
    setBirthday('');
    setPhone('');
    setEmail('');
    setShowForm(false);
  };

  return (
    <div className="registration-panel fade-in">
      <div className="results-header" style={{marginBottom:'2rem'}}>
        <div>
          <h2 style={{margin:0}}>🩺 Doctor Profiles</h2>
          <p style={{color:'#64748b', margin:0}}>Manage staff and specialists</p>
        </div>
        {!showForm && (
          <button className="add-family-btn" onClick={() => setShowForm(true)} style={{padding: '1.2rem 2rem', fontSize: '1.15rem'}}>
            🚀 Add New Doctor Profile
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
            <div className="form-group">
              <label>Service Type</label>
              <select value={type} onChange={e=>setType(e.target.value)} className="custom-select" required>
                <option value="Channeling">Channeling (Specialist)</option>
                <option value="OPD">OPD (General)</option>
              </select>
            </div>
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
        <div className="patient-cards">
          {loading ? (
            <p>Loading doctors...</p>
          ) : doctors.length === 0 ? (
            <p>No doctors registered yet.</p>
          ) : doctors.map(doc => (
            <div key={doc.id} className="patient-card" style={{cursor:'default'}}>
              <div style={{display:'flex', gap:'1.2rem', alignItems:'center'}}>
                <img src={doc.photoUrl} alt="doc" style={{width:'70px', height:'70px', borderRadius:'14px', objectFit:'cover', border:'2px solid var(--primary-cyan)', padding:'2px', background:'white'}} />
                <div>
                  <h4 style={{margin:0, fontSize:'1.1rem'}}>{doc.name}</h4>
                  <p style={{margin:0, color:'var(--primary-cyan)', fontWeight:'700', fontSize:'0.9rem'}}>{doc.specialization}</p>
                  <div style={{marginTop:'5px', color:'#64748b', fontSize:'0.85rem'}}>
                    <div>📞 {doc.phone}</div>
                    <div style={{fontSize:'0.8rem', opacity:0.8}}>✉️ {doc.email}</div>
                  </div>
                </div>
              </div>
              <div className="divider" style={{margin:'1rem 0'}}></div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{background: doc.type === 'OPD' ? '#fff7ed' : '#f0f9ff', color: doc.type === 'OPD' ? '#c2410c' : '#0369a1', padding:'5px 12px', borderRadius:'10px', fontSize:'0.75rem', fontWeight:'800', letterSpacing:'0.5px'}}>
                  {doc.type.toUpperCase()}
                </span>
                <div style={{display:'flex', gap:'8px'}}>
                  <button onClick={() => handleEdit(doc)} className="btn-sm" style={{background:'#f1f5f9', color:'#475569', fontSize:'0.8rem'}}>Edit</button>
                  <button onClick={() => handleDelete(doc.id)} className="btn-sm" style={{background:'#fee2e2', color:'#dc2626', fontSize:'0.8rem'}}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
