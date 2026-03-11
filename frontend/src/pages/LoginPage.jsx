import { useState } from "react";

export default function LoginPage({ onLogin, errorMessage }) {
  const [email, setEmail] = useState("coord@teste.com");
  const [password, setPassword] = useState("123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setLocalError("Preencha email e senha.");
      return;
    }
    setLocalError("");
    setIsSubmitting(true);
    try {
      await onLogin({
        email: email.trim().toLowerCase(),
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
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="coord@teste.com"
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
