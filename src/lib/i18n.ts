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
  // @ts-ignore
  let cur: any = messages;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return path;
  }
  return cur as string;
}
