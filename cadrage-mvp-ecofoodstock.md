# Cadrage MVP - EcoFoodStock

## Verdict

Le cadrage est suffisant pour lancer le developpement du MVP 1.

L'objectif n'est pas encore de livrer toute la vision produit, mais de construire une premiere version utile, mobile-first, centree sur le stock alimentaire, les DLC, les courses simples et l'historique.

## Perimetre MVP 1

Inclus dans le MVP 1 :

- Authentification simple
- Onboarding de base
- Choix du mode Grand Public / Sportif
- Gestion de l'inventaire
- Ajout manuel de produit
- Scan produit via Open Food Facts
- Gestion des DLC
- Recherche et filtres simples dans l'inventaire
- Gestion des quantites
- Liste de courses simple
- Transfert courses vers inventaire si faisable rapidement
- Historique detaille des actions
- Annulation des actions principales depuis l'historique
- Interface mobile-first responsive

Exclus du MVP 1 :

- Recettes intelligentes
- Mode cuisine
- Notifications push
- Bilan hebdomadaire
- Suggestions avancees de courses
- Foyer partage avance avec permissions fines
- Export CSV/PDF
- Suppression RGPD complete automatisee
- Dashboards nutritionnels complets

Ces elements pourront arriver en MVP 2 ou MVP 3.

## Regles de quantite

Regle d'affichage :

- Si une masse est inferieure a 1 kg, l'affichage se fait en grammes.
- Si une masse est superieure ou egale a 1 kg, l'affichage se fait en kilogrammes.
- Certains produits peuvent utiliser une unite par defaut differente : pieces, portions, bouteilles, boites, sachets, etc.

Regle technique recommandee :

- Stocker les quantites en unite canonique.
- Pour les masses : stocker en grammes.
- Pour les volumes : stocker en millilitres si on les gere.
- Pour les objets : stocker en pieces ou portions.
- Convertir seulement a l'affichage.

Exemples :

- 250 g affiche "250 g".
- 1500 g affiche "1,5 kg".
- 3 oeufs affiche "3 pieces".
- 2 portions affiche "2 portions".

## Scan Open Food Facts

Cas prevus pour le MVP 1 :

- Produit connu : pre-remplir les champs disponibles.
- Produit inconnu : afficher un message clair indiquant que le produit n'est pas reconnu.
- Image manquante : utiliser une image placeholder d'erreur/produit par defaut.
- Nutrition absente : ignorer pour le MVP 1, sans bloquer l'ajout.
- Nom incorrect ou quantite non reconnue : permettre la modification manuelle avant validation.

Principe UX :

- Le scan ne doit jamais bloquer l'utilisateur.
- Si les donnees sont incompletes, on garde le minimum utile : nom, quantite, DLC, categorie si connue.
- L'utilisateur peut corriger les champs avant d'ajouter au stock.

## Grand Public vs Sportif

Decision MVP 1 :

- Le choix du mode est conserve dans le profil.
- Les differences d'interface detaillees seront ajustees apres revue des captures d'ecran.
- Les dashboards nutritionnels complets ne sont pas une priorite du MVP 1.

Point a definir avec les captures :

- Ce qui change visuellement dans l'accueil, les parametres et l'onglet sante.
- Ce qui doit rester commun aux deux modes.

## Recettes

Decision :

- Pas de recettes dans le MVP 1.
- Les recettes passent en MVP 2.

Points a etudier plus tard :

- API gratuite ou freemium pertinente.
- Gestion des quotas API.
- Correspondance entre ingredients de recette et produits de l'inventaire.
- Ingredients manquants vers liste de courses.
- Mode cuisine et deduction automatique.

## Foyer partage

Decision MVP :

- Faire simple au depart.
- Un foyer doit toujours avoir au moins un membre.
- Pas de droits complexes au debut : tous les membres ont les memes droits.
- Invitation par lien simple.
- Le lien pourra etre transforme en QR code pour une meilleure experience.

Regle importante :

- Si un membre quitte un foyer, le foyer continue tant qu'il reste au moins un membre.
- Si le compte utilisateur est supprime, ses donnees personnelles sont supprimees.
- Les donnees communes du foyer doivent etre traitees prudemment si plusieurs membres existent.

Point a preciser plus tard :

- Que faire si le dernier membre supprime son compte : supprimer le foyer et toutes les donnees associees.

## Historique et annulation

Actions a historiser :

- Ajout de produit
- Modification de quantite
- Suppression de produit
- Consommation
- Produit jete
- Transfert courses vers inventaire
- Connexion d'un membre au foyer, plus tard
- Recette cuisinee, plus tard
- Annulation d'une action

Actions annulables :

- Ajout de produit
- Suppression de produit
- Consommation
- Transfert courses vers inventaire
- Recette cuisinee, en MVP 2

Principe :

- L'historique doit etre tres detaille.
- Il sert a la fois au droit a l'erreur, a la tracabilite et aux futures statistiques.

## Confidentialite et RGPD

Decision :

- Ce n'est pas la priorite fonctionnelle du MVP 1, car le projet ne sera pas publie immediatement.
- Il faut tout de meme garder la structure compatible avec ces exigences.

Prevoir dans l'architecture :

- Export des donnees plus tard.
- Suppression de compte plus tard.
- Donnees minimales.
- Attention particuliere aux donnees de sante.
- Mention claire sur le suivi nutritionnel au moment ou cette partie devient active.

## Priorite responsive

Decision :

- Mobile-first.

Raison :

- Le scan se fait sur telephone.
- Les courses se font sur telephone.
- La cuisine se fait souvent sur telephone.
- Le desktop doit rester confortable, mais n'est pas la cible principale du MVP.

## Points restants avant developpement

Non bloquants, mais a traiter rapidement :

- Captures d'ecran pour valider le parcours ecran par ecran. Premiere revue effectuee dans `revue-captures-ecrans-ecofoodstock.md`.
- Choix final du style visuel et de la navigation mobile.
- Liste exacte des champs du formulaire d'ajout produit.
- Definition des categories de filtres inventaire.
- Niveau de detail du premier historique.

## Ajustement apres revue des captures

Les captures montrent une maquette plus large que le MVP 1. Pour le developpement initial, il faut masquer ou neutraliser les modules suivants :

- recettes ;
- notifications ;
- suggestions avancees de courses ;
- sante avancee ;
- exports et suppression RGPD complete si non implementes.

Les ecrans prioritaires a developper sont :

- authentification ;
- onboarding ;
- inventaire ;
- ajout manuel ;
- scan ;
- courses simples ;
- historique ;
- parametres de base.
