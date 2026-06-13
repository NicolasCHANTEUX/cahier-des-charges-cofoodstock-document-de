import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-brand-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-brand-700">EcoFoodStock</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Politique de confidentialité</h1>
        <p className="mt-3 text-sm text-slate-500">Version MVP - 7 juin 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-950">Données collectées</h2>
            <p className="mt-2">
              EcoFoodStock collecte les informations nécessaires au compte, à l'inventaire, aux courses, aux préférences
              alimentaires et, en mode sportif, aux objectifs nutritionnels.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Utilisation</h2>
            <p className="mt-2">
              Ces données servent à personnaliser l'application, synchroniser le foyer, alimenter l'historique et fournir
              les statistiques visibles dans l'interface.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Droits utilisateur</h2>
            <p className="mt-2">
              L'utilisateur peut télécharger un export CSV de ses données et supprimer son compte depuis les paramètres.
              Si le compte est le dernier membre d'un foyer, les données du foyer sont également supprimées.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Données de santé</h2>
            <p className="mt-2">
              Les données physiques et nutritionnelles sont limitées au strict nécessaire pour les calculs de l'application.
              Elles ne sont pas vendues ni utilisées pour un ciblage publicitaire.
            </p>
          </section>
        </div>

        <Link className="mt-8 inline-flex font-semibold text-brand-700" href="/login">
          Retour à la connexion
        </Link>
      </section>
    </main>
  );
}
