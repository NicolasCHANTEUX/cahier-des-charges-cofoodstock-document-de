# 📋 BACKLOG PRODUIT : ÉCOFOODSTOCK

## 🔐 TICKET : Authentification — création de compte et SSO (Google & Apple)

**Contexte :** Le formulaire d'authentification existe (`features/auth/AuthCard.tsx`) avec des boutons UI pour Google et Apple mais sans handlers.

**Objectif :** Permettre la création de compte par email/password et la connexion via Google et Apple en utilisant Supabase OAuth.

**Critères d'Acceptation (DoD) :**

* [ ] Implémenter la création de compte (email + mot de passe) côté frontend et valider côté serveur si besoin.
* [ ] Ajouter handlers pour `Continuer avec Google` et `Continuer avec Apple` appelant `createSupabaseBrowserClient().auth.signInWithOAuth({ provider })`.
* [ ] Documenter les variables d'environnement requises et les redirect URIs dans `.env.example` et `README.md`.
* [ ] Gérer le callback / onboarding pour lier le profil `users` au `household_id` si nécessaire.
* [ ] Tests manuels : connexion par email, création de compte, flux OAuth Google et Apple.


## 🗂️ ÉPIC 1 : INFRASTRUCTURE & CADRE LÉGAL

*Mise en place des fondations techniques de distribution de l'application et de la conformité légale européenne (RGPD).*

### 🎟️ TICKET 1.1 : Transformation en Progressive Web App (PWA)

**Contexte :** ÉcoFoodStock est une application web (Next.js). Pour offrir une expérience "mobile native" (icône sur l'écran d'accueil, plein écran, mode hors-ligne), nous devons la configurer en PWA.
**User Story :** En tant qu'utilisateur mobile, je veux pouvoir installer l'application sur mon écran d'accueil sans passer par les App Stores, afin d'y accéder rapidement et avec une interface fluide.

**Parcours Utilisateur (UX) :**

1. L'utilisateur visite le site web depuis son smartphone (Chrome sur Android ou Safari sur iOS).
2. Sur Android : Une bannière native apparaît en bas de l'écran proposant "Ajouter à l'écran d'accueil".
3. Sur iOS : Une petite bulle d'aide (UI interne à notre app) s'affiche pour expliquer qu'il faut cliquer sur l'icône "Partager" puis "Sur l'écran d'accueil" de Safari.
4. Une fois installée, l'app s'ouvre sans la barre d'URL du navigateur.

**Critères d'Acceptation (DoD) :**

* [ ] Un fichier `manifest.json` valide est présent à la racine (définissant le nom "ÉcoFoodStock", la couleur du thème principal, et les chemins vers les icônes en différentes résolutions).
* [ ] Un Service Worker est configuré et actif (idéalement via un package comme `@serwist/next` ou `next-pwa`).
* [ ] Le Service Worker met en cache les assets statiques et les pages principales pour permettre une navigation basique sans connexion internet.
* [ ] Un composant React "Bulle d'aide iOS" est créé. Il détecte l'User-Agent d'Apple et s'affiche si l'app n'est pas lancée en mode "standalone" (PWA).

### 🎟️ TICKET 1.2 : Conformité RGPD, CGU et Droit à l'Oubli

**Contexte :** L'application récolte des données de santé (poids, sexe, régime). L'accord explicite de l'utilisateur est une obligation légale stricte.
**User Story :** En tant qu'utilisateur, je veux être informé de l'utilisation de mes données et pouvoir contrôler mon compte (export ou suppression) à tout moment.

**Parcours Utilisateur (UX) & Logique :**

1. Sur l'écran d'inscription (`features/auth/AuthCard.tsx`), l'utilisateur ne peut pas valider la création de compte tant qu'il n'a pas coché une case obligatoire acceptant les CGU.


2. S'il active le mode "Sportif" et renseigne son poids/sexe, un texte explicatif apparaît sous le formulaire pour rassurer sur l'usage local et chiffré de ces données.
3. Dans la vue des paramètres (`features/settings/SettingsView.tsx`), une nouvelle section "Légal & Sécurité" est présente en bas de page.



