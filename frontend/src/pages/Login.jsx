import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // The actual official owner email for the hospital
  const officialAdminEmail = "wellmed.medi@gmail.com";

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading("Sending automated reset link to Owner...");
    try {
      // Sends a real reset link to the owner's email
      await sendPasswordResetEmail(auth, officialAdminEmail);
      toast.success(
        <div>
          <b>Reset Link Sent!</b><br/>
          <small>An email has been sent to the Owner (wellmed.medi@gmail.com) to reset the password.</small>
        </div>,
        { id: loadingToast, duration: 6000 }
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to send reset email. Please contact the Owner directly.", { id: loadingToast });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    toast.loading("Authenticating...", { id: 'login-toast' });

    try {
      // Smart mapping: If they type 'admin', it actually logs into the owner's Firebase auth account.
      // If they really typed an email by accident, format it, otherwise map generic admin to official email.
      const formatEmail = (username.toLowerCase() === 'admin') 
        ? officialAdminEmail 
        : (username.includes('@') ? username : `${username}@wellmed.com`);
      
      // Attempt Firebase Authentication
      await signInWithEmailAndPassword(auth, formatEmail, password);
      
      toast.success(
        <div>
          <b>Welcome to WellMed!</b><br/>
          <small>Login successful. Accessing Dashboard...</small>
        </div>,
        { id: 'login-toast', duration: 3000 }
      );
      
      // Navigate to the Dashboard after a smooth delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error) {
      console.error("Login Error:", error.code);
      let errorMessage = "Invalid Username or Password. Please try again.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "The username and password you entered did not match our records.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Access blocked due to multiple failed attempts. Please contact Owner.";
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
            <input 
              type="text" 
              placeholder="Enter username (e.g. admin)" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
              disabled={isLoading}
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading} 
            />
          </div>

          <div className="forgot-password">
            <a href="#" onClick={handleForgotPassword}>Forget Password?</a>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? "Checking Details..." : "Login to Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
