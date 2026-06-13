export const messages = {
  auth: {
    missingCredentials: "Email et mot de passe requis.",
    signupFailed: "La création du compte a échoué.",
    authError: "Erreur d'authentification",
    signupSuccess: "Compte créé. Redirection...",
    loginSuccess: "Connexion réussie. Redirection..."
  },
  household: {
    joinSuccess: "Vous avez été rattaché au foyer.",
    invalidToken: "Token d'invitation invalide ou expiré.",
    alreadyMember: "Vous êtes déjà membre de ce foyer."
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
