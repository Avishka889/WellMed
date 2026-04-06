import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OwnerDashboard from './pages/OwnerDashboard';

function App() {
  return (
    <Router>
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 4000,
          style: {
            padding: '20px 32px',
            color: '#0f172a',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            fontFamily: 'Poppins, sans-serif',
            fontSize: '18px',
            fontWeight: '600',
            maxWidth: '500px',
            border: '2px solid #e2e8f0'
          },
          success: {
            style: {
              border: '2px solid #10b981',
              background: '#f0fdf4',
            },
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            style: {
              border: '2px solid #ef4444',
              background: '#fef2f2',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          }
        }} 
      />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/owner-dashboard" element={<OwnerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
