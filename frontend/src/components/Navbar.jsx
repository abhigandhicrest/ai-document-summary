import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar navbar-expand app-navbar">
      <div className="container">
        <NavLink className="navbar-brand" to="/" end>
          AI Document Summarizer
        </NavLink>
        <div className="navbar-nav">
          <NavLink className="nav-link" to="/" end>
            Dashboard
          </NavLink>
          <NavLink className="nav-link" to="/history">
            History
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
