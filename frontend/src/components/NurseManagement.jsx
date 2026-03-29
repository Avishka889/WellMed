import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function NurseManagement() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [role, setRole] = useState('Nurse');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState(''); // NIC

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'staff'));
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaffList(docs);
    } catch (err) {
      toast.error("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB Limit
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
    // Phone validation
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("Invalid Phone Number! Please enter exactly 10 digits (e.g., 0771234567).", { icon: '📞' });
      return false;
    }

    // ID Number Validation (NIC)
    const nicRegexOld = /^[0-9]{9}[vVxX]$/;
    const nicRegexNew = /^[0-9]{12}$/;
    if (!nicRegexOld.test(idNumber) && !nicRegexNew.test(idNumber)) {
      toast.error("Invalid NIC Number! Please enter a valid Sri Lankan NIC.", { icon: '🆔' });
      return false;
    }

    // Duplicate Name check
    const normalizedName = name.trim().toLowerCase();
    const isDuplicate = staffList.some(s => s.name.trim().toLowerCase() === normalizedName && s.id !== editingId);
    if (isDuplicate) {
      toast.error(`Staff member named "${name}" already exists!`, { icon: '🚫' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const loadingId = toast.loading(editingId ? "Updating staff..." : "Adding staff...");
    
    try {
      const docData = { 
        name: name.trim(), 
        role: role.trim(), 
        address: address.trim(), 
        birthday,
        phone: phone.trim(),
        idNumber: idNumber.trim(),
        photoUrl: photoUrl || 'https://via.placeholder.com/150' 
      };
      
      if (editingId) {
        await updateDoc(doc(db, 'staff', editingId), docData);
        toast.success("Staff profile updated successfully!", { id: loadingId });
      } else {
        await addDoc(collection(db, 'staff'), docData);
        toast.success("New staff registered successfully!", { id: loadingId });
      }
      
      resetForm();
      fetchStaff();
    } catch (err) {
      toast.error("System encountered an error. Please try again.", { id: loadingId });
    }
  };

  const handleEdit = (doc) => {
    setEditingId(doc.id);
    setName(doc.name);
    setRole(doc.role);
    setAddress(doc.address || '');
    setPhotoUrl(doc.photoUrl);
    setBirthday(doc.birthday || '');
    setPhone(doc.phone || '');
    setIdNumber(doc.idNumber || '');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
      toast.success("Staff member deleted.");
      fetchStaff();
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRole('Nurse');
    setAddress('');
    setPhotoUrl('');
    setBirthday('');
    setPhone('');
    setIdNumber('');
    setShowForm(false);
  };

  return (
    <div className="registration-panel fade-in">
      <div className="results-header" style={{marginBottom:'2rem'}}>
        <div>
          <h2 style={{margin:0}}>Nurse & Staff Profiles</h2>
          <p style={{color:'#64748b', margin:0}}>Manage non-doctor staff members</p>
        </div>
        {!showForm && (
          <button className="action-btn search-btn" onClick={() => setShowForm(true)} style={{width:'auto', padding: '1rem 2rem', fontSize: '1.1rem'}}>
            Add New Staff Member
          </button>
        )}
      </div>

      {showForm ? (
        <div className="form-card fade-in">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1.5rem'}}>
            <h3>{editingId ? 'Edit Staff Profile' : 'Register New Staff'}</h3>
            <button className="cancel-btn" onClick={resetForm}>Cancel</button>
          </div>
          <form onSubmit={handleSubmit} className="grid-form">
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Full Name</label>
              <input type="text" placeholder="e.g. Nimali Silva" value={name} onChange={e=>setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Role / Position</label>
              <select value={role} onChange={e=>setRole(e.target.value)} className="custom-select" required>
                <option value="Nurse">Nurse</option>
                <option value="Receptionist">Receptionist</option>
                <option value="Lab Technician">Lab Technician</option>
                <option value="Pharmacist">Pharmacist</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>ID Number (NIC)</label>
              <input type="text" placeholder="e.g. 199012345678" value={idNumber} onChange={e=>setIdNumber(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Birthday</label>
              <input type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="e.g. 0771234567" value={phone} onChange={e=>setPhone(e.target.value)} required />
            </div>
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Residential Address</label>
              <input type="text" placeholder="House No, Street, City" value={address} onChange={e=>setAddress(e.target.value)} required />
            </div>
            <div className="form-group" style={{gridColumn:'1 / -1'}}>
              <label>Profile Photo</label>
              <div style={{display:'flex', gap:'1rem', alignItems:'center', background:'#f8fafc', padding:'1rem', borderRadius:'12px', border:'2px dashed #e2e8f0'}}>
                 <img src={photoUrl || 'https://via.placeholder.com/150'} alt="preview" style={{width:'80px', height:'80px', borderRadius:'14px', objectFit:'cover', border:'2px solid var(--primary-cyan)'}} />
                 <input type="file" accept="image/*" onChange={handlePhotoSelect} id="staff-photo-upload" style={{display:'none'}} />
                 <label htmlFor="staff-photo-upload" className="btn-sm" style={{background:'var(--primary-cyan)', color:'white', padding:'0.8rem 1.2rem', cursor:'pointer', borderRadius:'10px'}}>
                   {photoUrl ? 'Change Photo' : 'Select Photo'}
                 </label>
                 {photoUrl && <button type="button" onClick={()=>setPhotoUrl('')} style={{background:'transparent', border:'none', color:'#ef4444', textDecoration:'underline', cursor:'pointer', fontWeight:'600'}}>Remove</button>}
              </div>
            </div>
            <button type="submit" className="action-btn submit-btn" style={{gridColumn:'1 / -1'}}>
              {editingId ? 'Save Changes' : 'Add Staff Profile'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%'}}>
          {loading ? (
            <p>Loading staff...</p>
          ) : staffList.length === 0 ? (
            <p>No staff profiles registered yet.</p>
          ) : staffList.map(doc => (
            <div key={doc.id} className="fade-in" style={{
              display:'flex', justifyContent:'space-between', alignItems:'center', 
              padding:'1.5rem 2rem', background:'white', borderRadius:'20px',
              boxShadow:'0 4px 6px -1px rgba(0,0,0,0.05)', border:'1px solid #f1f5f9',
              width: '100%', boxSizing: 'border-box'
            }}>
              <div style={{display:'flex', gap:'1.5rem', alignItems:'center'}}>
                <img src={doc.photoUrl} alt="staff" style={{width:'64px', height:'64px', borderRadius:'16px', objectFit:'cover', border:'2px solid var(--primary-cyan)', padding:'2px', background:'white'}} />
                <div>
                  <h4 style={{margin:0, fontSize:'1.25rem', color:'#1e293b'}}>{doc.name}</h4>
                  <p style={{margin:0, color:'var(--primary-cyan)', fontWeight:'700', fontSize:'1rem', marginTop:'4px'}}>{doc.role}</p>
                  <div style={{marginTop:'5px', color:'#64748b', fontSize:'0.9rem', display:'flex', gap:'1rem'}}>
                    <div>📞 {doc.phone}</div>
                    <div style={{opacity:0.8}}>🆔 {doc.idNumber}</div>
                    <div style={{opacity:0.8}}>📍 {doc.address}</div>
                  </div>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                 <span style={{background: '#f0f9ff', color: '#0369a1', padding:'8px 16px', borderRadius:'12px', fontSize:'0.85rem', fontWeight:'800', letterSpacing:'0.5px'}}>
                  {doc.role.toUpperCase()}
                </span>
                <div style={{display:'flex', gap:'8px'}}>
                  <button onClick={() => handleEdit(doc)} className="btn-sm" style={{background:'#f1f5f9', color:'#475569', padding:'8px 16px', borderRadius:'10px', fontWeight:'600'}}>Edit</button>
                  <button onClick={() => handleDelete(doc.id)} className="btn-sm" style={{background:'#fee2e2', color:'#dc2626', padding:'8px 16px', borderRadius:'10px', fontWeight:'600'}}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
