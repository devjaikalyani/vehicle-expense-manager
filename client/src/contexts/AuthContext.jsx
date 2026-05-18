import { createContext, useContext, useState } from 'react';
import axios from 'axios';

// Send cookies with every request automatically
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vem_user')); } catch { return null; }
  });

  const login = async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password });
    const { user } = res.data;
    // Token is now stored in httpOnly cookie — only persist the non-sensitive user profile
    localStorage.setItem('vem_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = async () => {
    try { await axios.post('/api/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('vem_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
