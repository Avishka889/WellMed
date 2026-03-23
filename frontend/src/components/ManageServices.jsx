import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ManageServices() {
  const [opdFee, setOpdFee] = useState('');
  const [channelingFee, setChannelingFee] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const docRef = doc(db, 'settings', 'pricing');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOpdFee(docSnap.data().opd_fee || 1000);
          setChannelingFee(docSnap.data().channeling_fee || 2500);
        } else {
          setOpdFee(1000);
          setChannelingFee(2500);
        }
      } catch (err) {
        console.error("Error fetching pricing", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPricing();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const loadingId = toast.loading("Saving global pricing settings...");
    try {
      await setDoc(doc(db, 'settings', 'pricing'), {
        opd_fee: Number(opdFee),
        channeling_fee: Number(channelingFee)
      });
      toast.success("Pricing updated successfully! All new registrations will exclusively use this global pricing starting now.", { id: loadingId });
    } catch (err) {
      toast.error("Failed to save pricing.", { id: loadingId });
    }
  };

  if (isLoading) return <div>Loading securely...</div>;

  return (
    <div className="registration-panel fade-in">
      <div className="top-banner" style={{padding:0, marginBottom:'2.5rem'}}>
        <h2 style={{color: '#0f172a', margin:0, fontSize: '1.8rem'}}>⚙️ Global Service Pricing</h2>
        <p style={{color: '#64748b'}}>Centralized control center to manage the default prices for all new patient registrations.</p>
      </div>

      <form onSubmit={handleSave} className="grid-form form-card">
        <div className="form-group">
          <label>OPD General Consultation Fee (LKR)</label>
          <input type="number" placeholder="e.g. 1000" value={opdFee} onChange={e => setOpdFee(e.target.value)} required style={{fontSize: '1.2rem', fontWeight: 'bold'}} />
        </div>
        <div className="form-group">
          <label>Channeling Specialist Fee (LKR)</label>
          <input type="number" placeholder="e.g. 2500" value={channelingFee} onChange={e => setChannelingFee(e.target.value)} required style={{fontSize: '1.2rem', fontWeight: 'bold'}} />
        </div>
        <button type="submit" className="action-btn submit-btn" style={{ gridColumn: '1 / -1', marginTop: '1.5rem', padding: '1.3rem' }}>
          Save Global Pricing
        </button>
      </form>
    </div>
  );
}