**Critères d'Acceptation (DoD) :**

* [ ] Ajout d'une case à cocher non pré-remplie sur `AuthCard.tsx` : *"J'ai lu et j'accepte les Conditions Générales d'Utilisation et la Politique de Confidentialité"*. Les termes sont des liens cliquables.
* [ ] Ajout d'un bouton "Exporter mes données (CSV)" dans les Paramètres, qui génère un fichier regroupant l'historique d'inventaire et les données de profil.
* [ ] Ajout d'un bouton rouge "Supprimer mon compte définitivement". Cette action déclenche un effacement total (Hard Delete) de l'utilisateur dans la base Supabase et détruit le `household_id` s'il en était l'unique membre.

---

## 🗂️ ÉPIC 2 : FOYER PARTAGÉ & GESTION DES RÉGIMES

*Permettre à plusieurs personnes de vivre sous le même toit (même inventaire) tout en gardant une interface filtrée selon leurs besoins de santé.*

### 🎟️ TICKET 2.1 : Invitation d'un colocataire via QR Code (Deep Linking)

**Contexte :** Actuellement, le `household_id` est géré de manière invisible. Il faut permettre à un utilisateur principal de rattacher un autre compte à son foyer de manière simple et sécurisée.
**User Story :** En tant que créateur d'un foyer, je veux afficher un QR Code sur mon téléphone pour que mon conjoint/colocataire puisse le scanner et rejoindre mon frigo virtuel.

**Parcours Utilisateur (UX) :**

1. Utilisateur A va dans Paramètres > "Mon profil & foyer" et clique sur "Inviter un membre".
2. Un QR Code s'affiche. Il contient une URL dynamique avec un token sécurisé (ex: `ecofoodstock.app/join?token=abc123xyz`).
3. Utilisateur B scanne le QR code avec son appareil photo natif.
4. Si B n'a pas de compte, l'URL le mène à la page d'inscription. Après validation de son onboarding, il est automatiquement rattaché au foyer.
5. Si B est déjà connecté, une modale s'ouvre : *"Alex vous invite à rejoindre le foyer. Accepter ?"*.

**Critères d'Acceptation (DoD) :**

* [ ] Création d'une table Supabase `invitation_tokens` (id, household_id, token, expires_at).
* [ ] Un endpoint API `/api/household/invite` permet de générer le token et de le renvoyer au frontend.
* [ ] Utilisation d'une librairie front-end (ex: `qrcode.react`) pour dessiner le QR Code à l'écran.
* [ ] La page `/join` intercepte le paramètre d'URL `?token=`, vérifie sa validité, et met à jour le `household_id` de l'Utilisateur B.

### 🎟️ TICKET 2.2 : Affichage intelligent des produits selon le Régime/Allergies

**Contexte :** Dans un foyer partagé, tout le monde ne mange pas la même chose. L'interface doit indiquer visuellement si un produit en stock est fait pour la personne qui regarde l'écran.
**User Story :** En tant qu'utilisateur végétarien partageant un frigo avec un omnivore, je veux que la viande apparaisse grisée dans mon inventaire pour ne pas polluer ma vue, tout en sachant qu'elle est en stock pour lui.

**Règles Métier (La logique de couleur) :**

* **Couleur normale :** Le produit correspond au régime de l'utilisateur actif (`SettingsProfile["diet"]`).


* **Grisé (Opacité 50%) :** Le produit contient des ingrédients interdits par le *régime* de l'utilisateur (ex: de la viande pour un profil végétarien).
* **Rouge (Alerte Danger) :** Le produit contient des *allergènes* déclarés par l'utilisateur (ex: Arachide, Gluten).

**Critères d'Acceptation (DoD) :**

* [ ] Le rendu de la carte produit dans `features/inventory/InventoryView.tsx` applique une classe CSS d'opacité conditionnelle en fonction de l'analyse du produit.


