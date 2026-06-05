export const messages = {
  auth: {
    missingCredentials: "Email et mot de passe requis.",
    signupFailed: "La creation du compte a echoue.",
    authError: "Erreur d'authentification",
    signupSuccess: "Compte cree. Redirection...",
    loginSuccess: "Connexion reussie. Redirection..."
  },
  household: {
    joinSuccess: "Vous avez ete rattache au foyer.",
    invalidToken: "Token d'invitation invalide ou expire.",
    alreadyMember: "Vous etes deja membre de ce foyer."
  }
} as const;

export function t(path: string) {
  const parts = path.split(".");
  let cur: unknown = messages;

  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) {
      return path;
    }

    cur = (cur as Record<string, unknown>)[part];
  }

  return typeof cur === "string" ? cur : path;
}
