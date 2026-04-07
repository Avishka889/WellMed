import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Load emails from environment variables for security
  const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL;
  const STAFF_EMAIL = import.meta.env.VITE_STAFF_EMAIL;

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Please enter your username first to receive the reset link.");
      return;
    }

    const lowerUser = username.trim().toLowerCase();
    const targetEmail = lowerUser === 'owner' ? OWNER_EMAIL : STAFF_EMAIL;
    
    const loadingToast = toast.loading(`Sending Reset Link to specialized ${lowerUser === 'owner' ? 'Owner' : 'Staff'} account...`);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      toast.success(
        <div>
          <b>Link Sent Successfully!</b><br/>
          <small>Check your email ({targetEmail}) for the reset instructions.</small>
          <br/><br/>
          <small style={{color:'red'}}>Note: If you don't see it, make sure this email is registered in your Firebase Console.</small>
        </div>,
        { id: loadingToast, duration: 8000 }
      );
    } catch (error) {
      console.error(error);
      toast.error(`Error: ${error.message}. Make sure the email is registered in Firebase.`, { id: loadingToast });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    toast.loading("Verifying Identity...", { id: 'login-toast' });

    try {
      const lowerUser = username.trim().toLowerCase();
      let formatEmail = "";
      
      if (lowerUser === 'owner') formatEmail = OWNER_EMAIL;
      else if (lowerUser === 'admin' || lowerUser === 'staff') formatEmail = STAFF_EMAIL;
      else formatEmail = username.includes('@') ? username : `${username}@wellmed.com`;
      
      await signInWithEmailAndPassword(auth, formatEmail, password);
      
      localStorage.removeItem('wellmed_activeTab');

      // Record Login Activity
      try {
        await addDoc(collection(db, 'login_logs'), {
          username: lowerUser,
          role: lowerUser === 'owner' ? 'Owner' : 'Staff',
          email: formatEmail,
          timestamp: serverTimestamp(),
          date: new Date().toLocaleDateString('en-CA'),
          time: new Date().toLocaleTimeString()
        });
      } catch (logErr) { console.error("Logging Error:", logErr); }
      
      toast.success(<b>Welcome! Accessing Dashboard...</b>, { id: 'login-toast', duration: 4000 });
      
      setTimeout(() => {
        if (lowerUser === 'owner') navigate('/owner-dashboard');
        else navigate('/dashboard');
      }, 800);

    } catch (error) {
      console.error("Login Error:", error.code);
      let errorMessage = "Access Denied. Check your username and password.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "The credentials you entered are incorrect.";
      }
      toast.error(errorMessage, { id: 'login-toast', duration: 4000 });
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="logo-area">
          <img src="/logo.png" alt="WellMed Logo" className="brand-logo" />
          <h1>WellMed</h1>
          <p className="subtitle">Specialist Medical & Diabetic Care</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Username</label>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="forgot-password">
            <a href="#" onClick={handleForgotPassword}>Forget Password?</a>
          </div>
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? "Validating..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
export default Login;
