import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { LayoutDashboard, Library, CheckCircle, Bot, LogOut, UserCircle } from 'lucide-react';

const NAV = [
  { path: '/dashboard', icon: <LayoutDashboard size={20} strokeWidth={2.2} />, label: 'Dashboard' },
  { path: '/library',   icon: <Library        size={20} strokeWidth={2.2} />, label: 'Library'   },
  { path: '/tasks',     icon: <CheckCircle    size={20} strokeWidth={2.2} />, label: 'Tasks'     },
  { path: '/chatbot',   icon: <Bot            size={20} strokeWidth={2.2} />, label: 'Kudos AI'  },
];

export default function Sidebar() {
    const navigate = useNavigate();
    const handleLogout = async () => { await signOut(auth); navigate('/login'); };

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <img src="/logo.svg" alt="Kudos" />
                </div>
                <span className="sidebar-logo-text">Kudos</span>
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
                {NAV.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-divider" />

            {/* Account */}
            <NavLink
                to="/account"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
                <span className="nav-icon"><UserCircle size={20} strokeWidth={2.2} /></span>
                Account
            </NavLink>

            {/* Logout */}
            <button className="nav-item logout" onClick={handleLogout}>
                <span className="nav-icon"><LogOut size={20} strokeWidth={2.2} /></span>
                Logout
            </button>
        </aside>
    );
}
