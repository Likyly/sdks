# LIKYLY dans les annuaires de Claude et de ChatGPT : dossier de soumission

Un seul serveur pour les deux : `https://mcp.likyly.com` (MCP distant, OAuth : les comptes LIKYLY sur Supabase Auth,
inscription automatique des clients, PKCE). Les assistants connectés par OAuth ont les 29 outils « chat » :
catalogues (import compris), emplacements, intégration, vérifications, statistiques, modèle (pas les recommandations
ni les événements, pas les clés secrètes, pas la facturation ; aucun secret ne passe par la conversation : les
sources créées en chat sont csv_url, json_url ou rest_api sans clé, sans champ `credentials` ni envoi de produits par
`push_items`, réservés au wizard et à la console).

- Claude : portail [claude.ai/directory/manage](https://claude.ai/directory/manage) → **Submit new** → **MCP connector**
  (forfait payant ; depuis son propre compte sur Pro/Max). Guides : [Submit](https://claude.com/docs/connectors/building/submission),
  [Review criteria](https://claude.com/docs/connectors/building/review-criteria).
- ChatGPT : [platform.openai.com/plugins](https://platform.openai.com/plugins) → **Upload new or existing plugin**, paquet
  ZIP (`chatgpt/`). Guides : [Submission](https://developers.openai.com/apps-sdk/deploy/submission),
  [Guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines).

## Où on en est

| Étape | Qui | État |
|---|---|---|
| Serveur HTTPS public, OAuth 2.1 (DCR, PKCE), `WWW-Authenticate` sur 401, métadonnées RFC 9728 | Claude | ✅ |
| Titre et annotations des outils (`readOnlyHint`, `destructiveHint`, `openWorldHint` explicites) | Claude | ✅ |
| Descriptions des outils et des paramètres sans consigne au modèle (aucun autre outil nommé, l’ordre des étapes est dans les instructions du serveur) | Claude | ✅ 2026-11-23 |
| Favicon et icône 512 × 512 (`icon-512.png`, `https://mcp.likyly.com/icon.png`) | Claude | ✅ |
| Test de bout en bout dans Claude (connecteur personnalisé, OAuth, outils) | vous | ✅ 2026-11-23 |
| Test dans ChatGPT avec le compte de démo (OAuth, 5 cas positifs et le cas négatif « clé secrète ») | Claude | ✅ 2026-11-23 : tout passe après ajout de l'outil `search_catalog_items` (ChatGPT devinait l'id d'un livre à partir de son titre) |
| Site en anglais, documentation `https://www.likyly.com/en/docs/mcp` | Claude | ✅ |
| Confidentialité : partie « AI assistants » (fr, en), page support (fr, en), panneau « Assistants connectés » pour retirer l'accès | Claude | ✅ |
| Vérification de chaque outil sur le serveur hébergé (compte de démo) : import d'un catalogue de bout en bout (création, test, aperçu, correspondance des champs, import 20/20, statut, suppression), ce qui est en place (`validate_integration`, santé, derniers événements), statistiques par emplacement et par produit, offre | Claude | ✅ 2026-11-23 ; les statistiques aussi dans ChatGPT (compte principal) |
| Compte de démo `demo@likyly.com` (sans double authentification) : catalogue `books` (20 livres, source « CSV by URL »), emplacements `pdp-you-may-also-like` et `home-for-you` | vous + Claude | ✅ 2026-11-23 |
| Vidéo de démonstration (exigée par OpenAI) : `https://www.likyly.com/video/likyly-in-chatgpt.mp4` (≈ 75 s, vraie session ChatGPT avec le compte de démo : connexion, import du catalogue, blocs, ce que renvoie un bloc, code, création, vérification de l'intégration, statistiques, suppression ; source : likyly-videos/my-video, composition `ChatGptDemo`) | Claude | ✅ 2026-11-23 |
| Vérification d'identité OpenAI (Individual, « Arnaud Breton », comme pour ROMKADE) | vous | déjà faite pour ROMKADE ; vérifier qu'elle vaut pour l'organisation choisie |
| Jeton de vérification du domaine OpenAI → `OPENAI_APPS_CHALLENGE` dans `deploy/compose.yaml`, redéployer | vous + Claude | à la soumission |
| Soumission Claude | vous | à faire |
| Soumission ChatGPT (ZIP, domaine, identifiants des relecteurs) | vous | à faire |

## Compte de démo (les deux annuaires)

Exigences : identifiant + mot de passe, sans double authentification, sans lien magique ni code par e-mail, avec des
données d'exemple, jamais un vrai compte (OpenAI refuse les plugins qui demandent de s'inscrire). Claude demande les
accès par e-mail pendant la revue « Verified » ; OpenAI dans le formulaire **Review details**. Le mot de passe ne
figure nulle part dans ce dépôt (public).

- Adresse : `demo@likyly.com` (alias à créer chez OVH vers la boîte du support).
- Contenu (en place depuis le 2026-11-23, workspace `li_fa6bb43c557f4dd3`, forfait **Pro** pour que les statistiques
  par produit répondent) : un catalogue **books** (20 livres en anglais, CSV par URL publique :
  `https://www.likyly.com/demo-data/books.csv`, images sur le même site) et deux emplacements : **You may also like** (`pdp-you-may-also-like`, fiche produit, contenu similaire,
  4 livres) et **Recommended for you** (`home-for-you`, accueil, auto, 4 livres). Une clé publique de site
  « Demo site » (publique par nature, gardée : la révoquer ferait dire à la santé des emplacements qu'aucun appel
  n'est arrivé depuis) ; aucune clé secrète ni clé développeur active. Les cas de test ci-dessous s'appuient dessus.
- Trafic d'exemple (visites, clics, achats en USD) pour que les statistiques aient des chiffres récents : les fenêtres
  sont de 7 jours (performances) et 30 jours (par produit). **À relancer avant chaque soumission et pendant la revue**
  (ou par une tâche quotidienne) :
  `docker exec -e PYTHONPATH=/srv/application/utils:/srv/application/api recsys-api python /srv/scripts/demo_traffic.py 12`
  (le script refuse tout autre workspace).
- Ne pas changer le mot de passe ni supprimer ces données pendant les revues.

Instructions pour les relecteurs (à coller avec les identifiants) :

> Connect LIKYLY: the assistant opens the LIKYLY sign-in page on www.likyly.com. Sign in with the email and password
> above (not "Continue with Google"), keep the workspace that is selected, then select "Allow". No two-factor
> authentication.
>
> The demo account has a sample catalog of 20 books and two recommendation placements. Write actions
> (creating or changing a placement, importing the catalog) ask for your approval; please don't delete the existing
> placements, other reviewers use them. If you create a placement to test it, please delete it afterwards.

## Fiche Claude (à coller dans le portail, en anglais)

**1. Connection** — Server URL: `https://mcp.likyly.com` (same URL for every user).

**2. Tools** — synced from the server: 29 tools with titles and annotations. Check that no warning shows.

**3. Listing**

- Server name: `LIKYLY`
- One-liner (≤ 200): *Set up and run your store's product recommendations from Claude: catalog import, placements,
  integration code, checks, and performance per placement and per product.*
- Description (≤ 2,000):

> LIKYLY adds personalized product recommendations to an online store or an app ("You may also like", "Recommended
> for you", "Complete your cart") and lets you set them up and run them from a conversation.
>
> Connected to your LIKYLY account, Claude can:
> - Connect a product catalog published at an address (CSV or JSON file, REST API without a key), import it and check
>   the import. Shopify, Magento, WooCommerce and APIs behind a key are connected with the LIKYLY wizard, plugin or app,
>   so no password or key goes through the conversation.
> - Create and tune recommendation placements: the page they appear on, the method (similar content, collaborative,
>   hybrid, browsing session, popular), how many products, and business rules.
> - Check which products a placement returns for a given product or visitor, and why.
> - Give you the integration code for the stack you name (React, Next.js, Vue, Svelte or plain JavaScript) and the
>   events your site should send.
> - Check the integration and each placement's health from the events your site actually sends.
> - Report how your recommendations perform: products shown, clicks, purchases and revenue attributed to them, per
>   placement and per product.
> - Report on the recommendation model: version in production, precision and training history.
>
> In a chat, Claude does not edit your site's code itself: it gives you the code to add, or points you to the LIKYLY
> wizard (npx @likyly/wizard) for Claude Code, the WordPress plugin or the Shopify app. It never sees your secret keys
> or billing details and cannot delete your account. Actions that change what your live site shows are marked as
> such, so you approve each one.
>
> When you connect, you sign in to LIKYLY (or create an account) and choose the one workspace Claude may act on. You
> can remove this access at any time from Claude or from your LIKYLY account (Security page).

- Categories (1 to 5, from the portal's list): Developer tools, E-commerce / Sales, Marketing (pick the closest).
- Documentation URL: `https://www.likyly.com/en/docs/mcp`
- Privacy policy URL: `https://www.likyly.com/en/privacy`
- Support contact: `support@likyly.com` (support page: `https://www.likyly.com/en/support`)
- Icon: `icon-512.png`
- URL slug (permanent): `likyly`
- Allowed link URIs: none (the server doesn't call `ui/open-link`).

**4. Use cases**

> 1. Connect and import a product catalog, then check the import.
> 2. Create or tune a recommendation placement and check what it returns for a given product.
> 3. Get the code to show a placement on a site, and the events to track.
> 4. Check that a site's integration works, then see how each placement and each product performs.
> 5. Review the recommendation model's version, precision and training history.

What users need before connecting: *A LIKYLY account (they can create one during the first connection). To show
recommendations on a site, the site's code must call LIKYLY (the assistant gives the code).*

Reads / writes: **both**.

**5. Company** — LIKYLY (Arnaud Breton, sole proprietor, France) · `https://www.likyly.com/en` · contact: vous.

**6. Authentication** — Required. OAuth 2.0, authorization code + PKCE (S256), dynamic client registration;
authorization server: LIKYLY's account system (Supabase Auth), discovered through
`https://mcp.likyly.com/.well-known/oauth-protected-resource`. No client ID or secret to give Anthropic.

**7. Data handling** — Our own API (`api.likyly.com`). Personal health data: no. Sponsored content: no.

**8. Test & launch** — confirm every tool was run. No credentials in the portal (a reviewer asks for them by e-mail).

**9. Compliance** — the seven acknowledgments. Conversation data: LIKYLY doesn't receive the conversation, only the
tool calls and their parameters (see the privacy page).

## ChatGPT

- Paquet : `chatgpt/` (`plugin.json` : fiche, 6 cas de test positifs, 3 négatifs, vidéo, traduction fr ; `mcp.json` :
  le serveur ; `assets/` : icône et logo 512 × 512). `sh chatgpt/build.sh` valide les deux fichiers avec les schémas
  officiels et construit `chatgpt/likyly-chatgpt.zip` (non versionné).
- Le nom du développeur (`developerName`, `author.name`) doit être celui de l'identité vérifiée chez OpenAI
  (« Arnaud Breton »), pas la marque : c'est ce qui a fait refuser la première version de ROMKADE.
- Pas de captures dans le ZIP (le portail refuse `interface.screenshots`).
- « Importer une archive de plugin » installe le paquet dans Codex, sans OAuth : ça valide le paquet, pas le
  serveur. Le vrai test se fait sur chatgpt.com, mode développeur, serveur personnalisé `https://mcp.likyly.com`.
- Vérification du domaine : le portail donne un jeton ; le mettre dans `OPENAI_APPS_CHALLENGE`
  (`deploy/compose.yaml`), redéployer (`./deploy/deploy.sh`) ; il est servi en texte brut à
  `https://mcp.likyly.com/.well-known/openai-apps-challenge`.
- Identifiants des relecteurs : dans **Review details** seulement (login URL : `https://www.likyly.com/en/login`,
  e-mail et mot de passe du compte de démo, instructions ci-dessus).
