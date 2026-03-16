import { useState } from "react";

import { cardVariants, inputVariants, buttonVariants } from "../components/ui/variants";
import { cn } from "../utils/cn";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
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

      <section className={cn("login-card panel-float", cardVariants({ variant: "elevated" }))}>
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
            required
            className={inputVariants()}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="nome.exemplo"
            autoComplete="username"
          />

          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            required
            className={inputVariants()}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
          />

          <button
            type="submit"
            className={buttonVariants({ variant: "primary", fullWidth: true })}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
