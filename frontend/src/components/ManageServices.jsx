import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ManageServices() {
  const [opdMorningFee, setOpdMorningFee] = useState('');
  const [opdEveningFee, setOpdEveningFee] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Additional Services Management
  const [procedures, setProcedures] = useState([]);
  const STANDARD_PROCEDURES = ["ECG", "IV", "Wound Dressing", "Nebulizing", "Oxygen Catheter", "Sutures", "Saline"];
  const [isCustomProc, setIsCustomProc] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcPrice, setNewProcPrice] = useState('');
  const [newProcType, setNewProcType] = useState('Fixed'); // 'Fixed' or 'Variable'
  const [docFee, setDocFee] = useState('');
  const [nurseFee, setNurseFee] = useState('');
  const [subTab, setSubTab] = useState('pricing'); // 'pricing' or 'procedures'
  const [editingProcId, setEditingProcId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'settings', 'pricing');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOpdMorningFee(data.opd_morning_fee || data.opd_fee || 1000);
          setOpdEveningFee(data.opd_evening_fee || data.opd_fee || 1500);
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
        opd_morning_fee: Number(opdMorningFee),
        opd_evening_fee: Number(opdEveningFee)
      }, { merge: true });
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
        type: newProcType,
        docFee: Number(docFee) || 0,
        nurseFee: Number(nurseFee) || 0
      };
      const docRef = await addDoc(collection(db, 'clinical_procedures'), proc);
      setProcedures([...procedures, { id: docRef.id, ...proc }]);
      setNewProcName(''); setNewProcPrice(''); setDocFee(''); setNurseFee(''); setIsCustomProc(false);
      toast.success("Procedure added successfully!", { id: loadingId });
    } catch (err) {
      toast.error("Failed to add procedure.", { id: loadingId });
    }
  };

  const handleEditClick = (proc) => {
    setEditingProcId(proc.id);
    setNewProcName(proc.name);
    setIsCustomProc(!STANDARD_PROCEDURES.includes(proc.name));
    setNewProcPrice(proc.price);
    setNewProcType(proc.type);
    setDocFee(proc.docFee || '');
    setNurseFee(proc.nurseFee || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProcedure = async () => {
    const loadingId = toast.loading("Updating clinical procedure...");
    try {
      const procRef = doc(db, 'clinical_procedures', editingProcId);
      const updatedData = {
        name: newProcName.trim(),
        price: newProcType === 'Variable' ? 0 : Number(newProcPrice),
        type: newProcType,
        docFee: Number(docFee) || 0,
        nurseFee: Number(nurseFee) || 0
      };
      await updateDoc(procRef, updatedData);
      setProcedures(procedures.map(p => p.id === editingProcId ? { id: p.id, ...updatedData } : p));
      setEditingProcId(null);
      setNewProcName(''); setNewProcPrice(''); setDocFee(''); setNurseFee(''); setIsCustomProc(false);
      toast.success("Procedure updated successfully!", { id: loadingId });
    } catch (err) {
      toast.error("Update failed.", { id: loadingId });
    }
  };

  const cancelEdit = () => {
    setEditingProcId(null);
    setNewProcName('');
    setIsCustomProc(false);
    setNewProcPrice('');
    setNewProcType('Fixed');
    setDocFee('');
    setNurseFee('');
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

      <div style={{display:'flex', gap:'1rem', marginBottom:'2.5rem', justifyContent: 'center'}} className="no-print">
         <button 
           className="action-btn" 
           onClick={() => setSubTab('procedures')}
           style={{
             background: subTab==='procedures' ? '#F4A261' : 'white', 
             color: subTab==='procedures' ? 'white' : '#475569', 
             padding:'0.7rem 1.5rem', margin:0, borderRadius:'12px', border: subTab==='procedures' ? 'none' : '2px solid #e2e8f0',
             fontSize: '0.95rem', width: 'auto'
           }}
         >
           Manage Clinical Procedures
         </button>
         <button 
           className="action-btn" 
           onClick={() => setSubTab('pricing')}
           style={{
             background: subTab==='pricing' ? '#F4A261' : 'white', 
             color: subTab==='pricing' ? 'white' : '#475569', 
             padding:'0.7rem 1.5rem', margin:0, borderRadius:'12px', border: subTab==='pricing' ? 'none' : '2px solid #e2e8f0',
             fontSize: '0.95rem', width: 'auto'
           }}
         >
           Global Default Fees
         </button>
      </div>

      <div className="fade-in">
        {subTab === 'pricing' && (
          <div className="form-card" style={{maxWidth:'600px', margin:'0 auto'}}>
             <h3 style={{marginBottom:'1.5rem'}}>1. Global Default Fees</h3>
             <form onSubmit={handleSavePricing} className="grid-form">
              <div className="form-group" style={{gridColumn:'1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem'}}>
                <div>
                  <label>OPD Consultation (Morning - Before 12 PM) LKR</label>
                  <input type="number" value={opdMorningFee} onChange={e => setOpdMorningFee(e.target.value)} required style={{fontSize:'1.2rem', width:'100%'}} />
                </div>
                <div>
                  <label>OPD Consultation (Evening - After 12 PM) LKR</label>
                  <input type="number" value={opdEveningFee} onChange={e => setOpdEveningFee(e.target.value)} required style={{fontSize:'1.2rem', width:'100%'}} />
                </div>
              </div>
              <div style={{gridColumn:'1 / -1', display:'flex', justifyContent:'center', marginTop:'1.5rem'}}>
                 <button type="submit" className="action-btn submit-btn" style={{margin:0, padding:'0.8rem 2.5rem', background: '#00B4D8', width: 'auto', borderRadius:'10px'}}>Save Defaults</button>
               </div>
             </form>
          </div>
        )}

        {subTab === 'procedures' && (
          <div className="form-card" style={{maxWidth:'800px', margin:'0 auto'}}>
            <h3 style={{marginBottom:'1.5rem'}}>{editingProcId ? 'Edit Procedure' : '2. Manage Other Clinical Procedures'}</h3>
            <form onSubmit={handleAddProcedure} className="grid-form" style={{marginBottom:'2rem', paddingBottom:'2rem', borderBottom:'2px solid #f1f5f9'}}>
              <div className="form-group" style={{gridColumn:'1 / -1'}}>
                <label>Procedure Name</label>
                <select 
                  className="custom-select" 
                  value={isCustomProc ? 'Other' : (newProcName && STANDARD_PROCEDURES.includes(newProcName) ? newProcName : (newProcName ? 'Other' : ''))}
                  onChange={(e) => {
                    if (e.target.value === 'Other') {
                      setIsCustomProc(true);
                      setNewProcName('');
                    } else {
                      setIsCustomProc(false);
                      setNewProcName(e.target.value);
                    }
                  }}
                  required={!isCustomProc}
                >
                  <option value="" disabled>-- Select a Procedure --</option>
                  {STANDARD_PROCEDURES.map(proc => <option key={proc} value={proc}>{proc}</option>)}
                  <option value="Other">Other Procedure (Type Manually...)</option>
                </select>
                
                {isCustomProc && (
                  <div className="fade-in" style={{marginTop:'10px'}}>
                    <input 
                      type="text" 
                      placeholder="Type custom procedure name..." 
                      value={newProcName} 
                      onChange={e => setNewProcName(e.target.value)} 
                      required 
                    />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Price Type</label>
                <select value={newProcType} onChange={e=>{setNewProcType(e.target.value); setDocFee(''); setNurseFee('');}} className="custom-select">
                  <option value="Fixed">Fixed Price</option>
                  <option value="Variable">Enter at Billing (Variable)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Default Price (LKR)</label>
                <input type="number" placeholder="0" value={newProcPrice} onChange={e=>setNewProcPrice(e.target.value)} disabled={newProcType==='Variable'} required={newProcType==='Fixed'} />
              </div>
              <div className="form-group" style={{gridColumn:'1 / -1', display: newProcType === 'Variable' ? 'flex' : 'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', background:'#f0fdf4', padding:'1rem', borderRadius:'10px', border:'1px solid #bbf7d0', flexDirection:'column'}}>
                {newProcType === 'Fixed' && (
                  <div style={{display:'flex', flexDirection:'column'}}>
                    <label>Doctor's Cut (LKR)</label>
                    <input type="number" placeholder="0" value={docFee} onChange={e=>setDocFee(e.target.value)} required />
                  </div>
                )}
                <div style={{display:'flex', flexDirection:'column', flex: 1}}>
                  <label>Nurse's Cut {newProcType === 'Variable' ? '(%)' : '(LKR)'}</label>
                  <input type="number" placeholder="0" value={nurseFee} onChange={e=>setNurseFee(e.target.value)} required />
                </div>
              </div>
              <div style={{gridColumn:'1 / -1', display:'flex', gap:'10px', justifyContent:'center', marginTop:'1rem'}}>
                <button type="submit" className="action-btn" style={{width: 'auto', margin:0, background: '#00B4D8', padding:'0.8rem 2.5rem', borderRadius: '10px', color:'white', border:'none', fontWeight:'700', cursor:'pointer'}}>
                  {editingProcId ? 'Save Changes' : '+ Add New Procedure'}
                </button>
                {editingProcId && (
                  <button type="button" className="cancel-btn" style={{padding: '0.8rem 1.5rem'}} onClick={cancelEdit}>Cancel</button>
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
                        <div style={{fontSize:'0.85rem', color:'#64748b', marginTop:'4px'}}>
                           {p.type==='Variable' ? `Nurse Cut: ${p.nurseFee}% | (Doc fee added at billing)` : `Doc: ${p.docFee} LKR | Nurse: ${p.nurseFee} LKR`}
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
