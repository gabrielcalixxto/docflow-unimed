import { useState } from "react";

export default function LoginPage({ onLogin, errorMessage }) {
  const [username, setUsername] = useState("qualidade.docflow");
  const [password, setPassword] = useState("123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!username || !password) {
      setLocalError("Preencha login e senha.");
      return;
    }
    setLocalError("");
    setIsSubmitting(true);
    try {
      await onLogin({
        username: username.trim().toLowerCase(),
        password,
      });
    } catch (_error) {
      // erro ja tratado no estado do App
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <section className="login-card panel-float">
        <p className="kicker">DocFlow Unimed</p>
        <h1>Controle documental com workflow</h1>
        <p className="login-description">
          Entre com seu usuario para acessar busca de documentos vigentes e a area de workflow.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-username">Login</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="gabriel.soares"
            autoComplete="username"
          />

          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
          />

          {(localError || errorMessage) && <p className="error-text">{localError || errorMessage}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
