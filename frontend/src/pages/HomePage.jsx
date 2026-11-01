import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="home-page">
      <h1 className="home-title">Welcome to SPCL Task Manager 🚀</h1>
      <p className="home-subtext">
        Stay organized, manage your tasks, and build consistency. Never miss a deadline: high
        priority tasks get email reminders days ahead.
      </p>

      <div className="home-buttons">
        <Link to="/login" className="home-button home-button-login">
          Login
        </Link>
        <Link to="/register" className="home-button home-button-register">
          Register
        </Link>
      </div>

      <footer className="home-footer">© 2025 SPCL Task Manager. Build, organize, repeat.</footer>
    </main>
  );
}
