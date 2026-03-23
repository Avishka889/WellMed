import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            padding: '16px',
            color: '#1e293b',
            borderRadius: '12px',
            boxShadow: '0 15px 30px rgba(0,0,0,0.1)',
            fontFamily: 'Poppins, sans-serif'
          },
          success: {
            iconTheme: {
              primary: '#00B4D8',
              secondary: '#fff',
            },
          },
        }} 
      />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
