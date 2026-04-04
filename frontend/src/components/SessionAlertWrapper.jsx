import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const OPD_SESSIONS = [
  { label: 'Morning Session (7:00 AM – 10:00 AM)', endHour: 10, endMin: 0, checkAfterMin: 30 },
  { label: 'Evening Session (4:00 PM – 8:00 PM)',  endHour: 20, endMin: 0, checkAfterMin: 30 },
];

export default function SessionAlertWrapper() {
  const [sessionAlerts, setSessionAlerts] = useState([]);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const [snoozedRecords, setSnoozedRecords] = useState({});

  useEffect(() => {
    // Run exactly every 1 minute
    const interval = setInterval(checkAlerts, 60 * 1000);
    // Initial check
    checkAlerts();
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snoozedRecords, showSessionAlert]);

  const checkAlerts = async () => {
    // Only check if we are not currently displaying alerts
    if (showSessionAlert) return;

    try {
      const today = new Date().toLocaleDateString('en-CA');
      const q = query(collection(db, 'attendance'), where('date', '==', today), where('status', '==', 'Present'));
      const snap = await getDocs(q);
      
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const alerts = [];

      snap.forEach(d => {
        const att = { id: d.id, ...d.data() };
        if (att.category !== 'doctor' || att.docType !== 'OPD') return;
        if (att.outTime) return;
        if (!att.inTime) return;

        OPD_SESSIONS.forEach(session => {
          const sessionEndMinutes = session.endHour * 60 + session.endMin;
          const [inH, inM] = att.inTime.split(':').map(Number);
          const inMinutes = inH * 60 + inM;

          // Target only sessions where they checked in before the end of the session
          if (inMinutes < sessionEndMinutes) {
            // Check if 30 mins have passed since session end
            if (nowMinutes >= sessionEndMinutes + session.checkAfterMin) {
              const lastSnoozeTime = snoozedRecords[att.id] || 0;
              // Check if 30 mins have passed since the LAST snooze (or since 1970 if never snoozed)
              const timeSinceSnoozeMins = (Date.now() - lastSnoozeTime) / (1000 * 60);

              if (timeSinceSnoozeMins >= 30) {
                alerts.push({
                  attId: att.id,
                  memberId: att.memberId,
                  name: att.name,
                  inTime: att.inTime,
                  sessionLabel: session.label,
                  endTimeStr: `${session.endHour > 12 ? session.endHour - 12 : session.endHour}:${String(session.endMin).padStart(2,'0')} ${session.endHour >= 12 ? 'PM' : 'AM'}`
                });
              }
            }
          }
        });
      });

      if (alerts.length > 0) {
        setSessionAlerts(alerts);
        setCurrentAlertIndex(0);
        setShowSessionAlert(true);
      }
    } catch (e) {
      console.error("Error checking session alerts", e);
    }
  };

  const handleAlertYes = () => {
    const alert = sessionAlerts[currentAlertIndex];
    if (alert) {
      setSnoozedRecords(prev => ({ ...prev, [alert.attId]: Date.now() }));
    }
    
    const next = currentAlertIndex + 1;
    if (next < sessionAlerts.length) {
      setCurrentAlertIndex(next);
    } else {
      setShowSessionAlert(false);
      setSessionAlerts([]);
    }
  };

  const handleAlertNo = async () => {
    const alert = sessionAlerts[currentAlertIndex];
    if (alert) {
      try {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const outTime = `${hh}:${mm}`;
        await updateDoc(doc(db, 'attendance', alert.attId), {
          outTime,
          status: 'Completed',
          timestamp: new Date().toISOString()
        });
        toast.success(`${alert.name} marked out at ${outTime}.`);
      } catch (e) {
        toast.error('Failed to mark out.');
      }
    }
    
    const next = currentAlertIndex + 1;
    if (next < sessionAlerts.length) {
      setCurrentAlertIndex(next);
    } else {
      setShowSessionAlert(false);
      setSessionAlerts([]);
    }
  };

  if (!showSessionAlert || !sessionAlerts[currentAlertIndex]) return null;

  const alert = sessionAlerts[currentAlertIndex];

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(15,23,42,0.5)', zIndex:99999,
      display:'flex', alignItems:'center', justifyContent:'center',
      backdropFilter:'blur(3px)'
    }}>
      <div className="fade-in" style={{
        background:'white', borderRadius:'14px', padding:'2.5rem',
        maxWidth:'420px', width:'90%', boxShadow:'0 20px 40px rgba(0,0,0,0.2)',
        border:'1px solid #e2e8f0'
      }}>
        <div style={{background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'0.8rem 1rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'10px'}}>
          <span style={{fontSize:'1.4rem'}}>⚠️</span>
          <span style={{fontWeight:'700', color:'#92400e', fontSize:'0.95rem'}}>Session End Time Passed</span>
        </div>

        <h3 style={{margin:'0 0 0.5rem 0', color:'#0f172a', fontSize:'1.2rem'}}>{alert.name}</h3>
        <p style={{margin:'0 0 0.3rem 0', color:'#475569', fontSize:'0.95rem'}}>
          <b>Session:</b> {alert.sessionLabel}
        </p>
        <p style={{margin:'0 0 1.5rem 0', color:'#475569', fontSize:'0.95rem'}}>
          <b>Marked In:</b> {(() => {
            const [h, m] = alert.inTime.split(':');
            let hr = parseInt(h);
            const ap = hr >= 12 ? 'PM' : 'AM';
            hr = hr % 12 || 12;
            return `${hr}:${m} ${ap}`;
          })()} &nbsp;·&nbsp; <b>Session Ended:</b> {alert.endTimeStr}
        </p>

        <p style={{margin:'0 0 1.8rem 0', color:'#1e293b', fontWeight:'600', fontSize:'1rem'}}>
          Is <span style={{color:'#0369a1'}}>{alert.name}</span> still available at the clinic?
        </p>

        <div style={{display:'flex', gap:'1rem'}}>
          <button
            onClick={handleAlertNo}
            style={{flex:1, background:'#dc2626', color:'white', border:'none', padding:'12px', borderRadius:'8px', fontWeight:'700', fontSize:'1rem', cursor:'pointer'}}
          >
            No — Mark Out Now
          </button>
          <button
            onClick={handleAlertYes}
            style={{flex:1, background:'#16a34a', color:'white', border:'none', padding:'12px', borderRadius:'8px', fontWeight:'700', fontSize:'1rem', cursor:'pointer'}}
          >
            Yes — Still Here
          </button>
        </div>

        {sessionAlerts.length > 1 && (
          <p style={{textAlign:'center', marginTop:'1rem', color:'#94a3b8', fontSize:'0.85rem'}}>
            Alert {currentAlertIndex + 1} of {sessionAlerts.length}
          </p>
        )}
      </div>
    </div>
  );
}
