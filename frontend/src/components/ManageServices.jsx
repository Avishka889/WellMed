import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ManageServices() {
  const [opdFee, setOpdFee] = useState('');
  const [channelingFee, setChannelingFee] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Additional Services Management
  const [procedures, setProcedures] = useState([]);
  const [newProcName, setNewProcName] = useState('');
  const [newProcPrice, setNewProcPrice] = useState('');
  const [newProcType, setNewProcType] = useState('Fixed'); // 'Fixed' or 'Variable'
  const [subTab, setSubTab] = useState('pricing'); // 'pricing' or 'procedures'
  const [editingProcId, setEditingProcId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'settings', 'pricing');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOpdFee(docSnap.data().opd_fee || 1000);
          setChannelingFee(docSnap.data().channeling_fee || 2500);
        }
        
        // Fetch Additional Procedures
        const procSnap = await getDocs(collection(db, 'clinical_procedures'));
        setProcedures(procSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching defaults", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSavePricing = async (e) => {
    e.preventDefault();
    const loadingId = toast.loading("Saving global pricing...");
    try {
      await setDoc(doc(db, 'settings', 'pricing'), {
        opd_fee: Number(opdFee),
        channeling_fee: Number(channelingFee)
      });
      toast.success("Default pricing updated!", { id: loadingId });
    } catch (err) {
      toast.error("Failed to save pricing.", { id: loadingId });
    }
  };

  const handleAddProcedure = async (e) => {
    e.preventDefault();

    // Duplicate Validation
    const normalizedNewName = newProcName.trim().toLowerCase();
    const isDuplicate = procedures.some(p => p.name.trim().toLowerCase() === normalizedNewName && p.id !== editingProcId);
    
    if (isDuplicate) {
      toast.error(`A procedure named "${newProcName}" already exists!`, { icon: '🚫' });
      return;
    }

    if (editingProcId) {
      handleUpdateProcedure();
      return;
    }
    const loadingId = toast.loading("Adding clinical procedure...");
    try {
      const proc = {
        name: newProcName.trim(),
        price: newProcType === 'Variable' ? 0 : Number(newProcPrice),
        type: newProcType
      };
      const docRef = await addDoc(collection(db, 'clinical_procedures'), proc);
      setProcedures([...procedures, { id: docRef.id, ...proc }]);
      setNewProcName(''); setNewProcPrice('');
      toast.success("Procedure added successfully!", { id: loadingId });
    } catch (err) {
      toast.error("Failed to add procedure.", { id: loadingId });
    }
  };

  const handleEditClick = (proc) => {
    setEditingProcId(proc.id);
    setNewProcName(proc.name);
    setNewProcPrice(proc.price);
    setNewProcType(proc.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProcedure = async () => {
    const loadingId = toast.loading("Updating clinical procedure...");
    try {
      const procRef = doc(db, 'clinical_procedures', editingProcId);
      const updatedData = {
        name: newProcName.trim(),
        price: newProcType === 'Variable' ? 0 : Number(newProcPrice),
        type: newProcType
      };
      await updateDoc(procRef, updatedData);
      setProcedures(procedures.map(p => p.id === editingProcId ? { id: p.id, ...updatedData } : p));
      setEditingProcId(null);
      setNewProcName(''); setNewProcPrice('');
      toast.success("Procedure updated successfully!", { id: loadingId });
    } catch (err) {
      toast.error("Update failed.", { id: loadingId });
    }
  };

  const cancelEdit = () => {
    setEditingProcId(null);
    setNewProcName('');
    setNewProcPrice('');
    setNewProcType('Fixed');
  };

  const handleDeleteProcedure = async (id) => {
    if (!window.confirm("Are you sure you want to remove this procedure?")) return;
    try {
      await deleteDoc(doc(db, 'clinical_procedures', id));
      setProcedures(procedures.filter(p => p.id !== id));
      toast.success("Procedure removed.");
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

  if (isLoading) return <div>Loading securely...</div>;

  return (
    <div className="registration-panel fade-in">
      <div className="top-banner" style={{padding:0, marginBottom:'2rem'}}>
        <h2 style={{color: '#0f172a', margin:0, fontSize: '1.8rem'}}>Clinical Service Management</h2>
        <p style={{color: '#64748b'}}>Configure standard fees and clinical procedures.</p>
      </div>

      <div style={{display:'flex', gap:'1rem', marginBottom:'2.5rem'}} className="no-print">
         <button 
           className={`action-btn ${subTab === 'pricing' ? 'submit-btn' : 'cancel-btn'}`} 
           onClick={() => setSubTab('pricing')}
           style={{flex:1, padding:'1.2rem', margin:0, borderRadius:'15px', border: subTab==='pricing' ? 'none' : '2px solid #e2e8f0'}}
         >
           Global Default Fees
         </button>
         <button 
           className={`action-btn ${subTab === 'procedures' ? 'submit-btn' : 'cancel-btn'}`} 
           onClick={() => setSubTab('procedures')}
           style={{flex:1, padding:'1.2rem', margin:0, borderRadius:'15px', border: subTab==='procedures' ? 'none' : '2px solid #e2e8f0'}}
         >
           Manage Clinical Procedures
         </button>
      </div>

      <div className="fade-in">
        {subTab === 'pricing' && (
          <div className="form-card" style={{maxWidth:'600px', margin:'0 auto'}}>
             <h3 style={{marginBottom:'1.5rem'}}>1. Global Default Fees</h3>
             <form onSubmit={handleSavePricing} className="grid-form">
              <div className="form-group" style={{gridColumn:'1 / -1'}}>
                <label>OPD Consultation (LKR)</label>
                <input type="number" value={opdFee} onChange={e => setOpdFee(e.target.value)} required style={{fontSize:'1.2rem'}} />
              </div>
              <div className="form-group" style={{gridColumn:'1 / -1'}}>
                <label>Channeling Fee (LKR)</label>
                <input type="number" value={channelingFee} onChange={e => setChannelingFee(e.target.value)} required style={{fontSize:'1.2rem'}} />
              </div>
              <button type="submit" className="action-btn submit-btn" style={{gridColumn:'1 / -1', margin:0, padding:'1.2rem'}}>Save Defaults</button>
             </form>
          </div>
        )}

        {subTab === 'procedures' && (
          <div className="form-card" style={{maxWidth:'800px', margin:'0 auto'}}>
            <h3 style={{marginBottom:'1.5rem'}}>{editingProcId ? 'Edit Procedure' : '2. Manage Other Clinical Procedures'}</h3>
            <form onSubmit={handleAddProcedure} className="grid-form" style={{marginBottom:'2rem', paddingBottom:'2rem', borderBottom:'2px solid #f1f5f9'}}>
              <div className="form-group" style={{gridColumn:'1 / -1'}}>
                <label>Procedure Name</label>
                <input type="text" placeholder="e.g. ECG" value={newProcName} onChange={e=>setNewProcName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Price Type</label>
                <select value={newProcType} onChange={e=>setNewProcType(e.target.value)} className="custom-select">
                  <option value="Fixed">Fixed Price</option>
                  <option value="Variable">Enter at Billing (Variable)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Default Price (LKR)</label>
                <input type="number" placeholder="0" value={newProcPrice} onChange={e=>setNewProcPrice(e.target.value)} disabled={newProcType==='Variable'} required={newProcType==='Fixed'} />
              </div>
              <div style={{gridColumn:'1 / -1', display:'flex', gap:'10px'}}>
                <button type="submit" className="action-btn submit-btn" style={{flex:2, margin:0, background: editingProcId ? '#16a34a' : 'var(--primary-cyan)', padding:'1.1rem'}}>
                  {editingProcId ? 'Save Changes' : '+ Add New Procedure'}
                </button>
                {editingProcId && (
                  <button type="button" className="cancel-btn" style={{flex:1}} onClick={cancelEdit}>Cancel</button>
                )}
              </div>
            </form>

            <div className="procedures-list">
              <h4 style={{marginBottom:'1rem'}}>Currently Registered Procedures</h4>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem'}}>
                {procedures.length === 0 && <p style={{color:'#94a3b8', fontSize:'0.9rem'}}>No additional procedures added yet.</p>}
                {procedures.map(p => (
                  <div key={p.id} style={{display:'flex', flexDirection:'column', gap:'15px', background:'#f8fafc', padding:'1.2rem', borderRadius:'15px', border:'1px solid #e2e8f0', borderLeft: editingProcId === p.id ? '5px solid #16a34a' : '1px solid #e2e8f0'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontWeight:'700', color:'#1e293b', fontSize:'1.1rem'}}>{p.name}</div>
                        <div style={{fontSize:'0.9rem', color:p.type==='Fixed'?'#16a34a':'#0284c7', marginTop:'4px', fontWeight:'600'}}>
                           {p.type === 'Fixed' ? `Rs. ${p.price}.00` : 'Manual Entry'}
                        </div>
                      </div>
                      <div style={{display:'flex', gap:'5px'}}>
                        <button className="btn-sm" style={{background:'#e0f2fe', color:'#0369a1', padding:'5px 12px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600'}} onClick={()=>handleEditClick(p)}>Edit</button>
                        <button className="btn-sm" style={{background:'#fee2e2', color:'#dc2626', padding:'5px 12px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600'}} onClick={()=>handleDeleteProcedure(p.id)}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
