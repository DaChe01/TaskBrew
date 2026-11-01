import { Link } from 'react-router-dom';


export default function HomePage() {
  return (
    <main className="home-page">
      <div className="home-heading">
        <span className="brand-label"><h1><em>TheBrewingTerminal</em></h1></span>
        <h2 className="home-title">
          Your Tasks. Your Momentum.
        </h2>
        <p>Plan better. Stay focused. Get things done.</p>
        </div>

      <div className="home-buttons">
        <Link to="/login" className="home-button home-button-login">
          Login
        </Link>
        <Link to="/register" className="home-button home-button-register">
          Register
        </Link>
      </div>

      <footer className="home-footer">
        © {new Date().getFullYear()} TheBrewingTerminal Task Manager. Build, organize, repeat.
      </footer>
    </main>
  );
}