* [ ] Le moteur de recherche interne Open Food Facts croise les `allergens_tags` du produit avec les intolérances de l'utilisateur. Si match = Affichage d'un avertissement rouge au moment du scan.
* [ ] Dans la liste de courses (`ShoppingView.tsx`), si un produit a été ajouté par l'Utilisateur B (et ne correspond pas au régime de A), l'initiale ou l'avatar de B apparaît à côté du produit.



---

## 🗂️ ÉPIC 3 : DATA INTELLIGENTE & LISTE DE COURSES

*Exploiter pleinement la base de données Open Food Facts et remplacer les suggestions statiques par un algorithme prédictif.*

### 🎟️ TICKET 3.1 : Extraction de la "Data Cachée" d'Open Food Facts

**Contexte :** L'endpoint de recherche actuel (`searchOpenFoodFactsProducts`) ne récupère que des données basiques (Nutri-Score, nom, image). Nous voulons enrichir l'information écologique et santé.
**User Story :** En tant qu'utilisateur soucieux de ma santé et de l'environnement, je veux voir l'Éco-Score et le niveau de transformation (NOVA) des produits que je scanne.

**Spécifications Techniques (Mapping JSON) :**

* Mettre à jour le type `OpenFoodFactsLookupResult` et la fonction `mapOffProduct` pour extraire les nouvelles clés de l'API OFF :


* `nova_group` (Int entier de 1 à 4).
* `ecoscore_grade` (String de a à e).
* `additives_tags` (Array de strings).



**Critères d'Acceptation (DoD) :**

* [ ] La fiche détail d'un produit (ou la modale d'ajout) affiche un badge de couleur pour l'Éco-Score (Vert foncé pour A, Rouge pour E).
* [ ] La fiche affiche le score NOVA (1 : Brut, 4 : Ultra-transformé).
* [ ] Si la longueur du tableau `additives_tags` est supérieure à 3, un composant d'avertissement UI ("Contient plusieurs additifs") s'affiche.

### 🎟️ TICKET 3.2 : L'Algorithme Prédictif de Liste de Courses (Le Scoring)

**Contexte :** Actuellement, les suggestions de courses sont une liste statique codée en dur (`curatedQueries`). Il faut développer un véritable moteur d'intelligence artificielle basé sur des points.
**User Story :** En tant qu'utilisateur, je veux que l'application me propose d'ajouter à ma liste de courses exactement ce dont j'ai besoin, au moment où j'en ai besoin.

**Règles Métier (Le Moteur de Scoring) :**
Le serveur doit analyser l'inventaire et l'historique, attribuer des points à des produits candidats, et renvoyer les 10 meilleurs au frontend.

1. **Filtre d'exclusion (Score = 0) :** Produit incompatible avec le régime OU produit déjà présent dans l'inventaire en quantité jugée "abondante".
2. **Pilier Historique :** +50 pts pour un produit dont le statut vient de passer à "Terminé" (via la table `activity_events`). +30 pts si le délai habituel de rachat est atteint.


3. **Pilier Santé (Carence) :** +30 pts pour une catégorie d'aliment (ex: viande/lentilles) si l'utilisateur est en déficit de protéines sur les 3 derniers jours.
4. **UX :** Chaque produit renvoyé par l'API doit inclure un champ `reason` (ex: "Produit terminé", "Suggéré pour vos protéines").

**Critères d'Acceptation (DoD) :**

* [ ] Refonte complète de la route `app/api/shopping/suggestions/route.ts` pour implémenter la logique mathématique de scoring décrite ci-dessus.


* [ ] L'interface `ShoppingView.tsx` affiche les suggestions dynamiques, triées par score décroissant, avec la raison visible sous le nom du produit.



---

## 🗂️ ÉPIC 4 : TRACKING SANTÉ & MÉTÉO (Mode Sportif)

*Offrir des outils de suivi morphologique et un ajustement dynamique de l'hydratation basé sur des données externes.*

### 🎟️ TICKET 4.1 : Tracker d'Hydratation & API Open-Meteo

