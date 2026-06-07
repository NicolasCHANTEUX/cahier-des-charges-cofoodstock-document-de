import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-brand-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-brand-700">EcoFoodStock</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Politique de confidentialite</h1>
        <p className="mt-3 text-sm text-slate-500">Version MVP - 7 juin 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-950">Donnees collectees</h2>
            <p className="mt-2">
              EcoFoodStock collecte les informations necessaires au compte, a l'inventaire, aux courses, aux preferences
              alimentaires et, en mode sportif, aux objectifs nutritionnels.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Utilisation</h2>
            <p className="mt-2">
              Ces donnees servent a personnaliser l'application, synchroniser le foyer, alimenter l'historique et fournir
              les statistiques visibles dans l'interface.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Droits utilisateur</h2>
            <p className="mt-2">
              L'utilisateur peut telecharger un export CSV de ses donnees et supprimer son compte depuis les parametres.
              Si le compte est le dernier membre d'un foyer, les donnees du foyer sont egalement supprimees.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Donnees de sante</h2>
            <p className="mt-2">
              Les donnees physiques et nutritionnelles sont limitees au strict necessaire pour les calculs de l'application.
              Elles ne sont pas vendues ni utilisees pour un ciblage publicitaire.
            </p>
          </section>
        </div>

        <Link className="mt-8 inline-flex font-semibold text-brand-700" href="/login">
          Retour a la connexion
        </Link>
      </section>
    </main>
  );
}
