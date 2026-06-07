import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-brand-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-brand-700">EcoFoodStock</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Conditions generales d'utilisation</h1>
        <p className="mt-3 text-sm text-slate-500">Version MVP - 7 juin 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-950">Objet</h2>
            <p className="mt-2">
              EcoFoodStock aide a gerer un inventaire alimentaire, une liste de courses et un suivi nutritionnel domestique.
              Le service est fourni en version MVP et peut encore evoluer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Compte utilisateur</h2>
            <p className="mt-2">
              L'utilisateur est responsable de l'exactitude des informations renseignees et de la confidentialite de ses
              identifiants. Les donnees du foyer peuvent etre partagees avec les membres invites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Nutrition</h2>
            <p className="mt-2">
              Les indicateurs nutritionnels sont fournis a titre informatif. Ils ne remplacent pas l'avis d'un medecin,
              d'un dieteticien ou d'un professionnel de sante.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-950">Suppression et export</h2>
            <p className="mt-2">
              L'utilisateur peut exporter ses donnees et supprimer son compte depuis les parametres. La suppression est
              definitive apres confirmation.
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