**Contexte :** L'hydratation est cruciale. L'objectif quotidien doit s'adapter à la température extérieure locale sans spammer l'API météo.
**User Story :** En tant qu'utilisateur, je veux suivre ma consommation d'eau facilement, avec un objectif quotidien qui augmente automatiquement s'il fait très chaud.

**Parcours Utilisateur (UX) :**

1. Sur le Dashboard, l'utilisateur voit un composant "Hydratation" (ex: 0L / 2.5L).
2. S'il n'a pas autorisé la géolocalisation, un bouton "Activer la météo" déclenche le "Soft Prompt" (Explication UI puis popup native du navigateur). S'il refuse, une modale permet de taper sa ville manuellement.
3. Pour ajouter de l'eau, il clique sur la jauge. Une "Bottom Sheet" (modale par le bas) s'ouvre avec des boutons rapides : +250ml, +330ml, +500ml, Saisie Libre.

**Logique d'Ajustement Météo :**

* L'objectif de base est fixé dans `SettingsProfile` (ex: 2.5L).
* Le serveur appelle l'API gratuite Open-Meteo une fois le matin (avec cache `next: { revalidate: 21600 }`) pour récupérer la `temperature_2m_max` du jour pour la latitude/longitude donnée.
* Si T° < 25°C = Ajout de 0ml.
* Si T° entre 25°C et 30°C = Ajout de 500ml à l'objectif.
* Si T° > 30°C = Ajout de 1000ml à l'objectif + Apparition d'une icône ☀️ sur la jauge ("Alerte chaleur").

**Critères d'Acceptation (DoD) :**

* [ ] Création du composant UI `HydrationWidget` avec la modale d'ajout rapide intégrée.
* [ ] Création de la route `/api/weather` intégrant le fetch vers Open-Meteo avec la stratégie de cache Next.js.
* [ ] Le quota s'ajuste visuellement en fonction de la réponse de la météo.

### 🎟️ TICKET 4.2 : Historisation du Poids & Recalibrage

**Contexte :** Actuellement, le poids est une simple variable dans les paramètres locaux. Il doit être historisé pour tracer des graphiques et recalibrer les algorithmes.
**User Story :** En tant qu'utilisateur sportif, je veux enregistrer mes pesées régulières pour visualiser mon évolution et que mes besoins caloriques s'ajustent en conséquence.

**Critères d'Acceptation (DoD) :**

* [ ] Création de la table Supabase `weight_logs` (id, user_id, weight_kg, created_at).
* [ ] Création d'un composant `WeightTrendCard` affichant un graphique linéaire (Line chart) de l'évolution du poids, placé dans la page `app/(app)/health/page.tsx`.


* [ ] Lorsqu'une nouvelle pesée est insérée, le système rappelle automatiquement la fonction `calculateBmr` et `calculateTargetCalories` pour mettre à jour la base de référence de l'utilisateur.



### 🎟️ TICKET 4.3 : Le "Macro-Solver" de Fin de Journée

**Contexte :** Aider l'utilisateur sportif à finir sa journée en comblant ses macros sans chercher au hasard dans ses placards.
**User Story :** En tant qu'utilisateur sportif, je veux que l'application me propose une combinaison exacte d'aliments de mon stock pour atteindre mon objectif calorique du soir.

**Critères d'Acceptation (DoD) :**

* [ ] Ajout d'un bouton "Combler mes macros" sur le Dashboard (visible uniquement si `appMode === "athlete"`).


* [ ] L'algorithme calcule le delta entre l'objectif journalier et les calories déjà consommées.
* [ ] L'algorithme filtre les produits de la table `active_inventory_summary` pour trouver une combinaison d'ingrédients (en calculant les grammages) qui correspond au delta (tolérance de +/- 5%).


* [ ] Affichage du résultat sous forme de "Mini-recette générée" (ex: "Prenez 2 œufs + 30g de fromage").

---

## 🗂️ ÉPIC 5 : PRÉVENTION SANTÉ & LE HUB PARTENAIRES (Monétisation)

*Générer des revenus via l'affiliation tout en rendant un immense service de santé préventive à l'utilisateur.*

### 🎟️ TICKET 5.1 : Diagnostic Carentiel Automatisé

**Contexte :** Prévenir les problèmes de santé en détectant les mauvaises habitudes sur une période glissante de 14 jours.
**User Story :** En tant qu'utilisateur, je veux être alerté si mon régime alimentaire récent manque d'un nutriment crucial (Fer, Oméga-3, etc.) pour pouvoir rectifier le tir.

**Logique de Détection :**

* Le script analyse la table `inventory_movements` (actions "consume") sur les 14 derniers jours.


* Il cherche l'absence totale (ou sous-représentation critique) de produits appartenant à des catégories spécifiques :
* *Fibres :* Manque de fruits/légumes frais.
* *Oméga-3 :* Manque de poissons gras, noix, huiles spécifiques.
* *Fer :* Manque de viande rouge, lentilles.


* Si une absence est détectée, une alerte UI s'affiche en haut de l'onglet Santé.

**Critères d'Acceptation (DoD) :**

* [ ] Implémentation du script d'analyse des 14 derniers jours (potentiellement dans la route `/api/health/summary/route.ts`).


* [ ] L'interface affiche une carte "Alerte Équilibre" décrivant le manque détecté de manière pédagogique.
* [ ] La carte propose deux boutons d'action : "Ajouter aux courses" (ajoute des aliments liés à la carence dans la liste) et "Voir les suppléments" (ouvre le Hub Partenaires).

### 🎟️ TICKET 5.2 : Espace "Avantages Membres" (Hub Affiliation)

**Contexte :** Offrir un espace de codes promotionnels qualitatifs pour des compléments alimentaires, intégré comme un club VIP pour générer des revenus d'affiliation.
**User Story :** En tant qu'utilisateur, je veux avoir accès à des réductions sur des produits de santé recommandés par l'application pour combler mes carences ou booster mes performances.

**Critères d'Acceptation (DoD) :**

* [ ] Création d'une table `partners_offers` (id, brand_name, category, description, promo_code, affiliate_url, logo_url).
* [ ] Création d'un composant Modale UI "Club ÉcoFoodStock" affichant les offres sous forme de cartes élégantes, triées par catégories (Vitamines, Protéines, etc.).
* [ ] Au clic sur le bouton d'une offre :
* Le texte du code promo (ex: `ECOFOOD15`) est copié silencieusement dans le presse-papier de l'OS (`navigator.clipboard.writeText`).
* L'utilisateur est redirigé dans un nouvel onglet vers l'URL d'affiliation du partenaire.
 
---

## EPIC UX : EXPERIENCE VISUELLE & ACCESSIBILITE

*Ameliorer l'identite visuelle, le confort d'utilisation et la preparation a une ouverture plus large apres le MVP 1.*

### TICKET UX.1 : Mode sombre configurable

**Priorite :** MVP 2, sauf si la refonte visuelle MVP 1 est terminee plus tot.

**Objectif :** Permettre a l'utilisateur d'activer un theme sombre depuis Parametres > Application, avec memorisation locale puis synchronisation profil plus tard.

**Criteres d'acceptation :**

* [ ] Ajouter un choix clair : clair, sombre, systeme.
* [ ] Adapter les couleurs principales : fond, cartes, textes, navigation, formulaires et alertes.
* [ ] Verifier les contrastes sur mobile et desktop.
* [ ] Persister le choix dans les parametres utilisateur.

### TICKET UX.2 : Internationalisation francais / anglais

**Priorite :** MVP 2.

**Objectif :** Preparer l'application a un mode anglais sans disperser les textes dans les composants.

**Criteres d'acceptation :**

* [ ] Centraliser les libelles d'interface dans un systeme i18n.
* [ ] Ajouter un choix de langue dans Parametres > Application.
* [ ] Traduire les parcours principaux : navigation, auth, onboarding, inventaire, courses, historique, parametres.
* [ ] Garder le francais comme langue par defaut pour le MVP 1.
